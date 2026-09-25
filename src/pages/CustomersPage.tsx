import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { App, Button, Checkbox, DatePicker, Dropdown, Input, InputNumber, Modal, Pagination, Result, Select, Space, Table, Tabs } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import { DownloadOutlined, DownOutlined, PlusOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { GoalEmpty } from '@/components/GoalEmpty'
import { useAuth } from '@/context/AuthContext'
import { CustomerReminderContent } from '@/pages/CustomerReminderPage'
import '@/styles/customers.css'

type CustomerTab = 'list' | 'advanced' | 'stored' | 'visit' | 'followup' | 'reminders'
type VisitTab = 'detail' | 'visit' | 'rules'

interface EmptyRow { id: string }

interface CustomerRecord extends EmptyRow {
  name: string
  phone: string
  code: string
  level: string
  cardCount: number
  balance: number
  spent: number
  visitCount: number
  lastVisit: string
}

interface VisitRule extends EmptyRow {
  store: string
  description: string
  updatedAt: string
}

const tabs: { key: CustomerTab; label: string }[] = [
  { key: 'list', label: '顾客列表' },
  { key: 'advanced', label: '高级查询' },
  { key: 'stored', label: '顾客寄存' },
  { key: 'visit', label: '顾客回访' },
  { key: 'followup', label: '顾客跟进' },
  { key: 'reminders', label: '回访提醒' },
]

const storeOptions = [{ value: 'current', label: '当前门店' }]
const sourceOptions = [{ value: 'offline', label: '线下到店' }, { value: 'online', label: '线上渠道' }]
const storageTypeOptions = [{ value: 'product', label: '产品寄存' }, { value: 'service', label: '项目寄存' }]

const defaultCustomerRecords: CustomerRecord[] = [
  { id: 'customer-1', name: '模拟顾客A', phone: '13800000001', code: 'MOCK-0001', level: '无等级', cardCount: 0, balance: 0, spent: 0, visitCount: 0, lastVisit: '' },
  { id: 'customer-2', name: '模拟顾客B', phone: '13800000002', code: 'MOCK-0002', level: '无等级', cardCount: 0, balance: 0, spent: 0, visitCount: 0, lastVisit: '' },
  { id: 'customer-3', name: '模拟顾客C', phone: '13800000003', code: 'MOCK-0003', level: '无等级', cardCount: 0, balance: 0, spent: 0, visitCount: 0, lastVisit: '' },
]

const followupAssignees = [
  { key: 'unassigned-tracker', label: '未分配跟踪员工', count: 1 },
  { key: 'unassigned-adviser', label: '未分配专属顾问', count: 1 },
  { key: 'owner', label: '负责人', count: 0 },
  { key: 'mock-staff-a', label: '模拟员工A', count: 0 },
]

function maskPhone(phone: string) {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone
}

function currentQuery(change: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search)
  change(params)
  return params
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="customer-filter-row"><span className="customer-filter-label">{label}：</span><div className="customer-filter-content">{children}</div></div>
}

function ChoiceRow({ label, options, initial = '全部', customInput }: { label: string; options: string[]; initial?: string; customInput?: 'date' | 'number' }) {
  const [value, setValue] = useState(initial)
  return <FilterRow label={label}><div className="customer-choice-list">{options.map(option => <button type="button" key={option} className={`customer-choice${value === option ? ' is-active' : ''}`} aria-pressed={value === option} onClick={() => setValue(option)}>{option}</button>)}</div>{value === '自定义' && customInput === 'date' && <DatePicker.RangePicker aria-label={`${label}自定义范围`} placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />}{value === '自定义' && customInput === 'number' && <Space.Compact className="customer-number-range"><InputNumber aria-label={`${label}最小值`} min={0} placeholder="最小值" /><span className="customer-range-separator">~</span><InputNumber aria-label={`${label}最大值`} min={0} placeholder="最大值" /></Space.Compact>}</FilterRow>
}

