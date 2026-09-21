import { useState } from 'react'
import type { ComponentType } from 'react'
import { Button, DatePicker, Empty, Modal, Radio, Select, Statistic, Tooltip } from 'antd'
import { BellFilled, ClockCircleFilled, ExclamationCircleFilled, GiftFilled, InfoCircleFilled, SafetyCertificateFilled, ShopOutlined, UserOutlined, WalletFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { GoalEmpty } from '@/components/GoalEmpty'
import { usePreferences } from '@/context/PreferencesContext'

type Period = 'today' | 'week' | 'month' | 'custom'
type DateRange = [Dayjs, Dayjs]
interface Reminder {
  key: string
  label: string
  icon: ComponentType
  color: string
}
const reminders: Reminder[] = [
  { key: 'birthday', label: '顾客生日', icon: GiftFilled, color: '#d89614' },
  { key: 'followup', label: '顾客回访提醒', icon: UserOutlined, color: '#36b3a8' },
  { key: 'booking', label: '待确认预约', icon: ClockCircleFilled, color: '#52c41a' },
  { key: 'absent', label: '持卡顾客7–100天未到店', icon: SafetyCertificateFilled, color: '#faad14' },
  { key: 'expiry', label: '会员卡到期', icon: ExclamationCircleFilled, color: '#597ef7' },
  { key: 'balance', label: '充值提醒', icon: WalletFilled, color: '#4096ff' },
  { key: 'stock', label: '库存预警', icon: BellFilled, color: '#ff4d4f' },
]
const metrics = [
  { name: '现金', unit: '元', hint: '统计所选时间范围内的现金收入' },
  { name: '实操', unit: '元' },
  { name: '产品', unit: '元' },
  { name: '客流', unit: '人' },
  { name: '人头', unit: '人' },
  { name: '项目数', unit: '个' },
]

function rangeFor(period: Exclude<Period, 'custom'>): DateRange {
  const end = dayjs().startOf('day')
  return [end.subtract(period === 'today' ? 0 : period === 'week' ? 6 : 29, 'day'), end]
}

export default function HomePage() {
  const { storeName } = usePreferences()
  const [scope, setScope] = useState('mine')
  const [period, setPeriod] = useState<Period>('week')
  const [range, setRange] = useState<DateRange>(() => rangeFor('week'))
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null)

  function changePeriod(value: Period) {
    setPeriod(value)
    if (value !== 'custom') setRange(rangeFor(value))
  }

  return (
    <div className="home-page">
      <h1 className="visually-hidden">首页</h1>
      <section className="reminder-bar" aria-label="门店提醒">
        {reminders.map(({ icon: Icon, ...item }) => (
          <button key={item.key} className="reminder-item" onClick={() => setActiveReminder({ ...item, icon: Icon })}>
            <span className="reminder-icon" aria-hidden="true" style={{ backgroundColor: item.color }}><Icon /></span>
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <section className="dashboard-panel goals-panel" aria-labelledby="goals-title">
        <div className="panel-header">
          <div className="panel-heading">
            <h2 id="goals-title">本月目标</h2>
            <span className="panel-date">{dayjs().format('YYYY年MM月')}</span>
          </div>
          <Radio.Group
            aria-label="目标范围"
            value={scope}
            onChange={(event) => setScope(event.target.value as string)}
            optionType="button"
            buttonStyle="solid"
            size="small"
            options={[{ label: '门店', value: 'store' }, { label: '我的', value: 'mine' }]}
          />
        </div>
        <div className="goals-empty" role="status" aria-label={scope === 'store' ? '门店本月暂无目标数据' : '我的本月暂无目标数据'}>
          <GoalEmpty />
          <span>暂无相关数据</span>
        </div>
      </section>

      <section className="dashboard-panel performance-panel" aria-labelledby="performance-title">
        <div className="panel-header performance-header">
          <div className="panel-heading">
            <h2 id="performance-title">业绩概览</h2>
            <span className="panel-date" data-testid="performance-date">
              {range[0].format('YYYY年MM月DD日')} - {range[1].format('YYYY年MM月DD日')}
            </span>
          </div>
          <div className="performance-filters">
            <Radio.Group
              aria-label="业绩日期范围"
              value={period}
              onChange={(event) => changePeriod(event.target.value as Period)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={[
                { label: '今天', value: 'today' },
                { label: '近7天', value: 'week' },
                { label: '近30天', value: 'month' },
                { label: '自定义', value: 'custom' },
              ]}
            />
            <Select
              aria-label="门店"
              className="store-select"
              value="current"
              size="small"
              suffixIcon={<ShopOutlined />}
              options={[{ value: 'current', label: storeName }]}
            />
          </div>
        </div>
        {period === 'custom' && <div className="custom-date-row">
          <span>选择日期</span>
          <DatePicker.RangePicker
            allowClear={false}
            value={range}
            onChange={(dates) => { if (dates?.[0] && dates[1]) setRange([dates[0], dates[1]]) }}
            disabledDate={(current) => current.isAfter(dayjs(), 'day')}
            inputReadOnly
            format="YYYY-MM-DD"
            aria-label="自定义日期范围"
            classNames={{ popup: { root: 'responsive-range-popup' } }}
          />
        </div>}
        <div className="metrics-grid">
          {metrics.map((metric) => (
            <div className="metric" key={metric.name}>
              <div className="metric-label">
                {metric.name}
                {metric.hint && <Tooltip title={metric.hint}>
                  <button type="button" className="metric-info" aria-label="现金统计说明"><InfoCircleFilled /></button>
                </Tooltip>}
              </div>
              <Statistic value={0} suffix={metric.unit} />
              <div className="metric-comparison"><span>环比</span><span className="comparison-value">0%</span></div>
            </div>
          ))}
        </div>
      </section>

      <Modal
        title={activeReminder?.label}
        open={activeReminder !== null}
        onCancel={() => setActiveReminder(null)}
        footer={<Button type="primary" onClick={() => setActiveReminder(null)}>知道了</Button>}
        centered
      >
        <div className="reminder-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="提醒服务尚未开通" /></div>
      </Modal>
    </div>
  )
}
