import { useMemo, useState } from 'react'
import { App, Button, Collapse, DatePicker, Input, Result, Select, Segmented, Space, Table, Tabs, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { GoalEmpty } from '@/components/GoalEmpty'
import '@/styles/data-reports.css'

type MainReport = 'operating' | 'new-customer' | 'staff' | 'customer' | 'items' | 'liability' | 'center'
const mainReports: Array<{ key: MainReport; label: string }> = [
  { key: 'operating', label: '经营数据表' },
  { key: 'new-customer', label: '新客数据表' },
  { key: 'staff', label: '美容师统计表' },
  { key: 'customer', label: '客户盘点表' },
  { key: 'items', label: '品项卡报表' },
  { key: 'liability', label: '负债报表' },
  { key: 'center', label: '报表中心' },
]

const staffViews = [
  { key: 'summary', label: '美容师数据汇总' },
  { key: 'metrics', label: '美容师数据指标' },
  { key: 'performance', label: '员工工绩汇总' },
  { key: 'commission', label: '员工提成汇总' },
  { key: 'attendance', label: '员工考勤' },
  { key: 'reviews', label: '服务评价' },
]
const customerViews = [{ key: 'inventory', label: '客户盘点' }, { key: 'visits', label: '客户到店动态' }]
const itemViews = [{ key: 'project', label: '项目统计' }, { key: 'product', label: '产品统计' }, { key: 'card', label: '卡统计' }]
const liabilityViews = [{ key: 'customer-summary', label: '顾客汇总' }, { key: 'member-card', label: '会员卡汇总' }]

const zeroRows = [
  { key: 'cash-total', group: '现金', name: '合计' },
  { key: 'cash-base', group: '现金', name: '基础消费' },
  { key: 'cash-partner', group: '现金', name: '合作项目' },
  { key: 'service', group: '实操', name: '实操业绩' },
  { key: 'product-total', group: '产品', name: '合计' },
  { key: 'product-cash', group: '产品', name: '现金购买' },
  { key: 'product-card', group: '产品', name: '卡扣购买' },
]
const newCustomerRows = [
  { key: 'traffic', name: '新客客流' },
  { key: 'headcount', name: '新客人头' },
  { key: 'customers', name: '新客成交人数' },
  { key: 'sales', name: '新客成交业绩' },
  { key: 'rate', name: '新客成交率' },
]

function parseMain(value: string | null): MainReport {
  return mainReports.some(item => item.key === value) ? value as MainReport : 'operating'
}

function isView(value: string | null, views: Array<{ key: string }>): boolean {
  return Boolean(value && views.some(item => item.key === value))
}

function dateColumns(range: [Dayjs, Dayjs], count = 7) {
  const start = range[0]
  const days = Math.min(Math.max(range[1].diff(start, 'day') + 1, 1), count)
  return Array.from({ length: days }, (_, index) => start.add(index, 'day'))
}

function EmptyTable({ columns }: { columns: ColumnsType<Record<string, unknown>> }) {
  return <div className="data-report-table-wrap"><Table<Record<string, unknown>> rowKey="key" columns={columns} dataSource={[]} pagination={false} locale={{ emptyText: <div className="data-report-empty"><GoalEmpty /><span>暂无相关数据</span></div> }} scroll={{ x: 'max-content' }} /></div>
}

function DateFilter({ value, onChange }: { value: [Dayjs, Dayjs]; onChange: (value: [Dayjs, Dayjs]) => void }) {
  return <DatePicker.RangePicker value={value} onChange={dates => { if (dates?.[0] && dates[1]) onChange([dates[0], dates[1]]) }} allowClear={false} />
}

function ReportToolbar({ mode, onModeChange, range, onRangeChange, store = true }: { mode?: 'day' | 'month'; onModeChange?: (value: 'day' | 'month') => void; range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void; store?: boolean }) {
  return <div className="data-report-toolbar">
    {mode && onModeChange && <Segmented aria-label="报表周期" value={mode} onChange={value => onModeChange(value as 'day' | 'month')} options={[{ label: '日维度', value: 'day' }, { label: '月维度', value: 'month' }]} />}
    {store && <Select aria-label="门店" placeholder="请选择门店" style={{ width: 190 }} options={[{ value: 'all', label: '全部门店' }]} defaultValue="all" />}
    <DateFilter value={range} onChange={onRangeChange} />
    <Button icon={<ReloadOutlined />} onClick={() => onRangeChange([dayjs().subtract(6, 'day'), dayjs()])}>重置</Button>
  </div>
}

function MatrixTable({ rows, range, mode }: { rows: Array<{ key: string; name: string; group?: string }>; range: [Dayjs, Dayjs]; mode: 'day' | 'month' }) {
  const dates = dateColumns(range, mode === 'month' ? 6 : 7)
  const columns: ColumnsType<Record<string, unknown>> = [
    { title: '数据项目', dataIndex: 'name', key: 'name', fixed: 'left', width: 150, render: (value: unknown, record: Record<string, unknown>) => <span className="data-report-row-name">{record.group ? <Tag variant="filled">{String(record.group)}</Tag> : null}{String(value ?? '')}</span> },
    ...dates.map(date => ({ title: mode === 'month' ? date.format('YYYY年MM月') : date.format('MM月DD日'), key: date.format('YYYY-MM-DD'), render: () => <span className="data-report-zero">0</span>, width: 112 })),
  ]
  return <div className="data-report-table-wrap"><Table<Record<string, unknown>> rowKey="key" columns={columns} dataSource={rows as Array<Record<string, unknown>>} pagination={false} scroll={{ x: 'max-content' }} /></div>
}

function StaffView({ view, range, onRangeChange }: { view: string; range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  const commonColumns: ColumnsType<Record<string, unknown>> = [
    { title: '员工姓名', dataIndex: 'name', key: 'name' },
    { title: '所属门店', dataIndex: 'store', key: 'store' },
    { title: '服务业绩', dataIndex: 'service', key: 'service' },
    { title: '销售业绩', dataIndex: 'sales', key: 'sales' },
    { title: '消耗业绩', dataIndex: 'consume', key: 'consume' },
    { title: '合计', dataIndex: 'total', key: 'total' },
  ]
  const attendanceColumns: ColumnsType<Record<string, unknown>> = [
    { title: '员工姓名', dataIndex: 'name', key: 'name' },
    { title: '应出勤天数', dataIndex: 'required', key: 'required' },
    { title: '实际出勤天数', dataIndex: 'actual', key: 'actual' },
    { title: '迟到次数', dataIndex: 'late', key: 'late' },
    { title: '请假次数', dataIndex: 'leave', key: 'leave' },
  ]
  return <>
    <ReportToolbar range={range} onRangeChange={onRangeChange} />
    {view === 'performance' || view === 'commission' ? <Table<Record<string, unknown>> rowKey="key" columns={commonColumns} dataSource={[{ key: 1, name: '暂无员工数据', store: '-', service: '0.00', sales: '0.00', consume: '0.00', total: '0.00' }]} pagination={false} scroll={{ x: 720 }} /> : view === 'attendance' ? <Table<Record<string, unknown>> rowKey="key" columns={attendanceColumns} dataSource={[]} pagination={false} locale={{ emptyText: <div className="data-report-empty"><GoalEmpty /><span>暂无考勤数据</span></div> }} scroll={{ x: 680 }} /> : <EmptyTable columns={commonColumns} />}
  </>
}

function FilterPanel({ children }: { children: React.ReactNode }) {
  return <Collapse className="data-report-advanced" ghost items={[{ key: 'filters', label: <span><FilterOutlined /> 更多筛选</span>, children }]} />
}

function ReportCenter({ onExport }: { onExport: () => void }) {
  const reports = ['顾客剩余资产', '员工工绩与提成', '门店流水', '卡消费列表', '订单支付明细']
  return <div className="report-center-grid">{reports.map(name => <article className="report-center-card" key={name}><div><h3>{name}</h3><p>按当前门店和时间范围生成报表</p></div><Button type="primary" ghost icon={<DownloadOutlined />} onClick={onExport}>导出</Button></article>)}</div>
}

export default function DataReportsPage() {
  const { session, can } = useAuth()
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()])
  const [mode, setMode] = useState<'day' | 'month'>('day')
  const main = parseMain(params.get('report'))
  const views = main === 'staff' ? staffViews : main === 'customer' ? customerViews : main === 'items' ? itemViews : main === 'liability' ? liabilityViews : []
  const view = params.get('view') && isView(params.get('view'), views) ? params.get('view')! : views[0]?.key
  const selectMain = (key: string) => { const next = new URLSearchParams(params); next.set('report', key); next.delete('view'); setParams(next) }
  const selectView = (key: string) => { const next = new URLSearchParams(params); next.set('view', key); setParams(next) }
  const rangeLabel = useMemo(() => `${range[0].format('YYYY-MM-DD')} 至 ${range[1].format('YYYY-MM-DD')}`, [range])

  if (!session?.userInfo.platformAdmin && !can('home:read')) return <Result status="403" title="暂无数据报表权限" subTitle="请联系企业管理员分配首页或数据报表查看权限。" />

  return <section className="data-reports-page" aria-labelledby="data-reports-title">
    <div className="data-reports-header">
      <div><h1 id="data-reports-title">数据报表</h1><p>统一查看经营、顾客、员工和资产数据</p></div>
      <Tag color="blue">查询区间：{rangeLabel}</Tag>
    </div>
    <div className="data-reports-nav" role="tablist" aria-label="报表分类">{mainReports.map(item => <button key={item.key} type="button" role="tab" aria-selected={main === item.key} className={main === item.key ? 'is-active' : ''} onClick={() => selectMain(item.key)}>{item.label}</button>)}</div>
    <div className="data-reports-card">
      {views.length > 0 && <Tabs className="data-report-subtabs" activeKey={view} onChange={selectView} items={views.map(item => ({ key: item.key, label: item.label }))} />}
      {main === 'center' && <ReportCenter onExport={() => message.info('报表导出接口待接入')} />}
      {main === 'operating' && <><ReportToolbar mode={mode} onModeChange={setMode} range={range} onRangeChange={setRange} /><FilterPanel><Space wrap><Select placeholder="数据口径" style={{ width: 180 }} options={[{ value: 'all', label: '全部口径' }, { value: 'cash', label: '现金' }, { value: 'consume', label: '消耗' }]} /><Select placeholder="展示门店" style={{ width: 180 }} options={[{ value: 'all', label: '全部门店' }]} /></Space></FilterPanel><MatrixTable rows={zeroRows} range={range} mode={mode} /></>}
      {main === 'new-customer' && <><ReportToolbar mode={mode} onModeChange={setMode} range={range} onRangeChange={setRange} /><FilterPanel><Space wrap><Select placeholder="新客来源" style={{ width: 180 }} options={[{ value: 'all', label: '全部来源' }]} /><Select placeholder="统计门店" style={{ width: 180 }} options={[{ value: 'all', label: '全部门店' }]} /></Space></FilterPanel><MatrixTable rows={newCustomerRows} range={range} mode={mode} /></>}
      {main === 'staff' && <StaffView view={view ?? 'summary'} range={range} onRangeChange={setRange} />}
      {main === 'customer' && <><div className="data-report-inline-filters"><Select placeholder="年份" defaultValue="current" options={[{ value: 'current', label: dayjs().format('YYYY年') }]} /><Select placeholder="请选择门店" options={[{ value: 'all', label: '全部门店' }]} /><Input placeholder="输入顾客姓名/手机号/编号" /></div><FilterPanel><Space wrap><Select placeholder="客户来源" style={{ width: 180 }} options={[{ value: 'all', label: '全部来源' }]} /><Input placeholder="顾客标签" style={{ width: 220 }} /></Space></FilterPanel>{view === 'visits' ? <EmptyTable columns={[{ title: '顾客信息', dataIndex: 'customer', key: 'customer' }, { title: '到店次数', dataIndex: 'visits', key: 'visits' }, { title: '最近到店时间', dataIndex: 'lastVisit', key: 'lastVisit' }, { title: '操作', key: 'actions', render: () => <Button type="link">查看详情</Button> }]} /> : <EmptyTable columns={[{ title: '顾客信息', dataIndex: 'customer', key: 'customer' }, { title: '顾客资产', dataIndex: 'asset', key: 'asset' }, { title: '累计消费', dataIndex: 'spent', key: 'spent' }, { title: '上次消费信息', dataIndex: 'last', key: 'last' }, { title: '操作', key: 'actions', render: () => <Button type="link">详情</Button> }]} />}</>}
      {main === 'items' && <><ReportToolbar range={range} onRangeChange={setRange} /><FilterPanel><Space wrap><Select placeholder="品项分类" style={{ width: 180 }} options={[{ value: 'all', label: '全部分类' }]} /><Input placeholder="输入项目或产品名称" style={{ width: 240 }} /></Space></FilterPanel><EmptyTable columns={[{ title: '品项名称', dataIndex: 'name', key: 'name' }, { title: '所属门店', dataIndex: 'store', key: 'store' }, { title: '销售数量', dataIndex: 'quantity', key: 'quantity' }, { title: '销售金额', dataIndex: 'amount', key: 'amount' }, { title: '操作', key: 'actions', render: () => <Button type="link">查看明细</Button> }]} /></>}
      {main === 'liability' && <><div className="data-report-inline-filters"><Select placeholder="统计范围" defaultValue="all" options={[{ value: 'all', label: '全部顾客' }, { value: 'active', label: '有效顾客' }]} /><Select placeholder="请选择门店" options={[{ value: 'all', label: '全部门店' }]} /><Input placeholder="输入顾客姓名/手机号" /></div><FilterPanel><Space wrap><Select placeholder="资产类型" style={{ width: 180 }} options={[{ value: 'all', label: '全部资产' }, { value: 'card', label: '会员卡' }, { value: 'product', label: '产品' }]} /><Input placeholder="最低余额" style={{ width: 160 }} /></Space></FilterPanel><EmptyTable columns={[{ title: '顾客信息', dataIndex: 'customer', key: 'customer' }, { title: '资产名称', dataIndex: 'asset', key: 'asset' }, { title: '剩余次数', dataIndex: 'count', key: 'count' }, { title: '剩余金额', dataIndex: 'amount', key: 'amount' }, { title: '所属门店', dataIndex: 'store', key: 'store' }]} /></>}
    </div>
  </section>
}
