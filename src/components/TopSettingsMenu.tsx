import { App, Divider } from 'antd'
import type { ReactNode } from 'react'
import { AppstoreOutlined, FundOutlined, SettingOutlined, ShopOutlined, TeamOutlined } from '@ant-design/icons'

interface SettingsItem {
  key: string
  label: string
}

interface SettingsGroup {
  key: string
  title: string
  icon: ReactNode
  items: SettingsItem[]
}

const settingsGroups: SettingsGroup[] = [
  {
    key: 'merchant',
    title: '商户基础信息设置',
    icon: <ShopOutlined />,
    items: [
      { key: 'stores', label: '门店管理' },
      { key: 'rooms', label: '房间管理' },
    ],
  },
  {
    key: 'application',
    title: '应用配置管理',
    icon: <SettingOutlined />,
    items: [
      { key: 'permissions', label: '系统权限' },
      { key: 'cashier', label: '收银设置' },
      { key: 'authorization', label: '授权管理' },
      { key: 'customers', label: '顾客设置' },
      { key: 'income-expense', label: '收支设置' },
      { key: 'advanced', label: '高级配置' },
    ],
  },
  {
    key: 'items',
    title: '品项管理',
    icon: <AppstoreOutlined />,
    items: [
      { key: 'store-products', label: '门店产品' },
      { key: 'services', label: '服务项目' },
      { key: 'cards', label: '会员卡' },
      { key: 'coupons', label: '券' },
      { key: 'categories', label: '类别设置' },
      { key: 'price-templates', label: '价格模板' },
    ],
  },
  {
    key: 'staff',
    title: '门店员工管理',
    icon: <TeamOutlined />,
    items: [
      { key: 'staff-list', label: '员工列表' },
      { key: 'positions', label: '职位管理' },
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
    items: [
      { key: 'service-commission', label: '项目提成' },
      { key: 'product-commission', label: '产品提成' },
      { key: 'card-commission', label: '卡提成' },
      { key: 'tiered-commission', label: '阶梯提成' },
    ],
  },
]

interface TopSettingsMenuProps {
  onDisplaySettings: () => void
}

export function TopSettingsMenu({ onDisplaySettings }: TopSettingsMenuProps) {
  const { message } = App.useApp()

  function showPlaceholder(label: string) {
    void message.info(`${label}功能将在后续模块接入`)
  }

  return (
    <div className="top-settings-menu" role="menu" aria-label="设置菜单">
      <div className="top-settings-heading">
        <SettingOutlined aria-hidden />
        <span>设置</span>
      </div>
      {settingsGroups.map(group => (
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
                onClick={() => showPlaceholder(item.label)}
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
