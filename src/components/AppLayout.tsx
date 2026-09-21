import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Button, Drawer, Dropdown, Grid, Menu, Tooltip } from 'antd'
import { DesktopOutlined, DownOutlined, HomeFilled, LogoutOutlined, MenuOutlined, MobileOutlined, SettingOutlined, TabletOutlined, UserOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/context/PreferencesContext'
import { SettingsDrawer } from '@/components/SettingsDrawer'
import { AppFooter } from '@/components/AppFooter'
import { APP_NAME } from '@/config/app'

export function AppLayout({ children }: { children: ReactNode }) {
  const screens = Grid.useBreakpoint()
  const mobile = !screens.md
  const compact = !screens.lg
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { session, logout } = useAuth()
  const { storeName } = usePreferences()
  const user = session?.userInfo
  const displayName = user?.username || '当前用户'
  const menuItems = [{ key: '/', icon: <HomeFilled />, label: <Link to="/" onClick={() => setNavigationOpen(false)}>首页</Link> }]

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="workspace-header">
        <div className="header-brand">
          {mobile && <Button type="text" icon={<MenuOutlined />} aria-label="打开导航" onClick={() => setNavigationOpen(true)} />}
          <span className="brand-mark" aria-hidden>余</span>
          <span className="store-name" title={storeName}>{storeName}</span>
        </div>
        <div className="header-actions">
          <Tooltip title="设置">
            <Button type="text" className="settings-button" icon={<SettingOutlined />} aria-label="设置" onClick={() => setSettingsOpen(true)} />
          </Tooltip>
          <span className="header-divider" aria-hidden />
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'account', label: <div className="account-menu-info"><strong>{displayName}</strong><span>账号：{user?.username}</span></div>, disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout },
              ],
            }}
          >
            <button type="button" className="user-button" aria-label="登录信息" aria-haspopup="menu">
              <Avatar size={30} className="user-avatar" icon={<UserOutlined />} />
              <span className="user-name">{displayName}</span>
              <DownOutlined className="user-chevron" />
            </button>
          </Dropdown>
        </div>
      </header>

      <aside className="workspace-sidebar" aria-label="主导航">
        <Menu mode="inline" inlineCollapsed={compact} selectedKeys={['/']} items={menuItems} />
        <div className="device-mode">
          {compact ? <TabletOutlined /> : <DesktopOutlined />}
          {!compact && <span>电脑模式</span>}
        </div>
      </aside>

      <Drawer
        title={APP_NAME}
        placement="left"
        size={240}
        open={mobile && navigationOpen}
        onClose={() => setNavigationOpen(false)}
        className="navigation-drawer"
      >
        <nav aria-label="移动端主导航"><Menu selectedKeys={['/']} mode="inline" items={menuItems} /></nav>
        <div className="mobile-mode"><MobileOutlined /> 移动模式</div>
      </Drawer>

      <div className="workspace-body">
        <main id="main-content" className="workspace-content">{children}</main>
        <AppFooter />
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