function EmptyTable<T extends EmptyRow>({
  ariaLabel,
  columns,
  rows = [],
  footerLabel = '当前共搜索到0条记录',
  width = 1120,
  showHeader = true,
}: {
  ariaLabel: string
  columns: TableColumnsType<T>
  rows?: T[]
  footerLabel?: string
  width?: number
  showHeader?: boolean
}) {
  const empty = rows.length === 0
  return <div className="customer-table-area">
    <Table<T> aria-label={ariaLabel} rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: width }} showHeader={showHeader} locale={{ emptyText: null }} />
    {empty && <div className="customer-table-state" role="status" aria-label={`${ariaLabel}暂无相关数据`}><GoalEmpty /><span>暂无相关数据</span></div>}
    <div className="customer-table-footer"><span>{footerLabel}</span><Pagination size="small" defaultCurrent={1} pageSize={10} total={rows.length} showSizeChanger={false} hideOnSinglePage={false} /></div>
  </div>
}

function FilterToolbar({ children }: { children: ReactNode }) {
  return <div className="customer-filter-toolbar">{children}</div>
}

function VisitDateFilter() {
  return <Space.Compact className="customer-date-filter">
    <Select aria-label="回访时间类型" defaultValue="planned" options={[{ value: 'planned', label: '计划回访时间' }]} />
    <DatePicker.RangePicker aria-label="计划回访时间" placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />
  </Space.Compact>
}

function VisitEmployeeFilter() {
  return <Space.Compact className="customer-search-combo">
    <Select aria-label="回访员工类型" defaultValue="employee" options={[{ value: 'employee', label: '员工' }, { value: 'store', label: '门店' }]} />
    <Input.Search aria-label="搜索回访员工" placeholder="输入员工姓名/工号" allowClear />
  </Space.Compact>
}

function TopActions({ children }: { children: ReactNode }) {
  return <div className="customer-top-actions">{children}</div>
}

function CustomerListPanel({ records }: { records: CustomerRecord[] }) {
  const [keyword, setKeyword] = useState('')
  const [cardFilterType, setCardFilterType] = useState('holding')
  const [cardName, setCardName] = useState('')
  const visibleRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return records
    return records.filter(row => `${row.name}${row.phone}${row.code}`.toLowerCase().includes(normalized))
  }, [keyword, records])
  const columns: TableColumnsType<CustomerRecord> = [
    { title: '顾客信息', key: 'customer', width: 300, render: (_, row) => <div className="customer-cell-stack"><strong>{row.name || maskPhone(row.phone)}</strong><span>{row.phone}</span><span>顾客编号：{row.code}</span><span>{row.level}</span></div> },
    { title: '顾客资产', key: 'assets', width: 260, render: (_, row) => <div className="customer-cell-stack"><span>持卡：{row.cardCount}张</span><span>卡余额：{row.balance.toFixed(2)}元</span><span>次卡余量：0次</span></div> },
    { title: '累计消费', key: 'spent', width: 220, render: (_, row) => <div className="customer-cell-stack"><span>金额：{row.spent.toFixed(2)}元</span><span>次数：{row.visitCount}次</span></div> },
    { title: '上次消费信息', key: 'lastOrder', width: 300, render: (_, row) => row.lastVisit || '暂无消费信息' },
    { title: '操作', key: 'actions', width: 150, render: () => <div className="customer-row-actions"><Button type="link" size="small">详情</Button><Button type="link" size="small">更多</Button></div> },
  ]
  return <>
    <div className="customer-panel customer-filter-panel">
      <FilterToolbar>
        <span className="customer-filter-label">基础搜索：</span>
        <Input.Search aria-label="搜索顾客" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="输入顾客姓名/手机号/编号" allowClear enterButton={<SearchOutlined />} />
        <Space.Compact className="customer-card-filter">
          <Select aria-label="会员卡筛选类型" value={cardFilterType} onChange={setCardFilterType} options={[{ value: 'holding', label: '持卡' }, { value: 'not-holding', label: '未持卡' }]} />
          <Input aria-label="搜索会员卡" value={cardName} onChange={event => setCardName(event.target.value)} placeholder="输入卡名称搜索" disabled={cardFilterType === 'not-holding'} allowClear />
        </Space.Compact>
        <Select aria-label="所属门店" placeholder="请选择门店" allowClear options={storeOptions} />
      </FilterToolbar>
      <FilterRow label="消费金额"><InputNumber aria-label="消费金额下限" min={0} precision={2} placeholder="请输入金额" /><span className="customer-range-separator">~</span><InputNumber aria-label="消费金额上限" min={0} precision={2} placeholder="请输入金额" /></FilterRow>
      <ChoiceRow label="持卡状态" options={['全部', '持卡', '未持卡']} />
      <ChoiceRow label="会员等级" options={['全部', '无等级']} />
      <ChoiceRow label="上次消费" options={['全部', '30天内未消费', '60天内未消费', '90天内未消费', '自定义']} customInput="date" />
      <ChoiceRow label="消费次数" options={['全部', '1次及以内', '3次及以内', '5次及以内', '自定义']} customInput="number" />
      <ChoiceRow label="近期生日" options={['全部', '今天', '未来3天', '未来7天', '自定义']} customInput="date" />
      <FilterRow label="顾客来源"><Select aria-label="顾客来源" placeholder="请选择顾客来源" allowClear options={sourceOptions} /><Input aria-label="顾客标签" placeholder="请输入个性标签搜索" /></FilterRow>
    </div>
    <div className="customer-panel customer-data-panel">
      <div className="customer-result-heading"><span>共搜索到{visibleRecords.length}个顾客</span><Select aria-label="顾客排序" size="small" defaultValue="created-desc" options={[{ value: 'created-desc', label: '顾客建档时间(由近到远)' }, { value: 'created-asc', label: '顾客建档时间(由远到近)' }]} /></div>
      <EmptyTable ariaLabel="顾客列表" columns={columns} rows={visibleRecords} footerLabel={`共搜索到${visibleRecords.length}个顾客`} width={1200} />
    </div>
  </>
}

