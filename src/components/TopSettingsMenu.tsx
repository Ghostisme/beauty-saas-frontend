import { App, Divider } from 'antd'
import type { ReactNode } from 'react'
import { AppstoreOutlined, FundOutlined, SettingOutlined, ShopOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface SettingsItem {
  key: string
  label: string
  route?: string
  permission?: string
}

interface SettingsGroup {
  key: string
  title: string
  icon: ReactNode
  items: SettingsItem[]
  permission?: string
}

const settingsGroups: SettingsGroup[] = [
  {
    key: 'merchant',
    title: '商户基础信息设置',
    icon: <ShopOutlined />,
    items: [
      { key: 'stores', label: '门店管理', route: '/store-management?tab=departments' },
      { key: 'rooms', label: '房间管理', route: '/store-management?tab=rooms' },
    ],
  },
  {
    key: 'application',
    title: '应用配置管理',
    icon: <SettingOutlined />,
    items: [
      { key: 'permissions', label: '系统权限' },
      { key: 'cashier', label: '收银设置', route: '/billing' },
      { key: 'authorization', label: '授权管理' },
      { key: 'customers', label: '顾客设置' },
      { key: 'income-expense', label: '收支设置', route: '/bookkeeping' },
      { key: 'advanced', label: '高级配置' },
    ],
  },
  {
    key: 'items',
    title: '品项管理',
    icon: <AppstoreOutlined />,
    permission: 'items:read',
    items: [
      { key: 'store-products', label: '门店产品', route: '/items?kind=PRODUCT', permission: 'items:read' },
      { key: 'services', label: '服务项目', route: '/items?kind=PROJECT', permission: 'items:read' },
      { key: 'cards', label: '会员卡', route: '/items?kind=CARD', permission: 'items:read' },
    ],
  },
  {
    key: 'staff',
    title: '门店员工管理',
    icon: <TeamOutlined />,
    items: [
      { key: 'staff-list', label: '员工列表', route: '/staff-management?tab=users' },
      { key: 'positions', label: '职位管理', route: '/user-management?tab=roles', permission: 'roles:read' },
      { key: 'schedules', label: '员工排班' },
      { key: 'sop', label: 'SOP自检' },
      { key: 'attendance', label: '考勤打卡' },
      { key: 'points', label: '员工积分' },
    ],
  },
  {
    key: 'commission',
    title: '提成管理',
    icon: <FundOutlined />,
    permission: 'commissions:read',
    items: [
      { key: 'service-commission', label: '项目提成', route: '/commissions?kind=PROJECT', permission: 'commissions:read' },
      { key: 'product-commission', label: '产品提成', route: '/commissions?kind=PRODUCT', permission: 'commissions:read' },
      { key: 'card-commission', label: '卡提成', route: '/commissions?kind=CARD', permission: 'commissions:read' },
      { key: 'tiered-commission', label: '阶梯提成', route: '/commissions?kind=STEP', permission: 'commissions:read' },
    ],
  },
]

interface TopSettingsMenuProps {
  onDisplaySettings: () => void
  onNavigate: () => void
}

export function TopSettingsMenu({ onDisplaySettings, onNavigate }: TopSettingsMenuProps) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { can, session } = useAuth()
  const platform = session?.userInfo.platformAdmin ?? false
  const visibleGroups = settingsGroups.filter(group => !group.permission || platform || can(group.permission))
  const managementTabs: Record<string, string> = { permissions: 'roles', authorization: 'roles' }

  function openItem(item: SettingsItem) {
    if (item.route) {
      if (!platform && item.permission && !can(item.permission)) { void message.warning('暂无访问权限，请联系企业管理员'); return }
      const [path, query = ''] = item.route.split('?')
      const target = new URLSearchParams(query)
      const tenantId = platform ? params.get('tenantId') : null
      if (tenantId) target.set('tenantId', tenantId)
      onNavigate()
      navigate(`${path}${target.size ? `?${target}` : ''}`)
      return
    }
    const tab = managementTabs[item.key]
    if (!tab) { void message.info(`${item.label}功能将在后续模块接入`); return }
    if (!can(`${tab}:read`)) { void message.warning('暂无访问权限，请联系企业管理员'); return }
    onNavigate()
    navigate(`/user-management?tab=${tab}`)
  }

  return (
    <div className="top-settings-menu" role="menu" aria-label="设置菜单">
      <div className="top-settings-heading">
        <SettingOutlined aria-hidden />
        <span>设置</span>
      </div>
      {visibleGroups.map(group => (
        <section className="settings-group" key={group.key}>
          <h2 className="settings-group-title">
            <span className="settings-group-icon" aria-hidden>{group.icon}</span>
            <span>{group.title}</span>
          </h2>
          <div className="settings-group-items">
            {group.items.map(item => (
              <button
                className="settings-group-item"
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => openItem(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      ))}
      <Divider className="top-settings-divider" />
      <button className="settings-display-item" type="button" role="menuitem" onClick={onDisplaySettings}>
        <SettingOutlined aria-hidden />
        <span>显示设置</span>
      </button>
    </div>
  )
}
