import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, Checkbox, DatePicker, Descriptions, Drawer, Dropdown, Input, InputNumber, Modal, Pagination, Radio, Result, Select, Space, Spin, Table, Tabs, Upload } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import { DownloadOutlined, DownOutlined, PlusOutlined, QuestionCircleOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
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
}

interface VisitRule extends EmptyRow {
  store: string
  description: string
  updatedAt: string
}

interface StoredRecord extends EmptyRow {
  customerId: number
  storeId?: number | null
  storageType: 'PRODUCT' | 'PROJECT'
  quantity: number
  customer: string
  store: string
  operation: string
  item: string
  remark: string
}

interface StoredApiRecord {
  id: number
  customerId: number
  customerName: string
  phone: string
  customerCode: string
  storeId?: number | null
  storeName: string
  storageType: 'PRODUCT' | 'PROJECT'
  itemName: string
  quantity: number
  remark?: string
  createTime?: string
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

function StoredValuePanel({ records, loading, error, onRetry }: { records: StoredRecord[]; loading: boolean; error?: string; onRetry: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<string>()
  const [page, setPage] = useState(1)
  const pageSize = 10
  const visibleRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return records.filter(row => (!type || row.storageType === type) && (!normalized || `${row.customer}${row.item}${row.remark}`.toLowerCase().includes(normalized)))
  }, [keyword, records, type])
  useEffect(() => { setPage(1) }, [keyword, type, records.length])
  const pagedRecords = visibleRecords.slice((page - 1) * pageSize, page * pageSize)
  const columns: TableColumnsType<StoredRecord> = [
    { title: '顾客信息', key: 'customer', width: 280, render: (_, row) => <div className="customer-cell-stack"><strong>{row.customer}</strong><span>{row.store}</span></div> },
    { title: '门店信息', dataIndex: 'store', key: 'store', width: 240 },
    { title: '操作信息', key: 'operation', width: 250, render: (_, row) => `${row.operation} · ${row.quantity}` },
    { title: '品项信息', dataIndex: 'item', key: 'item', width: 260 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 220, render: value => value || '—' },
    { title: '操作', key: 'actions', width: 120, render: () => null },
  ]
  return <>
    <div className="customer-panel customer-filter-panel">
      <FilterToolbar>
        <span className="customer-filter-label">门店：</span><Select aria-label="寄存门店" placeholder="请选择门店" allowClear options={storeOptions} />
        <span className="customer-filter-label">日期：</span><DatePicker.RangePicker aria-label="寄存日期范围" placeholder={['开始日期', '结束日期']} inputReadOnly classNames={{ popup: { root: 'responsive-range-popup' } }} />
        <span className="customer-filter-label">类型：</span><Select aria-label="寄存类型" placeholder="请选择类型" allowClear value={type === undefined ? undefined : type === 'PRODUCT' ? 'product' : 'service'} onChange={value => setType(value === undefined ? undefined : value === 'product' ? 'PRODUCT' : 'PROJECT')} options={storageTypeOptions} />
        <Input.Search aria-label="搜索寄存顾客" placeholder="输入顾客姓名/手机号/编号" allowClear value={keyword} onChange={event => setKeyword(event.target.value)} onSearch={setKeyword} />
        <Input.Search aria-label="搜索寄存品项" placeholder="输入产品/项目名称、编号" allowClear onSearch={value => setKeyword(value)} />
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
  return <Modal className="customer-editor-modal" title={initial ? '编辑顾客档案' : '新建顾客档案'} open={open} onCancel={saving ? undefined : onClose} footer={null} width={1000} centered destroyOnHidden>
    <div className="customer-editor-scroll">
      <section className="customer-editor-section"><h3>基础信息</h3><div className="customer-paste-box"><label>粘贴识别</label><Input.TextArea aria-label="粘贴识别" value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="粘贴姓名、手机号的文字，如：秒金 137xxx" autoSize={{ minRows: 2, maxRows: 4 }} /><div className="customer-paste-action"><span>识别后自动填入姓名、手机号</span><Button type="primary" onClick={parsePaste}>解析</Button></div></div><div className="customer-editor-grid customer-editor-grid-3"><label className="customer-editor-field required"><span>顾客姓名</span><Input aria-label="顾客姓名" value={name} onChange={event => setName(event.target.value)} placeholder="请输入顾客姓名" maxLength={80} /></label><label className="customer-editor-field"><span>手机号</span><Input aria-label="顾客手机号" value={phone} onChange={event => setPhone(event.target.value)} placeholder="请输入手机号" maxLength={30} /></label><label className="customer-editor-field required"><span>所属门店</span><Select aria-label="所属门店" value={storeId} onChange={setStoreId} placeholder="请选择所属门店" options={storeOptionsForForm} allowClear /></label></div></section>
      <section className="customer-editor-section"><h3>其他信息</h3><div className="customer-editor-grid customer-editor-grid-3"><label className="customer-editor-field"><span>性别</span><Select aria-label="性别" value={gender} onChange={setGender} options={[{ value: '女', label: '女' }, { value: '男', label: '男' }, { value: '其他', label: '其他' }]} /></label><label className="customer-editor-field"><span>顾客来源</span><Select aria-label="顾客来源" value={source} onChange={setSource} placeholder="请选择顾客来源" options={sourceOptions} allowClear /></label><label className="customer-editor-field"><span>顾客生日</span><Space.Compact className="customer-birthday-control"><Select aria-label="顾客生日类型" value={birthdayType} onChange={setBirthdayType} options={[{ value: '阳历', label: '阳历' }, { value: '农历', label: '农历' }]} /><DatePicker aria-label="顾客生日" value={birthday} onChange={value => setBirthday(value ?? undefined)} placeholder="请选择日期" /></Space.Compact></label><label className="customer-editor-field"><span>入会时间</span><DatePicker aria-label="入会时间" value={joinDate} onChange={value => setJoinDate(value ?? undefined)} placeholder="请选择日期" /></label><label className="customer-editor-field"><span>跟踪员工</span><Select aria-label="跟踪员工" value={tracker || undefined} onChange={value => setTracker(value ?? '')} placeholder="请选择跟踪员工" options={followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))} allowClear /></label><label className="customer-editor-field"><span>专属顾问</span><Select aria-label="专属顾问" value={adviser || undefined} onChange={value => setAdviser(value ?? '')} placeholder="请选择专属顾问" options={followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))} allowClear /></label></div><div className="customer-editor-grid customer-editor-grid-3 customer-editor-lower-grid"><div className="customer-editor-field customer-avatar-field customer-editor-span-2"><span>顾客头像 <small>上传png、jpg、Jpeg格式的图片，图片不超过2M</small></span><Upload accept=".png,.jpg,.jpeg" showUploadList={false} beforeUpload={file => readAvatar(file as File)}><button type="button" className="customer-avatar-upload">{avatarUrl ? <img src={avatarUrl} alt="顾客头像" /> : <><UploadOutlined /><span>上传头像</span></>}</button></Upload></div><label className="customer-editor-field"><span>顾客编号</span><Input aria-label="顾客编号" value={code} onChange={event => setCode(event.target.value)} placeholder="请输入顾客编号" maxLength={64} /></label><label className="customer-editor-field"><span>推荐人</span><Select aria-label="推荐人" value={referrer || undefined} onChange={value => setReferrer(value ?? '')} placeholder="请输入推荐人搜索" options={followupAssignees.filter(item => !item.key.startsWith('unassigned')).map(item => ({ value: item.label, label: item.label }))} allowClear /></label><label className="customer-editor-field"><span>初始消费金额</span><InputNumber aria-label="初始消费金额" value={initialSpent} onChange={value => setInitialSpent(value ?? undefined)} min={0} precision={2} placeholder="请输入初始消费金额" /></label></div><div className="customer-editor-grid customer-editor-grid-3"><label className="customer-editor-field customer-editor-span-2"><span>顾客备注</span><Input.TextArea aria-label="顾客备注" value={remark} onChange={event => setRemark(event.target.value)} maxLength={1000} showCount placeholder="请输入顾客备注" rows={3} /></label><label className="customer-editor-field"><span>推荐日期</span><DatePicker aria-label="推荐日期" value={referralDate} onChange={value => setReferralDate(value ?? undefined)} placeholder="请选择日期" /></label></div></section>
    </div>
    <div className="customer-editor-footer"><Button onClick={onClose} disabled={saving}>取消</Button>{!initial && <Button type="primary" ghost onClick={() => void save(true)} loading={saving}>保存并开卡</Button>}<Button type="primary" onClick={() => void save(false)} loading={saving}>保存</Button></div>
  </Modal>
}

