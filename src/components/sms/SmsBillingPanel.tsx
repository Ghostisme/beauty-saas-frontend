import { useState } from 'react'
import { Alert, App, Button, Descriptions, Modal, Pagination, Popconfirm, Spin, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { smsRequest, useSmsQuery } from '@/api/sms'
import { errorMessage, QueryError } from '@/components/iam/shared'
import { GoalEmpty } from '@/components/GoalEmpty'
import { smsDate } from './SmsRecordsPanel'
import type { PageResult } from '@/types/iam'
import type { SmsBilling, SmsPackage, SmsRecharge } from '@/types/sms'

// getRandomValues also works on a LAN HTTP preview where randomUUID is unavailable.
function requestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
function money(value: string) { return `¥${value.replace(/\.00$/, '')}` }
function rechargeStatus(status: SmsRecharge['status']) {
  return status === 'PAID' ? <Tag color="success">已支付</Tag> : status === 'CANCELLED' ? <Tag>已取消</Tag> : <Tag color="processing">待支付</Tag>
}

function RechargeHistory({ tenantId, platform, onChanged }: { tenantId?: number; platform: boolean; onChanged: () => void }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const query = useSmsQuery<PageResult<SmsRecharge>>(`/sms/recharges?page=${page}&pageSize=${pageSize}`, tenantId)
  const { message } = App.useApp()
  const [busy, setBusy] = useState<number>()
  const [error, setError] = useState('')
  async function cancel(row: SmsRecharge) {
    if (busy) return
    setBusy(row.id); setError('')
    try {
      await smsRequest<SmsRecharge>(`/sms/recharges/${row.id}/cancel`, platform ? row.tenantId : undefined, { method: 'POST', body: JSON.stringify({ version: row.version }) })
      void message.success('待支付充值单已取消，余额未发生变化'); query.reload(); onChanged()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(undefined) }
  }
  const columns: ColumnsType<SmsRecharge> = [
    ...(platform && tenantId === undefined ? [{ title: '所属企业', dataIndex: 'tenantName', width: 150 }] : []),
    { title: '订单编号', dataIndex: 'orderNo', width: 235, render: value => <span className="sms-order-no">{value}</span> },
    { title: '充值套餐', dataIndex: 'packageName', width: 160 },
    { title: '短信条数', dataIndex: 'units', width: 100, align: 'right' },
    { title: '金额', dataIndex: 'amount', width: 100, render: money },
    { title: '创建时间', dataIndex: 'createTime', width: 180, render: smsDate },
    { title: '状态', dataIndex: 'status', width: 95, render: rechargeStatus },
    { title: '操作', key: 'actions', width: 120, render: (_, row) => row.canCancel ? <Popconfirm title="取消这笔待支付充值单？" description="不会产生扣款或短信余额变动。" okText="确认取消" cancelText="返回" onConfirm={() => cancel(row)}><Button type="link" size="small" loading={busy === row.id} disabled={!!busy && busy !== row.id}>取消订单</Button></Popconfirm> : '—' },
  ]
  return <div className="sms-recharge-history">
    <Alert type="info" showIcon title="支付通道未接入，当前创建的充值单均为待支付，不增加短信余额。" />
    {error && <Alert type="error" showIcon title={error} action={<Button onClick={() => { setError(''); query.reload() }}>刷新记录</Button>} />}
    <QueryError error={query.error} onRetry={query.reload} />
    {query.loading ? <div className="sms-state"><Spin aria-label="加载充值记录" /></div> : query.data && <>
      {query.data.records.length ? <Table<SmsRecharge> rowKey="id" aria-label="短信充值记录" columns={columns} dataSource={query.data.records} pagination={false} size="small" scroll={{ x: platform && tenantId === undefined ? 1240 : 1090 }} /> : <div className="sms-state"><GoalEmpty /><span>暂无充值记录</span></div>}
      <div className="sms-table-footer"><span>共 {query.data.total} 条记录</span><Pagination current={page} pageSize={pageSize} total={query.data.total} size="small" hideOnSinglePage={query.data.total === 0} showSizeChanger pageSizeOptions={[10, 20, 50, 100]} onChange={(next, size) => { setPage(size === pageSize ? next : 1); setPageSize(size) }} /></div>
    </>}
  </div>
}

export function SmsBillingPanel({ tenantId, platform, writable }: { tenantId?: number; platform: boolean; writable: boolean }) {
  const query = useSmsQuery<SmsBilling>('/sms/billing', tenantId)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number>()
  const [purchase, setPurchase] = useState<{ pack: SmsPackage; key: string }>()
  const [created, setCreated] = useState<SmsRecharge>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const aggregate = platform && tenantId === undefined
  const canPurchase = writable && !aggregate
  const selected = query.data?.packages.find(pack => pack.id === selectedId)
  function confirmSelection() {
    if (!selected || !canPurchase) return
    setPurchase({ pack: selected, key: requestKey() }); setCreated(undefined); setError('')
  }
  function close() { if (!busy) { setPurchase(undefined); setCreated(undefined); setError('') } }
  async function create() {
    if (!purchase || busy || created) return
    setBusy(true); setError('')
    try {
      const row = await smsRequest<SmsRecharge>('/sms/recharges', tenantId, { method: 'POST', body: JSON.stringify({ packageId: purchase.pack.id, packageVersion: purchase.pack.version, idempotencyKey: purchase.key }) })
      setCreated(row); query.reload()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <>
    <div className="sms-billing-card">
      <div className="sms-balance-header"><div>{aggregate ? '全部企业剩余短信：' : '当前剩余短信：'} <strong className="sms-balance" aria-label="剩余短信条数">{query.data?.balance ?? '—'}</strong> 条</div><Button type="link" onClick={() => setHistoryOpen(true)}>短信充值记录</Button></div>
      <QueryError error={query.error} onRetry={query.reload} />
      {query.loading && <div className="sms-billing-loading"><Spin aria-label="加载短信余额" /></div>}
      {query.data && <div className="sms-package-grid" role="group" aria-label="短信充值套餐">{query.data.packages.map(pack => <Tooltip key={pack.id} title={aggregate ? '请先选择企业后创建充值单' : !writable ? '当前账号无法创建充值单' : undefined}><Button className={`sms-package${selected?.id === pack.id ? ' sms-package-selected' : ''}`} aria-pressed={selected?.id === pack.id} disabled={!canPurchase} onClick={() => setSelectedId(pack.id)}><span>{pack.name}</span><strong>{money(pack.price)}</strong></Button></Tooltip>)}</div>}
      {query.data?.packages.length === 0 && <p className="sms-muted">暂无可用短信套餐</p>}
      <p className="sms-billing-note">{aggregate ? '平台汇总视图；请选择具体企业后创建充值单。' : '套餐为当前预设配置。支付通道尚未接入，仅可创建待支付订单，不会扣款或增加短信条数。'}</p>
      {selected && canPurchase && <div className="sms-checkout" aria-label="已选套餐结算">
        <strong className="sms-checkout-amount" aria-label="应付金额" aria-live="polite">{money(selected.price)}</strong>
        <Button type="primary" onClick={confirmSelection}>立即支付</Button>
      </div>}
    </div>
    <Modal open={!!purchase} centered title={created ? '充值订单已记录' : '确认短信充值套餐'} width={520} footer={null} onCancel={close} closable={!busy} keyboard={!busy} destroyOnHidden className="sms-dialog">
      {purchase && <>
        <Alert type="info" showIcon title="充值收款通道尚未接入" description="此操作仅保存一笔待支付订单，不会扣款、发送短信或增加余额。服务商和支付接入后再完成真实充值。" />
        <Descriptions column={1} size="small" className="sms-purchase-summary" items={[
          { key: 'pack', label: '充值套餐', children: purchase.pack.name },
          { key: 'amount', label: '套餐金额', children: money(purchase.pack.price) },
          ...(created ? [{ key: 'number', label: '订单编号', children: <span className="sms-order-no">{created.orderNo}</span> }, { key: 'status', label: '订单状态', children: rechargeStatus(created.status) }] : []),
        ]} />
        {error && <Alert type="error" showIcon title="创建失败" description={error} action={<Button disabled={busy} onClick={() => { close(); query.reload() }}>刷新套餐</Button>} />}
        <div className="sms-dialog-actions">{created ? <><Button onClick={close}>关闭</Button><Button type="primary" onClick={() => { close(); setHistoryOpen(true) }}>查看充值记录</Button></> : <><Button disabled={busy} onClick={close}>取消</Button><Button type="primary" loading={busy} onClick={() => void create()}>创建待支付订单</Button></>}</div>
      </>}
    </Modal>
    <Modal open={historyOpen} centered title="短信充值记录" width={1080} onCancel={() => setHistoryOpen(false)} footer={<Button onClick={() => setHistoryOpen(false)}>关闭</Button>} destroyOnHidden className="sms-dialog sms-history-dialog">
      {historyOpen && <RechargeHistory tenantId={tenantId} platform={platform} onChanged={query.reload} />}
    </Modal>
  </>
}
