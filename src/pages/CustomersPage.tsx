import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, Checkbox, DatePicker, Descriptions, Drawer, Dropdown, Image, Input, InputNumber, Modal, Pagination, Radio, Result, Select, Space, Spin, Switch, Table, Tabs, Upload } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, DownloadOutlined, DownOutlined, EditOutlined, EyeOutlined, PlusOutlined, QuestionCircleOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoalEmpty } from '@/components/GoalEmpty'
import { useAuth } from '@/context/AuthContext'
import { CustomerReminderContent } from '@/pages/CustomerReminderPage'
import { EnterpriseSelector } from '@/components/iam/PlatformDataPanel'
import { catalogRequest, useCatalogQuery } from '@/api/catalog'
import { errorMessage, QueryError } from '@/components/iam/shared'
import type { Department, PageResult } from '@/types/iam'
import type { CatalogItem } from '@/types/catalog'
import '@/styles/customers.css'

type CustomerTab = 'list' | 'advanced' | 'stored' | 'visit' | 'followup' | 'reminders'
type VisitTab = 'detail' | 'visit' | 'rules'

interface EmptyRow { id: string | number }

interface CustomerRecord extends EmptyRow {
  tenantId?: number
  tenantName?: string
  tenantCode?: string
  name: string
  phone: string
  code: string
  level: string
  cardCount: number
  cardName?: string
  balance: number
  spent: number
  visitCount: number
  lastVisit: string
  tracker?: string
  adviser?: string
  storeId?: number | null
  storeName?: string
  source?: string
  birthday?: string
  birthdayType?: string
  gender?: string
  joinDate?: string
  avatarUrl?: string
  referrer?: string
  initialSpent?: number
  referralDate?: string
  remark?: string
  storageCount?: number
}

interface VisitRule extends EmptyRow {
  store: string
  description: string
  updatedAt: string
}

interface StoredRecord extends EmptyRow {
  batchId: string
  customerId: number
  phone?: string
  customerCode?: string
  storeId?: number | null
  storageType: 'PRODUCT' | 'PROJECT'
  quantity: number
  customer: string
  store: string
  operation: string
  item: string
  itemCode?: string
  itemCategory?: string
  operatorName?: string
  createTime?: string
  remark: string
}

interface StoredApiRecord {
  id: number
  batchId?: string
  customerId: number
  customerName: string
  phone: string
  customerCode: string
  storeId?: number | null
  storeName: string
  storageType: 'PRODUCT' | 'PROJECT'
  itemName: string
  itemId?: number | null
  itemCode?: string
  itemCategory?: string
  quantity: number
  remark?: string
  operatorName?: string
  operationType?: string
  revoked?: number | boolean
  revokeTime?: string
  createTime?: string
}

interface StorageBatchDetail {
  batchId: string
  customerId: number
  customerName: string
  phone: string
  customerCode: string
  storeId?: number | null
  storeName: string
  operatorName?: string
  createTime?: string
  remark?: string
  items: StoredApiRecord[]
}

interface StorageDraftLine {
  itemId: number
  itemName: string
  itemCode?: string
  category?: string
  storageType: 'PRODUCT' | 'PROJECT'
  quantity: number
}

const tabs: { key: CustomerTab; label: string }[] = [
  { key: 'list', label: '顾客列表' },
  { key: 'advanced', label: '高级查询' },
  { key: 'stored', label: '顾客寄存' },
  { key: 'visit', label: '顾客回访' },
  { key: 'followup', label: '顾客跟进' },
]

const storeOptions: Array<{ value: string | number; label: string }> = [{ value: 'current', label: '当前门店' }]
const fallbackCustomerCardNames = ['3980会员卡', '8880会员卡', '13800会员卡', '21800会员卡', '32800会员卡']
const sourceOptions = [
  { value: '默认', label: '默认' },
  { value: '消费股东', label: '消费股东' },
  { value: '抖音', label: '抖音' },
  { value: '小红书', label: '小红书' },
  { value: '美团', label: '美团' },
  { value: '路过', label: '路过' },
  { value: '老带新', label: '老带新' },
  { value: '微信', label: '微信' },
]
const storageTypeOptions = [{ value: 'product', label: '产品寄存' }, { value: 'service', label: '项目寄存' }]

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

function downloadCustomerCsv(records: CustomerRecord[]) {
  if (records.length === 0) return false
  const escape = (value: string) => {
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [
    ['顾客姓名', '手机号', '顾客编号', '会员等级', '持卡数量', '卡余额', '累计消费', '消费次数'],
    ...records.map(row => [row.name, row.phone, row.code, row.level, `${row.cardCount}`, row.balance.toFixed(2), row.spent.toFixed(2), `${row.visitCount}`]),
  ]
  const csv = rows.map(row => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = '顾客列表.csv'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function downloadStorageCsv(records: StoredRecord[]) {
  if (records.length === 0) return false
  const escape = (value: string) => {
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [
    ['顾客姓名', '手机号', '顾客编号', '寄存门店', '寄存类型', '品项名称', '品项编号', '品项分类', '余量', '操作员工', '创建时间', '备注'],
    ...records.map(row => [row.customer, row.phone ?? '', row.customerCode ?? '', row.store, row.storageType === 'PRODUCT' ? '产品寄存' : '项目寄存', row.item, row.itemCode ?? '', row.itemCategory ?? '', `${row.quantity}`, row.operatorName ?? '', row.createTime ?? '', row.remark]),
  ]
  const csv = rows.map(row => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = '顾客寄存.csv'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="customer-filter-row"><span className="customer-filter-label">{label}：</span><div className="customer-filter-content">{children}</div></div>
}

function ChoiceRow({ label, options, value = '全部', onChange, customInput, dateRange, onDateRangeChange, numberRange, onNumberRangeChange }: {
  label: string
  options: string[]
  value?: string
  onChange?: (value: string) => void
  customInput?: 'date' | 'number'
  dateRange?: [Dayjs, Dayjs]
  onDateRangeChange?: (value?: [Dayjs, Dayjs]) => void
  numberRange?: [number | undefined, number | undefined]
  onNumberRangeChange?: (value: [number | undefined, number | undefined]) => void
}) {
  return <FilterRow label={label}><div className="customer-choice-list">{options.map(option => <button type="button" key={option} className={`customer-choice${value === option ? ' is-active' : ''}`} aria-pressed={value === option} onClick={() => onChange?.(option)}>{option}</button>)}</div>{value === '自定义' && customInput === 'date' && <DatePicker.RangePicker aria-label={`${label}自定义范围`} value={dateRange} onChange={dates => onDateRangeChange?.(dates?.[0] && dates[1] ? [dates[0], dates[1]] : undefined)} placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />}{value === '自定义' && customInput === 'number' && <Space.Compact className="customer-number-range"><InputNumber aria-label={`${label}最小值`} min={0} value={numberRange?.[0]} onChange={next => onNumberRangeChange?.([next ?? undefined, numberRange?.[1]])} placeholder="最小值" /><span className="customer-range-separator">~</span><InputNumber aria-label={`${label}最大值`} min={0} value={numberRange?.[1]} onChange={next => onNumberRangeChange?.([numberRange?.[0], next ?? undefined])} placeholder="最大值" /></Space.Compact>}</FilterRow>
}

function EmptyTable<T extends EmptyRow>({
  ariaLabel,
  columns,
  rows = [],
  footerLabel = '当前共搜索到0条记录',
  width = 1120,
  showHeader = true,
  current = 1,
  pageSize = 10,
  total,
  onPageChange,
}: {
  ariaLabel: string
  columns: TableColumnsType<T>
  rows?: T[]
  footerLabel?: string
  width?: number
  showHeader?: boolean
  current?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number, pageSize: number) => void
}) {
  const empty = rows.length === 0
  const recordTotal = total ?? rows.length
  return <div className="customer-table-area">
    <Table<T> aria-label={ariaLabel} rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: width }} showHeader={showHeader} locale={{ emptyText: null }} />
    {empty && <div className="customer-table-state" role="status" aria-label={`${ariaLabel}暂无相关数据`}><GoalEmpty /><span>暂无相关数据</span></div>}
    <div className="customer-table-footer"><span>{footerLabel}</span><Pagination size="small" current={current} pageSize={pageSize} total={recordTotal} showSizeChanger={false} hideOnSinglePage={false} onChange={onPageChange ?? (() => undefined)} /></div>
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

function CustomerCardSearchModal({ open, value, cardNames, onClose, onSelect }: { open: boolean; value: string; cardNames: string[]; onClose: () => void; onSelect: (name: string) => void }) {
  const [category, setCategory] = useState('全部')
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    if (open) {
      setCategory('全部')
      setKeyword(value)
    }
  }, [open, value])
  const categories = ['全部', '储值卡', '次卡', '期限卡']
  const visibleCards = cardNames.filter(name => !keyword.trim() || name.toLowerCase().includes(keyword.trim().toLowerCase()))
  return <Modal
    title="选择会员卡"
    open={open}
    onCancel={onClose}
    width={900}
    className="customer-card-search-modal"
    footer={<div className="customer-card-search-footer"><span>共选择{value ? 1 : 0}项</span><Space><Button onClick={onClose}>取消</Button><Button type="primary" disabled={!value} onClick={onClose}>确认选择</Button></Space></div>}
  >
    <div className="customer-card-search-categories" role="tablist" aria-label="会员卡分类">
      {categories.map(item => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
    </div>
    <Input.Search aria-label="搜索会员卡" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="请输入卡名称搜索" allowClear />
    <div className="customer-card-search-grid">
      {visibleCards.map(name => <button key={name} type="button" className={`customer-card-option${value === name ? ' is-selected' : ''}`} onClick={() => { onSelect(name); onClose() }}><strong>{name}</strong><span>会员卡</span></button>)}
      {visibleCards.length === 0 && <div className="customer-card-search-empty">暂无相关会员卡</div>}
    </div>
    <div className="customer-card-search-pagination"><span>共 {visibleCards.length} 条</span><Pagination size="small" current={1} pageSize={10} total={visibleCards.length} showSizeChanger={false} hideOnSinglePage onChange={() => undefined} /></div>
  </Modal>
}

function CustomerListPanel({ records, stores = [], cardNames = fallbackCustomerCardNames, onDetail, onMore, onQuickAction, showTenant = false }: { records: CustomerRecord[]; stores?: Department[]; cardNames?: string[]; onDetail: (row: CustomerRecord) => void; onMore: (action: 'edit' | 'delete', row: CustomerRecord) => void; onQuickAction?: (action: 'billing' | 'card', row: CustomerRecord) => void; showTenant?: boolean }) {
  const [keyword, setKeyword] = useState('')
  const [cardFilterType, setCardFilterType] = useState('holding')
  const [cardName, setCardName] = useState('')
  const [cardSearchOpen, setCardSearchOpen] = useState(false)
  const [storeId, setStoreId] = useState<number | 'current' | 'none'>()
  const [spentRange, setSpentRange] = useState<[number | undefined, number | undefined]>([undefined, undefined])
  const [cardStatus, setCardStatus] = useState('全部')
  const [level, setLevel] = useState('全部')
  const [lastSpend, setLastSpend] = useState('全部')
  const [lastSpendRange, setLastSpendRange] = useState<[Dayjs, Dayjs]>()
  const [visitCount, setVisitCount] = useState('全部')
  const [visitCountRange, setVisitCountRange] = useState<[number | undefined, number | undefined]>([undefined, undefined])
  const [birthdayRange, setBirthdayRange] = useState('全部')
  const [birthdayDateRange, setBirthdayDateRange] = useState<[Dayjs, Dayjs]>()
  const [source, setSource] = useState<string>()
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState('created-desc')
  const [page, setPage] = useState(1)
  const storeChoices = stores.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name }))
  const storeSelectOptions: Array<{ value: number | string; label: string }> = [
    { value: 'current', label: showTenant ? '全部企业' : '当前门店' },
    ...storeChoices,
    { value: 'none', label: '无门店' },
  ]
  const visibleRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    const cardKeyword = cardName.trim().toLowerCase()
    const tagKeyword = tag.trim().toLowerCase()
    const [minSpent, maxSpent] = spentRange
    const now = dayjs()
    const filtered = records.filter(row => {
      if (normalized && !`${row.name}${row.phone}${row.code}`.toLowerCase().includes(normalized)) return false
      if (typeof storeId === 'number' && row.storeId !== storeId) return false
      if (storeId === 'none' && row.storeId != null) return false
      if (cardFilterType === 'not-holding' && row.cardCount > 0) return false
      if (cardKeyword && records.some(item => item.cardName) && !(row.cardName ?? '').toLowerCase().includes(cardKeyword)) return false
      if (minSpent !== undefined && row.spent < minSpent) return false
      if (maxSpent !== undefined && row.spent > maxSpent) return false
      if (cardStatus === '持卡' && row.cardCount <= 0) return false
      if (cardStatus === '未持卡' && row.cardCount > 0) return false
      if (level !== '全部' && row.level !== level) return false
      if (source) {
        const sourceAliases: Record<string, string[]> = { '线下到店': ['线下到店', 'offline'], '线上渠道': ['线上渠道', 'online'] }
        if (!(sourceAliases[source] ?? [source]).includes(row.source ?? '')) return false
      }
      if (tagKeyword && !`${row.remark ?? ''}${(row as CustomerRecord & { tags?: string }).tags ?? ''}`.toLowerCase().includes(tagKeyword)) return false
      if (visitCount !== '全部' && visitCount !== '自定义') {
        const limit = visitCount === '1次及以内' ? 1 : visitCount === '3次及以内' ? 3 : visitCount === '5次及以内' ? 5 : undefined
        if (limit !== undefined && row.visitCount > limit) return false
      }
      if (visitCount === '自定义') {
        const [min, max] = visitCountRange
        if (min !== undefined && row.visitCount < min) return false
        if (max !== undefined && row.visitCount > max) return false
      }
      if (lastSpend !== '全部' && lastSpend !== '自定义') {
        const last = row.lastVisit ? dayjs(row.lastVisit) : undefined
        const days = last?.isValid() ? now.diff(last, 'day') : Number.POSITIVE_INFINITY
        const limit = Number(lastSpend.match(/\d+/)?.[0] ?? 0)
        // “30天内未消费” means there has been no consumption in the most
        // recent 30 days, so a recent visit must be excluded.
        if (days < limit) return false
      }
      if (lastSpend === '自定义' && lastSpendRange && row.lastVisit) {
        const last = dayjs(row.lastVisit)
        if (!last.isValid() || last.isBefore(lastSpendRange[0], 'day') || last.isAfter(lastSpendRange[1], 'day')) return false
      }
      if (lastSpend === '自定义' && lastSpendRange && !row.lastVisit) {
        return false
      }
      if (birthdayRange !== '全部' && birthdayRange !== '自定义' && row.birthday) {
        const sourceBirthday = dayjs(row.birthday)
        const birthday = sourceBirthday.isValid() ? sourceBirthday.year(now.year()) : sourceBirthday
        const nextBirthday = birthday.isBefore(now, 'day') ? birthday.add(1, 'year') : birthday
        const days = nextBirthday.isValid() ? now.startOf('day').diff(nextBirthday.startOf('day'), 'day') * -1 : Number.POSITIVE_INFINITY
        const limit = birthdayRange === '今天' ? 0 : birthdayRange === '未来3天' ? 3 : 7
        if (days < 0 || days > limit) return false
      }
      if (birthdayRange === '自定义' && birthdayDateRange) {
        const sourceBirthday = row.birthday ? dayjs(row.birthday) : undefined
        if (!sourceBirthday?.isValid()) return false
        const birthday = sourceBirthday.year(now.year())
        if (birthday.isBefore(birthdayDateRange[0], 'day') || birthday.isAfter(birthdayDateRange[1], 'day')) return false
      }
      return true
    })
    return filtered.sort((a, b) => sort === 'created-asc' ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id))
  }, [birthdayDateRange, birthdayRange, cardFilterType, cardName, cardStatus, keyword, lastSpend, lastSpendRange, level, records, sort, source, spentRange, storeId, tag, visitCount, visitCountRange])
  useEffect(() => { setPage(1) }, [keyword, cardFilterType, cardName, storeId, spentRange, cardStatus, level, lastSpend, lastSpendRange, visitCount, visitCountRange, birthdayRange, birthdayDateRange, source, tag, sort, records.length])
  const pageSize = 10
  const pagedRecords = visibleRecords.slice((page - 1) * pageSize, page * pageSize)
  const columns: TableColumnsType<CustomerRecord> = [
    { title: '顾客信息', key: 'customer', width: 280, render: (_, row) => <div className="customer-customer-cell"><span className="customer-list-avatar">{(row.name || row.phone || '顾').slice(0, 1)}</span><div className="customer-cell-stack"><strong className="customer-primary-text">{row.name || maskPhone(row.phone)}</strong><span>{row.phone}</span><span>顾客编号：{row.code}</span><span>{row.level}</span></div></div> },
    ...(showTenant ? [{ title: '所属企业', key: 'tenant', width: 190, render: (_: unknown, row: CustomerRecord) => <div className="customer-cell-stack"><strong>{row.tenantName || '—'}</strong><span>{row.tenantCode || (row.tenantId ? `租户 ID ${row.tenantId}` : '—')}</span></div> }] : []),
    { title: '顾客资产', key: 'assets', width: 220, render: (_, row) => <div className="customer-cell-stack"><span>持卡：{row.cardCount}张</span><span>卡余额：{row.balance.toFixed(2)}元</span><span>次卡余量：0次</span></div> },
    { title: '累计消费', key: 'spent', width: 180, render: (_, row) => <div className="customer-cell-stack"><span>金额：{row.spent.toFixed(2)}元</span><span>次数：{row.visitCount}次</span></div> },
    { title: '上次消费信息', key: 'lastOrder', width: 240, render: (_, row) => row.lastVisit || '暂无消费信息' },
    { title: '操作', key: 'actions', width: 150, render: (_, row) => <div className="customer-row-actions customer-row-actions-grid"><Button type="link" size="small" onClick={() => onQuickAction?.('billing', row)}>开单</Button><Button type="link" size="small" onClick={() => onQuickAction?.('card', row)}>开卡</Button><Button type="link" size="small" onClick={() => onDetail(row)}>详情</Button><Dropdown trigger={['click']} menu={{ items: [{ key: 'edit', label: '编辑' }, { key: 'delete', label: '删除', danger: true }], onClick: ({ key }) => onMore(key as 'edit' | 'delete', row) }}><Button type="link" size="small">更多</Button></Dropdown></div> },
  ]
  return <>
    <div className="customer-panel customer-filter-panel">
      <FilterToolbar>
        <span className="customer-filter-label">基础搜索：</span>
        <Input.Search aria-label="搜索顾客" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="输入顾客姓名/手机号/编号" allowClear enterButton={<SearchOutlined />} />
        <Space.Compact className="customer-card-filter">
          <Select aria-label="会员卡筛选类型" value={cardFilterType} onChange={setCardFilterType} options={[{ value: 'holding', label: '持卡' }, { value: 'not-holding', label: '未持卡' }]} />
          <Input aria-label="搜索会员卡" value={cardName} onChange={event => setCardName(event.target.value)} onClick={() => { if (cardFilterType !== 'not-holding') setCardSearchOpen(true) }} placeholder="输入卡名称搜索" disabled={cardFilterType === 'not-holding'} allowClear />
        </Space.Compact>
        <Select aria-label="所属门店" placeholder="请选择门店" allowClear value={storeId} onChange={setStoreId} options={storeSelectOptions} />
      </FilterToolbar>
      <FilterRow label="消费金额"><InputNumber aria-label="消费金额下限" min={0} precision={2} value={spentRange[0]} onChange={value => setSpentRange([value ?? undefined, spentRange[1]])} placeholder="请输入金额" /><span className="customer-range-separator">~</span><InputNumber aria-label="消费金额上限" min={0} precision={2} value={spentRange[1]} onChange={value => setSpentRange([spentRange[0], value ?? undefined])} placeholder="请输入金额" /></FilterRow>
      <ChoiceRow label="持卡状态" options={['全部', '持卡', '未持卡']} value={cardStatus} onChange={setCardStatus} />
      <ChoiceRow label="会员等级" options={['全部', '无等级']} value={level} onChange={setLevel} />
      <ChoiceRow label="上次消费" options={['全部', '30天内未消费', '60天内未消费', '90天内未消费', '自定义']} value={lastSpend} onChange={setLastSpend} customInput="date" dateRange={lastSpendRange} onDateRangeChange={setLastSpendRange} />
      <ChoiceRow label="消费次数" options={['全部', '1次及以内', '3次及以内', '5次及以内', '自定义']} value={visitCount} onChange={setVisitCount} customInput="number" numberRange={visitCountRange} onNumberRangeChange={setVisitCountRange} />
      <ChoiceRow label="近期生日" options={['全部', '今天', '未来3天', '未来7天', '自定义']} value={birthdayRange} onChange={setBirthdayRange} customInput="date" dateRange={birthdayDateRange} onDateRangeChange={setBirthdayDateRange} />
      <FilterRow label="顾客来源"><Select aria-label="顾客来源" placeholder="请选择顾客来源" allowClear value={source} onChange={setSource} options={sourceOptions} /><Input aria-label="顾客标签" value={tag} onChange={event => setTag(event.target.value)} placeholder="请输入个性标签搜索" allowClear /></FilterRow>
    </div>
    <div className="customer-panel customer-data-panel">
      <div className="customer-result-heading"><span>共搜索到{visibleRecords.length}个顾客</span><Select aria-label="顾客排序" size="small" value={sort} onChange={setSort} options={[{ value: 'created-desc', label: '顾客建档时间(由近到远)' }, { value: 'created-asc', label: '顾客建档时间(由远到近)' }]} /></div>
      <EmptyTable ariaLabel="顾客列表" columns={columns} rows={pagedRecords} total={visibleRecords.length} current={page} pageSize={pageSize} onPageChange={setPage} footerLabel={`共搜索到${visibleRecords.length}个顾客`} width={showTenant ? 1260 : 1080} />
    </div>
    <CustomerCardSearchModal open={cardSearchOpen} value={cardName} cardNames={cardNames} onClose={() => setCardSearchOpen(false)} onSelect={setCardName} />
  </>
}

