import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Button, Drawer, Grid, Menu, Popover, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { AppstoreOutlined, BankOutlined, BarChartOutlined, CalendarOutlined, DatabaseOutlined, DesktopOutlined, DownOutlined, FileTextOutlined, FundOutlined, HomeFilled, MenuOutlined, MessageOutlined, MobileOutlined, SettingOutlined, ShopOutlined, TabletOutlined, TeamOutlined, UserOutlined, UsergroupAddOutlined, InboxOutlined } from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/context/PreferencesContext'
import { SettingsDrawer } from '@/components/SettingsDrawer'
import { AccountMenu } from '@/components/AccountMenu'
import { AppFooter } from '@/components/AppFooter'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import { TopSettingsMenu } from '@/components/TopSettingsMenu'
import { APP_NAME } from '@/config/app'

export function AppLayout({ children }: { children: ReactNode }) {
  const screens = Grid.useBreakpoint()
  const mobile = !screens.md
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const { session, logout, can } = useAuth()
  const location = useLocation()
  const { storeName, displayMode, setDisplayMode } = usePreferences()
  // Use the viewport only until the user chooses a mode. Phones always keep their mobile layout.
  const mode = displayMode ?? (screens.lg ? 'pc' : 'pad')
  const layoutMode = mobile ? 'mobile' : mode
  const compact = layoutMode === 'pad'
  const modeLabel = mode === 'pad' ? 'PAD模式' : '电脑模式'
  const nextModeLabel = mode === 'pad' ? '电脑模式' : 'PAD模式'
  const locationParams = new URLSearchParams(location.search)
  const selectedNavigationKey = location.pathname === '/customer-reminders'
    ? '/customers'
    : location.pathname === '/store-management'
      ? locationParams.get('tab') === 'rooms' ? '/store-management/rooms' : '/store-management/departments'
      : location.pathname
  const user = session?.userInfo
  const displayName = user?.nickname?.trim() || '负责人'
  const canManage = ['tenant:read', 'users:read', 'departments:read', 'rooms:read', 'roles:read'].some(can)
  const canCustomerModule = user?.platformAdmin || can('home:read')
  const canOrdersModule = user?.platformAdmin || can('orders:read')
  const canAppointmentModule = user?.platformAdmin || can('home:read')
  const canDataReports = user?.platformAdmin || can('home:read')
  const canInventory = user?.platformAdmin || can('inventory:read')
  const canStoreSettings = user?.platformAdmin || ['departments:read', 'rooms:read'].some(can)
  const canStaffSettings = user?.platformAdmin || can('users:read')
  const canItemsSettings = user?.platformAdmin || can('items:read')
  const canCommissionSettings = user?.platformAdmin || can('commissions:read')
  const settingsMenuItems = [
    ...(canStoreSettings ? [
      ...(user?.platformAdmin || can('departments:read') ? [{ key: '/store-management/departments', icon: <ShopOutlined />, label: <Link to="/store-management?tab=departments" onClick={() => setNavigationOpen(false)}>门店管理</Link> }] : []),
      ...(user?.platformAdmin || can('rooms:read') ? [{ key: '/store-management/rooms', icon: <ShopOutlined />, label: <Link to="/store-management?tab=rooms" onClick={() => setNavigationOpen(false)}>房间管理</Link> }] : []),
    ] : []),
    ...(canItemsSettings ? [{ key: '/items', icon: <AppstoreOutlined />, label: <Link to="/items?kind=PROJECT" onClick={() => setNavigationOpen(false)}>品项管理</Link> }] : []),
    ...(canStaffSettings ? [{ key: '/staff-management', icon: <TeamOutlined />, label: <Link to="/staff-management?tab=users" onClick={() => setNavigationOpen(false)}>门店员工管理</Link> }] : []),
    ...(canCommissionSettings ? [{ key: '/commissions', icon: <FundOutlined />, label: <Link to="/commissions?kind=PROJECT" onClick={() => setNavigationOpen(false)}>提成管理</Link> }] : []),
  ]
  const menuItems: MenuProps['items'] = [
    ...(user?.platformAdmin
      ? [{ key: '/platform/tenants', icon: <BankOutlined />, label: <Link to="/platform/tenants" onClick={() => setNavigationOpen(false)}>企业管理</Link> }]
      : [{ key: '/', icon: <HomeFilled />, label: <Link to="/" onClick={() => setNavigationOpen(false)}>首页</Link> }]),
    ...(canManage ? [{ key: 'system-management', type: 'group' as const, label: '系统管理', children: [
      { key: '/user-management', icon: <TeamOutlined />, label: <Link to="/user-management" onClick={() => setNavigationOpen(false)}>用户管理</Link> },
    ] }] : []),
    ...(canCustomerModule || canOrdersModule ? [{ key: 'customer-operations', type: 'group' as const, label: '顾客经营', children: [
      ...(canCustomerModule ? [{ key: '/customers', icon: <UsergroupAddOutlined />, label: <Link to="/customers" onClick={() => setNavigationOpen(false)}>顾客</Link> }] : []),
      ...(canOrdersModule ? [{ key: '/orders', icon: <FileTextOutlined />, label: <Link to="/orders" onClick={() => setNavigationOpen(false)}>订单管理</Link> }] : []),
      ...(canAppointmentModule ? [{ key: '/appointments', icon: <CalendarOutlined />, label: <Link to="/appointments" onClick={() => setNavigationOpen(false)}>预约</Link> }] : []),
    ] }] : []),
    ...(canDataReports ? [{ key: 'data-reports', icon: <DatabaseOutlined />, label: '数据', children: [
      { key: '/data-reports', icon: <BarChartOutlined />, label: <Link to="/data-reports" onClick={() => setNavigationOpen(false)}>数据报表</Link> },
    ] }] : []),
    ...(user?.platformAdmin || ['sms-settings:read', 'sms-records:read', 'sms-billing:read'].some(can) ? [{ key: 'acquisition-tools', type: 'group' as const, label: '拓客工具', children: [{ key: '/sms', icon: <MessageOutlined />, label: <Link to="/sms" onClick={() => setNavigationOpen(false)}>短信</Link> }] }] : []),
    ...(canInventory ? [{ key: 'business-management', type: 'group' as const, label: '业务管理', children: [
      { key: '/inventory', icon: <InboxOutlined />, label: <Link to="/inventory" onClick={() => setNavigationOpen(false)}>库存管理</Link> },
    ] }] : []),
    ...(settingsMenuItems.length ? [{ key: 'settings-management', type: 'group' as const, label: '设置', children: settingsMenuItems }] : []),
  ]

  function openDisplaySettings() {
    setSettingsOpen(false)
    setDisplaySettingsOpen(true)
  }

  function openPasswordDialog() {
    setAccountOpen(false)
    setPasswordOpen(true)
  }

  function handleLogout() {
    setAccountOpen(false)
    logout()
  }

  function toggleDisplayMode() {
    setDisplayMode(mode === 'pad' ? 'pc' : 'pad')
    setSettingsOpen(false)
    setAccountOpen(false)
  }

  return (
    <div className="workspace" data-layout-mode={layoutMode}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="workspace-header">
        <div className="header-brand">
          {mobile && <Button type="text" icon={<MenuOutlined />} aria-label="打开导航" onClick={() => setNavigationOpen(true)} />}
          <span className="brand-mark" aria-hidden>余</span>
          <span className="store-name" title={storeName}>{storeName}</span>
        </div>
        <div className="header-actions">
          <Popover
            trigger="click"
            placement="bottomRight"
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            content={<TopSettingsMenu onDisplaySettings={openDisplaySettings} onNavigate={() => setSettingsOpen(false)} />}
            classNames={{ root: 'top-settings-popover' }}
            align={mobile ? { offset: [54, 0] } : undefined}
          >
            <Tooltip title="设置">
              <Button type="text" className="settings-button" icon={<SettingOutlined />} aria-label="设置" aria-haspopup="menu" aria-expanded={settingsOpen} />
            </Tooltip>
          </Popover>
          <span className="header-divider" aria-hidden />
          <Popover
            trigger={['click']}
            placement="bottomRight"
            open={accountOpen}
            onOpenChange={setAccountOpen}
            content={<AccountMenu user={user} onChangePassword={openPasswordDialog} onLogout={handleLogout} />}
            classNames={{ root: 'account-popover' }}
          >
            <button type="button" className="user-button" aria-label="登录信息" aria-haspopup="menu" aria-expanded={accountOpen}>
              <Avatar size={30} className="user-avatar" icon={<UserOutlined />} />
              <span className="user-name">{displayName}</span>
              <DownOutlined className="user-chevron" />
            </button>
          </Popover>
        </div>
      </header>

      <aside className="workspace-sidebar" aria-label="主导航">
        <Menu mode="inline" inlineCollapsed={compact} defaultOpenKeys={['system-management', 'customer-operations', 'data-reports', 'acquisition-tools', 'business-management', 'settings-management']} selectedKeys={[selectedNavigationKey]} items={menuItems} />
        <button
          type="button"
          className="device-mode"
          onClick={toggleDisplayMode}
          aria-label={modeLabel}
          aria-pressed={mode === 'pad'}
          title={`切换为${nextModeLabel}`}
        >
          {mode === 'pad' ? <TabletOutlined aria-hidden /> : <DesktopOutlined aria-hidden />}
          <span>{modeLabel}</span>
        </button>
      </aside>

      <Drawer
        title={APP_NAME}
        placement="left"
        size={240}
        open={mobile && navigationOpen}
        onClose={() => setNavigationOpen(false)}
        className="navigation-drawer"
      >
        <nav aria-label="移动端主导航"><Menu selectedKeys={[selectedNavigationKey]} defaultOpenKeys={['system-management', 'customer-operations', 'data-reports', 'acquisition-tools', 'business-management', 'settings-management']} mode="inline" items={menuItems} /></nav>
        <div className="mobile-mode"><MobileOutlined /> 移动模式</div>
      </Drawer>

      <div className="workspace-body">
        <main id="main-content" className="workspace-content">{children}</main>
        <AppFooter />
      </div>
      <SettingsDrawer open={displaySettingsOpen} onClose={() => setDisplaySettingsOpen(false)} />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
