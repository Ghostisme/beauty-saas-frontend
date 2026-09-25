import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, DatePicker, Input, Result, Select, Space, Table } from 'antd'
import type { TableColumnsType } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { GoalEmpty } from '@/components/GoalEmpty'
import { useAuth } from '@/context/AuthContext'
import '@/styles/customers.css'

interface EmptyReminderRow { id: string }

const storeOptions = [{ value: 'current', label: '当前门店' }]
const sceneOptions = ['全部', '消费品项目', '顾客生日', '新建顾客', '长期未消费', '手动创建']
const statusOptions = ['全部', '待回访(0)', '已回访(0)', '已作废(0)']
const timeoutOptions = ['全部', '未超时', '已超时']

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="customer-filter-row"><span className="customer-filter-label">{label}：</span><div className="customer-filter-content">{children}</div></div>
}

function ChoiceRow({ label, options }: { label: string; options: string[] }) {
  const [value, setValue] = useState(options[0])
  return <FilterRow label={label}><div className="customer-choice-list">{options.map(option => <button type="button" key={option} className={`customer-choice${value === option ? ' is-active' : ''}`} aria-pressed={value === option} onClick={() => setValue(option)}>{option}</button>)}</div></FilterRow>
}

function VisitDateFilter() {
  return <Space.Compact className="customer-date-filter">
    <Select aria-label="回访时间类型" defaultValue="planned" options={[{ value: 'planned', label: '计划回访时间' }]} />
    <DatePicker.RangePicker aria-label="计划回访时间" placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />
  </Space.Compact>
}

function EmptyReminderTable() {
  const columns: TableColumnsType<EmptyReminderRow> = [
    { title: '顾客信息', key: 'customer', width: 300 },
    { title: '回访场景', key: 'scene', width: 240 },
    { title: '计划回访时间', key: 'plannedAt', width: 260 },
    { title: '回访员工', key: 'employee', width: 220 },
    { title: '状态', key: 'status', width: 140 },
    { title: '操作', key: 'actions', width: 120 },
  ]
  return <div className="customer-panel customer-data-panel customer-reminder-table-panel">
    <Table<EmptyReminderRow> aria-label="顾客回访提醒" rowKey="id" columns={columns} dataSource={[]} pagination={false} scroll={{ x: 1260 }} locale={{ emptyText: null }} />
    <div className="customer-table-state" role="status" aria-label="顾客回访提醒暂无相关数据"><GoalEmpty /><span>暂无相关数据</span></div>
    <div className="customer-table-footer"><span>当前共搜索到0条记录</span></div>
  </div>
}

export default function CustomerReminderPage() {
  const { session, can } = useAuth()
  const navigate = useNavigate()
  if (!session?.userInfo.platformAdmin && !can('home:read')) return <Result status="403" title="暂无顾客回访提醒权限" subTitle="请联系企业管理员分配首页或顾客经营权限。" />
  return <section className="customers-page customer-reminder-page" aria-labelledby="customer-reminder-title">
    <div className="customer-reminder-header customer-panel">
      <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回顾客经营" onClick={() => navigate('/customers')} />
      <h1 id="customer-reminder-title">顾客回访提醒</h1>
    </div>
    <div className="customer-panel customer-filter-panel customer-reminder-filter-panel">
      <div className="customer-filter-toolbar">
        <Select aria-label="回访门店" placeholder="请选择门店" allowClear options={storeOptions} />
        <Space.Compact className="customer-search-combo">
          <Select aria-label="回访员工类型" defaultValue="employee" options={[{ value: 'employee', label: '员工' }, { value: 'store', label: '门店' }]} />
          <Input.Search aria-label="搜索回访员工" placeholder="输入员工姓名/工号" allowClear />
        </Space.Compact>
        <VisitDateFilter />
      </div>
      <ChoiceRow label="回访场景" options={sceneOptions} />
      <ChoiceRow label="回访状态" options={statusOptions} />
      <ChoiceRow label="超时状态" options={timeoutOptions} />
    </div>
    <EmptyReminderTable />
  </section>
}