function AdvancedSearchPanel({ records, onDetail, onQuickAction }: { records: CustomerRecord[]; onDetail: (row: CustomerRecord) => void; onQuickAction?: (action: 'billing' | 'card', row: CustomerRecord) => void }) {
  const [category, setCategory] = useState('基本信息')
  const [condition, setCondition] = useState('性别')
  const [value, setValue] = useState('')
  const conditionMap: Record<string, string[]> = {
    基本信息: ['性别', '来源渠道', '所属门店', '近期生日', '年龄段'],
    高级信息: ['顾客标签', '顾客来源', '跟踪员工', '注册时间'],
    资产信息: ['会员卡', '储值余额', '项目余量', '产品余量'],
    消费能力: ['累计消费', '消费次数', '客单价', '最近消费'],
  }
  const visibleRecords = useMemo(() => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return records
    return records.filter(row => {
      const fields: Record<string, unknown> = {
        性别: row.gender,
        来源渠道: row.source,
        所属门店: row.storeName,
        近期生日: row.birthday,
        年龄段: '',
        顾客标签: `${row.remark ?? ''}${(row as CustomerRecord & { tags?: string }).tags ?? ''}`,
        顾客来源: row.source,
        跟踪员工: row.tracker,
        注册时间: row.joinDate,
        会员卡: row.cardCount > 0 ? '持卡' : '未持卡',
        储值余额: row.balance,
        项目余量: 0,
        产品余量: 0,
        累计消费: row.spent,
        消费次数: row.visitCount,
        客单价: row.visitCount > 0 ? row.spent / row.visitCount : 0,
        最近消费: row.lastVisit,
      }
      return String(fields[condition] ?? '').toLowerCase().includes(normalized)
    })
  }, [condition, records, value])
  const columns: TableColumnsType<CustomerRecord> = [
    { title: '顾客信息', key: 'customer', width: 280, render: (_, row) => <div className="customer-customer-cell"><span className="customer-list-avatar">{(row.name || row.phone || '顾').slice(0, 1)}</span><div className="customer-cell-stack"><strong className="customer-primary-text">{row.name || maskPhone(row.phone)}</strong><span>{row.phone}</span><span>顾客编号：{row.code}</span><span>{row.level}</span></div></div> },
    { title: '顾客资产', key: 'assets', width: 220, render: (_, row) => <div className="customer-cell-stack"><span>持卡：{row.cardCount}张</span><span>卡余额：{row.balance.toFixed(2)}元</span><span>次卡余量：0次</span></div> },
    { title: '累计消费', key: 'spent', width: 180, render: (_, row) => <div className="customer-cell-stack"><span>金额：{row.spent.toFixed(2)}元</span><span>次数：{row.visitCount}次</span></div> },
    { title: '上次消费信息', key: 'lastOrder', width: 240, render: (_, row) => row.lastVisit || '暂无消费信息' },
    { title: '操作', key: 'actions', width: 150, render: (_, row) => <div className="customer-row-actions customer-row-actions-grid"><Button type="link" size="small" onClick={() => onQuickAction?.('billing', row)}>开单</Button><Button type="link" size="small" onClick={() => onQuickAction?.('card', row)}>开卡</Button><Button type="link" size="small" onClick={() => onDetail(row)}>详情</Button></div> },
  ]
  return <>
    <div className="customer-panel customer-filter-panel customer-advanced-panel">
      <FilterRow label="条件分类"><div className="customer-choice-list" role="tablist" aria-label="高级查询条件分类">{Object.keys(conditionMap).map(item => <button type="button" role="tab" key={item} className={`customer-choice${category === item ? ' is-active' : ''}`} aria-selected={category === item} aria-pressed={category === item} onClick={() => { setCategory(item); setCondition(conditionMap[item][0]) }}>{item}</button>)}</div></FilterRow>
      <FilterRow label="选择条件"><div className="customer-choice-list">{conditionMap[category].map(item => <button type="button" key={item} className={`customer-choice${condition === item ? ' is-active' : ''}`} aria-pressed={condition === item} onClick={() => setCondition(item)}>{item}</button>)}</div></FilterRow>
      <FilterRow label="查询值"><Input aria-label="高级查询值" value={value} onChange={event => setValue(event.target.value)} placeholder={`请输入${condition}`} allowClear /></FilterRow>
    </div>
    <div className="customer-panel customer-data-panel"><div className="customer-result-heading"><span>共搜索到{visibleRecords.length}个顾客</span></div><EmptyTable ariaLabel="高级查询结果" columns={columns} rows={visibleRecords} total={visibleRecords.length} footerLabel={`共搜索到${visibleRecords.length}个顾客`} width={1080} /></div>
  </>
}

function StoredValuePanel({ records, stores = [], loading, error, onRetry, onDetail, onRevoke }: { records: StoredRecord[]; stores?: Department[]; loading: boolean; error?: string; onRetry: () => void; onDetail: (batchId: string) => void; onRevoke: (row: StoredRecord) => void }) {
  const [customerKeyword, setCustomerKeyword] = useState('')
  const [itemKeyword, setItemKeyword] = useState('')
  const [type, setType] = useState<string>()
  const [storeId, setStoreId] = useState<number>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>()
  const [page, setPage] = useState(1)
  const pageSize = 10
  const storeSelectOptions = stores.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name }))
  const visibleRecords = useMemo(() => {
    const customerText = customerKeyword.trim().toLowerCase()
    const itemText = itemKeyword.trim().toLowerCase()
    return records.filter(row => {
      const created = row.createTime ? dayjs(row.createTime) : undefined
      return (!storeId || row.storeId === storeId)
        && (!type || row.storageType === type)
        && (!range || !created || (created.isAfter(range[0].startOf('day').subtract(1, 'ms')) && created.isBefore(range[1].endOf('day').add(1, 'ms'))))
        && (!customerText || `${row.customer}${row.phone ?? ''}${row.customerCode ?? ''}`.toLowerCase().includes(customerText))
        && (!itemText || `${row.item}${row.itemCode ?? ''}${row.itemCategory ?? ''}`.toLowerCase().includes(itemText))
    })
  }, [customerKeyword, itemKeyword, range, records, storeId, type])
  useEffect(() => { setPage(1) }, [customerKeyword, itemKeyword, range, storeId, type, records.length])
  const pagedRecords = visibleRecords.slice((page - 1) * pageSize, page * pageSize)
  const columns: TableColumnsType<StoredRecord> = [
    { title: '顾客信息', key: 'customer', width: 250, render: (_, row) => <div className="customer-cell-stack"><strong>{row.customer || maskPhone(row.phone ?? '')}</strong><span>{row.phone ? maskPhone(row.phone) : '—'} · 编号 {row.customerCode || '—'}</span></div> },
    { title: '门店信息', dataIndex: 'store', key: 'store', width: 220 },
    { title: '操作信息', key: 'operation', width: 230, render: (_, row) => <div className="customer-cell-stack"><span>{row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '—'}</span><span>{row.operatorName || '负责人'} · {row.operation}</span></div> },
    { title: '品项信息', key: 'item', width: 280, render: (_, row) => <div className="customer-cell-stack"><strong>{row.item}</strong><span>{row.itemCategory || (row.storageType === 'PRODUCT' ? '产品' : '项目')} · {row.itemCode || '—'} · 余量 {row.quantity}</span></div> },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 220, render: value => value || '—' },
    { title: '操作', key: 'actions', width: 150, render: (_, row) => <div className="customer-row-actions"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onDetail(row.batchId)}>详情</Button><Button type="link" danger size="small" onClick={() => onRevoke(row)}>撤销</Button></div> },
  ]
  return <>
    <div className="customer-panel customer-filter-panel">
      <FilterToolbar>
        <span className="customer-filter-label">门店：</span><Select aria-label="寄存门店" placeholder="请选择门店" allowClear value={storeId} onChange={setStoreId} options={storeSelectOptions.length > 0 ? storeSelectOptions : storeOptions} />
        <span className="customer-filter-label">日期：</span><DatePicker.RangePicker aria-label="寄存日期范围" value={range} onChange={dates => setRange(dates?.[0] && dates[1] ? [dates[0], dates[1]] : undefined)} placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />
        <span className="customer-filter-label">类型：</span><Select aria-label="寄存类型" placeholder="请选择类型" allowClear value={type === undefined ? undefined : type === 'PRODUCT' ? 'product' : 'service'} onChange={value => setType(value === undefined ? undefined : value === 'product' ? 'PRODUCT' : 'PROJECT')} options={storageTypeOptions} />
        <Input.Search aria-label="搜索寄存顾客" placeholder="输入顾客姓名/手机号/编号" allowClear value={customerKeyword} onChange={event => setCustomerKeyword(event.target.value)} onSearch={setCustomerKeyword} />
        <Input.Search aria-label="搜索寄存品项" placeholder="输入产品/项目名称、编号" allowClear value={itemKeyword} onChange={event => setItemKeyword(event.target.value)} onSearch={setItemKeyword} />
      </FilterToolbar>
      <div className="stored-value-stats"><div><span>产品寄存余量</span><strong>{records.filter(row => row.storageType === 'PRODUCT').reduce((sum, row) => sum + row.quantity, 0)}</strong></div><div><span>项目寄存余量</span><strong>{records.filter(row => row.storageType === 'PROJECT').reduce((sum, row) => sum + row.quantity, 0)}</strong></div><div><span>寄存顾客人数</span><strong>{new Set(records.map(row => row.customerId)).size}</strong></div></div>
    </div>
    <div className="customer-panel customer-data-panel">{loading && <Spin />} {error && <QueryError error={error} onRetry={onRetry} />} {!loading && !error && <EmptyTable ariaLabel="顾客寄存" columns={columns} rows={pagedRecords} total={visibleRecords.length} current={page} pageSize={pageSize} onPageChange={setPage} footerLabel={`当前共搜索到${visibleRecords.length}条记录`} width={1320} />}</div>
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

function CustomerFollowupPanel({ records, onDetail, onAssign }: { records: CustomerRecord[]; onDetail: (row: CustomerRecord) => void; onAssign: (rows: CustomerRecord[], target: 'tracker' | 'adviser') => void }) {
  const [keyword, setKeyword] = useState('')
  const [assignee, setAssignee] = useState('unassigned-tracker')
  const [statFilter, setStatFilter] = useState('总顾客数')
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([])
  const [page, setPage] = useState(1)
  const followupRecords = records
  const visibleRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    const assigneeRecords = assignee === 'unassigned-tracker' || assignee === 'unassigned-adviser' ? followupRecords : []
    const statRecords = statFilter === '总顾客数' || statFilter === '未持卡顾客' ? assigneeRecords : []
    if (!normalized) return statRecords
    return statRecords.filter(row => `${row.name}${row.phone}${row.code}`.toLowerCase().includes(normalized))
  }, [assignee, followupRecords, keyword, statFilter])
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every(row => selectedKeys.includes(row.id))
  const pageSize = 20
  const pagedRecords = visibleRecords.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1); setSelectedKeys([]) }, [assignee, keyword, statFilter, records.length])
  const toggleAll = (checked: boolean) => setSelectedKeys(checked ? visibleRecords.map(row => row.id) : [])
  const columns: TableColumnsType<CustomerRecord> = [
    { title: <Checkbox aria-label="全选顾客" checked={allVisibleSelected} indeterminate={selectedKeys.length > 0 && !allVisibleSelected} onChange={event => toggleAll(event.target.checked)} />, key: 'select', width: 48, render: (_, row) => <Checkbox aria-label={`选择${row.name || maskPhone(row.phone)}`} checked={selectedKeys.includes(row.id)} onChange={event => setSelectedKeys(current => event.target.checked ? [...new Set([...current, row.id])] : current.filter(id => id !== row.id))} /> },
    { title: '顾客信息', key: 'customer', width: 330, render: (_, row) => <div className="customer-followup-customer"><span className="customer-followup-avatar">{row.name ? row.name.slice(0, 1) : '1'}</span><div className="customer-cell-stack"><strong>{row.name || maskPhone(row.phone)}</strong><span>{row.phone}</span><span>顾客编号：{row.code}</span></div></div> },
    { title: '跟踪员工', key: 'tracker', width: 180, render: (_, row) => <span className={row.tracker ? undefined : 'customer-muted'}>{row.tracker || '未分配'}</span> },
    { title: '专属顾问', key: 'adviser', width: 180, render: (_, row) => <span className={row.adviser ? undefined : 'customer-muted'}>{row.adviser || '未分配'}</span> },
    { title: '会员资产', key: 'assets', width: 250, render: (_, row) => <div className="customer-cell-stack"><span>持卡：{row.cardCount}张</span><span>卡余额：{row.balance.toFixed(2)}元</span><span>次卡余额：0次</span></div> },
    { title: '累计消费', key: 'spent', width: 220, render: (_, row) => <div className="customer-cell-stack"><span>金额：{row.spent.toFixed(2)}元</span><span>次数：{row.visitCount}次</span></div> },
    { title: '操作', key: 'actions', width: 150, render: (_, row) => <div className="customer-row-actions"><Button type="link" size="small" onClick={() => onAssign([row], 'tracker')}>分配</Button><Button type="link" size="small" onClick={() => onDetail(row)}>详情</Button></div> },
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
  const batchItems: MenuProps['items'] = [{ key: 'tracker', label: '分配跟踪员工' }, { key: 'adviser', label: '分配专属顾问' }]
  return <div className="customer-panel customer-followup-layout">
    <aside className="customer-followup-sidebar">
      <Select aria-label="跟进门店" defaultValue="current" options={storeOptions} />
      <div className="customer-followup-assignees">{followupAssignees.map(item => <button type="button" key={item.key} className={`customer-followup-assignee${assignee === item.key ? ' is-active' : ''}`} aria-pressed={assignee === item.key} onClick={() => setAssignee(item.key)}><span>{item.label}</span><strong>{item.count}</strong></button>)}</div>
    </aside>
    <div className="customer-followup-main">
      <div className="customer-followup-stats">{stats.map(item => <button type="button" className={`customer-followup-stat${statFilter === item.label ? ' is-active' : ''}`} key={item.label} aria-pressed={statFilter === item.label} onClick={() => setStatFilter(item.label)}><strong>{item.value}</strong><span>{item.label}</span></button>)}</div>
      <div className="customer-followup-toolbar"><Input.Search aria-label="搜索跟进顾客" placeholder="输入顾客姓名/手机号/编号" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear enterButton={<SearchOutlined />} /><Dropdown menu={{ items: batchItems, onClick: ({ key }) => onAssign(visibleRecords.filter(row => selectedKeys.includes(row.id)), key as 'tracker' | 'adviser') }} trigger={['click']}><Button disabled={selectedKeys.length === 0} icon={<DownOutlined />}>批量操作</Button></Dropdown></div>
      <div className="customer-followup-table-area">
      <Table<CustomerRecord> aria-label="顾客跟进" rowKey="id" columns={columns} dataSource={pagedRecords} pagination={false} scroll={{ x: 1320 }} locale={{ emptyText: null }} />
        {visibleRecords.length === 0 && <div className="customer-followup-empty" role="status" aria-label="顾客跟进暂无相关数据"><GoalEmpty /><span>暂无相关数据</span></div>}
        <div className="customer-followup-footer"><span>当前共搜索到{visibleRecords.length}条记录</span><Pagination size="small" current={page} pageSize={pageSize} total={visibleRecords.length} showSizeChanger={false} hideOnSinglePage={false} onChange={setPage} /></div>
      </div>
    </div>
  </div>
}

