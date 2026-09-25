import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { App, Button, DatePicker, Input, InputNumber, Result, Select, Segmented, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { GoalEmpty } from '@/components/GoalEmpty'
import { downloadReportTable } from '@/lib/reportCsv'
import '@/styles/data-reports.css'

type MainReport = 'operating' | 'new-customer' | 'staff' | 'customer' | 'items' | 'liability' | 'center'
type MatrixReport = 'operating' | 'new-customer' | 'staff-summary'
type MatrixPeriod = { mode: 'day' | 'month'; range: [Dayjs, Dayjs] }
type ReportRow = { key: string; group?: string; metric?: string; money?: boolean; [key: string]: ReactNode }

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

const operatingRows = [
  ['现金', '合计', true], ['现金', '基础', true], ['现金', '合作', true],
  ['实操', '合计', true],
  ['产品', '现金', true], ['产品', '卡扣', true],
  ['', '实耗', true], ['', '项目数', false], ['', '人头', false], ['', '到店人数', false],
  ['', '会员客流', false], ['', '散客客流', false], ['', '平均客单价', true], ['', '平均项目单价', true],
  ['', '平均项目数', false], ['', '平均到店率', false],
].map(([group, metric, money], index) => ({ key: `operating-${index}`, group: String(group), metric: String(metric), money: Boolean(money) }))
const newCustomerRows = [
  ['新客客流', false], ['新客人头', false], ['新客成交人数', false], ['新客成交业绩', true], ['新客成交率', false],
].map(([metric, money], index) => ({ key: `new-customer-${index}`, metric: String(metric), money: Boolean(money) }))
const staffSummaryRows = [
  ['现金', '合计', true], ['现金', '合作', true],
  ['产品', '现金', true], ['产品', '卡扣', true],
  ['实操', '指定', true], ['实操', '非指定', true],
  ['', '会员客流', false], ['', '散客客流', false], ['', '人数', false], ['', '项目数量', false], ['', '分配会员数', false], ['', '分配散客数', false],
].map(([group, metric, money], index) => ({ key: `staff-summary-${index}`, group: String(group), metric: String(metric), money: Boolean(money) }))

const customerTypes = ['档案客', '活跃客', '有效客', '半休眠客', '休眠客'].map(value => ({ value, label: value }))
const positions = ['全部职位', '美容师', '主理人', '店长', '前台'].map(value => ({ value, label: value }))
const staffStatusOptions = [{ value: 'all', label: '全部' }]
const itemCategoryOptionsByView = {
  project: [
    { value: 'entry', label: '入账系统' },
    { value: 'prescription', label: '处方系统' },
    { value: 'recharge', label: '充值系统' },
  ],
  product: [
    { value: 'test', label: '测试' },
    { value: 'yu', label: '余儿' },
  ],
  card: [
    { value: 'member', label: '会员卡' },
    { value: 'package', label: '疗程卡' },
  ],
} as const
const itemDimensionOptionsByView = {
  project: [
    { value: 'project', label: '项目维度' },
    { value: 'major', label: '大类维度' },
    { value: 'minor', label: '小类维度' },
    { value: 'sub', label: '子类维度' },
  ],
  product: [
    { value: 'product', label: '产品维度' },
    { value: 'major', label: '大类维度' },
    { value: 'minor', label: '小类维度' },
  ],
  card: [
    { value: 'card', label: '卡维度' },
    { value: 'type', label: '卡类型' },
    { value: 'category', label: '卡分类' },
  ],
} as const
const cardTypeOptions = [{ value: 'stored', label: '储值卡' }, { value: 'times', label: '次卡' }, { value: 'period', label: '周期卡' }, { value: 'point', label: '点卡' }]
const cardCategoryOptions = [
  { value: 'member-3980', label: '3980会员卡' },
  { value: 'member-8880', label: '8880会员卡' },
  { value: 'member-13800', label: '13800会员卡' },
  { value: 'member-21800', label: '21800会员卡' },
  { value: 'member-32800', label: '32800会员卡' },
  { value: 'package', label: '疗程卡' },
]

// Demo-only rows keep the report table usable before report APIs are available.
// They must never be treated as tenant users or as a backend data source.
const customerInventoryRows: ReportRow[] = [
  { key: 'customer-inventory-1', index: '1', name: '模拟顾客A', phone: '13800000001', code: 'MOCK-0001', arrived: '2026-09-16', age: '-', lastYear: '¥0.00', thisYear: '¥0.00', items: '0项', itemBalance: '¥0.00', cashBalance: '¥0.00', lastVisit: '-', type: '新客' },
  { key: 'customer-inventory-2', index: '2', name: '模拟顾客B', phone: '13800000002', code: 'MOCK-0002', arrived: '2026-09-15', age: '40', lastYear: '¥0.00', thisYear: '¥0.00', items: '0项', itemBalance: '¥0.00', cashBalance: '¥0.00', lastVisit: '-', type: '休眠客' },
  { key: 'customer-inventory-3', index: '3', name: '模拟顾客C', phone: '13800000003', code: 'MOCK-0003', arrived: '2026-09-14', age: '52', lastYear: '¥0.00', thisYear: '¥0.00', items: '0项', itemBalance: '¥0.00', cashBalance: '¥0.00', lastVisit: '-', type: '休眠客' },
]

const staffPerformanceRows: ReportRow[] = [
  { key: 'staff-performance-1', employee: '模拟负责人', store: '当前门店', sales: 0, manual: 0, service: 0, consume: 0, cash: 0, card: 0, actual: 0, assigned: 0, unassigned: 0, memberCard: 0 },
  { key: 'staff-performance-2', employee: '模拟员工A', store: '当前门店', sales: 0, manual: 0, service: 0, consume: 0, cash: 0, card: 0, actual: 0, assigned: 0, unassigned: 0, memberCard: 0 },
]

const staffAttendanceSummaryRows: ReportRow[] = [
  { key: 'staff-attendance-summary-1', name: '模拟负责人', number: 'MOCK-0001', total: '21天', normal: '0', late: '0次', early: '0次', missing: '42次', location: '0次', overtime: '0次', overtimeHours: '-', lateHours: '-', workHours: '-' },
  { key: 'staff-attendance-summary-2', name: '模拟员工A', number: 'MOCK-0002', total: '20天', normal: '0', late: '0次', early: '0次', missing: '40次', location: '0次', overtime: '0次', overtimeHours: '-', lateHours: '-', workHours: '-' },
]

const staffAttendanceDetailRows: ReportRow[] = [
  { key: 'staff-attendance-detail-1', name: '模拟负责人', number: 'MOCK-0001', checkIn: '-', checkOut: '-', checkInType: '未签到', checkOutType: '未签退', status: '正常', remark: '-' },
  { key: 'staff-attendance-detail-2', name: '模拟员工A', number: 'MOCK-0002', checkIn: '-', checkOut: '-', checkInType: '未签到', checkOutType: '未签退', status: '正常', remark: '-' },
]

const liabilityCustomerRows: ReportRow[] = [
  { key: 'liability-customer-1', name: '模拟顾客A', phone: '13800000001', lastVisit: '-', advisor: '-', staff: '-', store: '当前门店', debt: '¥0.00', points: '0', stored: '¥0.00', storedDiscount: '¥0.00', times: '0次', timesDiscount: '¥0.00', period: '0张', periodUsed: '0次', pointsLeft: '0', pointsUsed: '0', original: '¥0.00', gifts: '0' },
  { key: 'liability-customer-2', name: '模拟顾客B', phone: '13800000002', lastVisit: '-', advisor: '-', staff: '-', store: '当前门店', debt: '¥0.00', points: '0', stored: '¥0.00', storedDiscount: '¥0.00', times: '0次', timesDiscount: '¥0.00', period: '0张', periodUsed: '0次', pointsLeft: '0', pointsUsed: '0', original: '¥0.00', gifts: '0' },
  { key: 'liability-customer-3', name: '模拟顾客C', phone: '13800000003', lastVisit: '-', advisor: '-', staff: '-', store: '当前门店', debt: '¥0.00', points: '0', stored: '¥0.00', storedDiscount: '¥0.00', times: '0次', timesDiscount: '¥0.00', period: '0张', periodUsed: '0次', pointsLeft: '0', pointsUsed: '0', original: '¥0.00', gifts: '0' },
  { key: 'liability-customer-total', name: '汇总', phone: '', lastVisit: '', advisor: '', staff: '', store: '', debt: '¥0.00', points: '0', stored: '¥0.00', storedDiscount: '¥0.00', times: '0次', timesDiscount: '¥0.00', period: '0张', periodUsed: '0次', pointsLeft: '0', pointsUsed: '0', original: '¥0.00', gifts: '0' },
]

function parseMain(value: string | null): MainReport {
  return mainReports.some(item => item.key === value) ? value as MainReport : 'operating'
}

function dateColumns(range: [Dayjs, Dayjs], mode: 'day' | 'month') {
  const start = mode === 'month' ? range[0].startOf('month') : range[0].startOf('day')
  const end = mode === 'month' ? range[1].startOf('month') : range[1].startOf('day')
  const unit = mode === 'month' ? 'month' : 'day'
  const total = Math.min(Math.max(end.diff(start, unit) + 1, 1), mode === 'month' ? 24 : 31)
  return Array.from({ length: total }, (_, index) => start.add(index, unit))
}

function EmptyState({ label = '暂无相关数据' }: { label?: string }) {
  return <div className="data-report-empty"><GoalEmpty /><span>{label}</span></div>
}

function EmptyTable({ columns, rows = [], emptyLabel = '暂无相关数据', className = '', showFooter = true, footerLabel, pageNumber, scrollX = 'max-content' }: { columns: ColumnsType<ReportRow>; rows?: ReportRow[]; emptyLabel?: string; className?: string; showFooter?: boolean; footerLabel?: string; pageNumber?: string; scrollX?: number | 'max-content' }) {
  const total = rows.length
  return <div className={`data-report-table-wrap ${className}`}>
    <Table<ReportRow> rowKey="key" columns={columns} dataSource={rows} pagination={false} locale={{ emptyText: <EmptyState label={emptyLabel} /> }} scroll={{ x: scrollX }} />
    {showFooter && <div className="data-report-table-footer"><span>{footerLabel ?? `当前共搜索到${total}条记录`}</span><span className="data-report-pagination"><Button size="small" disabled={total === 0} aria-label="上一页">‹</Button><span className="data-report-page-number">{pageNumber ?? (total > 0 ? '1' : '0')}</span><Button size="small" disabled={total === 0} aria-label="下一页">›</Button><Select size="small" aria-label="每页条数" defaultValue="10" options={[{ value: '10', label: '10 条/页' }, { value: '20', label: '20 条/页' }]} /></span></div>}
  </div>
}

function DateRange({ value, onChange, prefix, format = 'YYYY-MM-DD' }: { value: [Dayjs, Dayjs]; onChange: (value: [Dayjs, Dayjs]) => void; prefix?: string; format?: string }) {
  const picker = <DatePicker.RangePicker aria-label="统计日期范围" value={value} onChange={dates => { if (dates?.[0] && dates[1]) onChange([dates[0], dates[1]]) }} allowClear={false} format={format} inputReadOnly />
  return prefix ? <div className="data-report-date-range"><span>{prefix}</span>{picker}</div> : picker
}

function StoreSelect({ label = '门店', current = false, placeholder = '请选择门店' }: { label?: string; current?: boolean; placeholder?: string }) {
  const { session } = useAuth()
  const currentStore = session?.userInfo.tenantName || '当前门店'
  return <Select aria-label={label} placeholder={placeholder} allowClear value={current ? 'current' : undefined} options={current ? [{ value: 'current', label: currentStore }] : []} />
}

function MainNav({ active, onChange }: { active: MainReport; onChange: (key: MainReport) => void }) {
  return <div className="data-reports-nav" role="tablist" aria-label="报表分类">
    <div className="data-reports-nav-tabs">{mainReports.map(item => <button key={item.key} type="button" role="tab" aria-selected={active === item.key} className={active === item.key ? 'is-active' : ''} onClick={() => onChange(item.key)}>{item.label}</button>)}</div>
  </div>
}

function SubNav({ items, active, onChange }: { items: Array<{ key: string; label: string }>; active: string; onChange: (key: string) => void }) {
  return <div className="data-report-subnav" role="tablist">{items.map(item => <button key={item.key} type="button" role="tab" aria-selected={active === item.key} className={active === item.key ? 'is-active' : ''} onClick={() => onChange(item.key)}>{item.label}</button>)}</div>
}

function MatrixTable({ rows, range, mode, withGroup = true }: { rows: Array<{ key: string; group?: string; metric?: string; money?: boolean }>; range: [Dayjs, Dayjs]; mode: 'day' | 'month'; withGroup?: boolean }) {
  const dates = dateColumns(range, mode)
  const value = (record: ReportRow) => <span className="data-report-zero">{record.money ? '¥0' : '0'}</span>
  const groupColumn = { title: '分类', dataIndex: 'group', key: 'group', fixed: 'left' as const, width: withGroup ? 70 : 140, render: (_value: unknown, record: ReportRow) => record.group || record.metric, onCell: (record: ReportRow, rowIndex?: number) => {
    if (!withGroup) return { rowSpan: 0 }
    if (!record.group) return { colSpan: 2 }
    const index = rowIndex ?? 0
    const previous = index > 0 ? rows[index - 1]?.group : undefined
    if (previous === record.group) return { rowSpan: 0 }
    let span = 1
    while (rows[index + span]?.group === record.group) span += 1
    return { rowSpan: span }
  } }
  const metricColumn = { title: withGroup ? '指标' : '数据项目', dataIndex: 'metric', key: 'metric', fixed: 'left' as const, width: withGroup ? 70 : 140, onCell: (record: ReportRow) => !record.group && withGroup ? { colSpan: 0 } : {} }
  const columns: ColumnsType<ReportRow> = [
    { title: '数据', children: withGroup ? [groupColumn, metricColumn] : [metricColumn] },
    { title: '汇总', dataIndex: 'total', key: 'total', width: 84, render: (_value: unknown, record: ReportRow) => value(record) },
    ...dates.map(date => ({ title: mode === 'month' ? date.format('M月') : date.format('M/D'), key: date.format('YYYY-MM-DD'), width: 112, render: (_value: unknown, record: ReportRow) => value(record) })),
  ]
  return <div className="data-report-table-wrap data-report-matrix"><Table<ReportRow> rowKey="key" columns={columns} dataSource={rows.map(row => ({ ...row, total: 0 }))} pagination={false} scroll={{ x: mode === 'day' ? 2500 : 'max-content' }} /></div>
}

function MatrixToolbar({ mode, onModeChange, range, onRangeChange }: { mode: 'day' | 'month'; onModeChange: (mode: 'day' | 'month') => void; range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  return <div className="data-report-toolbar matrix-toolbar">
    <Segmented aria-label="统计维度" value={mode} onChange={value => onModeChange(value as 'day' | 'month')} options={[{ label: '日维度', value: 'day' }, { label: '月维度', value: 'month' }]} />
    <StoreSelect />
    <DateRange value={range} onChange={onRangeChange} />
  </div>
}

function OperatingReport({ range, mode, onRangeChange, onModeChange }: { range: [Dayjs, Dayjs]; mode: 'day' | 'month'; onRangeChange: (value: [Dayjs, Dayjs]) => void; onModeChange: (mode: 'day' | 'month') => void }) {
  return <><MatrixToolbar mode={mode} onModeChange={onModeChange} range={range} onRangeChange={onRangeChange} /><MatrixTable rows={operatingRows} range={range} mode={mode} /></>
}

function NewCustomerReport({ range, mode, onRangeChange, onModeChange }: { range: [Dayjs, Dayjs]; mode: 'day' | 'month'; onRangeChange: (value: [Dayjs, Dayjs]) => void; onModeChange: (mode: 'day' | 'month') => void }) {
  return <><MatrixToolbar mode={mode} onModeChange={onModeChange} range={range} onRangeChange={onRangeChange} /><MatrixTable rows={newCustomerRows} range={range} mode={mode} withGroup={false} /></>
}

function StaffSummary({ range, mode, onRangeChange, onModeChange }: { range: [Dayjs, Dayjs]; mode: 'day' | 'month'; onRangeChange: (value: [Dayjs, Dayjs]) => void; onModeChange: (mode: 'day' | 'month') => void }) {
  return <><div className="data-report-toolbar"><Segmented aria-label="统计维度" value={mode} onChange={value => onModeChange(value as 'day' | 'month')} options={[{ label: '日维度', value: 'day' }, { label: '月维度', value: 'month' }]} /><Select aria-label="员工" defaultValue="owner" options={[{ value: 'owner', label: '负责人' }]} /><DateRange value={range} onChange={onRangeChange} /></div><MatrixTable rows={staffSummaryRows} range={range} mode={mode} /></>
}

function StaffMetrics({ range, onRangeChange }: { range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  const columns: ColumnsType<ReportRow> = [
    { title: '员工', dataIndex: 'employee', key: 'employee', fixed: 'left', width: 120 },
    { title: '现金', children: [{ title: '基础', key: 'cash-base' }, { title: '合作', key: 'cash-partner' }] },
    { title: '产品', children: [{ title: '现金', key: 'product-cash' }, { title: '卡扣', key: 'product-card' }] },
    { title: '实操', children: [{ title: '指定', key: 'actual-assigned' }, { title: '非指定', key: 'actual-unassigned' }] },
    { title: '会员客流', dataIndex: 'memberTraffic', key: 'memberTraffic' },
    { title: '散客客流', dataIndex: 'casualTraffic', key: 'casualTraffic' },
    { title: '人数', dataIndex: 'people', key: 'people' },
    { title: '项目数', dataIndex: 'items', key: 'items' },
    { title: '分配会员数', dataIndex: 'assignedMembers', key: 'assignedMembers' },
    { title: '分配散客数', dataIndex: 'assignedGuests', key: 'assignedGuests' },
  ]
  return <><div className="data-report-toolbar staff-metrics-toolbar"><StoreSelect /><DateRange value={range} onChange={onRangeChange} /></div><EmptyTable columns={columns} showFooter={false} className="data-report-wide-table" scrollX={1900} /></>
}

function monthPeriodRange(range: [Dayjs, Dayjs]): [Dayjs, Dayjs] {
  return [range[0].startOf('month'), range[1].endOf('month')]
}

function StaffPerformance({ range, onRangeChange }: { range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  const columns: ColumnsType<ReportRow> = [
    { title: '员工', dataIndex: 'employee', key: 'employee', fixed: 'left', width: 140 }, { title: '门店', dataIndex: 'store', key: 'store', width: 230 },
    { title: '员工销售业绩', dataIndex: 'sales', key: 'sales', width: 170, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '员工手工业绩', dataIndex: 'manual', key: 'manual', width: 170, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '员工服务业绩', dataIndex: 'service', key: 'service', width: 170, render: value => <span className="data-report-zero">¥{value ?? 0}</span> },
    { title: '员工消耗业绩', dataIndex: 'consume', key: 'consume', width: 170, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '员工现金业绩', dataIndex: 'cash', key: 'cash', width: 170, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '员工耗卡业绩', dataIndex: 'card', key: 'card', width: 170, render: value => <span className="data-report-zero">¥{value ?? 0}</span> },
    { title: '实操业绩', dataIndex: 'actual', key: 'actual', width: 150, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '指定客', dataIndex: 'assigned', key: 'assigned', width: 140, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '非指定客', dataIndex: 'unassigned', key: 'unassigned', width: 140, render: value => <span className="data-report-zero">¥{value ?? 0}</span> }, { title: '会员卡业绩', dataIndex: 'memberCard', key: 'member-card', width: 160, render: value => <span className="data-report-zero">¥{value ?? 0}</span> },
  ]
  const { session } = useAuth()
  const rows = staffPerformanceRows.map(row => ({ ...row, store: session?.userInfo.tenantName || row.store }))
  return <><div className="data-report-toolbar staff-performance-toolbar"><DateRange prefix="本月" format="YYYY/MM/DD" value={monthPeriodRange(range)} onChange={onRangeChange} /><StoreSelect label="业绩门店" placeholder="请选择业绩门店" /><Select aria-label="职位" placeholder="全部职位" options={positions} /><Select aria-label="员工状态" defaultValue="all" options={staffStatusOptions} /><Input aria-label="搜索员工" placeholder="员工姓名" allowClear suffix={<SearchOutlined />} /></div><EmptyTable columns={columns} rows={rows} showFooter={false} className="data-report-wide-table" scrollX={2300} /></>
}

function StaffCommission({ range, onRangeChange }: { range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  const columns: ColumnsType<ReportRow> = [
    { title: '员工排行', key: 'rank', width: 130 }, { title: '汇总', key: 'total' }, { title: '服务提成', key: 'service' }, { title: '销售提成', key: 'sales' }, { title: '阶梯提成（区间）', key: 'range' }, { title: '阶梯提成（本轮）', key: 'current' }, { title: '操作', key: 'action', render: () => <Button type="link">明细</Button> },
  ]
  return <><div className="data-report-toolbar"><span className="toolbar-field-label">业绩门店：</span><StoreSelect label="业绩门店" current /><DateRange prefix="本月" format="YYYY/MM/DD" value={monthPeriodRange(range)} onChange={onRangeChange} /></div><EmptyTable columns={columns} showFooter={false} /></>
}

function StaffAttendance({ range, onRangeChange }: { range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  const [detail, setDetail] = useState(false)
  const summaryColumns: ColumnsType<ReportRow> = [
    { title: '员工姓名', dataIndex: 'name', key: 'name', width: 150 }, { title: '员工工号', dataIndex: 'number', key: 'number', width: 110 }, { title: '总出勤天数', dataIndex: 'total', key: 'total', width: 150 }, { title: '正常出勤天数', dataIndex: 'normal', key: 'normal', width: 150 }, { title: '迟到', dataIndex: 'late', key: 'late', width: 120 }, { title: '早退', dataIndex: 'early', key: 'early', width: 120 }, { title: '缺卡', dataIndex: 'missing', key: 'missing', width: 120 }, { title: '异常定位', dataIndex: 'location', key: 'location', width: 140 }, { title: '加班', dataIndex: 'overtime', key: 'overtime', width: 120 }, { title: '加班时长', dataIndex: 'overtimeHours', key: 'overtime-hours', width: 140 }, { title: '迟到时长', dataIndex: 'lateHours', key: 'late-hours', width: 140 }, { title: '工作时长', dataIndex: 'workHours', key: 'work-hours', width: 140 }, { title: '操作', key: 'action', width: 100, render: () => <Button type="link">明细</Button> },
  ]
  const detailColumns: ColumnsType<ReportRow> = [
    { title: '员工姓名', dataIndex: 'name', key: 'name', width: 150 }, { title: '员工工号', dataIndex: 'number', key: 'number', width: 110 }, { title: '签到时间', dataIndex: 'checkIn', key: 'check-in', width: 160 }, { title: '签退时间', dataIndex: 'checkOut', key: 'check-out', width: 160 }, { title: '签到类型', dataIndex: 'checkInType', key: 'check-in-type', width: 150 }, { title: '签退类型', dataIndex: 'checkOutType', key: 'check-out-type', width: 150 }, { title: '考勤状态', dataIndex: 'status', key: 'status', width: 150 }, { title: '备注', dataIndex: 'remark', key: 'remark', width: 180 }, { title: '操作', key: 'action', width: 100, render: () => <Button type="link">查看</Button> },
  ]
  return <><div className="data-report-toolbar"><Segmented aria-label="考勤视图" value={detail ? 'detail' : 'summary'} onChange={value => setDetail(value === 'detail')} options={[{ label: '考勤统计', value: 'summary' }, { label: '考勤明细', value: 'detail' }]} />{detail ? <DatePicker aria-label="考勤日期" defaultValue={dayjs()} placeholder="选择日期" format="YYYY-MM-DD" /> : <DateRange prefix="本月" format="YYYY/MM/DD" value={range} onChange={onRangeChange} />}<StoreSelect current />{detail && <Select aria-label="员工筛选" defaultValue="all" options={staffStatusOptions} />}</div><EmptyTable columns={detail ? detailColumns : summaryColumns} rows={detail ? staffAttendanceDetailRows : staffAttendanceSummaryRows} emptyLabel="暂无考勤数据" showFooter={false} className="data-report-wide-table" scrollX={2300} /></>
}

function StaffReviews({ range, onRangeChange }: { range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void }) {
  const columns: ColumnsType<ReportRow> = [
    { title: '顾客信息', key: 'customer', fixed: 'left', width: 150 }, { title: '订单编号', key: 'order' }, { title: '订单内容', key: 'content', width: 220 }, { title: '订单金额', key: 'amount' }, { title: '评价状态', key: 'status' }, { title: '服务人员', key: 'staff' }, { title: '订单评价时间', key: 'time' }, { title: '操作', key: 'action', render: () => <Button type="link">查看</Button> },
  ]
  return <><div className="data-report-toolbar staff-review-toolbar"><div className="staff-review-date-filter"><Select aria-label="订单类型" defaultValue="order" options={[{ value: 'order', label: '订单' }]} /><DatePicker.RangePicker aria-label="评价日期范围" value={range} onChange={dates => { if (dates?.[0] && dates[1]) onRangeChange([dates[0], dates[1]]) }} allowClear={false} format="YYYY/MM/DD" inputReadOnly /></div><StoreSelect /><Select aria-label="职位" placeholder="全部职位" options={positions} /><Input aria-label="搜索服务人员" placeholder="员工姓名" allowClear suffix={<SearchOutlined />} /></div><EmptyTable columns={columns} className="data-report-wide-table" scrollX={1900} /></>
}

function StaffReport({ view, range, matrixRange, mode, onRangeChange, onMatrixRangeChange, onModeChange }: { view: string; range: [Dayjs, Dayjs]; matrixRange: [Dayjs, Dayjs]; mode: 'day' | 'month'; onRangeChange: (value: [Dayjs, Dayjs]) => void; onMatrixRangeChange: (value: [Dayjs, Dayjs]) => void; onModeChange: (mode: 'day' | 'month') => void }) {
  if (view === 'metrics') return <StaffMetrics range={range} onRangeChange={onRangeChange} />
  if (view === 'performance') return <StaffPerformance range={range} onRangeChange={onRangeChange} />
  if (view === 'commission') return <StaffCommission range={range} onRangeChange={onRangeChange} />
  if (view === 'attendance') return <StaffAttendance range={range} onRangeChange={onRangeChange} />
  if (view === 'reviews') return <StaffReviews range={range} onRangeChange={onRangeChange} />
  return <StaffSummary mode={mode} onModeChange={onModeChange} range={matrixRange} onRangeChange={onMatrixRangeChange} />
}

function CustomerToolbar() {
  return <div className="data-report-toolbar customer-report-toolbar"><DatePicker picker="year" aria-label="统计年份" defaultValue={dayjs()} format="YYYY" /><StoreSelect current /><Select aria-label="客户分类" placeholder="请选择自定义客户" options={customerTypes} /><Input aria-label="搜索顾客" placeholder="姓名/手机号/编号" allowClear suffix={<SearchOutlined />} /></div>
}

function CustomerReport({ view }: { view: string }) {
  const columns: ColumnsType<ReportRow> = [
    { title: '序号', dataIndex: 'index', key: 'index', width: 70 }, { title: '顾客信息', key: 'customer', fixed: 'left', width: 210, render: (_value, record) => <div className="data-report-customer-cell"><span className="data-report-avatar">{record.index || String(record.name || '顾').slice(0, 1)}</span><div className="data-report-customer-copy"><strong>{record.name}</strong><span>{record.phone}</span><span>顾客编号：{record.code}</span></div></div> }, { title: '进店时间', dataIndex: 'arrived', key: 'arrived' }, { title: '年龄', dataIndex: 'age', key: 'age' }, { title: '去年消费', dataIndex: 'lastYear', key: 'last-year' }, { title: '今年消费', dataIndex: 'thisYear', key: 'this-year' }, { title: '剩余项目', dataIndex: 'items', key: 'items' }, { title: '余额', children: [{ title: '项目余额', dataIndex: 'itemBalance', key: 'item-balance' }, { title: '现金金额', dataIndex: 'cashBalance', key: 'cash-balance' }] }, { title: '上次进店时间', dataIndex: 'lastVisit', key: 'last-visit' }, { title: '客户类别', dataIndex: 'type', key: 'type' },
  ]
  return <><CustomerToolbar />{view === 'visits' ? <div className="data-report-blank-panel"><EmptyState /></div> : <><div className="customer-report-result-heading"><span>共搜索到{customerInventoryRows.length}个顾客</span><Select aria-label="顾客排序" size="small" defaultValue="created-desc" options={[{ value: 'created-desc', label: '顾客建档时间(由近到远)' }, { value: 'created-asc', label: '顾客建档时间(由远到近)' }]} /></div><EmptyTable columns={columns} rows={customerInventoryRows} footerLabel={`共搜索到${customerInventoryRows.length}个顾客`} className="data-report-wide-table" scrollX={2300} /></>}</>
}

function ItemReport({ view, range, onRangeChange, onViewChange }: { view: string; range: [Dayjs, Dayjs]; onRangeChange: (value: [Dayjs, Dayjs]) => void; onViewChange: (key: string) => void }) {
  const itemLabels = itemViews.map(item => ({ label: item.label, value: item.key }))
  const categoryOptions = [...(itemCategoryOptionsByView[view as keyof typeof itemCategoryOptionsByView] ?? itemCategoryOptionsByView.project)]
  const dimensionOptions = [...(itemDimensionOptionsByView[view as keyof typeof itemDimensionOptionsByView] ?? itemDimensionOptionsByView.project)]
  return <><div className="item-report-switcher"><Segmented aria-label="品项报表类型" value={view} onChange={value => onViewChange(String(value))} options={itemLabels} /></div><div className="data-report-toolbar item-report-toolbar"><StoreSelect label="业绩门店" placeholder="请选择业绩门店" /><DateRange prefix="日期" format="YYYY/MM/DD" value={range} onChange={onRangeChange} /><span className="toolbar-spacer" /><Select aria-label="品项分类" mode="multiple" maxTagCount={1} placeholder="请选择分类" options={categoryOptions} /><Select key={view} aria-label="统计维度" defaultValue={dimensionOptions[0].value} options={dimensionOptions} /></div><div className="data-report-blank-panel"><EmptyState /></div></>
}

const assetScopeOptions = [{ value: 'expired-only', label: '仅未过期权益' }, { value: 'include-expired', label: '包含已过期权益' }, { value: 'expired', label: '仅已过期权益' }]

function LiabilityCustomer() {
  const columns: ColumnsType<ReportRow> = [
    { title: '顾客信息', key: 'customer', fixed: 'left', width: 210, render: (_value, record) => <div className="data-report-customer-cell"><span className="data-report-avatar">{String(record.name || '顾').slice(0, 1)}</span><div className="data-report-customer-copy"><strong>{record.name}</strong>{record.phone && <span>{record.phone}</span>}</div></div> }, { title: '上次到店时间', dataIndex: 'lastVisit', key: 'last-visit' }, { title: '跟踪顾问', dataIndex: 'advisor', key: 'advisor' }, { title: '跟踪员工', dataIndex: 'staff', key: 'staff' }, { title: '所属门店', dataIndex: 'store', key: 'store' }, { title: '欠款', dataIndex: 'debt', key: 'debt' }, { title: '积分', dataIndex: 'points', key: 'points' }, { title: '储值余额', dataIndex: 'stored', key: 'stored' }, { title: '储值剩余抵扣', dataIndex: 'storedDiscount', key: 'stored-discount' }, { title: '次卡剩余次数', dataIndex: 'times', key: 'times' }, { title: '次卡剩余抵扣', dataIndex: 'timesDiscount', key: 'times-discount' }, { title: '周期卡数量', dataIndex: 'period', key: 'period' }, { title: '周期卡核销', dataIndex: 'periodUsed', key: 'period-used' }, { title: '点卡剩余点数', dataIndex: 'pointsLeft', key: 'points-left' }, { title: '点卡剩余核销', dataIndex: 'pointsUsed', key: 'points-used' }, { title: '剩余原价消费金', dataIndex: 'original', key: 'original' }, { title: '剩余赠品', dataIndex: 'gifts', key: 'gifts' },
  ]
  return <><div className="data-report-toolbar liability-toolbar"><span className="toolbar-field-label">资产范围：</span><Select aria-label="资产范围" defaultValue="expired-only" options={assetScopeOptions} /><span className="toolbar-field-label">门店：</span><StoreSelect current /><span className="toolbar-field-label">余额汇总：</span><Select aria-label="余额比较" defaultValue="gte" options={[{ value: 'gte', label: '大于等于' }, { value: 'lte', label: '小于等于' }]} /><InputNumber aria-label="余额金额" min={0} defaultValue={0} /><Input aria-label="搜索顾客" placeholder="请输入顾客姓名/手机号/编号" allowClear suffix={<SearchOutlined />} /><Button className="liability-query-button" type="primary">查询</Button></div><div className="data-report-cutoff">数据截止日期：{dayjs().format('YYYY-MM-DD')}</div><EmptyTable columns={columns} rows={liabilityCustomerRows} footerLabel="当前共搜索到3条记录" className="data-report-wide-table" scrollX={2500} /></>
}

function LiabilityMemberCard() {
  return <><div className="data-report-toolbar liability-toolbar"><span className="toolbar-field-label">资产范围：</span><Select aria-label="资产范围" defaultValue="expired-only" options={assetScopeOptions} /><span className="toolbar-field-label">所属门店：</span><StoreSelect label="所属门店" current /><span className="toolbar-field-label">负债门店：</span><StoreSelect label="负债门店" current /><span className="toolbar-field-label">卡类型：</span><Select aria-label="卡类型" placeholder="请选择卡类型" options={cardTypeOptions} /><span className="toolbar-field-label">卡分类：</span><Select aria-label="卡分类" placeholder="请选择卡分类" options={cardCategoryOptions} /><Input aria-label="搜索卡" placeholder="请输入卡名称/编号" allowClear suffix={<SearchOutlined />} /><Button className="liability-query-button" type="primary">查询</Button></div><div className="data-report-cutoff">数据截止日期：{dayjs().format('YYYY-MM-DD')}</div><div className="data-report-blank-panel"><EmptyState /></div></>
}

function LiabilityReport({ view }: { view: string }) {
  return view === 'member-card' ? <LiabilityMemberCard /> : <LiabilityCustomer />
}

const centerReports = [
  ['顾客剩余资产', '导出指定门店下所有顾客剩余卡、券、赠品、积分等资产'],
  ['员工工绩与提成', '导出员工的业绩和提成明细'],
  ['门店流水', '导出指定时间段和指定门店所产生的订单明细'],
  ['卡消费列表', '导出卡消费项目、卡上卡下、实操及赠品消费明细'],
  ['订单支付明细', '按订单支付方式为维度，统计每笔支付金额所对应订单内的售卖品项'],
]

function ReportCenter({ onExport }: { onExport: (title: string) => void }) {
  return <div className="report-center-grid">{centerReports.map(([title, description]) => <article className="report-center-card" key={title}><div className="report-center-copy"><h3>{title}</h3><p>{description}</p></div><Button icon={<DownloadOutlined />} onClick={() => onExport(title)}>导出报表</Button></article>)}</div>
}

export default function DataReportsPage() {
  const { session, can } = useAuth()
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const reportRef = useRef<HTMLDivElement>(null)
  const [navigating, setNavigating] = useState(false)
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf('month'), dayjs()])
  const [matrixPeriods, setMatrixPeriods] = useState<Record<MatrixReport, MatrixPeriod>>(() => {
    const initial = (): MatrixPeriod => ({ mode: 'day', range: [dayjs().startOf('month'), dayjs()] })
    return { operating: initial(), 'new-customer': initial(), 'staff-summary': initial() }
  })
  const main = parseMain(params.get('report'))
  const views = main === 'staff' ? staffViews : main === 'customer' ? customerViews : main === 'liability' ? liabilityViews : []
  const view = params.get('view') && views.some(item => item.key === params.get('view')) ? params.get('view')! : views[0]?.key
  const paramsKey = params.toString()
  useEffect(() => { setNavigating(false) }, [paramsKey])
  const selectMain = (key: MainReport) => {
    if (key === main) return
    setNavigating(true)
    const next = new URLSearchParams(params)
    next.set('report', key)
    next.delete('view')
    setParams(next)
  }
  const selectView = (key: string) => {
    if (key === (params.get('view') ?? (main === 'items' ? 'project' : view))) return
    setNavigating(true)
    const next = new URLSearchParams(params)
    next.set('view', key)
    setParams(next)
  }
  const updateMatrixRange = (key: MatrixReport, nextRange: [Dayjs, Dayjs]) => {
    setMatrixPeriods(current => ({ ...current, [key]: { ...current[key], range: nextRange } }))
  }
  const updateMatrixMode = (key: MatrixReport, nextMode: 'day' | 'month') => {
    const today = dayjs()
    setMatrixPeriods(current => ({ ...current, [key]: {
      mode: nextMode,
      range: nextMode === 'month' ? [today.startOf('year'), today.endOf('month')] : [today.startOf('month'), today],
    } }))
  }
  const itemView = itemViews.some(item => item.key === params.get('view')) ? params.get('view')! : 'project'
  const currentView = main === 'items' ? itemView : view
  const currentLabel = mainReports.find(item => item.key === main)!.label
  const viewLabel = [...staffViews, ...customerViews, ...itemViews, ...liabilityViews].find(item => item.key === currentView)?.label
  const matrixKey: MatrixReport | null = main === 'operating' || main === 'new-customer' ? main : main === 'staff' && view === 'summary' ? 'staff-summary' : null
  const canDownload = main === 'operating' || main === 'new-customer' || main === 'staff' && ['summary', 'performance', 'attendance'].includes(view ?? '') || main === 'customer' && view === 'inventory' || main === 'liability' && view === 'customer-summary'
  const downloadCurrentView = () => {
    const table = reportRef.current?.querySelector<HTMLTableElement>('.ant-table-container table') ?? null
    const filename = [currentLabel, viewLabel, matrixKey ? matrixPeriods[matrixKey].mode === 'day' ? '日维度' : '月维度' : null, dayjs().format('YYYY-MM-DD')].filter(Boolean).join('_') + '.csv'
    if (!downloadReportTable(table, filename)) message.warning('当前报表暂无可下载的数据')
  }

  if (!session?.userInfo.platformAdmin && !can('home:read')) return <Result status="403" title="暂无数据报表权限" subTitle="请联系企业管理员分配首页或数据报表查看权限。" />

  return <section className="data-reports-page" aria-labelledby="data-reports-title">
    <div className="data-reports-header"><h1 id="data-reports-title">数据报表</h1>{main !== 'center' && <Tooltip title={canDownload ? '下载当前视图表格' : '当前报表暂无可下载的数据'}><span><Button type="primary" icon={<DownloadOutlined />} disabled={!canDownload || navigating} onClick={downloadCurrentView}>下载到本地</Button></span></Tooltip>}</div>
    <MainNav active={main} onChange={selectMain} />
    <div className="data-reports-card" ref={reportRef}>
      {views.length > 0 && <SubNav items={views} active={view ?? views[0].key} onChange={selectView} />}
      {main === 'center' && <ReportCenter onExport={title => message.info(`${title}导出接口待接入`)} />}
      {main === 'operating' && <OperatingReport range={matrixPeriods.operating.range} mode={matrixPeriods.operating.mode} onRangeChange={value => updateMatrixRange('operating', value)} onModeChange={value => updateMatrixMode('operating', value)} />}
      {main === 'new-customer' && <NewCustomerReport range={matrixPeriods['new-customer'].range} mode={matrixPeriods['new-customer'].mode} onRangeChange={value => updateMatrixRange('new-customer', value)} onModeChange={value => updateMatrixMode('new-customer', value)} />}
      {main === 'staff' && <StaffReport view={view ?? 'summary'} range={range} matrixRange={matrixPeriods['staff-summary'].range} mode={matrixPeriods['staff-summary'].mode} onRangeChange={setRange} onMatrixRangeChange={value => updateMatrixRange('staff-summary', value)} onModeChange={value => updateMatrixMode('staff-summary', value)} />}
      {main === 'customer' && <CustomerReport view={view ?? 'inventory'} />}
      {main === 'items' && <ItemReport view={itemView} range={range} onRangeChange={setRange} onViewChange={selectView} />}
      {main === 'liability' && <LiabilityReport view={view ?? 'customer-summary'} />}
    </div>
  </section>
}