function AdvancedSearchPanel() {
  const [category, setCategory] = useState('基本信息')
  const [condition, setCondition] = useState('性别')
  const conditionMap: Record<string, string[]> = {
    基本信息: ['性别', '来源渠道', '所属门店', '近期生日', '年龄段'],
    高级信息: ['顾客标签', '顾客来源', '跟踪员工', '注册时间'],
    资产信息: ['会员卡', '储值余额', '项目余量', '产品余量'],
    消费能力: ['累计消费', '消费次数', '客单价', '最近消费'],
  }
  const columns: TableColumnsType<EmptyRow> = [
    { title: '顾客信息', key: 'customer', width: 320 },
    { title: '顾客资产', key: 'assets', width: 280 },
    { title: '累计消费', key: 'spent', width: 260 },
    { title: '上次消费信息', key: 'lastOrder', width: 330 },
    { title: '操作', key: 'actions', width: 120 },
  ]
  return <>
    <div className="customer-panel customer-filter-panel customer-advanced-panel">
      <FilterRow label="条件分类"><div className="customer-choice-list" role="tablist" aria-label="高级查询条件分类">{Object.keys(conditionMap).map(item => <button type="button" role="tab" key={item} className={`customer-choice${category === item ? ' is-active' : ''}`} aria-selected={category === item} aria-pressed={category === item} onClick={() => { setCategory(item); setCondition(conditionMap[item][0]) }}>{item}</button>)}</div></FilterRow>
      <FilterRow label="选择条件"><div className="customer-choice-list">{conditionMap[category].map(item => <button type="button" key={item} className={`customer-choice${condition === item ? ' is-active' : ''}`} aria-pressed={condition === item} onClick={() => setCondition(item)}>{item}</button>)}</div></FilterRow>
    </div>
    <div className="customer-panel customer-data-panel"><EmptyTable ariaLabel="高级查询结果" columns={columns} /></div>
  </>
}

