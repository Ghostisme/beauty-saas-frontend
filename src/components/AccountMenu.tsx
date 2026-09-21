import { Avatar } from 'antd'
import { LockOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import type { UserInfo } from '@/types/auth'

interface AccountMenuProps {
  user?: UserInfo
  onChangePassword: () => void
  onLogout: () => void
}

export function AccountMenu({ user, onChangePassword, onLogout }: AccountMenuProps) {
  const displayName = user?.nickname?.trim() || '负责人'
  const accountLabel = user?.phone?.trim() || `账号：${user?.username || '未登录'}`

  return (
    <div className="account-popover-content" role="menu" aria-label="账号菜单">
      <div className="account-summary">
        <Avatar size={42} src={user?.avatar || undefined} className="account-summary-avatar" icon={<UserOutlined />} />
        <div className="account-summary-text">
          <strong>{displayName}</strong>
          <span>{accountLabel}</span>
        </div>
      </div>
      <div className="account-menu-actions">
        <button type="button" role="menuitem" className="account-menu-action" onClick={onChangePassword}>
          <LockOutlined aria-hidden />
          <span>修改密码</span>
        </button>
        <button type="button" role="menuitem" aria-label="退出登录" className="account-menu-action account-menu-logout" onClick={onLogout}>
          <LogoutOutlined aria-hidden />
          <span>退出</span>
        </button>
      </div>
    </div>
  )
}