function CustomerEditorModal({ open, initial, stores = [], onClose, onSave, onOpenCard }: { open: boolean; initial?: CustomerRecord; stores?: Department[]; onClose: () => void; onSave: (record: CustomerRecord) => Promise<number | void> | number | void; onOpenCard?: (id: number | string) => void }) {
  const { message } = App.useApp()
  const [pasteText, setPasteText] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [storeId, setStoreId] = useState<number>()
  const [gender, setGender] = useState('女')
  const [source, setSource] = useState<string>()
  const [birthday, setBirthday] = useState<Dayjs>()
  const [birthdayType, setBirthdayType] = useState('阳历')
  const [joinDate, setJoinDate] = useState<Dayjs>()
  const [tracker, setTracker] = useState('')
  const [adviser, setAdviser] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [referrer, setReferrer] = useState('')
  const [initialSpent, setInitialSpent] = useState<number>()
  const [remark, setRemark] = useState('')
  const [referralDate, setReferralDate] = useState<Dayjs>()
  const [saving, setSaving] = useState(false)
  const storeOptionsForForm = stores.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name }))
  useEffect(() => {
    if (!open) return
    setPasteText('')
    setName(initial?.name ?? '')
    setPhone(initial?.phone ?? '')
    setCode(initial?.code ?? '')
    setStoreId(initial?.storeId ?? undefined)
    setGender(initial?.gender ?? '女')
    setSource(initial?.source)
    setBirthday(initial?.birthday ? dayjs(initial.birthday) : undefined)
    setBirthdayType(initial?.birthdayType ?? '阳历')
    setJoinDate(initial?.joinDate ? dayjs(initial.joinDate) : undefined)
    setTracker(initial?.tracker ?? '')
    setAdviser(initial?.adviser ?? '')
    setAvatarUrl(initial?.avatarUrl ?? '')
    setReferrer(initial?.referrer ?? '')
    setInitialSpent(initial?.initialSpent)
    setRemark(initial?.remark ?? '')
    setReferralDate(initial?.referralDate ? dayjs(initial.referralDate) : undefined)
  }, [initial, open])
  // The departments request is asynchronous.  When a new dossier is opened
  // before it resolves, select the first active store as soon as it arrives;
  // otherwise the form looks complete but silently submits without a store.
  useEffect(() => {
    if (open && storeId === undefined && storeOptionsForForm.length > 0) setStoreId(storeOptionsForForm[0].value)
  }, [initial, open, storeId, storeOptionsForForm.length])
  const parsePaste = () => {
    const text = pasteText.trim()
    const foundPhone = text.match(/1\d{10}/)?.[0]
    const withoutPhone = foundPhone ? text.replace(foundPhone, ' ').trim() : text
    const foundName = withoutPhone.match(/[\u4e00-\u9fa5]{2,8}/)?.[0]
    if (!foundPhone && !foundName) { void message.warning('请先粘贴顾客姓名和手机号'); return }
    if (foundName) setName(foundName)
    if (foundPhone) setPhone(foundPhone)
    void message.success('已识别顾客姓名和手机号')
  }
  const readAvatar = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { void message.error('仅支持 png、jpg、Jpeg 格式的图片'); return false }
    if (file.size > 2 * 1024 * 1024) { void message.error('图片不能超过2M'); return false }
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(String(reader.result ?? ''))
    reader.readAsDataURL(file)
    return false
  }
  const save = async (openCard = false) => {
    if (!name.trim()) { void message.error('请输入顾客姓名'); return }
    if (!phone.trim()) { void message.error('请输入手机号'); return }
    if (storeOptionsForForm.length > 0 && !storeId) { void message.error('请选择所属门店'); return }
    setSaving(true)
    try {
      const id = await onSave({ id: initial?.id ?? `local-${Date.now()}`, name: name.trim(), phone: phone.trim(), code: code.trim() || '', level: initial?.level ?? '无等级', cardCount: initial?.cardCount ?? 0, balance: initial?.balance ?? 0, spent: initial ? (initial.spent ?? 0) : (initialSpent ?? 0), visitCount: initial?.visitCount ?? 0, lastVisit: initial?.lastVisit ?? '', tracker: tracker.trim() || undefined, adviser: adviser.trim() || undefined, storeId, source, birthday: birthday?.format('YYYY-MM-DD'), birthdayType, gender, joinDate: joinDate?.format('YYYY-MM-DD'), avatarUrl: avatarUrl || undefined, referrer: referrer.trim() || undefined, initialSpent, remark: remark.trim() || undefined, referralDate: referralDate?.format('YYYY-MM-DD') })
      onClose()
      if (openCard && id !== undefined) onOpenCard?.(id)
    } finally { setSaving(false) }
  }
  return <Modal className="customer-editor-modal" title={initial ? '编辑顾客档案' : '新建顾客档案'} open={open} onCancel={saving ? undefined : onClose} footer={null} width={1000} centered zIndex={1200} destroyOnHidden>
    <div className="customer-editor-scroll">
      <section className="customer-editor-section"><h3>基础信息</h3><div className="customer-paste-box"><label>粘贴识别</label><Input.TextArea aria-label="粘贴识别" value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="粘贴姓名、手机号的文字，如：秒金 137xxx" autoSize={{ minRows: 2, maxRows: 4 }} /><div className="customer-paste-action"><span>识别后自动填入姓名、手机号</span><Button type="primary" onClick={parsePaste}>解析</Button></div></div><div className="customer-editor-grid customer-editor-grid-3"><label className="customer-editor-field required"><span>顾客姓名</span><Input aria-label="顾客姓名" value={name} onChange={event => setName(event.target.value)} placeholder="请输入顾客姓名" maxLength={80} /></label><label className="customer-editor-field"><span>手机号</span><Input aria-label="顾客手机号" value={phone} onChange={event => setPhone(event.target.value)} placeholder="请输入手机号" maxLength={30} /></label><label className="customer-editor-field required"><span>所属门店</span><Select aria-label="所属门店" value={storeId} onChange={setStoreId} placeholder="请选择所属门店" options={storeOptionsForForm} allowClear /></label></div></section>
      <section className="customer-editor-section"><h3>其他信息</h3><div className="customer-editor-grid customer-editor-grid-3"><label className="customer-editor-field"><span>性别</span><Select aria-label="性别" value={gender} onChange={setGender} options={[{ value: '女', label: '女' }, { value: '男', label: '男' }, { value: '其他', label: '其他' }]} /></label><label className="customer-editor-field"><span>顾客来源</span><Select aria-label="顾客来源" value={source} onChange={setSource} placeholder="请选择顾客来源" options={sourceOptions} allowClear /></label><label className="customer-editor-field"><span>顾客生日</span><Space.Compact className="customer-birthday-control"><Select aria-label="顾客生日类型" value={birthdayType} onChange={setBirthdayType} options={[{ value: '阳历', label: '阳历' }, { value: '农历', label: '农历' }]} /><DatePicker aria-label="顾客生日" value={birthday} onChange={value => setBirthday(value ?? undefined)} placeholder="请选择日期" /></Space.Compact></label><label className="customer-editor-field"><span>入会时间</span><DatePicker aria-label="入会时间" value={joinDate} onChange={value => setJoinDate(value ?? undefined)} placeholder="请选择日期" /></label><label className="customer-editor-field"><span>跟踪员工</span><Select aria-label="跟踪员工" value={tracker || undefined} onChange={value => setTracker(value ?? '')} placeholder="请选择跟踪员工" options={followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))} allowClear /></label><label className="customer-editor-field"><span>专属顾问</span><Select aria-label="专属顾问" value={adviser || undefined} onChange={value => setAdviser(value ?? '')} placeholder="请选择专属顾问" options={followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))} allowClear /></label></div><div className="customer-editor-grid customer-editor-grid-3 customer-editor-lower-grid"><div className="customer-editor-field customer-avatar-field customer-editor-span-2"><span>顾客头像 <small>上传png、jpg、Jpeg格式的图片，图片不超过2M</small></span><Upload accept=".png,.jpg,.jpeg" showUploadList={false} beforeUpload={file => readAvatar(file as File)}><button type="button" className="customer-avatar-upload">{avatarUrl ? <img src={avatarUrl} alt="顾客头像" /> : <><UploadOutlined /><span>上传头像</span></>}</button></Upload></div><label className="customer-editor-field"><span>顾客编号</span><Input aria-label="顾客编号" value={code} onChange={event => setCode(event.target.value)} placeholder="请输入顾客编号" maxLength={64} /></label><label className="customer-editor-field"><span>推荐人</span><Select aria-label="推荐人" value={referrer || undefined} onChange={value => setReferrer(value ?? '')} placeholder="请输入推荐人搜索" options={followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))} allowClear /></label><label className="customer-editor-field"><span>初始消费金额</span><InputNumber aria-label="初始消费金额" value={initialSpent} onChange={value => setInitialSpent(value ?? undefined)} min={0} precision={2} placeholder="请输入初始消费金额" /></label></div><div className="customer-editor-grid customer-editor-grid-3"><label className="customer-editor-field customer-editor-span-2"><span>顾客备注</span><Input.TextArea aria-label="顾客备注" value={remark} onChange={event => setRemark(event.target.value)} maxLength={1000} showCount placeholder="请输入顾客备注" rows={3} /></label><label className="customer-editor-field"><span>推荐日期</span><DatePicker aria-label="推荐日期" value={referralDate} onChange={value => setReferralDate(value ?? undefined)} placeholder="请选择日期" /></label></div></section>
    </div>
    <div className="customer-editor-footer"><Button onClick={onClose} disabled={saving}>取消</Button>{!initial && <Button type="primary" ghost onClick={() => void save(true)} loading={saving}>保存并开卡</Button>}<Button type="primary" onClick={() => void save(false)} loading={saving}>保存</Button></div>
  </Modal>
}

interface CustomerHistoryRow extends EmptyRow {
  orderNo: string
  orderTime: string
  content: string
  staff: string
  total: string
}

interface CustomerArrivalRow extends EmptyRow {
  arrival: string
  staff: string
  content: string
  amount: string
}

interface CustomerAppointmentRow extends EmptyRow {
  time: string
  duration: string
  store: string
  teacher: string
  content: string
  note: string
  status: string
}

interface CustomerStorageHistoryRow extends EmptyRow {
  operationTime: string
  store: string
  type: string
  content: string
  operator: string
}

interface CustomerEditHistoryRow extends EmptyRow {
  operator: string
  operationTime: string
  event: string
}

interface CustomerSkinRow extends EmptyRow {
  imageUrl?: string
  score: string
  inputAge: string
  percentage: string
  skinAge: string
  texture: string
  sensitivity: string
  color: string
  time: string
}

interface CustomerLogRow extends EmptyRow {
  kind: '日志' | '回访'
  content: string
  operator: string
  recordTime: string
  imageName?: string
  imageUrl?: string
}

interface CustomerFollowupTaskRow extends EmptyRow {
  dueDate: string
  employee: string
  script: string
  status: string
}

interface CustomerArchiveRecord extends EmptyRow {
  content: string
  operator: string
  recordTime: string
}

type CustomerArchiveFormKey = 'consultation' | 'skin-type'

interface CustomerArchiveTemplate {
  id: number
  name: string
  type: string
  form: CustomerArchiveFormKey
}

interface ConsultationArchiveForm {
  skinStatus: string[]
  skinIssues: string[]
  careCycle?: string
  products: string[]
  workEnvironment: string[]
}

interface SkinTypeArchiveForm {
  skinType?: string
  sensitivity?: string
  sensitivityDetail: string
  acne?: string
  acneDetail: string
}

type CustomerArchiveFormData = ConsultationArchiveForm | SkinTypeArchiveForm

interface CustomerAlbumImage extends EmptyRow {
  name: string
  url: string
  createdAt: string
}

interface CustomerAttachment {
  name: string
  url: string
}

function CustomerProfileTab({ customer, onEdit }: { customer: CustomerRecord; onEdit: () => void }) {
  const [canAccess, setCanAccess] = useState(true)
  useEffect(() => setCanAccess(true), [customer.id])
  const profileFields: Array<[string, string]> = [
    ['顾客姓名', customer.name || (customer.phone ? maskPhone(customer.phone) : '—')],
    ['手机号', customer.phone || '—'],
    ['所属门店', customer.storeName || '当前门店'],
    ['性别', customer.gender || '—'],
    ['顾客来源', customer.source || '—'],
    ['顾客生日', customer.birthday || '—'],
    ['入会时间', customer.joinDate || '—'],
    ['跟踪员工', customer.tracker || '/'],
    ['专属顾问', customer.adviser || '—'],
    ['顾客编号', customer.code || '—'],
    ['推荐人', customer.referrer || '—'],
    ['初始消费金额', customer.initialSpent === undefined ? '—' : `¥${customer.initialSpent.toFixed(2)}`],
    ['顾客备注', customer.remark || '/'],
    ['推荐日期', customer.referralDate || '—'],
  ]
  return <div className="customer-profile-tab">
    <div className="customer-profile-card">
      <div className="customer-profile-grid">
        {profileFields.map(([label, value]) => <div key={label} className="customer-profile-field"><span>{label}：</span><strong>{value}</strong></div>)}
      </div>
      <div className="customer-profile-custom">自定义属性：</div>
      <Button className="customer-profile-edit" onClick={onEdit}>编辑</Button>
    </div>
    <div className="customer-profile-access"><span>顾客是否可访问门店顾客端</span><Switch checked={canAccess} onChange={setCanAccess} size="small" /></div>
  </div>
}