function StoredValuePanel() {
  const columns: TableColumnsType<EmptyRow> = [
    { title: '顾客信息', key: 'customer', width: 280 },
    { title: '门店信息', key: 'store', width: 240 },
    { title: '操作信息', key: 'operation', width: 250 },
    { title: '品项信息', key: 'item', width: 260 },
    { title: '备注', key: 'remark', width: 220 },
    { title: '操作', key: 'actions', width: 120 },
  ]
  return <>
    <div className="customer-panel customer-filter-panel">
      <FilterToolbar>
        <span className="customer-filter-label">门店：</span><Select aria-label="寄存门店" placeholder="请选择门店" allowClear options={storeOptions} />
        <span className="customer-filter-label">日期：</span><DatePicker.RangePicker aria-label="寄存日期范围" placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />
        <span className="customer-filter-label">类型：</span><Select aria-label="寄存类型" placeholder="请选择类型" allowClear options={storageTypeOptions} />
        <Input.Search aria-label="搜索寄存顾客" placeholder="输入顾客姓名/手机号/编号" allowClear />
        <Input.Search aria-label="搜索寄存品项" placeholder="输入产品/项目名称、编号" allowClear />
      </FilterToolbar>
      <div className="stored-value-stats"><div><span>产品寄存余量</span><strong>0</strong></div><div><span>项目寄存余量</span><strong>0</strong></div><div><span>寄存顾客人数</span><strong>0</strong></div></div>
    </div>
    <div className="customer-panel customer-data-panel"><EmptyTable ariaLabel="顾客寄存" columns={columns} width={1320} /></div>
  </>
}

function FollowupFilters({ variant, onEditRule }: { variant: VisitTab; onEditRule?: () => void }) {
  if (variant === 'rules') return <div className="customer-panel customer-filter-panel customer-rule-toolbar"><FilterRow label="回访门店"><Select aria-label="回访门店" placeholder="请选择回访门店" allowClear options={storeOptions} /></FilterRow><Button type="primary" icon={<PlusOutlined />} aria-label="新增回访计划" onClick={onEditRule}>新增回访计划</Button></div>
  return <div className="customer-panel customer-filter-panel">
    <FilterToolbar><Select aria-label="回访门店" placeholder="请选择门店" allowClear options={storeOptions} /><VisitEmployeeFilter /><VisitDateFilter /></FilterToolbar>
    <ChoiceRow label="回访场景" options={['全部', '消费品项目', '顾客生日', '新建顾客', '长期未消费', '手动创建']} />
    {variant === 'detail' ? <><ChoiceRow label="回访状态" options={['全部', '待回访(0)', '已回访(0)', '已作废(0)']} /><ChoiceRow label="超时状态" options={['全部', '未超时', '已超时']} /></> : <p className="customer-followup-note">顾客回访后 <strong>15</strong> 天内到店消费计为回访后到店，超出限定时间范围不计算。<Button type="link" size="small" onClick={onEditRule}>修改</Button></p>}
  </div>
}

function CustomerVisitPanel({ visitTab, onChangeTab, onEditRule, rules }: { visitTab: VisitTab; onChangeTab: (tab: VisitTab) => void; onEditRule: () => void; rules: VisitRule[] }) {
  const columns: TableColumnsType<EmptyRow> = visitTab === 'rules'
    ? [{ title: '回访门店', key: 'store', width: 300 }, { title: '回访规则', key: 'rule', width: 420 }, { title: '更新时间', key: 'updatedAt', width: 240 }, { title: '操作', key: 'actions', width: 120 }]
    : [{ title: '顾客信息', key: 'customer', width: 300 }, { title: '回访场景', key: 'scene', width: 240 }, { title: '计划回访时间', key: 'plannedAt', width: 260 }, { title: '回访员工', key: 'employee', width: 220 }, { title: '状态', key: 'status', width: 140 }, { title: '操作', key: 'actions', width: 120 }]
  return <div className="customer-visit-workspace">
    <div className="customer-subtabs"><Tabs activeKey={visitTab} items={[{ key: 'detail', label: '回访明细' }, { key: 'visit', label: '回访到店' }, { key: 'rules', label: '回访计划规则' }]} onChange={key => onChangeTab(key as VisitTab)} /></div>
    <FollowupFilters variant={visitTab} onEditRule={onEditRule} />
    <div className="customer-panel customer-data-panel"><EmptyTable ariaLabel={visitTab === 'rules' ? '回访计划规则' : visitTab === 'visit' ? '回访到店' : '回访明细'} columns={columns} rows={visitTab === 'rules' ? rules : []} width={visitTab === 'rules' ? 1080 : 1260} /></div>
  </div>
}

