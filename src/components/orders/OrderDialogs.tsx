import { useState } from 'react'
import { Alert, App, Button, Checkbox, Descriptions, Form, Grid, Modal, Radio, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { orderRequest, useOrderQuery } from '@/api/orders'
import { errorMessage, QueryError } from '@/components/iam/shared'
import type { OrderItem, OrderOptions, OrderRow, VerificationSettings } from '@/types/orders'

export function orderDate(value?: string) { return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—' }
// Money is supplied as a decimal string by the server; do not round via floating point.
export function orderMoney(value?: string) { return value === undefined ? '—' : `¥${value}` }

function SettingsForm({ initial, tenantId, writable, onSaved, onClose, onReload, onBusy }: {
  initial: VerificationSettings; tenantId?: number; writable: boolean; onSaved: () => void; onClose: () => void; onReload: () => void; onBusy: (busy: boolean) => void
}) {
  const [form] = Form.useForm<VerificationSettings>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { message } = App.useApp()
  const enabled = Form.useWatch('enabled', form)
  async function save(values: VerificationSettings) {
    setSaving(true); onBusy(true); setError('')
    try {
      await orderRequest<VerificationSettings>('/orders/verification-settings', tenantId, { method: 'PUT', body: JSON.stringify({ ...values, version: initial.version }) })
      void message.success('订单核对设置已保存'); onSaved(); onClose()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false); onBusy(false) }
  }
  return <Form form={form} initialValues={initial} onFinish={values => void save(values)} className="order-settings-form" disabled={!writable || saving}>
    <Form.Item label="订单核对" name="enabled" required rules={[{ required: true, message: '请选择是否启用订单核对' }]}>
      <Radio.Group options={[{ label: '启用', value: true }, { label: '禁用', value: false }]} />
    </Form.Item>
    <Form.Item name="recheckAfterPerformanceChange" valuePropName="checked" className="order-recheck-option">
      <Checkbox disabled={!writable || saving || !enabled}>已核对的订单，重新分配订单业绩后需重新核对</Checkbox>
    </Form.Item>
    {!writable && <Alert type="info" showIcon title="当前账号只有查看权限，无法修改设置。" />}
    {error && <Alert type="error" showIcon title="保存失败" description={error} action={<Button disabled={saving} onClick={onReload}>重新加载</Button>} />}
    <div className="order-dialog-actions">
      <Button disabled={saving} onClick={onClose}>取消</Button>
      {writable && <Button type="primary" htmlType="submit" loading={saving}>保存</Button>}
    </div>
  </Form>
}

export function OrderSettingsDialog({ open, tenantId, writable, onClose, onSaved }: { open: boolean; tenantId?: number; writable: boolean; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const query = useOrderQuery<VerificationSettings>('/orders/verification-settings', tenantId, 0, open)
  return <Modal open={open} centered title="订单核对设置" width={540} onCancel={() => { if (!busy) onClose() }} keyboard={!busy} closable={!busy} footer={null} className="order-dialog order-settings-dialog" destroyOnHidden>
    <QueryError error={query.error} onRetry={query.reload} />
    {query.loading && <div className="order-dialog-loading"><Spin aria-label="加载订单核对设置" /></div>}
    {query.data && <SettingsForm key={query.data.version} initial={query.data} tenantId={tenantId} writable={writable} onClose={onClose} onSaved={onSaved} onReload={query.reload} onBusy={setBusy} />}
  </Modal>
}

export function OrderDetailDialog({ row, platform, options, onClose }: { row?: OrderRow; platform: boolean; options?: OrderOptions; onClose: () => void }) {
  const screens = Grid.useBreakpoint()
  const query = useOrderQuery<OrderRow>(`/orders/${row?.id}`, platform ? row?.tenantId : undefined, 0, row !== undefined)
  const order = query.data
  const columns: ColumnsType<OrderItem> = [
    { title: '项目 / 产品', dataIndex: 'name', width: 230 },
    { title: '消费类型', dataIndex: 'consumptionType', width: 120, render: value => options?.consumptionTypes.find(item => item.value === value)?.label ?? value },
    { title: '数量', dataIndex: 'quantity', width: 90 },
    { title: '单价', dataIndex: 'unitPrice', width: 120, render: orderMoney },
    { title: '小计', dataIndex: 'amount', width: 120, render: orderMoney },
  ]
  return <Modal open={row !== undefined} centered width={840} title={row?.status === 'PENDING' ? '未完成订单详情' : '订单详情'} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>} className="order-dialog order-detail-dialog" destroyOnHidden>
    <QueryError error={query.error} onRetry={query.reload} />
    {query.loading && <div className="order-dialog-loading"><Spin aria-label="加载订单详情" /></div>}
    {order && <>
      <Descriptions size="small" column={screens.md ? 2 : 1} items={[
        { key: 'number', label: '订单编号', children: order.orderNo },
        { key: 'time', label: '订单时间', children: orderDate(order.orderTime) },
        ...(platform ? [{ key: 'enterprise', label: '所属企业', children: `${order.tenantName}（${order.tenantCode}）` }] : []),
        { key: 'store', label: '消费门店', children: order.storeName || '—' },
        { key: 'customer', label: '顾客信息', children: `${order.customerName} ${order.customerPhone || ''}` },
        { key: 'staff', label: '服务人员', children: order.staff.map(item => item.staffName).join('、') || '—' },
        { key: 'status', label: '核对状态', children: order.status === 'PENDING' ? <Tag>未完成</Tag> : <Tag color={order.verified ? 'blue' : 'default'}>{order.verified ? '已核对' : '未核对'}</Tag> },
        { key: 'total', label: '订单合计', children: orderMoney(order.totalAmount) },
        { key: 'paid', label: '已结算金额', children: orderMoney(order.paidAmount) },
        { key: 'balance', label: '待收尾款', children: orderMoney(order.outstandingAmount) },
      ]} />
      <h3>订单内容</h3>
      <Table<OrderItem> rowKey="id" size="small" columns={columns} dataSource={order.items} pagination={false} scroll={{ x: 680 }} />
      <h3>支付明细</h3>
      {order.payments?.length ? <ul className="order-payment-list">{order.payments.map(payment => <li key={payment.id}><span>{options?.paymentMethods.find(item => item.value === payment.method)?.label ?? payment.method}</span><strong>{orderMoney(payment.amount)}</strong></li>)}</ul> : <p className="order-muted">暂无支付记录</p>}
      {order.remark && <div className="order-remark"><h3>备注</h3><p>{order.remark}</p></div>}
    </>}
  </Modal>
}