function CustomerRecordsTab({ customer, storageRows = [] }: { customer?: CustomerRecord; storageRows?: StoredApiRecord[] }) {
  const { modal } = App.useApp()
  type RecordTabKey = 'consumption' | 'arrival' | 'appointment' | 'storage' | 'edit' | 'skin'
  const [activeTab, setActiveTab] = useState<RecordTabKey>('consumption')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>()
  const [store, setStore] = useState<string>()
  const [kind, setKind] = useState<string>()
  const [operator, setOperator] = useState<string>()
  const [appointmentKeyword, setAppointmentKeyword] = useState('')
  const [skinEnabled, setSkinEnabled] = useState(true)
  const [skinRows, setSkinRows] = useState<CustomerSkinRow[]>([])
  const tabs: Array<{ key: RecordTabKey; label: string }> = [
    { key: 'consumption', label: '消费记录' },
    { key: 'arrival', label: '到店记录' },
    { key: 'appointment', label: '预约记录' },
    { key: 'storage', label: '寄存记录' },
    { key: 'edit', label: '修改记录' },
    { key: 'skin', label: '测肌记录' },
  ]

  // The current detail APIs already provide storage rows.  Appointment and skin
  // history endpoints are not part of the customer API yet, so keep the same
  // reference rows used by the supplied detail screenshots until those endpoints
  // are connected.  All filters and delete/toggle interactions remain local.
  const appointmentRows = useMemo<CustomerAppointmentRow[]>(() => customer ? [{ id: `appointment-demo-${customer.id}`, time: '2026-10-02 14:00', duration: '60分钟', store: customer.storeName || '当前门店', teacher: '—', content: '—', note: '—', status: '已确认' }] : [], [customer?.id, customer?.storeName])
  const storageHistoryRows = useMemo<CustomerStorageHistoryRow[]>(() => storageRows.map(row => {
    const operation = String(row.operationType ?? 'CREATE').toUpperCase()
    const type = operation === 'CLAIM' ? '领取寄存' : operation === 'REVOKE' ? '撤销寄存' : '新建-寄存'
    return { id: row.id, operationTime: row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '—', store: row.storeName || customer?.storeName || '当前门店', type, content: `${type}（${row.itemName}）x${row.quantity}`, operator: row.operatorName || '负责人' }
  }), [customer?.storeName, storageRows])
  const demoSkinRows = useMemo<CustomerSkinRow[]>(() => customer ? [{ id: `skin-demo-${customer.id}`, score: '9.25', inputAge: '33', percentage: '83', skinAge: '28', texture: '混干肌', sensitivity: '轻度敏感', color: '粉一白', time: '2026-09-02 09:12:59' }] : [], [customer?.id])
  useEffect(() => {
    setActiveTab('consumption')
    setDateRange(undefined)
    setStore(undefined)
    setKind(undefined)
    setOperator(undefined)
    setAppointmentKeyword('')
    setSkinEnabled(true)
    setSkinRows(demoSkinRows)
  }, [demoSkinRows])

  const inDateRange = (value: string) => {
    if (!dateRange) return true
    const current = dayjs(value)
    if (!current.isValid()) return false
    return current.isAfter(dateRange[0].startOf('day').subtract(1, 'millisecond')) && current.isBefore(dateRange[1].endOf('day').add(1, 'millisecond'))
  }
  const storeOptions = [{ value: 'current', label: customer?.storeName || '当前门店' }]
  const datePicker = <DatePicker.RangePicker aria-label="顾客记录日期范围" value={dateRange} onChange={dates => setDateRange(dates?.[0] && dates[1] ? [dates[0], dates[1]] : undefined)} placeholder={['开始日期', '结束日期']} inputReadOnly />

  const consumptionColumns: TableColumnsType<CustomerHistoryRow> = [
    { title: '订单编号', dataIndex: 'orderNo', key: 'orderNo', width: 150 },
    { title: '订单时间', dataIndex: 'orderTime', key: 'orderTime', width: 170 },
    { title: '订单内容', dataIndex: 'content', key: 'content', width: 240 },
    { title: '服务人员', dataIndex: 'staff', key: 'staff', width: 150 },
    { title: '订单合计', dataIndex: 'total', key: 'total', width: 130 },
    { title: '操作', key: 'actions', width: 100, render: () => <Button type="link" size="small">详情</Button> },
  ]
  const arrivalColumns: TableColumnsType<CustomerArrivalRow> = [
    { title: '到店信息', dataIndex: 'arrival', key: 'arrival', width: 250 },
    { title: '服务技师', dataIndex: 'staff', key: 'staff', width: 220 },
    { title: '消费内容', dataIndex: 'content', key: 'content', width: 360 },
    { title: '消费金额', dataIndex: 'amount', key: 'amount', width: 150 },
  ]
  const appointmentColumns: TableColumnsType<CustomerAppointmentRow> = [
    { title: '预约时间', dataIndex: 'time', key: 'time', width: 180 },
    { title: '预约时长', dataIndex: 'duration', key: 'duration', width: 130 },
    { title: '预约门店', dataIndex: 'store', key: 'store', width: 240 },
    { title: '预约老师', dataIndex: 'teacher', key: 'teacher', width: 150 },
    { title: '预约内容', dataIndex: 'content', key: 'content', width: 180 },
    { title: '备注', dataIndex: 'note', key: 'note', width: 150 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: value => <span className="customer-record-status">{value}</span> },
  ]
  const storageColumns: TableColumnsType<CustomerStorageHistoryRow> = [
    { title: '操作时间', dataIndex: 'operationTime', key: 'operationTime', width: 190 },
    { title: '门店', dataIndex: 'store', key: 'store', width: 250 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 150 },
    { title: '内容', dataIndex: 'content', key: 'content', width: 360 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 150 },
  ]
  const editColumns: TableColumnsType<CustomerEditHistoryRow> = [
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 220 },
    { title: '操作时间', dataIndex: 'operationTime', key: 'operationTime', width: 250 },
    { title: '操作事件', dataIndex: 'event', key: 'event' },
  ]
  const skinColumns: TableColumnsType<CustomerSkinRow> = [
    { title: '测肤图片', key: 'image', width: 110, render: (_, row) => row.imageUrl ? <Image width={48} height={48} src={row.imageUrl} alt="测肤图片" /> : <div className="customer-skin-thumb" aria-label="测肤图片">测肤</div> },
    { title: '总分', dataIndex: 'score', key: 'score', width: 110 },
    { title: '顾客输入年龄', dataIndex: 'inputAge', key: 'inputAge', width: 150 },
    { title: '百分比', dataIndex: 'percentage', key: 'percentage', width: 110 },
    { title: '肤龄', dataIndex: 'skinAge', key: 'skinAge', width: 110 },
    { title: '肤质', dataIndex: 'texture', key: 'texture', width: 130 },
    { title: '肤感', dataIndex: 'sensitivity', key: 'sensitivity', width: 150 },
    { title: '肤色', dataIndex: 'color', key: 'color', width: 130 },
    { title: '测肤时间', dataIndex: 'time', key: 'time', width: 190 },
    { title: '操作', key: 'actions', width: 90, render: (_, row) => <Button type="link" size="small" danger onClick={() => modal.confirm({ title: '确认要删除此记录?', icon: <QuestionCircleOutlined style={{ color: '#faad14' }} />, okText: '确定', cancelText: '取消', onOk: () => setSkinRows(current => current.filter(item => item.id !== row.id)) })}>删除</Button> },
  ]

  const arrivalRows: CustomerArrivalRow[] = []
  const editRows: CustomerEditHistoryRow[] = []
  const visibleAppointmentRows = appointmentRows.filter(row => {
    const keyword = appointmentKeyword.trim().toLowerCase()
    return inDateRange(row.time) && (!keyword || `${row.store}${row.teacher}${row.content}`.toLowerCase().includes(keyword))
  })
  const visibleStorageRows = storageHistoryRows.filter(row => inDateRange(row.operationTime) && (!kind || row.type === kind))
  const visibleSkinRows = skinEnabled ? skinRows.filter(row => inDateRange(row.time)) : []

  function renderRecordsTable<T extends EmptyRow>(ariaLabel: string, columns: TableColumnsType<T>, rows: T[], width = 980) {
    if (rows.length === 0) return <EmptyTable<T> ariaLabel={ariaLabel} columns={columns} rows={[]} width={width} />
    return <div className="customer-table-area customer-records-table-area"><Table<T> aria-label={ariaLabel} rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: width }} /><div className="customer-table-footer"><span>当前共搜索到{rows.length}条记录</span></div></div>
  }

  return <div className="customer-records-tab">
    <div className="customer-inner-tabs" role="tablist" aria-label="顾客记录分类">{tabs.map(tab => <button type="button" role="tab" aria-selected={activeTab === tab.key} key={tab.key} className={activeTab === tab.key ? 'is-active' : ''} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>
    {activeTab === 'consumption' && <>
      <div className="customer-records-filters">{datePicker}<Select aria-label="顾客记录门店" value={store} onChange={setStore} placeholder="请选择门店" allowClear options={storeOptions} /><Select aria-label="顾客记录类型" value={kind} onChange={setKind} placeholder="请选择类型" allowClear options={[{ value: '消费', label: '消费' }, { value: '项目', label: '项目' }, { value: '产品', label: '产品' }]} /></div>
      {renderRecordsTable<CustomerHistoryRow>('消费记录列表', consumptionColumns, [], 1100)}
    </>}
    {activeTab === 'arrival' && <>
      <div className="customer-records-filters customer-records-filters-with-summary">{datePicker}<Select aria-label="到店记录门店" value={store} onChange={setStore} placeholder="请选择门店" allowClear options={storeOptions} /><span className="customer-records-summary">总到店次数：<strong>{customer?.visitCount ?? 0}</strong></span></div>
      {renderRecordsTable<CustomerArrivalRow>('到店记录列表', arrivalColumns, arrivalRows, 1000)}
    </>}
    {activeTab === 'appointment' && <>
      <div className="customer-records-filters">{datePicker}<Input.Search className="customer-records-search" aria-label="搜索预约记录" placeholder="门店/技师/消费内容" allowClear value={appointmentKeyword} onChange={event => setAppointmentKeyword(event.target.value)} onSearch={setAppointmentKeyword} /></div>
      {renderRecordsTable<CustomerAppointmentRow>('预约记录列表', appointmentColumns, visibleAppointmentRows, 1240)}
    </>}
    {activeTab === 'storage' && <>
      <div className="customer-records-filters">{datePicker}<Select aria-label="寄存记录类型" value={kind} onChange={setKind} placeholder="请选择类型" allowClear options={[{ value: '新建-寄存', label: '新建-寄存' }, { value: '领取寄存', label: '领取寄存' }, { value: '撤销寄存', label: '撤销寄存' }]} /></div>
      {renderRecordsTable<CustomerStorageHistoryRow>('寄存记录列表', storageColumns, visibleStorageRows, 1150)}
    </>}
    {activeTab === 'edit' && <>
      <div className="customer-records-filters">{datePicker}<Select aria-label="修改记录操作员" value={operator} onChange={setOperator} placeholder="请选择操作员工" allowClear options={[{ value: '负责人', label: '负责人' }, { value: '模拟员工A', label: '模拟员工A' }]} /></div>
      {renderRecordsTable<CustomerEditHistoryRow>('修改记录列表', editColumns, editRows.filter(row => !operator || row.operator === operator), 980)}
    </>}
    {activeTab === 'skin' && <>
      <div className="customer-records-filters customer-records-filters-with-summary">{datePicker}<span className="customer-records-switch">测肌开关：<Switch size="small" checked={skinEnabled} onChange={setSkinEnabled} /></span></div>
      {renderRecordsTable<CustomerSkinRow>('测肌记录列表', skinColumns, visibleSkinRows, 1450)}
    </>}
  </div>
}

function CustomerDataTab({ customer }: { customer: CustomerRecord }) {
  const { message } = App.useApp()
  const [wallet, setWallet] = useState(customer.balance ?? 0)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [walletInput, setWalletInput] = useState(customer.balance ?? 0)
  const [walletRemark, setWalletRemark] = useState('')
  useEffect(() => { setWallet(customer.balance ?? 0); setWalletInput(customer.balance ?? 0) }, [customer.id, customer.balance])
  const money = (value: number) => `¥${value.toFixed(2)}`
  const renderStat = (label: string, value: ReactNode, key: string) => <div key={key} className="customer-data-stat"><span>{label}</span><strong>{value}</strong></div>
  const openWalletModal = () => { setWalletInput(wallet); setWalletRemark(''); setWalletModalOpen(true) }
  const closeWalletModal = () => { setWalletModalOpen(false); setWalletRemark('') }
  const saveWallet = () => {
    const nextWallet = Number(walletInput)
    if (!Number.isFinite(nextWallet) || nextWallet < 0) { void message.error('请输入有效的钱包余额'); return }
    setWallet(nextWallet)
    closeWalletModal()
    void message.success('钱包余额已更新')
  }
  return <div className="customer-data-tab">
    <section className="customer-data-card"><h3>客户资产</h3><div className="customer-data-grid">{renderStat('会员钱包', <>{money(wallet)} <button type="button" className="customer-data-link" onClick={openWalletModal}>修改</button></>, 'wallet')}{renderStat('剩余消费储值', money(0), 'stored-value')}{renderStat('积分', '0', 'points')}{renderStat('欠款金额', money(0), 'debt')}{renderStat('名下卡/券数', `${customer.cardCount}/0`, 'cards')}</div></section>
    <section className="customer-data-card"><h3>客户贡献</h3><div className="customer-data-grid">{renderStat('累计消费金额', money(customer.spent ?? 0), 'spent')}{renderStat('累计耗卡金额', money(0), 'card-spent')}{renderStat('转介绍人数', '0', 'referrals')}{renderStat('当年消费排名', 'No.', 'year-rank')}{renderStat('累计消费排名', 'No.', 'all-rank')}</div></section>
    <section className="customer-data-card"><h3>客户粘性</h3><div className="customer-data-grid customer-data-grid-3">{renderStat('总到店次数', `${customer.visitCount ?? 0}`, 'visits')}{renderStat('平均到店频率', '天', 'frequency')}{renderStat('生命周期归类', '暂无', 'lifecycle')}</div></section>
    <section className="customer-data-card"><h3>合伙人收益</h3><div className="customer-data-grid customer-data-grid-4">{renderStat('店内消费可用金额', money(0), 'available')}{renderStat('可提现收益', money(0), 'withdraw')}{renderStat('直接推荐人', '0人', 'direct')}{renderStat('间接推荐人', '0人', 'indirect')}</div></section>
    <Modal title="修改钱包余额" open={walletModalOpen} onCancel={closeWalletModal} footer={<Space className="customer-wallet-modal-actions"><Button onClick={closeWalletModal}>取消</Button><Button type="primary" onClick={saveWallet}>确定</Button></Space>} destroyOnHidden>
      <div className="customer-wallet-form">
        <label className="customer-wallet-field required"><span>余额</span><Space.Compact block className="customer-wallet-amount"><InputNumber aria-label="余额" value={walletInput} onChange={value => setWalletInput(value ?? 0)} min={0} precision={2} /><span className="customer-wallet-unit">元</span></Space.Compact></label>
        <label className="customer-wallet-field"><span>备注</span><Input aria-label="钱包余额备注" value={walletRemark} onChange={event => setWalletRemark(event.target.value)} placeholder="请输入备注" maxLength={100} /></label>
      </div>
    </Modal>
  </div>
}

function CustomerLogsTab({ customer, initialTab = 'all' }: { customer?: CustomerRecord; initialTab?: 'all' | 'followup' | 'log' }) {
  const { message } = App.useApp()
  type LogTabKey = 'all' | 'followup' | 'log'
  type TaskDateMode = 'fixed' | 'specified'
  type TaskEmployeeMode = 'adviser' | 'tracker' | 'specified'
  type TaskScriptMode = 'fixed' | 'custom'
  type TaskErrors = { date?: string; employee?: string; script?: string }
  const [activeTab, setActiveTab] = useState<LogTabKey>('all')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>()
  const [followupStatus, setFollowupStatus] = useState('待回访')
  const [rows, setRows] = useState<CustomerLogRow[]>([])
  const [taskRows, setTaskRows] = useState<CustomerFollowupTaskRow[]>([])
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [followupModalOpen, setFollowupModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [logTime, setLogTime] = useState<Dayjs>(dayjs())
  const [logImage, setLogImage] = useState<CustomerAttachment>()
  const [followupEmployee, setFollowupEmployee] = useState('')
  const [followupContent, setFollowupContent] = useState('')
  const [followupTime, setFollowupTime] = useState<Dayjs>(dayjs())
  const [followupImage, setFollowupImage] = useState<CustomerAttachment>()
  const [taskDateMode, setTaskDateMode] = useState<TaskDateMode>('specified')
  const [taskDays, setTaskDays] = useState<number>()
  const [taskDate, setTaskDate] = useState<Dayjs>()
  const [taskEmployeeMode, setTaskEmployeeMode] = useState<TaskEmployeeMode>('adviser')
  const [taskEmployee, setTaskEmployee] = useState('')
  const [taskScriptMode, setTaskScriptMode] = useState<TaskScriptMode>('fixed')
  const [taskScript, setTaskScript] = useState('')
  const [taskErrors, setTaskErrors] = useState<TaskErrors>({})
  const tabs = [{ key: 'all', label: '全部' }, { key: 'followup', label: '回访/客勤' }, { key: 'log', label: '服务日志' }] as const
  const employeeOptions = useMemo(() => {
    const names = [customer?.adviser, customer?.tracker, ...followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => item.label)].filter((item): item is string => Boolean(item))
    return [...new Set(names)].map(value => ({ value, label: value }))
  }, [customer?.adviser, customer?.tracker])
  const readImage = (file: File, setImage: (value: CustomerAttachment | undefined) => void) => {
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { void message.error('仅支持 png、jpg、jpeg 格式的图片'); return }
    if (file.size > 10 * 1024 * 1024) { void message.error('图片不能超过10M'); return }
    const reader = new FileReader()
    reader.onload = () => setImage({ name: file.name, url: String(reader.result ?? '') })
    reader.readAsDataURL(file)
  }
  const resetLogForm = () => { setLogContent(''); setLogTime(dayjs()); setLogImage(undefined) }
  const resetFollowupForm = () => { setFollowupEmployee(''); setFollowupContent(''); setFollowupTime(dayjs()); setFollowupImage(undefined) }
  const resetTaskForm = () => { setTaskDateMode('specified'); setTaskDays(undefined); setTaskDate(undefined); setTaskEmployeeMode('adviser'); setTaskEmployee(''); setTaskScriptMode('fixed'); setTaskScript(''); setTaskErrors({}) }
  useEffect(() => {
    setActiveTab(initialTab)
    setDateRange(undefined)
    setFollowupStatus('待回访')
    setRows([])
    setTaskRows([])
    resetLogForm()
    resetFollowupForm()
    resetTaskForm()
  }, [customer?.id, initialTab])
  const submitLog = () => {
    if (!logContent.trim()) { void message.error('请输入日志内容'); return }
    setRows(current => [{ id: Date.now(), kind: '日志', content: logContent.trim(), operator: '负责人', recordTime: logTime.format('YYYY-MM-DD HH:mm'), imageName: logImage?.name, imageUrl: logImage?.url }, ...current])
    setLogModalOpen(false); resetLogForm(); void message.success('顾客日志已添加')
  }
  const submitFollowup = () => {
    if (!followupEmployee.trim()) { void message.error('请输入回访员工'); return }
    if (!followupContent.trim()) { void message.error('请输入回访备注'); return }
    setRows(current => [{ id: Date.now(), kind: '回访', content: followupContent.trim(), operator: followupEmployee.trim(), recordTime: followupTime.format('YYYY-MM-DD HH:mm'), imageName: followupImage?.name, imageUrl: followupImage?.url }, ...current])
    setFollowupModalOpen(false); resetFollowupForm(); void message.success('回访记录已添加')
  }
  const taskEmployeeName = taskEmployeeMode === 'adviser' ? customer?.adviser || '顾客专属顾问' : taskEmployeeMode === 'tracker' ? customer?.tracker || '顾客跟踪员工' : taskEmployee.trim()
  const submitTask = () => {
    const errors: TaskErrors = {}
    if (taskDateMode === 'fixed' && (!taskDays || taskDays < 1)) errors.date = '请完善回访日期周期设置'
    if (taskDateMode === 'specified' && !taskDate) errors.date = '请完善回访日期'
    if (taskEmployeeMode === 'adviser' && !customer?.adviser) errors.employee = '顾客未设置专属顾问，无法生成待回访任务'
    if (taskEmployeeMode === 'tracker' && !customer?.tracker) errors.employee = '顾客未设置跟踪员工，无法生成待回访任务'
    if (taskEmployeeMode === 'specified' && !taskEmployee.trim()) errors.employee = '请选择回访员工'
    if (!taskScript.trim()) errors.script = taskScriptMode === 'custom' ? '请输入提醒内容' : '请输入回访话术'
    setTaskErrors(errors)
    if (Object.keys(errors).length > 0) return
    const dueDate = taskDateMode === 'fixed' ? dayjs().add(taskDays ?? 0, 'day').format('YYYY-MM-DD') : taskDate?.format('YYYY-MM-DD') ?? ''
    setTaskRows(current => [{ id: Date.now(), dueDate, employee: taskEmployeeName, script: taskScript.trim(), status: '待回访' }, ...current])
    setTaskModalOpen(false); resetTaskForm(); void message.success('回访任务已创建')
  }
  const inDateRange = (value: string) => {
    if (!dateRange) return true
    const current = dayjs(value)
    return current.isValid() && current.isAfter(dateRange[0].startOf('day').subtract(1, 'ms')) && current.isBefore(dateRange[1].endOf('day').add(1, 'ms'))
  }
  const visibleRows = rows.filter(row => {
    const inType = activeTab === 'all' || (activeTab === 'log' ? row.kind === '日志' : row.kind === '回访')
    return inType && inDateRange(row.recordTime)
  })
  const visibleTaskRows = taskRows.filter(row => inDateRange(row.dueDate) && (activeTab !== 'followup' || row.status === followupStatus))
  const logColumns: TableColumnsType<CustomerLogRow> = [{ title: '类型', dataIndex: 'kind', key: 'kind', width: 100 }, { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true }, { title: '记录人', dataIndex: 'operator', key: 'operator', width: 140 }, { title: '记录时间', dataIndex: 'recordTime', key: 'recordTime', width: 170 }, { title: '图片', key: 'image', width: 120, render: (_, row) => row.imageUrl ? <Image width={36} height={36} src={row.imageUrl} alt={row.imageName ?? '附件'} /> : '—' }]
  const taskColumns: TableColumnsType<CustomerFollowupTaskRow> = [{ title: '计划回访日期', dataIndex: 'dueDate', key: 'dueDate', width: 160 }, { title: '回访员工', dataIndex: 'employee', key: 'employee', width: 190 }, { title: '回访话术', dataIndex: 'script', key: 'script', ellipsis: true }, { title: '状态', dataIndex: 'status', key: 'status', width: 120 }, { title: '操作', key: 'actions', width: 90, render: (_, row) => <Button type="link" size="small" danger onClick={() => setTaskRows(current => current.filter(item => item.id !== row.id))}>删除</Button> }]
  const uploadControl = (attachment: CustomerAttachment | undefined, setAttachment: (value: CustomerAttachment | undefined) => void) => <Upload accept=".png,.jpg,.jpeg" showUploadList={false} beforeUpload={file => { readImage(file as File, setAttachment); return false }}><button type="button" className="customer-log-upload"><UploadOutlined /><span>{attachment?.name ?? '上传图片'}</span></button></Upload>
  const dateFilter = <DatePicker.RangePicker aria-label="服务日志日期范围" value={dateRange} onChange={dates => setDateRange(dates?.[0] && dates[1] ? [dates[0], dates[1]] : undefined)} placeholder={['开始日期', '结束日期']} inputReadOnly />
  const hasVisibleRows = visibleRows.length > 0 || (activeTab !== 'log' && visibleTaskRows.length > 0)
  return <div className="customer-logs-tab">
    <div className="customer-log-toolbar">
      <div className="customer-inner-tabs" role="tablist" aria-label="顾客日志回访分类">{tabs.map(tab => <button type="button" role="tab" aria-selected={activeTab === tab.key} key={tab.key} className={activeTab === tab.key ? 'is-active' : ''} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>
      <div className="customer-log-actions">
        <div className="customer-log-action-row">
          {activeTab !== 'log' && <Button className="customer-followup-task-button" type="primary" onClick={() => { resetTaskForm(); setTaskModalOpen(true) }}>创建回访任务</Button>}
          {activeTab !== 'log' && <Button type="primary" onClick={() => { resetFollowupForm(); setFollowupModalOpen(true) }}>添加回访记录</Button>}
          {activeTab !== 'followup' && <Button type="primary" onClick={() => { resetLogForm(); setLogModalOpen(true) }}>添加顾客日志</Button>}
        </div>
        <div className="customer-log-filters">{dateFilter}{activeTab === 'followup' && <Select aria-label="回访任务状态" value={followupStatus} onChange={setFollowupStatus} options={[{ value: '待回访', label: '待回访' }, { value: '已完成', label: '已完成' }, { value: '已取消', label: '已取消' }]} />}</div>
      </div>
    </div>
    {!hasVisibleRows && <div className="customer-detail-empty customer-log-empty"><GoalEmpty /><span>暂无相关数据</span></div>}
    {activeTab !== 'log' && visibleTaskRows.length > 0 && <div className="customer-log-section"><Table<CustomerFollowupTaskRow> rowKey="id" pagination={false} dataSource={visibleTaskRows} columns={taskColumns} scroll={{ x: 760 }} /></div>}
    {visibleRows.length > 0 && <div className="customer-log-section"><Table<CustomerLogRow> rowKey="id" pagination={false} dataSource={visibleRows} columns={logColumns} scroll={{ x: 760 }} /></div>}
    <Modal className="customer-followup-task-modal" title="创建待回访任务" open={taskModalOpen} onCancel={() => { setTaskModalOpen(false); resetTaskForm() }} onOk={submitTask} okText="确认" cancelText="取消" width={760} destroyOnHidden>
      <div className="customer-followup-task-form">
        <label className="required"><span>计划回访日期</span><Radio.Group value={taskDateMode} onChange={event => { setTaskDateMode(event.target.value as TaskDateMode); setTaskErrors(current => ({ ...current, date: undefined })) }}><Radio value="fixed">固定周期</Radio><Radio value="specified">指定日期</Radio></Radio.Group></label>
        <div className="customer-task-date-control">
          {taskDateMode === 'fixed' ? <><span>计划回访日期为</span><InputNumber aria-label="计划回访天数" min={1} precision={0} status={taskErrors.date ? 'error' : undefined} value={taskDays} onChange={value => { setTaskDays(value ?? undefined); setTaskErrors(current => ({ ...current, date: undefined })) }} /><span>天后</span></> : <DatePicker aria-label="计划回访日期" status={taskErrors.date ? 'error' : undefined} value={taskDate} onChange={value => { setTaskDate(value ?? undefined); setTaskErrors(current => ({ ...current, date: undefined })) }} placeholder="请选择日期" />}
          {taskErrors.date && <div className="customer-task-field-error">{taskErrors.date}</div>}
        </div>
        <label className="required"><span>回访员工</span><Radio.Group value={taskEmployeeMode} onChange={event => { setTaskEmployeeMode(event.target.value as TaskEmployeeMode); setTaskEmployee(''); setTaskErrors(current => ({ ...current, employee: undefined })) }}><Radio value="adviser">顾客专属顾问</Radio><Radio value="tracker">顾客跟踪员工</Radio><Radio value="specified">指定员工</Radio></Radio.Group></label>
        {taskEmployeeMode === 'specified' && <Select aria-label="指定回访员工" status={taskErrors.employee ? 'error' : undefined} value={taskEmployee || undefined} onChange={value => { setTaskEmployee(value); setTaskErrors(current => ({ ...current, employee: undefined })) }} placeholder="请选择员工" options={employeeOptions} />}
        {taskErrors.employee && <div className="customer-task-field-error customer-task-employee-error">{taskErrors.employee}</div>}
        <div className="customer-task-hint">温馨提示：1. 顾客有多个跟踪员工/专属顾问，默认选择设置的第一个员工生成待回访任务<br />　　　　2. 顾客未设置跟踪员工/专属顾问，不会生成待回访任务</div>
        <label className="required"><span>回访话术</span><div className="customer-task-script-heading"><Radio.Group value={taskScriptMode} onChange={event => { setTaskScriptMode(event.target.value as TaskScriptMode); setTaskErrors(current => ({ ...current, script: undefined })) }}><Radio value="fixed">固定话术</Radio><Radio value="custom">单独设定</Radio></Radio.Group><Button size="small" onClick={() => { setTaskScript(current => current || '您好，感谢您的支持，欢迎再次到店。'); setTaskErrors(current => ({ ...current, script: undefined })) }}>话术模板</Button></div>{taskScriptMode === 'custom' && <div className="customer-task-reminder-time">提醒时间： {taskDateMode === 'fixed' ? (taskDays ? taskDays : '') + '天后提醒' : '指定日期提醒'}</div>}<Input.TextArea aria-label="回访话术" status={taskErrors.script ? 'error' : undefined} value={taskScript} onChange={event => { setTaskScript(event.target.value); setTaskErrors(current => ({ ...current, script: undefined })) }} placeholder="请输入提醒信息" maxLength={500} showCount rows={4} />{taskErrors.script && <div className="customer-task-field-error">{taskErrors.script}</div>}</label>
      </div>
    </Modal>
    <Modal className="customer-log-modal" title="添加顾客日志" open={logModalOpen} onCancel={() => { setLogModalOpen(false); resetLogForm() }} onOk={submitLog} okText="确定" cancelText="取消" width={620} destroyOnHidden><div className="customer-log-form"><label>添加人员<Input value="负责人" disabled /></label><label className="required">日志内容<Input.TextArea value={logContent} onChange={event => setLogContent(event.target.value)} placeholder="输入日志" maxLength={1000} showCount rows={5} /></label><label>记录时间<DatePicker showTime value={logTime} onChange={value => setLogTime(value ?? dayjs())} style={{ width: '100%' }} /></label><label>上传图片<small>上传png、jpg、jpeg格式的图片，每张不超过10M</small>{uploadControl(logImage, setLogImage)}</label></div></Modal>
    <Modal className="customer-followup-modal" title="顾客回访" open={followupModalOpen} onCancel={() => { setFollowupModalOpen(false); resetFollowupForm() }} onOk={submitFollowup} okText="确定" cancelText="取消" width={620} destroyOnHidden><div className="customer-log-form"><label className="required">回访员工<Input value={followupEmployee} onChange={event => setFollowupEmployee(event.target.value)} placeholder="请指定员工" /></label><label className="required">回访备注<div className="customer-log-template-links"><button type="button" onClick={() => setFollowupContent('')}>编辑</button><button type="button" onClick={() => setFollowupContent(current => current || '您好，感谢您的支持，欢迎再次到店。')}>添加话术模板</button></div><Input.TextArea value={followupContent} onChange={event => setFollowupContent(event.target.value)} placeholder="请输入备注" maxLength={500} showCount rows={5} /></label><label>记录时间<DatePicker showTime value={followupTime} onChange={value => setFollowupTime(value ?? dayjs())} style={{ width: '100%' }} /></label><label>上传图片<small>上传png、jpg、jpeg格式的图片，每张不超过10M</small>{uploadControl(followupImage, setFollowupImage)}</label></div></Modal>
  </div>
}

function createArchiveQrMatrix(seed: string, size = 29) {
  const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const placeFinder = (originX: number, originY: number) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const px = originX + x
        const py = originY + y
        if (px < 0 || py < 0 || px >= size || py >= size) continue
        reserved[py][px] = true
        matrix[py][px] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))
      }
    }
  }
  placeFinder(0, 0)
  placeFinder(size - 7, 0)
  placeFinder(0, size - 7)
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (reserved[y][x]) continue
      hash = Math.imul(hash ^ (x + y * size + 31), 16777619)
      matrix[y][x] = ((hash >>> 0) & 1) === 1
    }
  }
  return matrix
}

