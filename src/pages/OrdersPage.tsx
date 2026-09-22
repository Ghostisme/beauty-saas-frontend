import { useState } from 'react'
import { Alert, App, Button, DatePicker, Input, Pagination, Result, Select, Space, Spin, Table, Tabs, Tag, Tooltip } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { orderListPath, orderRequest, useOrderQuery } from '@/api/orders'
import { useAuth } from '@/context/AuthContext'
import { EnterpriseSelector } from '@/components/iam/PlatformDataPanel'
import { errorMessage, QueryError, useIamQuery } from '@/components/iam/shared'
import { GoalEmpty } from '@/components/GoalEmpty'
import { OrderDetailDialog, OrderSettingsDialog, orderDate, orderMoney } from '@/components/orders/OrderDialogs'
import type { PageResult } from '@/types/iam'
import type { Enterprise } from '@/types/platform'
import type { OrderFilters, OrderOption, OrderOptions, OrderRow, OrderStore, OrderTab, SearchType } from '@/types/orders'
import '@/styles/iam.css'
import '@/styles/platform.css'
import '@/styles/orders.css'

const tabs = [{ key: 'all', label: '订单列表' }, { key: 'pending', label: '未完成订单列表' }, { key: 'balance', label: '尾款单' }]
const searchTypes = [{ value: 'CUSTOMER', label: '顾客' }, { value: 'ORDER', label: '订单' }, { value: 'STAFF', label: '员工' }]
const placeholders: Record<SearchType, string> = { CUSTOMER: '输入顾客姓名/手机号/编号', ORDER: '输入订单编号', STAFF: '输入员工姓名/手机号/编号' }
const verificationOptions = [{ value: 'VERIFIED', label: '已核对' }, { value: 'UNVERIFIED', label: '未核对' }]
function initialFilters(tab: OrderTab): OrderFilters {
  return { searchType: 'CUSTOMER', keyword: '', sortBy: 'orderTime', sortDirection: 'desc', page: 1, pageSize: 10, ...(tab === 'pending' ? { startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD') } : {}) }
}
function currentQuery(change: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search)
  change(params)
  return params
}

function FilterChips({ label, options, value, onChange }: { label: string; options: OrderOption[]; value?: string; onChange: (value?: string) => void }) {
  return <div className="order-filter-row" role="group" aria-label={label}>
    <span className="order-filter-label">{label}：</span>
    <div className="order-filter-choices">{[{ value: '', label: '全部' }, ...options].map(option => <button type="button" key={option.value} aria-pressed={(value ?? '') === option.value} className={`order-filter-chip${(value ?? '') === option.value ? ' is-active' : ''}`} onClick={() => onChange(option.value || undefined)}>{option.label}</button>)}</div>
  </div>
}

function StoreSelect({ tenantId, platform, value, onChange }: { tenantId?: number; platform: boolean; value?: number; onChange: (id?: number) => void }) {
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<OrderStore>()
  const query = useOrderQuery<PageResult<OrderStore>>(`/orders/stores?page=1&pageSize=100&keyword=${encodeURIComponent(keyword)}`, tenantId)
  const choices = [...(query.data?.records ?? [])]
  if (selected && !choices.some(store => store.id === selected.id)) choices.push(selected)
  return <div className="order-store-field">
    <Select aria-label="消费门店" placeholder="请选择门店" allowClear showSearch filterOption={false} loading={query.loading} value={value} onSearch={setKeyword} onChange={next => { setSelected(choices.find(store => store.id === next)); setKeyword(''); onChange(next) }}
      options={choices.map(store => ({ value: store.id, label: `${store.name}${platform && tenantId === undefined ? ` · ${store.tenantName}` : ''}${store.status === 0 ? '（已停用）' : ''}` }))}
      notFoundContent={query.loading ? <Spin size="small" /> : query.error ? <Button type="link" onClick={query.reload}>加载失败，点击重试</Button> : '暂无可选门店'} />
    {query.error && <span className="order-field-error" role="alert">门店加载失败 <Button size="small" type="link" onClick={query.reload}>重试</Button></span>}
  </div>
}

function OrderList({ tab, filters, onFilters, tenantId, platform, revision, onChanged, options }: {
  tab: OrderTab; filters: OrderFilters; onFilters: (filters: OrderFilters) => void; tenantId?: number; platform: boolean; revision: number; onChanged: () => void; options?: OrderOptions
}) {
  const { modal, message } = App.useApp()
  const query = useOrderQuery<PageResult<OrderRow>>(orderListPath(tab, filters), tenantId, revision)
  const [draft, setDraft] = useState(filters.keyword)
  const [detail, setDetail] = useState<OrderRow>()
  const [verifying, setVerifying] = useState<number>()
  const pending = tab === 'pending'
  const change = (values: Partial<OrderFilters>) => onFilters({ ...filters, ...values, page: 1 })
  const total = query.data?.total ?? 0
  const rows = query.data?.records ?? []

  async function verify(row: OrderRow) {
    if (verifying !== undefined) return
    setVerifying(row.id)
    try {
      await orderRequest<void>(`/orders/${row.id}/verification`, platform ? row.tenantId : undefined, { method: 'POST', body: JSON.stringify({ verified: !row.verified, version: row.version }) })
      void message.success(row.verified ? '已取消订单核对' : '订单已核对'); onChanged()
    } catch (cause) { void message.error(errorMessage(cause)); query.reload() }
    finally { setVerifying(undefined) }
  }
  function handleVerify(row: OrderRow) {
    if (!row.verified) { void verify(row); return }
    modal.confirm({ title: '取消订单核对？', content: `订单 ${row.orderNo} 将恢复为未核对状态，操作会记录在审计日志中。`, okText: '确认取消核对', cancelText: '返回', onOk: () => verify(row) })
  }
  const columns: ColumnsType<OrderRow> = [
    ...(platform && tenantId === undefined ? [{ title: '所属企业', key: 'tenant', width: 200, render: (_: unknown, row: OrderRow) => <div className="order-cell-stack"><strong>{row.tenantName}</strong><span>{row.tenantCode}{row.tenantStatus === 0 && <Tag>已停用</Tag>}</span></div> }] : []),
    { title: '顾客信息', key: 'customer', width: 190, render: (_, row) => <div className="order-cell-stack"><strong>{row.customerName}</strong><span>{row.customerPhone || row.customerCode || '—'}</span></div> },
    { title: pending ? '挂单编号' : '订单编号', dataIndex: 'orderNo', key: 'orderNo', width: 180, sorter: tab === 'all', sortOrder: tab === 'all' && filters.sortBy === 'orderNo' ? (filters.sortDirection === 'asc' ? 'ascend' : 'descend') : null },
    { title: pending ? '挂单时间' : '订单时间', dataIndex: 'orderTime', key: 'orderTime', width: 170, render: orderDate, sorter: tab === 'all', sortOrder: tab === 'all' && filters.sortBy === 'orderTime' ? (filters.sortDirection === 'asc' ? 'ascend' : 'descend') : null },
    { title: pending ? '挂单内容' : '订单内容', key: 'items', width: 260, render: (_, row) => <div className="order-cell-stack"><span>{row.items.length ? row.items.map(item => `${item.name} × ${item.quantity.replace(/\.00$/, '')}`).join('、') : '—'}</span><span className="order-muted">{row.storeName || '—'}</span></div> },
    { title: '服务人员', key: 'staff', width: 140, render: (_, row) => row.staff.map(person => person.staffName).join('、') || '—' },
    { title: pending ? '挂单合计' : '订单合计', key: 'total', width: 140, align: 'right', render: (_, row) => <div className="order-cell-stack order-amount"><strong>{orderMoney(row.totalAmount)}</strong>{tab === 'balance' && <span>尾款 {orderMoney(row.outstandingAmount)}</span>}</div> },
    { title: '操作', key: 'actions', width: 160, render: (_, row) => <div className="order-row-actions"><Button type="link" onClick={() => setDetail(row)}>查看</Button>{row.canVerify && <Button type="link" loading={verifying === row.id} disabled={verifying !== undefined && verifying !== row.id} onClick={() => handleVerify(row)}>{row.verified ? '取消核对' : '核对'}</Button>}{!pending && <Tag color={row.verified ? 'blue' : 'default'}>{row.verified ? '已核对' : '未核对'}</Tag>}</div> },
  ]
  const onTableChange: TableProps<OrderRow>['onChange'] = (_, __, sorter, extra) => {
    if (extra.action !== 'sort' || Array.isArray(sorter)) return
    const by = sorter.columnKey === 'orderNo' ? 'orderNo' : 'orderTime'
    change({ sortBy: sorter.order ? by : 'orderTime', sortDirection: sorter.order === 'ascend' ? 'asc' : 'desc' })
  }
  return <div className="orders-card">
    <div className="order-basic-filters">
      <div className="order-basic-field order-search-field"><span className="order-filter-label">基础搜索：</span><Space.Compact className="order-search-inputs">
        {tab === 'all' && <Select aria-label="搜索类型" value={filters.searchType} options={searchTypes} onChange={value => { setDraft(''); change({ searchType: value, keyword: '' }) }} />}
        <Input.Search aria-label="搜索订单" value={draft} maxLength={100} placeholder={placeholders[filters.searchType]} allowClear onChange={event => { setDraft(event.target.value); if (!event.target.value) change({ keyword: '' }) }} onSearch={value => change({ keyword: value.trim() })} />
      </Space.Compact></div>
      <div className="order-basic-field order-date-field"><span className="order-filter-label">日期：</span><DatePicker.RangePicker value={filters.startDate && filters.endDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : null} onChange={dates => change({ startDate: dates?.[0]?.format('YYYY-MM-DD'), endDate: dates?.[1]?.format('YYYY-MM-DD') })} placeholder={['开始日期', '结束日期']} format="YYYY/MM/DD" aria-label="订单日期范围" inputReadOnly allowClear classNames={{ popup: { root: 'responsive-range-popup' } }} /></div>
      <div className="order-basic-field order-store-select"><span className="order-filter-label">消费门店：</span><StoreSelect tenantId={tenantId} platform={platform} value={filters.storeId} onChange={storeId => change({ storeId })} /></div>
      <div className="order-tools"><Tooltip title="重置筛选"><Button type="text" onClick={() => { setDraft(''); onFilters(initialFilters(tab)) }}>重置</Button></Tooltip><Tooltip title="刷新订单"><Button aria-label="刷新订单" icon={<ReloadOutlined />} loading={query.loading} onClick={query.reload} /></Tooltip></div>
    </div>
    {tab === 'all' && <div className="order-advanced-filters">
      <FilterChips label="消费类型" options={options?.consumptionTypes ?? []} value={filters.consumptionType} onChange={consumptionType => change({ consumptionType })} />
      <FilterChips label="支付方式" options={options?.paymentMethods ?? []} value={filters.paymentMethod} onChange={paymentMethod => change({ paymentMethod })} />
      <FilterChips label="核对状态" options={verificationOptions} value={filters.verification} onChange={verification => change({ verification })} />
    </div>}
    <div className={`order-table-area${rows.length === 0 ? ' order-table-empty' : ''}`} aria-busy={query.loading}>
      <Table<OrderRow> aria-label={tabs.find(item => item.key === tab)?.label} rowKey="id" size="middle" columns={columns} dataSource={rows} pagination={false} scroll={{ x: platform && tenantId === undefined ? 1430 : 1230 }} locale={{ emptyText: null }} onChange={onTableChange} />
      {query.loading && <div className="order-table-state" role="status"><Spin /><span>正在加载订单</span></div>}
      {query.error && <div className="order-table-state"><QueryError error={query.error} onRetry={query.reload} /></div>}
      {!query.loading && !query.error && rows.length === 0 && <div className="order-table-state"><GoalEmpty /><span>暂无相关数据</span></div>}
    </div>
    {!query.error && !query.loading && <div className="order-table-footer"><span role="status">当前共搜索到{total}条记录</span><Pagination size="small" current={filters.page} pageSize={filters.pageSize} total={total} showSizeChanger pageSizeOptions={[10, 20, 50, 100]} hideOnSinglePage={total === 0} onChange={(page, pageSize) => onFilters({ ...filters, page: pageSize !== filters.pageSize ? 1 : page, pageSize })} /></div>}
    <OrderDetailDialog row={detail} platform={platform} options={options} onClose={() => setDetail(undefined)} />
  </div>
}

function OrdersWorkspace({ tenantId, platform }: { tenantId?: number; platform: boolean }) {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (tabs.some(item => item.key === params.get('tab')) ? params.get('tab') : 'all') as OrderTab
  const [filters, setFilters] = useState<Record<OrderTab, OrderFilters>>(() => ({ all: initialFilters('all'), pending: initialFilters('pending'), balance: initialFilters('balance') }))
  const [revision, setRevision] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const options = useOrderQuery<OrderOptions>('/orders/options', tenantId)
  const enterprise = useIamQuery<Enterprise>(`/platform/tenants/${tenantId}`, 0, platform && tenantId !== undefined)
  const onChanged = () => setRevision(value => value + 1)
  const canReadSettings = platform || can('order-settings:read')
  return <section className="orders-page" aria-labelledby="orders-title">
    <h1 id="orders-title" className="visually-hidden">订单管理</h1>
    {enterprise.data?.status === 0 && <Alert type="warning" showIcon title="该企业已停用，订单可查看；维护设置前请先启用企业。" />}
    <div className="orders-tabs-bar"><Tabs className="orders-tabs" activeKey={tab} items={tabs} onChange={next => { setSettingsOpen(false); setParams(currentQuery(current => current.set('tab', next))) }} />
      {tab === 'all' && canReadSettings && <Tooltip title={platform && tenantId === undefined ? '请先选择要维护的企业' : undefined}><Button className="order-settings-button" type="primary" disabled={platform && tenantId === undefined} onClick={() => setSettingsOpen(true)}>订单核对设置</Button></Tooltip>}
    </div>
    <QueryError error={options.error || enterprise.error} onRetry={() => { options.reload(); enterprise.reload() }} />
    <OrderList key={tab} tab={tab} filters={filters[tab]} onFilters={next => setFilters(previous => ({ ...previous, [tab]: next }))} tenantId={tenantId} platform={platform} revision={revision} onChanged={onChanged} options={options.data} />
    <OrderSettingsDialog open={settingsOpen} tenantId={tenantId} writable={(platform || can('order-settings:write')) && enterprise.data?.status !== 0} onClose={() => setSettingsOpen(false)} onSaved={onChanged} />
  </section>
}

export default function OrdersPage() {
  const { session, can } = useAuth()
  const [params, setParams] = useSearchParams()
  const platform = session?.userInfo.platformAdmin ?? false
  const raw = platform ? params.get('tenantId') : null
  const tenantId = raw === null ? undefined : Number(raw)
  if (!platform && !can('orders:read')) return <Result status="403" title="暂无订单查看权限" subTitle="请联系企业管理员分配订单管理权限。" />
  if (tenantId !== undefined && (!Number.isSafeInteger(tenantId) || tenantId <= 0)) return <Result status="404" title="企业参数不正确" />
  return <div className="orders-workspace">
    {platform && <EnterpriseSelector value={tenantId} onChange={id => setParams(currentQuery(next => { if (id === undefined) next.delete('tenantId'); else next.set('tenantId', String(id)) }))} />}
    <OrdersWorkspace key={`${session?.token}:${tenantId ?? 'all'}`} tenantId={tenantId} platform={platform} />
  </div>
}