function CustomerFollowupPanel({ records }: { records: CustomerRecord[] }) {
  const [keyword, setKeyword] = useState('')
  const [assignee, setAssignee] = useState('unassigned-tracker')
  const [statFilter, setStatFilter] = useState('总顾客数')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const followupRecords = useMemo(() => records.slice(0, 1), [records])
  const visibleRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    const assigneeRecords = assignee === 'unassigned-tracker' || assignee === 'unassigned-adviser' ? followupRecords : []
    const statRecords = statFilter === '总顾客数' || statFilter === '未持卡顾客' ? assigneeRecords : []
    if (!normalized) return statRecords
    return statRecords.filter(row => `${row.name}${row.phone}${row.code}`.toLowerCase().includes(normalized))
  }, [assignee, followupRecords, keyword, statFilter])
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every(row => selectedKeys.includes(row.id))
  const toggleAll = (checked: boolean) => setSelectedKeys(checked ? visibleRecords.map(row => row.id) : [])
  const columns: TableColumnsType<CustomerRecord> = [
    { title: <Checkbox aria-label="全选顾客" checked={allVisibleSelected} indeterminate={selectedKeys.length > 0 && !allVisibleSelected} onChange={event => toggleAll(event.target.checked)} />, key: 'select', width: 48, render: (_, row) => <Checkbox aria-label={`选择${row.name || maskPhone(row.phone)}`} checked={selectedKeys.includes(row.id)} onChange={event => setSelectedKeys(current => event.target.checked ? [...new Set([...current, row.id])] : current.filter(id => id !== row.id))} /> },
    { title: '顾客信息', key: 'customer', width: 330, render: (_, row) => <div className="customer-followup-customer"><span className="customer-followup-avatar">{row.name ? row.name.slice(0, 1) : '1'}</span><div className="customer-cell-stack"><strong>{row.name || maskPhone(row.phone)}</strong><span>{row.phone}</span><span>顾客编号：{row.code}</span></div></div> },
    { title: '跟踪员工', key: 'tracker', width: 180, render: () => <span className="customer-muted">未分配</span> },
    { title: '专属顾问', key: 'adviser', width: 180, render: () => <span className="customer-muted">未分配</span> },
    { title: '会员资产', key: 'assets', width: 250, render: (_, row) => <div className="customer-cell-stack"><span>持卡：{row.cardCount}张</span><span>卡余额：{row.balance.toFixed(2)}元</span><span>次卡余额：0次</span></div> },
    { title: '累计消费', key: 'spent', width: 220, render: (_, row) => <div className="customer-cell-stack"><span>金额：{row.spent.toFixed(2)}元</span><span>次数：{row.visitCount}次</span></div> },
    { title: '操作', key: 'actions', width: 150, render: () => <div className="customer-row-actions"><Button type="link" size="small">分配</Button><Button type="link" size="small">详情</Button></div> },
  ]
  const stats = [
    { label: '总顾客数', value: followupRecords.length },
    { label: '有效持卡顾客', value: followupRecords.filter(row => row.cardCount > 0).length },
    { label: '未持卡顾客', value: followupRecords.filter(row => row.cardCount === 0).length },
    { label: '新顾客', value: 0 },
    { label: '活跃顾客', value: 0 },
    { label: '休眠顾客', value: 0 },
    { label: '流失顾客', value: 0 },
  ]
  const batchItems: MenuProps['items'] = [{ key: 'assign', label: '分配跟踪员工' }, { key: 'adviser', label: '分配专属顾问' }]
  return <div className="customer-panel customer-followup-layout">
    <aside className="customer-followup-sidebar">
      <Select aria-label="跟进门店" defaultValue="current" options={storeOptions} />
      <div className="customer-followup-assignees">{followupAssignees.map(item => <button type="button" key={item.key} className={`customer-followup-assignee${assignee === item.key ? ' is-active' : ''}`} aria-pressed={assignee === item.key} onClick={() => setAssignee(item.key)}><span>{item.label}</span><strong>{item.count}</strong></button>)}</div>
    </aside>
    <div className="customer-followup-main">
      <div className="customer-followup-stats">{stats.map(item => <button type="button" className={`customer-followup-stat${statFilter === item.label ? ' is-active' : ''}`} key={item.label} aria-pressed={statFilter === item.label} onClick={() => setStatFilter(item.label)}><strong>{item.value}</strong><span>{item.label}</span></button>)}</div>
      <div className="customer-followup-toolbar"><Input.Search aria-label="搜索跟进顾客" placeholder="输入顾客姓名/手机号/编号" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear enterButton={<SearchOutlined />} /><Dropdown menu={{ items: batchItems }} trigger={['click']}><Button disabled={selectedKeys.length === 0} icon={<DownOutlined />}>批量操作</Button></Dropdown></div>
      <div className="customer-followup-table-area">
        <Table<CustomerRecord> aria-label="顾客跟进" rowKey="id" columns={columns} dataSource={visibleRecords} pagination={false} scroll={{ x: 1320 }} locale={{ emptyText: null }} />
        {visibleRecords.length === 0 && <div className="customer-followup-empty" role="status" aria-label="顾客跟进暂无相关数据"><GoalEmpty /><span>暂无相关数据</span></div>}
        <div className="customer-followup-footer"><span>当前共搜索到{visibleRecords.length}条记录</span><Pagination size="small" current={1} pageSize={20} total={visibleRecords.length} showSizeChanger={false} hideOnSinglePage={false} /></div>
      </div>
    </div>
  </div>
}

function NewCustomerModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (record: CustomerRecord) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const save = () => {
    if (!name.trim() || !phone.trim()) return
    onSave({ id: `local-${Date.now()}`, name: name.trim(), phone: phone.trim(), code: code.trim() || '未编号', level: '无等级', cardCount: 0, balance: 0, spent: 0, visitCount: 0, lastVisit: '' })
    setName(''); setPhone(''); setCode(''); onClose()
  }
  return <Modal title="新建顾客档案" open={open} onCancel={onClose} onOk={save} okText="保存" cancelText="取消"><div className="customer-form"><label>顾客姓名<Input aria-label="顾客姓名" value={name} onChange={event => setName(event.target.value)} placeholder="请输入顾客姓名" /></label><label>手机号<Input aria-label="顾客手机号" value={phone} onChange={event => setPhone(event.target.value)} placeholder="请输入手机号" /></label><label>顾客编号<Input aria-label="顾客编号" value={code} onChange={event => setCode(event.target.value)} placeholder="可选" /></label></div></Modal>
}

function StorageModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  return <Modal title="新建寄存" open={open} onCancel={onClose} onOk={() => { onSave(); onClose() }} okText="保存" cancelText="取消"><div className="customer-form"><label>顾客<Input placeholder="请选择顾客" /></label><label>寄存类型<Select aria-label="新建寄存类型" placeholder="请选择寄存类型" options={storageTypeOptions} /></label><label>品项<Input placeholder="请输入产品或项目" /></label></div></Modal>
}

function RuleModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  const [days, setDays] = useState('15')
  return <Modal title="回访规则设置" open={open} onCancel={onClose} onOk={() => { onSave(); onClose() }} okText="确定" cancelText="取消"><div className="customer-form"><label>回访后到店计入天数<Input aria-label="回访后到店计入天数" value={days} onChange={event => setDays(event.target.value)} inputMode="numeric" /></label><p className="customer-form-hint">超过该时间范围的到店记录不会计入回访后到店。</p></div></Modal>
}

export default function CustomersPage() {
  const { session, can } = useAuth()
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as CustomerTab | null
  const tab: CustomerTab = tabs.some(item => item.key === raw) ? raw! : 'list'
  const rawVisitTab = params.get('visitTab') as VisitTab | null
  const visitTab: VisitTab = rawVisitTab === 'visit' || rawVisitTab === 'rules' ? rawVisitTab : 'detail'
  const [records, setRecords] = useState<CustomerRecord[]>(defaultCustomerRecords)
  const [visitRules, setVisitRules] = useState<VisitRule[]>([])
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [storageModalOpen, setStorageModalOpen] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const setTab = (next: CustomerTab) => setParams(currentQuery(current => { current.set('tab', next); if (next !== 'visit') current.delete('visitTab') }))
  const setVisitTab = (next: VisitTab) => setParams(currentQuery(current => { current.set('tab', 'visit'); current.set('visitTab', next) }))
  const exportRecords = () => { void message.info(records.length ? `已准备导出${records.length}条顾客记录` : '当前没有可导出的顾客记录') }
  const content = tab === 'advanced'
    ? <AdvancedSearchPanel />
    : tab === 'stored'
      ? <StoredValuePanel />
    : tab === 'visit'
        ? <CustomerVisitPanel visitTab={visitTab} onChangeTab={setVisitTab} onEditRule={() => setRuleModalOpen(true)} rules={visitRules} />
        : tab === 'followup'
          ? <CustomerFollowupPanel records={records} />
          : tab === 'reminders'
            ? <CustomerReminderContent />
            : <CustomerListPanel records={records} />
  if (!session?.userInfo.platformAdmin && !can('home:read')) return <Result status="403" title="暂无顾客查看权限" subTitle="请联系企业管理员分配首页或顾客经营权限。" />
  return <section className="customers-page" aria-labelledby="customers-title">
    <h1 id="customers-title" className="visually-hidden">顾客经营</h1>
    <div className="customer-tabs-bar">
      <Tabs className="customer-tabs" activeKey={tab} items={tabs} onChange={key => setTab(key as CustomerTab)} />
      <TopActions>
        {tab === 'list' && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCustomerModalOpen(true)}>新建顾客档案</Button>}
        {tab === 'stored' && <Button type="primary" icon={<PlusOutlined />} onClick={() => setStorageModalOpen(true)}>新建寄存</Button>}
        {tab === 'followup' && <Button type="primary" icon={<QuestionCircleOutlined />} onClick={() => setExplanationOpen(true)}>数据说明</Button>}
        {(tab === 'list' || tab === 'advanced' || tab === 'stored' || (tab === 'visit' && visitTab === 'detail')) && <Button icon={<DownloadOutlined />} onClick={exportRecords}>批量导出</Button>}
      </TopActions>
    </div>
    {content}
    <NewCustomerModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onSave={record => { setRecords(current => [...current, record]); void message.success('顾客档案已保存') }} />
    <StorageModal open={storageModalOpen} onClose={() => setStorageModalOpen(false)} onSave={() => { void message.success('寄存记录已保存') }} />
    <RuleModal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} onSave={() => { setVisitRules(current => [...current, { id: `rule-${Date.now()}`, store: '当前门店', description: '回访后15天内到店计入回访后到店', updatedAt: '刚刚' }]); void message.success('回访规则已保存') }} />
    <Modal title="顾客跟进数据说明" open={explanationOpen} onCancel={() => setExplanationOpen(false)} footer={<Button type="primary" onClick={() => setExplanationOpen(false)}>知道了</Button>}><p>顾客跟进会汇总待回访、已回访和已作废记录，支持按门店、员工、计划时间和超时状态筛选。</p></Modal>
  </section>
}