function archiveQrSvgMarkup(matrix: boolean[][]) {
  const size = matrix.length
  const moduleSize = 8
  const cells = matrix.flatMap((row, y) => row.map((filled, x) => filled ? `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="#111"/>` : ''))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * moduleSize} ${size * moduleSize}" role="img" aria-label="顾客档案填写二维码"><rect width="100%" height="100%" fill="#fff"/>${cells.join('')}</svg>`
}

function CustomerArchiveQr({ matrix }: { matrix: boolean[][] }) {
  const size = matrix.length
  return <svg className="customer-archive-qr-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="顾客档案填写二维码" shapeRendering="crispEdges"><rect width="100%" height="100%" fill="#fff" />{matrix.flatMap((row, y) => row.map((filled, x) => filled ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111" /> : null))}</svg>
}

function CustomerArchivesTab({ customer }: { customer?: CustomerRecord }) {
  const { message } = App.useApp()
  const [mode, setMode] = useState<'record' | 'archive'>('record')
  const [recordItemModalOpen, setRecordItemModalOpen] = useState(false)
  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [fillModalOpen, setFillModalOpen] = useState(false)
  const [archiveFormOpen, setArchiveFormOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [recordContent, setRecordContent] = useState('')
  const [recordTime, setRecordTime] = useState<Dayjs>(dayjs())
  const [recordRows, setRecordRows] = useState<CustomerArchiveRecord[]>([])
  const [selectedRecordItem, setSelectedRecordItem] = useState<string>()
  const [selectedTemplate, setSelectedTemplate] = useState<CustomerArchiveTemplate>()
  const [archiveFormTemplate, setArchiveFormTemplate] = useState<CustomerArchiveTemplate>()
  const [filledForms, setFilledForms] = useState<Record<number, CustomerArchiveFormData>>({})
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>()
  const [archiveType, setArchiveType] = useState<string>()
  const [consultationForm, setConsultationForm] = useState<ConsultationArchiveForm>({ skinStatus: [], skinIssues: [], careCycle: undefined, products: [], workEnvironment: [] })
  const [skinTypeForm, setSkinTypeForm] = useState<SkinTypeArchiveForm>({ skinType: undefined, sensitivity: undefined, sensitivityDetail: '', acne: undefined, acneDetail: '' })
  const templates: CustomerArchiveTemplate[] = [{ id: 1, name: '咨询单', type: '公开档案', form: 'consultation' }, { id: 2, name: '16肌肤分型问诊表', type: '公开档案', form: 'skin-type' }]
  const recordItemOptions = ['效果对比图', '处方笺', '三阶段规划']
  const consultationSkinStatus = ['在皮肤科、整形科做过手术', '过去三个月内皮肤有过创伤', '有对某种产品产生过过敏', '以上均不符合']
  const consultationSkinIssues = ['毛孔', '黑头', '痘痘', '色斑', '美白', '补水', '提升', '抗衰', '敏感肌修复管理', '身体亚健康管理']
  const consultationProducts = ['洗面奶', '爽肤水', '精华素', '精油', '日霜', '晚霜', '隔离霜', '防晒霜', '眼霜', '粉底', '彩妆', '防晒指数', '什么都不用']
  const consultationWorkEnvironment = ['经常出差', '高温工作', '接触化工类产品', '无需工作', '长时间暴晒', '长时间电脑辐射', '室内', '其他']
  const qrMatrix = useMemo(() => createArchiveQrMatrix(`customer:${customer?.id ?? 'preview'}:template:${selectedTemplate?.id ?? 'none'}`), [customer?.id, selectedTemplate?.id])
  const qrMarkup = useMemo(() => archiveQrSvgMarkup(qrMatrix), [qrMatrix])
  useEffect(() => {
    setMode('record')
    setRecordItemModalOpen(false)
    setRecordModalOpen(false)
    setFillModalOpen(false)
    setArchiveFormOpen(false)
    setQrModalOpen(false)
    setRecordContent('')
    setRecordTime(dayjs())
    setRecordRows([])
    setSelectedRecordItem(undefined)
    setSelectedTemplate(undefined)
    setArchiveFormTemplate(undefined)
    setFilledForms({})
    setDateRange(undefined)
    setArchiveType(undefined)
    setConsultationForm({ skinStatus: [], skinIssues: [], careCycle: undefined, products: [], workEnvironment: [] })
    setSkinTypeForm({ skinType: undefined, sensitivity: undefined, sensitivityDetail: '', acne: undefined, acneDetail: '' })
  }, [customer?.id])
  const modeToggle = <div className="customer-archive-toggle"><button type="button" className={mode === 'record' ? 'is-active' : ''} onClick={() => setMode('record')}>顾客记录</button><button type="button" className={mode === 'archive' ? 'is-active' : ''} onClick={() => setMode('archive')}>顾客档案</button></div>
  const openRecordItemPicker = () => { setSelectedRecordItem(undefined); setRecordItemModalOpen(true) }
  const chooseRecordItem = (item: string) => { setSelectedRecordItem(item); setRecordItemModalOpen(false); setRecordContent(''); setRecordTime(dayjs()); setRecordModalOpen(true) }
  const addRecord = () => {
    if (!recordContent.trim()) { void message.error('请输入顾客记录'); return }
    const content = selectedRecordItem ? `${selectedRecordItem}：${recordContent.trim()}` : recordContent.trim()
    setRecordRows(rows => [{ id: Date.now(), content, operator: '负责人', recordTime: recordTime.format('YYYY-MM-DD HH:mm') }, ...rows])
    setRecordModalOpen(false); setRecordContent(''); setRecordTime(dayjs()); setSelectedRecordItem(undefined); void message.success('顾客记录已添加')
  }
  const openArchiveForm = (template: CustomerArchiveTemplate) => {
    const existing = filledForms[template.id]
    setArchiveFormTemplate(template)
    if (template.form === 'consultation') setConsultationForm(existing && 'skinStatus' in existing ? { ...existing, skinStatus: [...existing.skinStatus], skinIssues: [...existing.skinIssues], products: [...existing.products], workEnvironment: [...existing.workEnvironment] } : { skinStatus: [], skinIssues: [], careCycle: undefined, products: [], workEnvironment: [] })
    if (template.form === 'skin-type') setSkinTypeForm(existing && 'sensitivityDetail' in existing ? { ...existing } : { skinType: undefined, sensitivity: undefined, sensitivityDetail: '', acne: undefined, acneDetail: '' })
    setArchiveFormOpen(true)
  }
  const openFillMethod = (template: CustomerArchiveTemplate) => { setSelectedTemplate(template); setFillModalOpen(true) }
  const saveArchiveForm = () => {
    if (!archiveFormTemplate) return
    const form = archiveFormTemplate.form === 'consultation'
      ? { ...consultationForm, skinStatus: [...consultationForm.skinStatus], skinIssues: [...consultationForm.skinIssues], products: [...consultationForm.products], workEnvironment: [...consultationForm.workEnvironment] }
      : { ...skinTypeForm }
    setFilledForms(current => ({ ...current, [archiveFormTemplate.id]: form }))
    setArchiveFormOpen(false)
    void message.success(`${archiveFormTemplate.name}已保存`)
  }
  const downloadQr = () => {
    const url = URL.createObjectURL(new Blob([qrMarkup], { type: 'image/svg+xml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedTemplate?.name ?? '顾客档案'}填写二维码.svg`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    void message.success('二维码已保存')
  }
  const visibleTemplates = templates.filter(template => !archiveType || template.type === archiveType)
  return <div className="customer-archives-tab">
    {mode === 'record' ? <>
      <div className="customer-archive-toolbar"><Select aria-label="顾客档案模板" placeholder="请选择模板" allowClear options={templates.map(item => ({ value: item.id, label: item.name }))} /><div className="customer-archive-toolbar-right">{modeToggle}<Button type="primary" onClick={openRecordItemPicker}>添加顾客记录</Button></div></div>
      {recordRows.length === 0 ? <div className="customer-detail-empty"><GoalEmpty /><span>暂无相关数据</span></div> : <Table<CustomerArchiveRecord> rowKey="id" pagination={false} dataSource={recordRows} columns={[{ title: '记录内容', dataIndex: 'content', key: 'content' }, { title: '记录人', dataIndex: 'operator', key: 'operator', width: 150 }, { title: '记录时间', dataIndex: 'recordTime', key: 'recordTime', width: 180 }]} />}
    </> : <>
      <div className="customer-archive-toolbar"><Space><DatePicker.RangePicker aria-label="顾客档案日期范围" value={dateRange} onChange={dates => setDateRange(dates?.[0] && dates[1] ? [dates[0], dates[1]] : undefined)} placeholder={['开始日期', '结束日期']} inputReadOnly /><Select aria-label="顾客档案类型" value={archiveType} onChange={setArchiveType} placeholder="请选择类型" allowClear options={[{ value: '公开档案', label: '公开档案' }]} /></Space><div className="customer-archive-toolbar-right">{modeToggle}</div></div>
      <div className="customer-archive-table"><div className="customer-archive-table-head"><span>档案名称</span><span>类型</span><span>是否填写</span><span>操作</span></div>{visibleTemplates.map(template => { const filled = Boolean(filledForms[template.id]); return <div className="customer-archive-table-row" key={template.id}><span>{template.name}</span><span>{template.type}</span><span>{filled ? '已填写' : '未填写'}</span><span><Button type="link" size="small" onClick={() => filled ? openArchiveForm(template) : openFillMethod(template)}>{filled ? '查看' : '填写'}</Button></span></div> })}</div>
    </>}
    <Modal title="请选择档案项" open={recordItemModalOpen} onCancel={() => setRecordItemModalOpen(false)} footer={null} width={620} destroyOnHidden><div className="customer-archive-item-picker">{recordItemOptions.map(item => <button type="button" key={item} onClick={() => chooseRecordItem(item)}>{item}</button>)}</div></Modal>
    <Modal title="添加顾客记录" open={recordModalOpen} onCancel={() => { setRecordModalOpen(false); setSelectedRecordItem(undefined) }} onOk={addRecord} okText="确定" cancelText="取消" destroyOnHidden><div className="customer-log-form"><label>档案项<Input value={selectedRecordItem ?? '未选择'} disabled /></label><label className="required">记录内容<Input.TextArea value={recordContent} onChange={event => setRecordContent(event.target.value)} maxLength={1000} showCount rows={5} placeholder="请输入顾客记录" /></label><label>记录时间<DatePicker showTime value={recordTime} onChange={value => setRecordTime(value ?? dayjs())} style={{ width: '100%' }} /></label></div></Modal>
    <Modal title="选择填写方式" open={fillModalOpen} onCancel={() => setFillModalOpen(false)} footer={null} width={520} destroyOnHidden><div className="customer-archive-fill-options"><button type="button" onClick={() => { if (!selectedTemplate) return; setFillModalOpen(false); openArchiveForm(selectedTemplate) }}><strong>✎</strong><b>门店自行填写</b><span>由门店工作人员手动填写顾客信息</span></button><button type="button" onClick={() => { if (!selectedTemplate) return; setFillModalOpen(false); setQrModalOpen(true) }}><strong>▦</strong><b>邀请顾客填写</b><span>生成二维码，顾客扫码自行填写</span></button></div></Modal>
    <Modal className="customer-archive-form-modal" title={archiveFormTemplate?.name ?? '填写档案'} open={archiveFormOpen} onCancel={() => setArchiveFormOpen(false)} onOk={saveArchiveForm} okText="确定" cancelText="取消" width={620} destroyOnHidden>
      {archiveFormTemplate?.form === 'consultation' ? <div className="customer-archive-form">
        <section className="customer-archive-form-section"><h4>1、皮肤状况</h4><Checkbox.Group className="customer-archive-option-group customer-archive-option-grid-2" value={consultationForm.skinStatus} options={consultationSkinStatus} onChange={values => setConsultationForm(current => ({ ...current, skinStatus: values as string[] }))} /></section>
        <section className="customer-archive-form-section"><h4>2、最想改善的肌肤问题</h4><Checkbox.Group className="customer-archive-option-group customer-archive-option-grid-4" value={consultationForm.skinIssues} options={consultationSkinIssues} onChange={values => setConsultationForm(current => ({ ...current, skinIssues: values as string[] }))} /></section>
        <section className="customer-archive-form-section"><h4>3、护理周期</h4><Radio.Group className="customer-archive-radio-grid" value={consultationForm.careCycle} onChange={event => setConsultationForm(current => ({ ...current, careCycle: event.target.value }))} options={['1个月', '2周', '1周', '无周期', '未做过', '其他'].map(value => ({ value, label: value }))} /></section>
        <section className="customer-archive-form-section"><h4>4、护肤品</h4><Checkbox.Group className="customer-archive-option-group customer-archive-option-grid-5" value={consultationForm.products} options={consultationProducts} onChange={values => setConsultationForm(current => ({ ...current, products: values as string[] }))} /></section>
        <section className="customer-archive-form-section"><h4>5、工作环境</h4><Checkbox.Group className="customer-archive-option-group customer-archive-option-grid-3" value={consultationForm.workEnvironment} options={consultationWorkEnvironment} onChange={values => setConsultationForm(current => ({ ...current, workEnvironment: values as string[] }))} /></section>
      </div> : <div className="customer-archive-form">
        <section className="customer-archive-form-section"><h4>1、皮肤类型</h4><Radio.Group className="customer-archive-radio-grid customer-archive-radio-grid-3" value={skinTypeForm.skinType} onChange={event => setSkinTypeForm(current => ({ ...current, skinType: event.target.value }))} options={['干性', '混合偏干', '中性', '油性', '混合偏油'].map(value => ({ value, label: value }))} /></section>
        <section className="customer-archive-form-section"><h4>2、皮肤健康度 - 敏感表现</h4><Radio.Group className="customer-archive-radio-grid customer-archive-radio-grid-3" value={skinTypeForm.sensitivity} onChange={event => setSkinTypeForm(current => ({ ...current, sensitivity: event.target.value }))} options={['完全稳定', '角质层偏薄，但不敏感', '偶尔有过敏表现', '经常反复过敏', '面部有红血丝，易潮红'].map(value => ({ value, label: value }))} /></section>
        <section className="customer-archive-form-section"><h4>3、如果敏感，请再次详细说明敏感表现以及处理的经历</h4><Input.TextArea value={skinTypeForm.sensitivityDetail} onChange={event => setSkinTypeForm(current => ({ ...current, sensitivityDetail: event.target.value }))} placeholder="请输入内容" rows={5} /></section>
        <section className="customer-archive-form-section"><h4>4、皮肤健康度 - 痤疮症状</h4><Radio.Group className="customer-archive-radio-grid customer-archive-radio-grid-2" value={skinTypeForm.acne} onChange={event => setSkinTypeForm(current => ({ ...current, acne: event.target.value }))} options={['完全不长痘', '闭口粉刺，几乎无炎性痘', '闭口粉刺，混合大量炎性痘', '少量闭口粉刺，炎性痘为主', '炎性痘疤混合大量结节、囊肿'].map(value => ({ value, label: value }))} /></section>
        <section className="customer-archive-form-section"><h4>5、如果长痘，请再次详细说明长痘的经历以及处理的过程</h4><Input.TextArea value={skinTypeForm.acneDetail} onChange={event => setSkinTypeForm(current => ({ ...current, acneDetail: event.target.value }))} placeholder="请输入内容" rows={5} /></section>
      </div>}
    </Modal>
    <Modal className="customer-archive-qr-modal" title="填写二维码" open={qrModalOpen} onCancel={() => setQrModalOpen(false)} footer={null} width={420} destroyOnHidden><div className="customer-archive-qr"><div className="customer-archive-qr-frame"><CustomerArchiveQr matrix={qrMatrix} /></div><p>请让顾客扫码填写档案信息</p><Button type="primary" icon={<DownloadOutlined />} onClick={downloadQr}>保存图片</Button></div></Modal>
  </div>
}

function CustomerPartnerTab() {
  return <div className="customer-partner-tab">商户是未完成合伙人基础配置 请去营销-合伙人-合伙人设置-规则设置配置</div>
}

function CustomerAlbumTab({ customer }: { customer?: CustomerRecord }) {
  const { message } = App.useApp()
  const [images, setImages] = useState<CustomerAlbumImage[]>([])
  const [albumModalOpen, setAlbumModalOpen] = useState(false)
  const [draftImages, setDraftImages] = useState<CustomerAlbumImage[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  useEffect(() => {
    setImages([])
    setAlbumModalOpen(false)
    setDraftImages([])
    setKeyword('')
    setPage(1)
  }, [customer?.id])
  const readImage = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['png', 'jpg', 'jpeg'].includes(extension ?? '') || !['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { void message.error('仅支持 png、jpg、Jpeg 格式的图片'); return }
    if (file.size > 10 * 1024 * 1024) { void message.error('图片不能超过10M'); return }
    const reader = new FileReader()
    reader.onload = () => setDraftImages(current => [...current, { id: `${Date.now()}-${Math.random()}-${file.name}`, name: file.name, url: String(reader.result ?? ''), createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }])
    reader.onerror = () => { void message.error('图片读取失败，请重新选择') }
    reader.readAsDataURL(file)
  }
  const openUploadModal = () => { setDraftImages([]); setAlbumModalOpen(true) }
  const closeUploadModal = () => { setAlbumModalOpen(false); setDraftImages([]) }
  const saveAlbum = () => {
    if (draftImages.length === 0) { void message.error('请先上传顾客相册图片'); return }
    setImages(current => [...draftImages, ...current])
    setPage(1)
    closeUploadModal()
    void message.success('添加成功')
  }
  const removeDraftImage = (id: string | number) => setDraftImages(current => current.filter(image => image.id !== id))
  const visibleImages = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return images.filter(image => !normalizedKeyword || image.name.toLowerCase().includes(normalizedKeyword))
  }, [images, keyword])
  const pagedImages = useMemo(() => {
    const start = (page - 1) * pageSize
    return visibleImages.slice(start, start + pageSize)
  }, [page, pageSize, visibleImages])
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(visibleImages.length / pageSize))
    if (page > lastPage) setPage(lastPage)
  }, [page, pageSize, visibleImages.length])
  const uploadButton = <Button type="primary" onClick={openUploadModal}>上传顾客相册</Button>
  const uploadTile = <Upload accept=".png,.jpg,.jpeg" multiple showUploadList={false} beforeUpload={file => { readImage(file as File); return false }}><button type="button" className="customer-album-upload-tile"><UploadOutlined /><span>上传图片</span></button></Upload>
  const modalFooter = <div className="customer-album-modal-footer"><span>上传png、jpg、Jpeg格式的图片，每张不超过10M</span><Space><Button onClick={closeUploadModal}>取消</Button><Button type="primary" onClick={saveAlbum}>保存</Button></Space></div>
  return <div className="customer-album-tab">{images.length === 0 ? <div className="customer-detail-empty customer-album-empty"><GoalEmpty /><span>暂无相关数据</span><Button type="primary" onClick={openUploadModal}>上传顾客相册</Button></div> : <div className="customer-album-content"><div className="customer-album-toolbar"><Input.Search className="customer-album-search" aria-label="搜索顾客相册" placeholder="输入相册关键词" allowClear value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1) }} onSearch={() => setPage(1)} />{uploadButton}</div><Image.PreviewGroup><div className="customer-album-grid">{pagedImages.map(image => <div className="customer-album-item" key={image.id}><Image src={image.url} alt={image.name} /><div className="customer-album-meta"><span title={image.name}>{image.name}</span><small>{image.createdAt}</small></div></div>)}{pagedImages.length === 0 && <div className="customer-album-search-empty"><GoalEmpty /><span>暂无相关数据</span></div>}</div></Image.PreviewGroup><div className="customer-album-pagination"><Pagination current={page} pageSize={pageSize} total={visibleImages.length} showSizeChanger pageSizeOptions={['10', '20', '50']} onChange={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize) }} /></div></div>}
    <Modal className="customer-album-modal" title="添加顾客相册" open={albumModalOpen} onCancel={closeUploadModal} footer={modalFooter} width={650} destroyOnHidden><div className="customer-album-upload-list"><div className="customer-album-upload-picker">{uploadTile}</div>{draftImages.map(image => <div className="customer-album-upload-preview" key={image.id}><img src={image.url} alt={image.name} /><div><span title={image.name}>{image.name}</span><Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`移除${image.name}`} onClick={() => removeDraftImage(image.id)} /></div></div>)}</div></Modal>
  </div>
}