function CustomerDetailDrawer({ customer, loading, error, onRetry, onClose, onAction }: { customer?: CustomerRecord; loading?: boolean; error?: string; onRetry?: () => void; onClose: () => void; onAction?: (action: string, customer: CustomerRecord) => void }) {
  const [assetMode, setAssetMode] = useState<'detail' | 'summary'>('detail')
  const [assetCardType, setAssetCardType] = useState('全部')
  const [assetCardStatus, setAssetCardStatus] = useState('生效中')
  const [assetSort, setAssetSort] = useState('默认')
  const [availableOnly, setAvailableOnly] = useState(false)
  const assetContent = customer && <div className="customer-asset-pane">
    <div className="customer-asset-summary">
      {[
        ['会员卡', `${customer.cardCount}张`],
        ['券', '0张'],
        ['赠送', '0项'],
        ['会员积分', '0'],
        ['钱包', '0'],
        ['原价消费金', '0'],
        ['顾客寄存', '0项'],
      ].map(([label, value]) => <div key={label} className="customer-asset-stat"><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="customer-asset-filters">
      <label>卡类型：<Select size="small" value={assetCardType} onChange={setAssetCardType} options={['全部', '储值卡', '次卡', '期限卡'].map(value => ({ value, label: value }))} /></label>
      <label>卡状态：<Select size="small" value={assetCardStatus} onChange={setAssetCardStatus} options={['生效中', '已失效', '全部'].map(value => ({ value, label: value }))} /></label>
      <label>卡排序：<Select size="small" value={assetSort} onChange={setAssetSort} options={['默认', '余额从高到低', '到期时间'].map(value => ({ value, label: value }))} /></label>
    </div>
    <div className="customer-asset-mode-row"><Checkbox checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)}>仅展示卡内可用资产</Checkbox><Radio.Group value={assetMode} onChange={event => setAssetMode(event.target.value)} optionType="button" buttonStyle="solid" options={[{ value: 'detail', label: '详细模式' }, { value: 'summary', label: '简要模式' }]} /></div>
    <div className="customer-detail-empty"><GoalEmpty /><span>{availableOnly ? '暂无可用资产' : assetMode === 'summary' ? '暂无资产摘要' : '暂无相关数据'}</span></div>
  </div>
  const profileContent = customer && <Descriptions bordered size="small" column={2}><Descriptions.Item label="顾客姓名">{customer.name || '—'}</Descriptions.Item><Descriptions.Item label="手机号">{customer.phone || '—'}</Descriptions.Item><Descriptions.Item label="顾客来源">{customer.source || '—'}</Descriptions.Item><Descriptions.Item label="所属门店">{customer.storeName || '当前门店'}</Descriptions.Item><Descriptions.Item label="备注" span={2}>{customer.remark || '—'}</Descriptions.Item></Descriptions>
  const profile = customer && <>
    <div className="customer-detail-profile-head"><div className="customer-detail-avatar">{(customer.name || customer.phone || '顾').slice(0, 1)}</div><div><strong>{customer.phone ? maskPhone(customer.phone) : customer.name}</strong><span>{customer.phone || '—'}</span></div></div>
    <div className="customer-detail-level"><strong>{customer.level || '无等级'}</strong><span>设置&nbsp;&nbsp;|&nbsp;&nbsp;进度</span></div>
    <div className="customer-detail-fields">
      {([['电话', customer.phone], ['生日', customer.birthday], ['会员编号', customer.code], ['所属门店', customer.storeName || '当前门店'], ['顾客来源', customer.source || '—'], ['推荐人', '—'], ['专属顾问', customer.adviser || '—'], ['跟踪员工', customer.tracker || '—']] as const).map(([label, value]) => <div key={label}><span>{label}：</span><strong>{value || '—'}</strong></div>)}
    </div>
    <div className="customer-detail-note"><strong>备注信息</strong><span>顾客禁忌</span><p>{customer.remark || '暂无'}</p></div>
    <div className="customer-detail-note"><strong>顾客标签</strong><button type="button" aria-label="添加顾客标签">＋</button></div>
    <div className="customer-detail-consumption"><div><strong>消费信息</strong><span>最后消费</span></div><div className="customer-detail-consumption-stats"><span><b>{customer.visitCount}</b>消费次数</span><span><b>¥{customer.spent.toFixed(2)}</b>累计消费金额</span><span><b>¥0.00</b>欠款金额</span></div></div>
    <div className="customer-detail-actions">{['开单', '开卡', '预约', '赠送', '回访', '资料'].map(label => <Button key={label} size="small" onClick={() => onAction?.(label, customer)}>{label}</Button>)}</div>
    <div className="customer-detail-wechat">微信：已绑定</div>
  </>
  return <Drawer title="会员详情" className="customer-detail-drawer" placement="right" size="min(1296px, calc(100vw - 144px))" open={Boolean(customer)} onClose={onClose} destroyOnHidden>
    {loading && <Spin />}
    {error && <QueryError error={error} onRetry={onRetry ?? (() => undefined)} />}
    {!loading && !error && customer && <div className="customer-detail-layout"><aside className="customer-detail-sidebar">{profile}</aside><section className="customer-detail-main"><Tabs items={[
      { key: 'assets', label: '顾客资产', children: assetContent },
      { key: 'profile', label: '会员资料', children: profileContent },
      { key: 'records', label: '顾客记录', children: <div className="customer-detail-empty"><GoalEmpty /><span>暂无顾客记录</span></div> },
      { key: 'data', label: '客户数据', children: <div className="customer-detail-empty"><GoalEmpty /><span>暂无客户数据</span></div> },
      { key: 'logs', label: '服务日志/回访', children: <div className="customer-detail-empty"><GoalEmpty /><span>暂无服务日志/回访</span></div> },
      { key: 'archive', label: '顾客档案', children: profileContent },
      { key: 'partner', label: '合伙人信息', children: <div className="customer-detail-empty"><GoalEmpty /><span>暂无合伙人信息</span></div> },
      { key: 'album', label: '顾客相册', children: <div className="customer-detail-empty"><GoalEmpty /><span>暂无顾客相册</span></div> },
    ]} /></section></div>}
  </Drawer>
}

