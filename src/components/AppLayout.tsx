import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Button, Drawer, Grid, Menu, Popover, Tooltip } from 'antd'
import { DesktopOutlined, DownOutlined, HomeFilled, MenuOutlined, MobileOutlined, SettingOutlined, TabletOutlined, UserOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
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
  const { session, logout } = useAuth()
  const { storeName, displayMode, setDisplayMode } = usePreferences()
  // Use the viewport only until the user chooses a mode. Phones always keep their mobile layout.
  const mode = displayMode ?? (screens.lg ? 'pc' : 'pad')
  const layoutMode = mobile ? 'mobile' : mode
  const compact = layoutMode === 'pad'
  const modeLabel = mode === 'pad' ? 'PAD模式' : '电脑模式'
  const nextModeLabel = mode === 'pad' ? '电脑模式' : 'PAD模式'
  const user = session?.userInfo
  const displayName = user?.nickname?.trim() || '负责人'
  const menuItems = [{ key: '/', icon: <HomeFilled />, label: <Link to="/" onClick={() => setNavigationOpen(false)}>首页</Link> }]

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
            content={<TopSettingsMenu onDisplaySettings={openDisplaySettings} />}
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
        <Menu mode="inline" inlineCollapsed={compact} selectedKeys={['/']} items={menuItems} />
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
        <nav aria-label="移动端主导航"><Menu selectedKeys={['/']} mode="inline" items={menuItems} /></nav>
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