function CustomerDetailDrawer({ customer, loading, error, onRetry, onClose, onAction, storageRows = [], storageLoading = false, storageError, onStorageRetry, onClaim }: { customer?: CustomerRecord; loading?: boolean; error?: string; onRetry?: () => void; onClose: () => void; onAction?: (action: string, customer: CustomerRecord) => void; storageRows?: StoredApiRecord[]; storageLoading?: boolean; storageError?: string; onStorageRetry?: () => void; onClaim?: (row: StoredApiRecord) => void }) {
  const [storageKeyword, setStorageKeyword] = useState('')
  const [activeDetailTab, setActiveDetailTab] = useState('assets')
  const [logsTab, setLogsTab] = useState<'all' | 'followup' | 'log'>('all')
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [remarkDraft, setRemarkDraft] = useState('')
  const [displayRemark, setDisplayRemark] = useState('')
  const [levelOpen, setLevelOpen] = useState(false)
  const [levelDraft, setLevelDraft] = useState('无等级')
  const [levelLocked, setLevelLocked] = useState(false)
  const [displayLevel, setDisplayLevel] = useState('无等级')
  const [progressOpen, setProgressOpen] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftAmountEnabled, setGiftAmountEnabled] = useState(false)
  const [giftContentEnabled, setGiftContentEnabled] = useState(false)
  const [giftContentEditorOpen, setGiftContentEditorOpen] = useState(false)
  const [giftAmount, setGiftAmount] = useState<number>()
  const [giftContent, setGiftContent] = useState('')
  const [giftNote, setGiftNote] = useState('')
  useEffect(() => {
    setActiveDetailTab('assets')
    setLogsTab('all')
    setGiftOpen(false)
    setGiftAmountEnabled(false)
    setGiftContentEnabled(false)
    setGiftContentEditorOpen(false)
    setGiftAmount(undefined)
    setGiftContent('')
    setGiftNote('')
  }, [customer?.id])
  useEffect(() => {
    if (!customer) return
    setDisplayRemark(customer.remark ?? '')
    setRemarkDraft(customer.remark ?? '')
    setDisplayLevel(customer.level || '无等级')
    setLevelDraft(customer.level || '无等级')
  }, [customer?.id, customer?.level, customer?.remark])
  const visibleStorageRows = useMemo(() => {
    const keyword = storageKeyword.trim().toLowerCase()
    return storageRows.filter(row => !keyword || `${row.itemName}${row.itemCode ?? ''}${row.itemCategory ?? ''}`.toLowerCase().includes(keyword))
  }, [storageKeyword, storageRows])
  const assetContent = customer && <div className="customer-asset-pane">
    <div className="customer-asset-summary">
      {[
        ['会员卡', `${customer.cardCount}张`],
        ['券', '0张'],
        ['赠送', '0项'],
        ['会员积分', '0'],
        ['钱包', '0'],
        ['原价消费金', '0'],
        ['顾客寄存', `${customer.storageCount ?? storageRows.length}项`],
      ].map(([label, value]) => <div key={label} className={`customer-asset-stat${label === '顾客寄存' ? ' is-highlighted' : ''}`}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="customer-asset-filters customer-storage-filters"><span>顾客寄存品项</span><Input.Search aria-label="搜索顾客寄存品项" placeholder="输入品项名称、编号" allowClear value={storageKeyword} onChange={event => setStorageKeyword(event.target.value)} onSearch={setStorageKeyword} /></div>
    {storageLoading && <div className="customer-detail-empty"><Spin /></div>}
    {!storageLoading && storageError && <QueryError error={storageError} onRetry={onStorageRetry ?? (() => undefined)} />}
    {!storageLoading && !storageError && visibleStorageRows.length === 0 && <div className="customer-detail-empty"><GoalEmpty /><span>暂无顾客寄存</span></div>}
    {!storageLoading && !storageError && visibleStorageRows.length > 0 && <Table<StoredApiRecord> rowKey="id" pagination={false} scroll={{ x: 820 }} dataSource={visibleStorageRows} columns={[
      { title: '寄存门店', key: 'store', width: 180, render: (_, row) => row.storeName || '当前门店' },
      { title: '品项分类', key: 'category', width: 130, render: (_, row) => row.itemCategory || (row.storageType === 'PRODUCT' ? '产品' : '项目') },
      { title: '品项编号', dataIndex: 'itemCode', key: 'code', width: 130, render: value => value || '—' },
      { title: '品项信息', key: 'item', width: 240, render: (_, row) => <div className="customer-cell-stack"><strong>{row.itemName}</strong><span>{row.storageType === 'PRODUCT' ? '产品寄存' : '项目寄存'}</span></div> },
      { title: '余量', dataIndex: 'quantity', key: 'quantity', width: 100 },
      { title: '领取', key: 'claim', width: 100, render: (_, row) => <Button type="link" size="small" disabled={Number(row.quantity) <= 0} onClick={() => onClaim?.(row)}>领取</Button> },
    ]} />}
  </div>
  const saveRemark = () => {
    const next = remarkDraft.trim()
    setDisplayRemark(next)
    setRemarkDraft(next)
    setRemarkOpen(false)
    if (customer) onAction?.('备注更新', { ...customer, remark: next })
  }
  const saveLevel = () => {
    const next = levelDraft || '无等级'
    setDisplayLevel(next)
    setLevelOpen(false)
    if (customer) onAction?.('等级更新', { ...customer, level: next })
  }
  const resetGift = () => {
    setGiftAmountEnabled(false)
    setGiftContentEnabled(false)
    setGiftContentEditorOpen(false)
    setGiftAmount(undefined)
    setGiftContent('')
    setGiftNote('')
  }
  const closeGift = () => { setGiftOpen(false); resetGift() }
  const triggerAction = (label: string) => {
    if (!customer) return
    if (label === '赠送') { resetGift(); setGiftOpen(true); return }
    if (label === '回访') { setActiveDetailTab('logs'); setLogsTab('followup'); return }
    onAction?.(label, customer)
  }
  const profile = customer && <>
    <div className="customer-detail-profile-head"><div className="customer-detail-avatar">{(customer.name || customer.phone || '顾').slice(0, 1)}</div><div><strong>{customer.phone ? maskPhone(customer.phone) : customer.name}</strong><span>{customer.phone || '—'}</span></div><Button type="text" className="customer-detail-edit-button" icon={<EditOutlined />} aria-label="编辑顾客备注" onClick={() => { setRemarkDraft(displayRemark); setRemarkOpen(true) }} /></div>
    <div className="customer-detail-level"><strong>{displayLevel}</strong><span><Button type="link" size="small" onClick={() => { setLevelDraft(displayLevel); setLevelOpen(true) }}>设置</Button><i aria-hidden>|</i><Button type="link" size="small" onClick={() => setProgressOpen(true)}>进度</Button></span></div>
    <div className="customer-detail-fields">
      {([['电话', customer.phone], ['生日', customer.birthday], ['会员编号', customer.code], ['所属门店', customer.storeName || '当前门店'], ['顾客来源', customer.source || '—'], ['推荐人', customer.referrer || '—'], ['专属顾问', customer.adviser || '—'], ['跟踪员工', customer.tracker || '—']] as const).map(([label, value]) => <div key={label}><span>{label}：</span><strong>{value || '—'}</strong></div>)}
    </div>
    <div className="customer-detail-note"><strong>备注信息</strong><span>顾客禁忌</span><Button type="text" size="small" className="customer-detail-note-edit" aria-label="编辑顾客备注" onClick={() => { setRemarkDraft(displayRemark); setRemarkOpen(true) }}>编辑</Button><p>{displayRemark || '暂无'}</p></div>
    <div className="customer-detail-note"><strong>顾客标签</strong><button type="button" aria-label="添加顾客标签">＋</button></div>
    <div className="customer-detail-consumption"><div><strong>消费信息</strong><span>最后消费</span></div><div className="customer-detail-consumption-stats"><span><b>{customer.visitCount}</b>消费次数</span><span><b>¥{customer.spent.toFixed(2)}</b>累计消费金额</span><span><b>¥0.00</b>欠款金额</span></div></div>
    <div className="customer-detail-actions">{['开单', '开卡', '预约', '赠送', '回访', '资料'].map(label => <Button key={label} size="small" onClick={() => triggerAction(label)}>{label}</Button>)}</div>
    <div className="customer-detail-wechat">微信：已绑定</div>
  </>
  const headerActions = customer && <Space size={4} wrap className="customer-detail-header-actions"><Button type="text" size="small">{displayLevel}</Button><Button type="link" size="small" onClick={() => { setLevelDraft(displayLevel); setLevelOpen(true) }}>设置</Button><Button type="link" size="small" onClick={() => setProgressOpen(true)}>进度</Button>{['开单', '开卡', '预约', '赠送', '回访', '资料'].map(label => <Button key={label} type="link" size="small" onClick={() => triggerAction(label)}>{label}</Button>)}</Space>
  return <>
  <Drawer title="会员详情" extra={headerActions} className="customer-detail-drawer" placement="right" size="min(1296px, calc(100vw - 144px))" open={Boolean(customer)} onClose={onClose} destroyOnHidden>
    {loading && <Spin />}
    {error && <QueryError error={error} onRetry={onRetry ?? (() => undefined)} />}
    {!loading && !error && customer && <div className="customer-detail-layout"><aside className="customer-detail-sidebar">{profile}</aside><section className="customer-detail-main"><Tabs activeKey={activeDetailTab} onChange={setActiveDetailTab} items={[
      { key: 'assets', label: '顾客资产', children: assetContent },
      { key: 'profile', label: '会员资料', children: <CustomerProfileTab customer={customer} onEdit={() => onAction?.('资料', customer)} /> },
      { key: 'records', label: '顾客记录', children: <CustomerRecordsTab customer={customer} storageRows={storageRows} /> },
      { key: 'data', label: '客户数据', children: <CustomerDataTab customer={customer} /> },
      { key: 'logs', label: '服务日志/回访', children: <CustomerLogsTab customer={customer} initialTab={logsTab} /> },
      { key: 'archive', label: '顾客档案', children: <CustomerArchivesTab customer={customer} /> },
      { key: 'partner', label: '合伙人信息', children: <CustomerPartnerTab /> },
      { key: 'album', label: '顾客相册', children: <CustomerAlbumTab customer={customer} /> },
    ]} /></section></div>}
  </Drawer>
  <Modal title="顾客备注" open={remarkOpen && Boolean(customer)} onCancel={() => setRemarkOpen(false)} footer={<Space><Button onClick={() => setRemarkOpen(false)}>取消</Button><Button type="primary" onClick={saveRemark}>确定</Button></Space>} destroyOnHidden>
    <Input.TextArea aria-label="顾客备注信息" value={remarkDraft} onChange={event => setRemarkDraft(event.target.value)} placeholder="请输入顾客备注信息" maxLength={500} showCount autoSize={{ minRows: 4, maxRows: 7 }} />
  </Modal>
  <Modal title="设置会员级别" open={levelOpen && Boolean(customer)} onCancel={() => setLevelOpen(false)} footer={<Space><Button onClick={() => setLevelOpen(false)}>取消</Button><Button type="primary" onClick={saveLevel}>确定</Button></Space>} destroyOnHidden>
    <div className="customer-level-settings"><label>选择级别：<Select aria-label="选择级别" value={levelDraft} onChange={setLevelDraft} options={['无等级', '普通会员', '银卡会员', '金卡会员', '钻石会员'].map(value => ({ value, label: value }))} /></label><Checkbox checked={levelLocked} onChange={event => setLevelLocked(event.target.checked)}>锁定会员等级，等级不会随着自动升级规则而改变</Checkbox></div>
  </Modal>
  <Modal title="会员等级进度" open={progressOpen && Boolean(customer)} onCancel={() => setProgressOpen(false)} footer={null} destroyOnHidden>
    <div className="customer-level-progress"><strong>当前已升级至最高等级</strong><strong>当前等级权益</strong><span>暂无可展示的升级权益</span></div>
  </Modal>
  <Drawer className="customer-gift-drawer" placement="right" size="min(920px, calc(100vw - 180px))" title={<Space><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回顾客详情" onClick={closeGift} /><strong>赠送顾客内容</strong></Space>} closable={false} open={giftOpen && Boolean(customer)} onClose={closeGift} destroyOnHidden>
    <div className="customer-gift-form">
      <div className="customer-gift-row"><span>赠送原价消费金额</span><Switch aria-label="赠送原价消费金额" checked={giftAmountEnabled} onChange={setGiftAmountEnabled} /></div>
      {giftAmountEnabled && <div className="customer-gift-control"><InputNumber aria-label="赠送原价消费金额" value={giftAmount} onChange={value => setGiftAmount(value ?? undefined)} min={0} precision={2} placeholder="请输入原价消费金额" addonAfter="元" /></div>}
      <div className="customer-gift-row"><span>赠送内容</span><Switch aria-label="赠送内容" checked={giftContentEnabled} onChange={setGiftContentEnabled} /></div>
      {giftContentEnabled && <div className="customer-gift-content-control"><button type="button" className="customer-gift-link" onClick={() => setGiftContentEditorOpen(current => !current)}>添加赠送内容</button>{giftContentEditorOpen && <Input aria-label="赠送内容说明" value={giftContent} onChange={event => setGiftContent(event.target.value)} placeholder="请输入赠送内容" maxLength={100} />}</div>}
      <label className="customer-gift-note">赠送备注<Input value={giftNote} onChange={event => setGiftNote(event.target.value)} placeholder="请输入赠送说明" maxLength={100} showCount /></label>
      {(giftAmountEnabled || giftContentEnabled) && <div className="customer-gift-actions"><Button type="primary" onClick={closeGift}>确认赠送</Button><Button onClick={closeGift}>取消</Button></div>}
    </div>
  </Drawer>
  </>
}

function CustomerAssignmentModal({ customers, target, onClose, onSave }: { customers: CustomerRecord[]; target: 'tracker' | 'adviser'; onClose: () => void; onSave: (name: string) => void }) {
  const [assignee, setAssignee] = useState(target === 'tracker' ? customers[0]?.tracker ?? '' : customers[0]?.adviser ?? '')
  useEffect(() => { setAssignee(target === 'tracker' ? customers[0]?.tracker ?? '' : customers[0]?.adviser ?? '') }, [customers, target])
  return <Modal title={target === 'tracker' ? '分配跟踪员工' : '分配专属顾问'} open={customers.length > 0} onCancel={onClose} onOk={() => onSave(assignee)} okText="保存" cancelText="取消" destroyOnHidden>
    <Select aria-label="跟踪员工" value={assignee || undefined} onChange={setAssignee} placeholder="请选择跟踪员工" options={followupAssignees.filter(item => item.key !== 'unassigned-tracker' && item.key !== 'unassigned-adviser').map(item => ({ value: item.label, label: item.label }))} style={{ width: '100%' }} allowClear />
  </Modal>
}

function StorageBatchDetailModal({ open, detail, loading, error, onRetry, onClose }: { open: boolean; detail?: StorageBatchDetail; loading?: boolean; error?: string; onRetry?: () => void; onClose: () => void }) {
  return <Modal title="寄存详情" open={open} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>} width={900} destroyOnHidden>
    {loading && <div className="customer-detail-empty"><Spin /></div>}
     {error && <QueryError error={error} onRetry={onRetry ?? (() => undefined)} />}
    {!loading && !error && detail && <div className="storage-detail-modal">
      <Descriptions size="small" column={3} bordered><Descriptions.Item label="顾客">{detail.customerName}（{detail.phone ? maskPhone(detail.phone) : '—'}）</Descriptions.Item><Descriptions.Item label="门店">{detail.storeName}</Descriptions.Item><Descriptions.Item label="操作员工">{detail.operatorName || '负责人'}</Descriptions.Item><Descriptions.Item label="创建时间">{detail.createTime ? dayjs(detail.createTime).format('YYYY-MM-DD HH:mm:ss') : '—'}</Descriptions.Item><Descriptions.Item label="备注" span={2}>{detail.remark || '—'}</Descriptions.Item></Descriptions>
      <Table<StoredApiRecord> rowKey="id" pagination={false} dataSource={detail.items} columns={[{ title: '品项名称', key: 'name', render: (_, row) => row.itemName }, { title: '分类', key: 'category', render: (_, row) => row.itemCategory || (row.storageType === 'PRODUCT' ? '产品' : '项目') }, { title: '编号', dataIndex: 'itemCode', key: 'code', render: value => value || '—' }, { title: '数量', dataIndex: 'quantity', key: 'quantity' }, { title: '状态', key: 'status', render: (_, row) => row.revoked ? '已撤销' : row.operationType === 'CLAIM' ? '部分领取' : '有效' }]} />
    </div>}
  </Modal>
}

function StorageModal({ open, customers, stores = [], products = [], projects = [], onClose, onSave }: { open: boolean; customers: CustomerRecord[]; stores?: Department[]; products?: CatalogItem[]; projects?: CatalogItem[]; onClose: () => void; onSave: (record: { customerId: number; storeId?: number | null; remark?: string; items: StorageDraftLine[] }) => Promise<void> | void }) {
  const { message } = App.useApp()
  const [customerId, setCustomerId] = useState<number>()
  const [storeId, setStoreId] = useState<number>()
  const [operator, setOperator] = useState('负责人')
  const [lines, setLines] = useState<StorageDraftLine[]>([])
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectionKeyword, setSelectionKeyword] = useState('')
  const [selectionCategory, setSelectionCategory] = useState<string>()
  const [selectionKind, setSelectionKind] = useState<'PRODUCT' | 'PROJECT' | undefined>()
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const storeOptionsForForm = stores.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name }))
  const allItems = useMemo(() => [...products, ...projects], [products, projects])
  const categoryOptions = useMemo(() => [...new Set(allItems.map(item => item.category).filter((item): item is string => Boolean(item)))].map(value => ({ value, label: value })), [allItems])
  const availableItems = useMemo(() => allItems.filter(item => (!selectionKind || item.kind === selectionKind) && (!selectionCategory || item.category === selectionCategory) && (!selectionKeyword.trim() || `${item.name}${item.code}${item.category ?? ''}`.toLowerCase().includes(selectionKeyword.trim().toLowerCase()))), [allItems, selectionCategory, selectionKeyword, selectionKind])
  useEffect(() => { if (open) { setCustomerId(undefined); setStoreId(undefined); setOperator('负责人'); setLines([]); setSelectedIds([]); setSelectionOpen(false); setSelectionKeyword(''); setSelectionCategory(undefined); setSelectionKind(undefined); setRemark('') } }, [open])
  useEffect(() => { if (customerId !== undefined) setStoreId(customers.find(row => row.id === customerId)?.storeId ?? undefined) }, [customerId, customers])
  useEffect(() => { setSelectedIds(lines.map(line => line.itemId)) }, [lines])
  const confirmSelection = () => {
    const selected = allItems.filter(item => selectedIds.includes(item.id))
    setLines(selected.map(item => {
      const existing = lines.find(line => line.itemId === item.id)
      return existing ?? { itemId: item.id, itemName: item.name, itemCode: item.code, category: item.category, storageType: item.kind === 'PRODUCT' ? 'PRODUCT' : 'PROJECT', quantity: 1 }
    }))
    setSelectionOpen(false)
  }
  const save = async () => {
    if (!customerId) { void message.error('请选择寄存顾客'); return }
    if (!storeId) { void message.error('请选择寄存门店'); return }
    if (lines.length === 0) { void message.error('请添加至少一个寄存品项'); return }
    if (lines.some(line => !line.quantity || line.quantity <= 0)) { void message.error('寄存数量必须大于0'); return }
    setSaving(true)
    try { await onSave({ customerId, storeId, remark: remark.trim() || undefined, items: lines }); onClose() } finally { setSaving(false) }
  }
  return <>
    <Modal className="storage-create-modal" title="新建寄存" open={open} onCancel={saving ? undefined : onClose} footer={<div className="storage-modal-footer"><Button onClick={onClose} disabled={saving}>取消</Button><Button type="primary" loading={saving} onClick={() => void save()}>确认寄存</Button></div>} width={880} centered destroyOnHidden>
      <div className="storage-create-form">
         <div className="storage-create-grid"><label className="required">寄存顾客<Select aria-label="新建寄存顾客" showSearch optionFilterProp="label" value={customerId} onChange={setCustomerId} placeholder="请输入顾客昵称" options={customers.filter(row => typeof row.id === 'number').map(row => ({ value: row.id as number, label: `${row.name || '未命名顾客'} · ${row.phone}` }))} /></label><label className="required">寄存门店<Select aria-label="寄存门店" value={storeId} onChange={setStoreId} placeholder={storeOptionsForForm.length > 0 ? '请选择门店' : '暂无可用门店'} options={storeOptionsForForm} disabled={storeOptionsForForm.length === 0} /></label><label>操作员工<Select aria-label="操作员工" value={operator} onChange={setOperator} options={[{ value: '负责人', label: '负责人' }, ...followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))]} /></label></div>
        <div className="storage-items-heading"><span className="required-label">寄存品项</span><Button type="primary" icon={<PlusOutlined />} onClick={() => setSelectionOpen(true)}>添加品项</Button></div>
        <Table<StorageDraftLine> rowKey="itemId" pagination={false} dataSource={lines} locale={{ emptyText: <div className="storage-items-empty"><GoalEmpty /><span>暂无相关数据，请点击添加品项</span></div> }} columns={[{ title: '品/项名称', dataIndex: 'itemName', key: 'itemName' }, { title: '分类', dataIndex: 'category', key: 'category', render: value => value || '—' }, { title: '数量', key: 'quantity', width: 180, render: (_, row) => <InputNumber min={0.001} precision={3} value={row.quantity} onChange={value => setLines(current => current.map(line => line.itemId === row.itemId ? { ...line, quantity: value ?? 0 } : line))} /> }, { title: '操作', key: 'actions', width: 80, render: (_, row) => <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除${row.itemName}`} onClick={() => setLines(current => current.filter(line => line.itemId !== row.itemId))} /> }]} />
        <label className="storage-remark-field">备注<Input.TextArea value={remark} onChange={event => setRemark(event.target.value)} maxLength={300} placeholder="请输入备注" rows={3} /></label>
      </div>
    </Modal>
    <Drawer className="storage-selection-drawer" placement="right" size="min(1220px, calc(100vw - 40px))" title={<Space><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setSelectionOpen(false)} /><strong>品项选择</strong></Space>} closable={false} open={selectionOpen} onClose={() => setSelectionOpen(false)} destroyOnHidden extra={<Space><Button onClick={() => setSelectionOpen(false)}>取消</Button><Button type="primary" icon={<CheckOutlined />} onClick={confirmSelection}>确认选择</Button></Space>} footer={<div className="storage-selection-footer"><span>已选择 {selectedIds.length} 项</span><span>{allItems.filter(item => selectedIds.includes(item.id)).map(item => item.name).join('、') || '暂无选择'}</span></div>}>
      <div className="storage-selection-filters"><Select allowClear value={selectionKind} onChange={value => setSelectionKind(value)} options={[{ value: 'PRODUCT', label: '产品' }, { value: 'PROJECT', label: '项目' }]} placeholder="请选择品项类型" /><Select allowClear value={selectionCategory} onChange={setSelectionCategory} options={categoryOptions} placeholder="请选择品项分类" /><Input.Search allowClear value={selectionKeyword} onChange={event => setSelectionKeyword(event.target.value)} placeholder="请输入名称或编号" /></div>
      <Table<CatalogItem> rowKey="id" rowSelection={{ selectedRowKeys: selectedIds, onChange: keys => setSelectedIds(keys as number[]) }} dataSource={availableItems} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[{ title: '品项信息', key: 'item', width: 360, render: (_, row) => <div className="customer-cell-stack"><strong>{row.name}</strong><span>{row.code}</span></div> }, { title: '品项分类', dataIndex: 'category', key: 'category', width: 200, render: value => value || '—' }, { title: '类型', key: 'kind', width: 120, render: (_, row) => row.kind === 'PRODUCT' ? '产品' : '项目' }, { title: '规格/单位', key: 'spec', width: 180, render: (_, row) => `${row.spec || '—'} / ${row.unit || '—'}` }, { title: '售价', dataIndex: 'price', key: 'price', width: 120 }]} scroll={{ x: 1000 }} locale={{ emptyText: '暂无相关品项' }} />
    </Drawer>
  </>
}

function RuleModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  const [days, setDays] = useState('15')
  return <Modal title="回访规则设置" open={open} onCancel={onClose} onOk={() => { onSave(); onClose() }} okText="确定" cancelText="取消"><div className="customer-form"><label>回访后到店计入天数<Input aria-label="回访后到店计入天数" value={days} onChange={event => setDays(event.target.value)} inputMode="numeric" /></label><p className="customer-form-hint">超过该时间范围的到店记录不会计入回访后到店。</p></div></Modal>
}

export default function CustomersPage() {
  const { session, can } = useAuth()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const platform = session?.userInfo.platformAdmin ?? false
  const canReadCustomers = platform || can('customers:read') || can('home:read')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as CustomerTab | null
  const tab: CustomerTab = raw === 'reminders' || (raw !== null && tabs.some(item => item.key === raw)) ? raw : 'list'
  const rawVisitTab = params.get('visitTab') as VisitTab | null
  const visitTab: VisitTab = rawVisitTab === 'visit' || rawVisitTab === 'rules' ? rawVisitTab : 'detail'
  const [revision, setRevision] = useState(0)
  const [storageRevision, setStorageRevision] = useState(0)
  const [storageDetailBatchId, setStorageDetailBatchId] = useState<string>()
  const [visitRules, setVisitRules] = useState<VisitRule[]>([])
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [storageModalOpen, setStorageModalOpen] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [detailCustomer, setDetailCustomer] = useState<CustomerRecord>()
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord>()
  const [editingFromDetail, setEditingFromDetail] = useState(false)
  const [assigningCustomers, setAssigningCustomers] = useState<CustomerRecord[]>([])
  const [assignTarget, setAssignTarget] = useState<'tracker' | 'adviser'>('tracker')
  const rawTenantId = platform ? params.get('tenantId') : null
  const tenantId = rawTenantId === null ? undefined : Number(rawTenantId)
  const tenantIdValid = rawTenantId === null || (Number.isSafeInteger(tenantId) && tenantId! > 0)
  const customerQuery = useCatalogQuery<PageResult<CustomerRecord>>('/customers?page=1&pageSize=100', tenantId, revision, canReadCustomers && tenantIdValid)
  const departmentQuery = useCatalogQuery<Department[]>('/iam/departments', tenantId, revision, canReadCustomers && tenantIdValid && (!platform || tenantId !== undefined))
  const cardQuery = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=CARD&page=1&pageSize=100&status=1', tenantId, revision, canReadCustomers && tenantIdValid && (!platform || tenantId !== undefined))
  const storageQuery = useCatalogQuery<PageResult<StoredApiRecord>>('/customers/storage?page=1&pageSize=100', tenantId, storageRevision, canReadCustomers && tenantIdValid)
  const storageProductsQuery = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=PRODUCT&page=1&pageSize=100&status=1', tenantId, revision, canReadCustomers && tenantIdValid && (!platform || tenantId !== undefined))
  const storageProjectsQuery = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=PROJECT&page=1&pageSize=100&status=1', tenantId, revision, canReadCustomers && tenantIdValid && (!platform || tenantId !== undefined))
  const storageDetailQuery = useCatalogQuery<StorageBatchDetail>(storageDetailBatchId ? `/customers/storage/${encodeURIComponent(storageDetailBatchId)}` : '/customers/storage/none', tenantId, storageRevision, Boolean(storageDetailBatchId && canReadCustomers && tenantIdValid))
  const records = customerQuery.data?.records ?? []
  const cardNames = (cardQuery.data?.records ?? []).map(item => item.name).filter((name): name is string => Boolean(name))
  const storedRecords: StoredRecord[] = (storageQuery.data?.records ?? []).map(row => ({ id: row.id, batchId: row.batchId ?? `legacy-${row.id}`, customerId: row.customerId, phone: row.phone, customerCode: row.customerCode, storeId: row.storeId, storageType: row.storageType, quantity: Number(row.quantity), customer: row.customerName, store: row.storeName, operation: row.storageType === 'PRODUCT' ? '产品寄存' : '项目寄存', item: row.itemName, itemCode: row.itemCode, itemCategory: row.itemCategory, operatorName: row.operatorName, createTime: row.createTime, remark: row.remark ?? '' }))
  const detailQuery = useCatalogQuery<CustomerRecord>(detailCustomer && typeof detailCustomer.id === 'number' ? `/customers/${detailCustomer.id}` : '/customers/0', detailCustomer?.tenantId ?? tenantId, revision, Boolean(detailCustomer && typeof detailCustomer.id === 'number' && canReadCustomers && tenantIdValid))
  const detailStorageQuery = useCatalogQuery<PageResult<StoredApiRecord>>(detailCustomer && typeof detailCustomer.id === 'number' ? `/customers/${detailCustomer.id}/storage?page=1&pageSize=100` : '/customers/0/storage?page=1&pageSize=1', detailCustomer?.tenantId ?? tenantId, storageRevision, Boolean(detailCustomer && typeof detailCustomer.id === 'number' && canReadCustomers && tenantIdValid))
  const setTab = (next: CustomerTab) => setParams(currentQuery(current => { current.set('tab', next); if (next !== 'visit') current.delete('visitTab') }))
  const setVisitTab = (next: VisitTab) => setParams(currentQuery(current => { current.set('tab', 'visit'); current.set('visitTab', next) }))
  const exportRecords = () => { if (!downloadCustomerCsv(records)) void message.info('当前没有可导出的顾客记录') }
  const exportStorageRecords = () => { if (!downloadStorageCsv(storedRecords)) void message.info('当前没有可导出的寄存记录') }
  const saveCustomer = async (record: CustomerRecord) => {
    const editing = typeof record.id === 'number'
    const payload = { name: record.name, phone: record.phone, code: record.code || undefined, level: record.level, source: record.source, birthday: record.birthday, birthdayType: record.birthdayType, gender: record.gender, joinDate: record.joinDate, avatarUrl: record.avatarUrl, referrer: record.referrer, initialSpent: record.initialSpent, referralDate: record.referralDate, remark: record.remark, tracker: record.tracker, adviser: record.adviser, storeId: record.storeId ?? undefined, cardCount: record.cardCount, balance: record.balance, spent: record.spent, visitCount: record.visitCount, lastVisit: record.lastVisit }
    try {
      const id = await catalogRequest<number>(`/customers${editing ? `/${record.id}` : ''}`, editing ? (record.tenantId ?? tenantId) : tenantId, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      setRevision(value => value + 1)
      void message.success(editing ? '顾客档案已更新' : '顾客档案已保存')
      return id
    } catch (cause) { void message.error(errorMessage(cause)); throw cause }
  }
  const handleMore = (action: 'edit' | 'delete', row: CustomerRecord) => {
    if (action === 'edit') {
      setEditingFromDetail(false)
      setEditingCustomer(row)
      setCustomerModalOpen(false)
      return
    }
    modal.confirm({ title: `删除“${row.name}”？`, content: '删除后不可恢复，请确认。', okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', onOk: async () => { try { if (typeof row.id === 'number') await catalogRequest(`/customers/${row.id}`, row.tenantId ?? tenantId, { method: 'DELETE' }); setRevision(value => value + 1); void message.success('顾客档案已删除') } catch (cause) { void message.error(errorMessage(cause)); throw cause } } })
  }
  const openAssignment = (rows: CustomerRecord[], target: 'tracker' | 'adviser') => {
    if (rows.length === 0) return
    setAssigningCustomers(rows)
    setAssignTarget(target)
  }
  const assignCustomer = async (name: string) => {
    try {
      await Promise.all(assigningCustomers.filter(row => typeof row.id === 'number').map(row => {
        const payload = { name: row.name, phone: row.phone, code: row.code || undefined, level: row.level, source: row.source, birthday: row.birthday, birthdayType: row.birthdayType, gender: row.gender, joinDate: row.joinDate, avatarUrl: row.avatarUrl, referrer: row.referrer, initialSpent: row.initialSpent, referralDate: row.referralDate, remark: row.remark, storeId: row.storeId ?? undefined, tracker: assignTarget === 'tracker' ? (name || undefined) : row.tracker, adviser: assignTarget === 'adviser' ? (name || undefined) : row.adviser, cardCount: row.cardCount, balance: row.balance, spent: row.spent, visitCount: row.visitCount, lastVisit: row.lastVisit }
        return catalogRequest(`/customers/${row.id}`, row.tenantId ?? tenantId, { method: 'PUT', body: JSON.stringify(payload) })
      }))
      setRevision(value => value + 1)
      setAssigningCustomers([])
      void message.success(assignTarget === 'tracker' ? '跟踪员工已分配' : '专属顾问已分配')
    } catch (cause) { void message.error(errorMessage(cause)); throw cause }
  }
  const saveStorage = async (input: { customerId: number; storeId?: number | null; remark?: string; items: StorageDraftLine[] }) => {
    try {
      await catalogRequest('/customers/storage', tenantId, { method: 'POST', body: JSON.stringify(input) })
      setStorageRevision(value => value + 1)
      void message.success('寄存记录已保存')
    } catch (cause) { void message.error(errorMessage(cause)); throw cause }
  }
  const revokeStorage = (row: StoredRecord) => {
    modal.confirm({ title: '撤销寄存', content: '撤销后无法恢复，是否确认撤销？', okText: '确认撤销', cancelText: '取消', okButtonProps: { danger: true }, onOk: async () => {
      try {
        await catalogRequest(`/customers/storage/${encodeURIComponent(row.batchId)}/revoke`, tenantId, { method: 'POST' })
        setStorageRevision(value => value + 1)
        void message.success('寄存记录已撤销')
      } catch (cause) { void message.error(errorMessage(cause)); throw cause }
    } })
  }
  const claimStorage = (row: StoredApiRecord) => {
    modal.confirm({ title: '领取寄存品项', content: `确认领取“${row.itemName}”1份吗？`, okText: '确认领取', cancelText: '取消', onOk: async () => {
      try {
        await catalogRequest(`/customers/storage/lines/${row.id}/claim`, detailCustomer?.tenantId ?? tenantId, { method: 'POST', body: JSON.stringify({ quantity: 1 }) })
        setStorageRevision(value => value + 1)
        void message.success('已领取1份')
      } catch (cause) { void message.error(errorMessage(cause)); throw cause }
    } })
  }
  const openCustomerAction = (action: 'billing' | 'card', row: CustomerRecord) => {
    if (action === 'billing') navigate(`/billing?customerId=${row.id}`)
    else navigate(`/billing?customerId=${row.id}&action=card`)
  }
  const content = tab === 'advanced'
    ? <AdvancedSearchPanel records={records} onDetail={setDetailCustomer} onQuickAction={openCustomerAction} />
    : tab === 'stored'
      ? <StoredValuePanel records={storedRecords} stores={departmentQuery.data ?? []} loading={storageQuery.loading} error={storageQuery.error} onRetry={storageQuery.reload} onDetail={setStorageDetailBatchId} onRevoke={revokeStorage} />
    : tab === 'visit'
        ? <CustomerVisitPanel visitTab={visitTab} onChangeTab={setVisitTab} onEditRule={() => setRuleModalOpen(true)} rules={visitRules} />
        : tab === 'followup'
          ? <CustomerFollowupPanel records={records} onDetail={setDetailCustomer} onAssign={openAssignment} />
          : tab === 'reminders'
            ? <CustomerReminderContent />
           : <CustomerListPanel records={records} stores={departmentQuery.data ?? []} cardNames={cardNames.length > 0 ? cardNames : fallbackCustomerCardNames} showTenant={platform && tenantId === undefined} onDetail={setDetailCustomer} onMore={handleMore} onQuickAction={openCustomerAction} />
  if (!canReadCustomers) return <Result status="403" title="暂无顾客查看权限" subTitle="请联系企业管理员分配顾客经营权限。" />
  const chooseEnterprise = (id?: number) => setParams(currentQuery(next => { if (id === undefined) next.delete('tenantId'); else next.set('tenantId', String(id)); next.delete('tab'); next.delete('visitTab') }))
  if (!tenantIdValid) return <><EnterpriseSelector value={tenantId} onChange={chooseEnterprise} /><Result status="404" title="企业参数不正确" /></>
  return <div className="customers-platform-workspace">{platform && <EnterpriseSelector value={tenantId} onChange={chooseEnterprise} />}<section className="customers-page" aria-labelledby="customers-title">
    <h1 id="customers-title" className="visually-hidden">顾客经营</h1>
    <div className="customer-tabs-bar">
      <Tabs className="customer-tabs" activeKey={tab} items={tabs} onChange={key => setTab(key as CustomerTab)} />
      <TopActions>
        {tab === 'list' && <Button type="primary" icon={<PlusOutlined />} disabled={platform && tenantId === undefined} title={platform && tenantId === undefined ? '选择企业后可新建顾客档案' : undefined} onClick={() => { setEditingFromDetail(false); setCustomerModalOpen(true) }}>新建顾客档案</Button>}
        {tab === 'stored' && <Button type="primary" icon={<PlusOutlined />} disabled={platform && tenantId === undefined} title={platform && tenantId === undefined ? '选择企业后可新建寄存' : undefined} onClick={() => setStorageModalOpen(true)}>新建寄存</Button>}
        {tab === 'followup' && <Button type="primary" icon={<QuestionCircleOutlined />} onClick={() => setExplanationOpen(true)}>数据说明</Button>}
        {(tab === 'list' || tab === 'advanced' || (tab === 'visit' && visitTab === 'detail')) && <Button icon={<DownloadOutlined />} onClick={exportRecords}>批量导出</Button>}
        {tab === 'stored' && <Button icon={<DownloadOutlined />} onClick={exportStorageRecords}>批量导出</Button>}
      </TopActions>
    </div>
    {customerQuery.loading && <div className="customer-panel"><Spin /></div>}
    {customerQuery.error && <QueryError error={customerQuery.error} onRetry={customerQuery.reload} />}
    {!customerQuery.loading && !customerQuery.error && content}
    <CustomerEditorModal open={customerModalOpen || Boolean(editingCustomer)} initial={editingCustomer} stores={departmentQuery.data ?? []} onClose={() => { setCustomerModalOpen(false); setEditingCustomer(undefined); if (editingFromDetail) setDetailCustomer(undefined); setEditingFromDetail(false) }} onSave={saveCustomer} onOpenCard={id => navigate(`/billing?customerId=${id}&action=card`)} />
     <CustomerDetailDrawer customer={detailQuery.data ?? detailCustomer} loading={detailQuery.loading} error={detailQuery.error} onRetry={detailQuery.reload} storageRows={detailStorageQuery.data?.records ?? []} storageLoading={detailStorageQuery.loading} storageError={detailStorageQuery.error} onStorageRetry={detailStorageQuery.reload} onClaim={claimStorage} onClose={() => { setDetailCustomer(undefined); setEditingFromDetail(false) }} onAction={(action, customer) => {
      if (action === '开单') navigate(`/billing?customerId=${customer.id}`)
      else if (action === '开卡') navigate(`/billing?customerId=${customer.id}&action=card`)
      else if (action === '赠送') navigate(`/billing?customerId=${customer.id}&action=gift`)
      else if (action === '预约') navigate(`/appointments?customerId=${customer.id}`)
      else if (action === '资料') { setEditingFromDetail(true); setEditingCustomer(customer) }
      else if (action === '回访') { setDetailCustomer(undefined); setTab('visit') }
      else if (action === '设置') { setDetailCustomer(undefined); setEditingFromDetail(false); setEditingCustomer(customer) }
      else if (action === '无等级') { setDetailCustomer(undefined); setEditingFromDetail(false); setEditingCustomer(customer) }
      else if (action === '进度') void message.info('顾客进度已打开，当前可在顾客记录和回访页继续跟进')
    }} />
    <CustomerAssignmentModal customers={assigningCustomers} target={assignTarget} onClose={() => setAssigningCustomers([])} onSave={assignCustomer} />
     <StorageBatchDetailModal open={Boolean(storageDetailBatchId)} detail={storageDetailQuery.data} loading={storageDetailQuery.loading} error={storageDetailQuery.error} onRetry={storageDetailQuery.reload} onClose={() => setStorageDetailBatchId(undefined)} />
    <StorageModal open={storageModalOpen} customers={records} stores={departmentQuery.data ?? []} products={storageProductsQuery.data?.records ?? []} projects={storageProjectsQuery.data?.records ?? []} onClose={() => setStorageModalOpen(false)} onSave={saveStorage} />
    <RuleModal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} onSave={() => { setVisitRules(current => [...current, { id: `rule-${Date.now()}`, store: '当前门店', description: '回访后15天内到店计入回访后到店', updatedAt: '刚刚' }]); void message.success('回访规则已保存') }} />
    <Modal title="顾客跟进数据说明" open={explanationOpen} onCancel={() => setExplanationOpen(false)} footer={<Button type="primary" onClick={() => setExplanationOpen(false)}>知道了</Button>}><p>顾客跟进会汇总待回访、已回访和已作废记录，支持按门店、员工、计划时间和超时状态筛选。</p></Modal>
  </section></div>
}