function CustomerAssignmentModal({ customers, target, onClose, onSave }: { customers: CustomerRecord[]; target: 'tracker' | 'adviser'; onClose: () => void; onSave: (name: string) => void }) {
  const [assignee, setAssignee] = useState(target === 'tracker' ? customers[0]?.tracker ?? '' : customers[0]?.adviser ?? '')
  useEffect(() => { setAssignee(target === 'tracker' ? customers[0]?.tracker ?? '' : customers[0]?.adviser ?? '') }, [customers, target])
  return <Modal title={target === 'tracker' ? '分配跟踪员工' : '分配专属顾问'} open={customers.length > 0} onCancel={onClose} onOk={() => onSave(assignee)} okText="保存" cancelText="取消" destroyOnHidden>
    <Select aria-label="跟踪员工" value={assignee || undefined} onChange={setAssignee} placeholder="请选择跟踪员工" options={followupAssignees.filter(item => item.key !== 'unassigned-tracker' && item.key !== 'unassigned-adviser').map(item => ({ value: item.label, label: item.label }))} style={{ width: '100%' }} allowClear />
  </Modal>
}

function StorageModal({ open, customers, onClose, onSave }: { open: boolean; customers: CustomerRecord[]; onClose: () => void; onSave: (record: { customerId: number; storeId?: number | null; storageType: 'PRODUCT' | 'PROJECT'; itemName: string; quantity: number; remark?: string }) => Promise<void> | void }) {
  const [customerId, setCustomerId] = useState<number>()
  const [type, setType] = useState<string>()
  const [item, setItem] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) { setCustomerId(undefined); setType(undefined); setItem(''); setQuantity(1); setRemark('') } }, [open])
  const save = async () => {
    if (!customerId || !type || !item.trim() || quantity <= 0) return
    setSaving(true)
    try { await onSave({ customerId, storeId: customers.find(row => row.id === customerId)?.storeId, storageType: type === 'product' ? 'PRODUCT' : 'PROJECT', itemName: item.trim(), quantity, remark: remark.trim() }); onClose() } finally { setSaving(false) }
  }
  return <Modal title="新建寄存" open={open} onCancel={saving ? undefined : onClose} onOk={() => void save()} okButtonProps={{ loading: saving }} okText="保存" cancelText="取消"><div className="customer-form"><label>顾客<Select aria-label="新建寄存顾客" showSearch optionFilterProp="label" value={customerId} onChange={setCustomerId} placeholder="请选择顾客" options={customers.filter(row => typeof row.id === 'number').map(row => ({ value: row.id as number, label: `${row.name} · ${row.phone}` }))} /></label><label>寄存类型<Select aria-label="新建寄存类型" value={type} onChange={setType} placeholder="请选择寄存类型" options={storageTypeOptions} /></label><label>品项<Input value={item} onChange={event => setItem(event.target.value)} placeholder="请输入产品或项目" /></label><label>数量<InputNumber min={0.001} precision={3} value={quantity} onChange={value => setQuantity(value ?? 0)} /></label><label>备注<Input.TextArea value={remark} onChange={event => setRemark(event.target.value)} maxLength={300} /></label></div></Modal>
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
  const [visitRules, setVisitRules] = useState<VisitRule[]>([])
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [storageModalOpen, setStorageModalOpen] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [detailCustomer, setDetailCustomer] = useState<CustomerRecord>()
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord>()
  const [assigningCustomers, setAssigningCustomers] = useState<CustomerRecord[]>([])
  const [assignTarget, setAssignTarget] = useState<'tracker' | 'adviser'>('tracker')
  const rawTenantId = platform ? params.get('tenantId') : null
  const tenantId = rawTenantId === null ? undefined : Number(rawTenantId)
  const tenantIdValid = rawTenantId === null || (Number.isSafeInteger(tenantId) && tenantId! > 0)
  const customerQuery = useCatalogQuery<PageResult<CustomerRecord>>('/customers?page=1&pageSize=100', tenantId, revision, canReadCustomers && tenantIdValid)
  const departmentQuery = useCatalogQuery<Department[]>('/iam/departments', tenantId, revision, canReadCustomers && tenantIdValid && (!platform || tenantId !== undefined))
  const cardQuery = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=CARD&page=1&pageSize=100&status=1', tenantId, revision, canReadCustomers && tenantIdValid && (!platform || tenantId !== undefined))
  const storageQuery = useCatalogQuery<PageResult<StoredApiRecord>>('/customers/storage?page=1&pageSize=100', tenantId, storageRevision, canReadCustomers && tenantIdValid)
  const records = customerQuery.data?.records ?? []
  const cardNames = (cardQuery.data?.records ?? []).map(item => item.name).filter((name): name is string => Boolean(name))
  const storedRecords: StoredRecord[] = (storageQuery.data?.records ?? []).map(row => ({ id: row.id, customerId: row.customerId, storeId: row.storeId, storageType: row.storageType, quantity: Number(row.quantity), customer: row.customerName, store: row.storeName, operation: row.storageType === 'PRODUCT' ? '产品寄存' : '项目寄存', item: row.itemName, remark: row.remark ?? '' }))
  const detailQuery = useCatalogQuery<CustomerRecord>(detailCustomer && typeof detailCustomer.id === 'number' ? `/customers/${detailCustomer.id}` : '/customers/0', detailCustomer?.tenantId ?? tenantId, revision, Boolean(detailCustomer && typeof detailCustomer.id === 'number' && canReadCustomers && tenantIdValid))
  const setTab = (next: CustomerTab) => setParams(currentQuery(current => { current.set('tab', next); if (next !== 'visit') current.delete('visitTab') }))
  const setVisitTab = (next: VisitTab) => setParams(currentQuery(current => { current.set('tab', 'visit'); current.set('visitTab', next) }))
  const exportRecords = () => { if (!downloadCustomerCsv(records)) void message.info('当前没有可导出的顾客记录') }
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
  const saveStorage = async (input: { customerId: number; storeId?: number | null; storageType: 'PRODUCT' | 'PROJECT'; itemName: string; quantity: number; remark?: string }) => {
    try {
      await catalogRequest('/customers/storage', tenantId, { method: 'POST', body: JSON.stringify(input) })
      setStorageRevision(value => value + 1)
      void message.success('寄存记录已保存')
    } catch (cause) { void message.error(errorMessage(cause)); throw cause }
  }
  const openCustomerAction = (action: 'billing' | 'card', row: CustomerRecord) => {
    if (action === 'billing') navigate(`/billing?customerId=${row.id}`)
    else navigate(`/billing?customerId=${row.id}&action=card`)
  }
  const content = tab === 'advanced'
    ? <AdvancedSearchPanel records={records} onDetail={setDetailCustomer} onQuickAction={openCustomerAction} />
    : tab === 'stored'
      ? <StoredValuePanel records={storedRecords} loading={storageQuery.loading} error={storageQuery.error} onRetry={storageQuery.reload} />
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
        {tab === 'list' && <Button type="primary" icon={<PlusOutlined />} disabled={platform && tenantId === undefined} title={platform && tenantId === undefined ? '选择企业后可新建顾客档案' : undefined} onClick={() => setCustomerModalOpen(true)}>新建顾客档案</Button>}
        {tab === 'stored' && <Button type="primary" icon={<PlusOutlined />} disabled={platform && tenantId === undefined} title={platform && tenantId === undefined ? '选择企业后可新建寄存' : undefined} onClick={() => setStorageModalOpen(true)}>新建寄存</Button>}
        {tab === 'followup' && <Button type="primary" icon={<QuestionCircleOutlined />} onClick={() => setExplanationOpen(true)}>数据说明</Button>}
        {(tab === 'list' || tab === 'advanced' || tab === 'stored' || (tab === 'visit' && visitTab === 'detail')) && <Button icon={<DownloadOutlined />} onClick={exportRecords}>批量导出</Button>}
      </TopActions>
    </div>
    {customerQuery.loading && <div className="customer-panel"><Spin /></div>}
    {customerQuery.error && <QueryError error={customerQuery.error} onRetry={customerQuery.reload} />}
    {!customerQuery.loading && !customerQuery.error && content}
    <CustomerEditorModal open={customerModalOpen || Boolean(editingCustomer)} initial={editingCustomer} stores={departmentQuery.data ?? []} onClose={() => { setCustomerModalOpen(false); setEditingCustomer(undefined) }} onSave={saveCustomer} onOpenCard={id => navigate(`/billing?customerId=${id}&action=card`)} />
    <CustomerDetailDrawer customer={detailQuery.data ?? detailCustomer} loading={detailQuery.loading} error={detailQuery.error} onRetry={detailQuery.reload} onClose={() => setDetailCustomer(undefined)} onAction={(action, customer) => {
      if (action === '开单') navigate(`/billing?customerId=${customer.id}`)
      else if (action === '开卡') navigate(`/billing?customerId=${customer.id}&action=card`)
      else if (action === '赠送') navigate(`/billing?customerId=${customer.id}&action=gift`)
      else if (action === '预约') navigate(`/appointments?customerId=${customer.id}`)
      else if (action === '资料') { setDetailCustomer(undefined); setEditingCustomer(customer) }
      else if (action === '回访') { setDetailCustomer(undefined); setTab('visit') }
    }} />
    <CustomerAssignmentModal customers={assigningCustomers} target={assignTarget} onClose={() => setAssigningCustomers([])} onSave={assignCustomer} />
    <StorageModal open={storageModalOpen} customers={records} onClose={() => setStorageModalOpen(false)} onSave={saveStorage} />
    <RuleModal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} onSave={() => { setVisitRules(current => [...current, { id: `rule-${Date.now()}`, store: '当前门店', description: '回访后15天内到店计入回访后到店', updatedAt: '刚刚' }]); void message.success('回访规则已保存') }} />
    <Modal title="顾客跟进数据说明" open={explanationOpen} onCancel={() => setExplanationOpen(false)} footer={<Button type="primary" onClick={() => setExplanationOpen(false)}>知道了</Button>}><p>顾客跟进会汇总待回访、已回访和已作废记录，支持按门店、员工、计划时间和超时状态筛选。</p></Modal>
  </section></div>
}
