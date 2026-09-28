import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, DatePicker, Empty, Form, Input, InputNumber, Modal, Radio, Result, Select, Spin, Tag, TimePicker } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined, UserOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { EnterpriseSelector } from '@/components/iam/PlatformDataPanel'
import { QueryError } from '@/components/iam/shared'
import { useAuth } from '@/context/AuthContext'
import { catalogRequest, useCatalogQuery } from '@/api/catalog'
import type { Department, PageResult } from '@/types/iam'
import '@/styles/appointment.css'

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'DONE' | 'CANCELLED' | 'TEMP_BLOCK'
type ViewMode = 'staff' | 'room'

interface Appointment {
  id: number
  departmentId: number
  departmentName?: string
  date: string
  start: string
  duration: number
  customer: string
  phone?: string
  service: string
  staff: string
  room: string
  status: AppointmentStatus
  color: string
  note?: string
}

interface AppointmentFormValues {
  customer: string
  phone?: string
  service: string
  start: Dayjs
  duration: number
  assignee: string
  status: AppointmentStatus
  color: string
  note?: string
}

const defaultStaffColumns = ['小杨', '李老师', '王店长', '前台']
const defaultRoomColumns = ['护理间 A', '护理间 B', 'VIP 房', '公共区']
const defaultServices = ['基础清洁护理', '补水修护护理', '肩颈舒缓', '产品试用咨询']
const statuses: Array<{ value: AppointmentStatus; label: string; color: string }> = [
  { value: 'PENDING', label: '待确认', color: '#faad14' },
  { value: 'CONFIRMED', label: '待服务', color: '#1677ff' },
  { value: 'ARRIVED', label: '已到店', color: '#13c2c2' },
  { value: 'DONE', label: '已完成', color: '#52c41a' },
  { value: 'CANCELLED', label: '已取消', color: '#bfbfbf' },
  { value: 'TEMP_BLOCK', label: '临时占用', color: '#722ed1' },
]
const colors = ['#1677ff', '#722ed1', '#13c2c2', '#fa8c16', '#eb2f96', '#52c41a']
const slots = Array.from({ length: 10 }, (_, index) => `${String(index + 10).padStart(2, '0')}:00`)

function statusMeta(status: AppointmentStatus) {
  return statuses.find(item => item.value === status) ?? statuses[0]
}

function minutesOf(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number)
  return (hour - 10) * 60 + minute
}

function toAppointment(row: Record<string, unknown>): Appointment {
  const status = String(row.status ?? 'PENDING') as AppointmentStatus
  return {
    id: Number(row.id), departmentId: Number(row.departmentId), departmentName: String(row.departmentName ?? ''),
    date: String(row.appointmentDate ?? ''), start: String(row.startTime ?? '').slice(0, 5), duration: Number(row.durationMinutes ?? 60),
    customer: String(row.customerName ?? ''), phone: row.phone ? String(row.phone) : undefined, service: String(row.serviceName ?? ''),
    staff: String(row.staffName ?? ''), room: String(row.roomName ?? ''), status,
    color: String(row.color ?? statusMeta(status).color), note: row.note ? String(row.note) : undefined,
  }
}

function AppointmentEditor({ open, appointment, defaultStart, viewMode, staffOptions, roomOptions, serviceOptions, onClose, onSave }: {
  open: boolean
  appointment?: Appointment
  defaultStart: string
  viewMode: ViewMode
  staffOptions: string[]
  roomOptions: string[]
  serviceOptions: string[]
  onClose: () => void
  onSave: (value: AppointmentFormValues) => void
}) {
  const [form] = Form.useForm<AppointmentFormValues>()
  const assigneeOptions = (viewMode === 'staff' ? staffOptions : roomOptions).map(value => ({ value, label: value }))
  function setDefaults() {
    form.setFieldsValue(appointment ? {
      customer: appointment.customer, phone: appointment.phone, service: appointment.service,
      start: dayjs(`2026-01-01 ${appointment.start}`), duration: appointment.duration,
      assignee: viewMode === 'staff' ? appointment.staff : appointment.room, status: appointment.status,
      color: appointment.color, note: appointment.note,
    } : {
      customer: '', service: serviceOptions[0] ?? defaultServices[0], start: dayjs(`2026-01-01 ${defaultStart}`), duration: 60,
      assignee: assigneeOptions[0]?.value, status: 'PENDING', color: colors[0],
    })
  }
  return <Modal className="appointment-editor-modal" title={<span className="appointment-editor-title"><CalendarOutlined /> {appointment ? '编辑预约' : '新增预约'}</span>} open={open} width={520} centered destroyOnClose onCancel={onClose} footer={<div className="appointment-dialog-actions"><Button onClick={onClose}>取消</Button><Button type="primary" onClick={() => form.submit()}>保存预约</Button></div>} afterOpenChange={visible => { if (visible) setDefaults() }}>
    <Form form={form} layout="vertical" onFinish={onSave} className="appointment-editor-form">
      <div className="appointment-form-grid">
        <Form.Item name="customer" label="顾客姓名" rules={[{ required: true, whitespace: true, message: '请输入顾客姓名' }]}><Input placeholder="例如：林女士" maxLength={80} /></Form.Item>
        <Form.Item name="phone" label="联系电话"><Input placeholder="选填" maxLength={30} /></Form.Item>
      </div>
      <div className="appointment-form-grid">
        <Form.Item name="service" label="预约项目" rules={[{ required: true, message: '请选择预约项目' }]}><Select options={serviceOptions.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="assignee" label={viewMode === 'staff' ? '服务人员' : '房间'} rules={[{ required: true, message: '请选择安排' }]}><Select options={assigneeOptions} /></Form.Item>
      </div>
      <div className="appointment-form-grid appointment-form-grid--three">
        <Form.Item name="start" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}><TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="duration" label="时长（分钟）" rules={[{ required: true, message: '请输入时长' }]}><InputNumber min={15} max={480} step={15} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={statuses.map(item => ({ value: item.value, label: item.label }))} /></Form.Item>
      </div>
      <Form.Item name="color" label="自定义颜色" rules={[{ required: true, message: '请选择颜色' }]}>
        <Radio.Group className="appointment-color-picker">{colors.map(color => <Radio.Button value={color} key={color}><span className="appointment-color-dot" style={{ background: color }} aria-label={color} /></Radio.Button>)}</Radio.Group>
      </Form.Item>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} maxLength={500} placeholder="记录顾客偏好或注意事项" showCount /></Form.Item>
    </Form>
  </Modal>
}

export default function AppointmentPage() {
  const { session, can } = useAuth()
  const platform = session?.userInfo.platformAdmin ?? false
  const [params, setParams] = useSearchParams()
  const rawTenant = platform ? params.get('tenantId') : null
  const tenantId = rawTenant === null ? undefined : Number(rawTenant)
  const enabled = platform ? tenantId !== undefined : true
  const { message, modal } = App.useApp()
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [viewMode, setViewMode] = useState<ViewMode>('staff')
  const [departmentId, setDepartmentId] = useState<number>()
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL')
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState<{ open: boolean; appointment?: Appointment; start: string }>({ open: false, start: '10:00' })
  const departments = useCatalogQuery<Department[]>('/iam/departments', tenantId, revision, enabled)
  const options = useCatalogQuery<{ staff?: Array<Record<string, unknown>>; rooms?: Array<Record<string, unknown>>; services?: Array<Record<string, unknown>> }>(`/appointments/options${departmentId ? `?departmentId=${departmentId}` : ''}`, tenantId, revision, enabled)
  const query = useCatalogQuery<PageResult<Record<string, unknown>>>(`/appointments?date=${date.format('YYYY-MM-DD')}&page=1&pageSize=100${departmentId ? `&departmentId=${departmentId}` : ''}${statusFilter === 'ALL' ? '' : `&status=${statusFilter}`}`, tenantId, revision, enabled)
  const stores = (departments.data ?? []).filter(item => item.type === 'STORE' && item.status === 1)
  const store = stores.find(item => item.id === departmentId) ?? stores[0]
  useEffect(() => { if (departmentId === undefined && stores[0]) setDepartmentId(stores[0].id) }, [departmentId, stores])
  const appointments = useMemo(() => (query.data?.records ?? []).map(toAppointment), [query.data])
  const staffColumns = useMemo(() => { const values = (options.data?.staff ?? []).map(row => String(row.nickname ?? row.username ?? '')).filter(Boolean); return values.length ? values : defaultStaffColumns }, [options.data])
  const roomColumns = useMemo(() => { const values = (options.data?.rooms ?? []).map(row => String(row.name ?? '')).filter(Boolean); return values.length ? values : defaultRoomColumns }, [options.data])
  const serviceOptions = useMemo(() => { const values = (options.data?.services ?? []).map(row => String(row.name ?? '')).filter(Boolean); return values.length ? values : defaultServices }, [options.data])
  const columns = viewMode === 'staff' ? staffColumns : roomColumns
  const counts = useMemo(() => statuses.map(status => ({ ...status, count: appointments.filter(item => item.status === status.value).length })), [appointments])
  const writable = platform || can('appointments:write')

  function changeDate(next: Dayjs) { setDate(next); setStatusFilter('ALL') }
  function openNew(start = '10:00') { setEditor({ open: true, start }) }
  function openEdit(appointment: Appointment) { setEditor({ open: true, appointment, start: appointment.start }) }
  async function save(values: AppointmentFormValues) {
    if (!store) { void message.warning('请先配置门店'); return }
    const payload = {
      departmentId: store.id, appointmentDate: date.format('YYYY-MM-DD'), startTime: values.start.format('HH:mm:ss'), durationMinutes: values.duration,
      customerName: values.customer.trim(), phone: values.phone?.trim(), serviceName: values.service.trim(),
      staffName: viewMode === 'staff' ? values.assignee : editor.appointment?.staff ?? staffColumns[0], roomName: viewMode === 'room' ? values.assignee : editor.appointment?.room ?? roomColumns[0],
      status: values.status, color: values.color, note: values.note?.trim(),
    }
    try {
      await catalogRequest(`/appointments${editor.appointment ? `/${editor.appointment.id}` : ''}`, tenantId, { method: editor.appointment ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      setEditor({ open: false, start: '10:00' }); setRevision(value => value + 1); void message.success(editor.appointment ? '预约已更新' : '预约已创建')
    } catch (cause) { void message.error(cause instanceof Error ? cause.message : '保存失败，请重试') }
  }
  function remove(appointment: Appointment) {
    modal.confirm({ title: `删除“${appointment.customer}”预约？`, content: '删除后不可恢复。', okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', onOk: async () => {
      try { await catalogRequest(`/appointments/${appointment.id}`, tenantId, { method: 'DELETE' }); setRevision(value => value + 1); void message.success('预约已删除') } catch (cause) { void message.error(cause instanceof Error ? cause.message : '删除失败，请重试'); throw cause }
    } })
  }
  if (!platform && !can('appointments:read')) return <Result status="403" title="暂无预约管理权限" />
  if (platform && tenantId === undefined) return <div className="appointment-page"><EnterpriseSelector value={tenantId} onChange={id => setParams(current => { if (id === undefined) current.delete('tenantId'); else current.set('tenantId', String(id)); return current })} /><section className="catalog-panel appointment-scope-prompt"><Result status="info" title="请选择要管理的企业" subTitle="预约数据按企业和门店独立维护。" /></section></div>
  return <div className="appointment-page">
    {platform && <EnterpriseSelector value={tenantId} onChange={id => setParams(current => { if (id === undefined) current.delete('tenantId'); else current.set('tenantId', String(id)); return current })} />}
    <QueryError error={query.error || departments.error || options.error} onRetry={() => { query.reload(); departments.reload(); options.reload() }} />
    <div className="appointment-toolbar">
      <div className="appointment-date-control"><Button type="text" icon={<LeftOutlined />} aria-label="前一天" onClick={() => changeDate(date.subtract(1, 'day'))} /><DatePicker bordered={false} value={date} allowClear={false} format="YYYY-MM-DD dddd" onChange={value => value && changeDate(value)} /><Button type="text" icon={<RightOutlined />} aria-label="后一天" onClick={() => changeDate(date.add(1, 'day'))} /><Button size="small" onClick={() => changeDate(dayjs())}>今天</Button></div>
      <div className="appointment-toolbar-actions"><Select value={store?.id} onChange={value => { setDepartmentId(value); setRevision(value => value + 1) }} loading={departments.loading} options={stores.map(value => ({ value: value.id, label: value.name }))} placeholder="请选择门店" aria-label="选择门店" /><Select value={viewMode} onChange={setViewMode} options={[{ value: 'staff', label: '技师维度' }, { value: 'room', label: '房间维度' }]} aria-label="选择日历维度" /><Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ALL', label: '全部状态' }, ...statuses.map(item => ({ value: item.value, label: item.label }))]} aria-label="筛选预约状态" /><Button type="primary" icon={<PlusOutlined />} disabled={!writable || !store} onClick={() => openNew()}>新增预约</Button></div>
    </div>
    <section className="appointment-summary-card" aria-label="预约概览"><div className="appointment-summary-copy"><span className="appointment-summary-eyebrow">{store?.name ?? '未选择门店'}</span><strong>{date.format('YYYY年MM月DD日 dddd')}</strong><span>今日营业预约一览</span></div><div className="appointment-summary-stats">{counts.map(item => <button type="button" className="appointment-summary-stat" key={item.value} onClick={() => setStatusFilter(current => current === item.value ? 'ALL' : item.value)}><span className="appointment-summary-dot" style={{ background: item.color }} /><strong>{item.count}</strong><span>{item.label}</span></button>)}</div></section>
    <section className="appointment-board" aria-label="预约日历"><div className="appointment-board-header"><div className="appointment-board-title"><ClockCircleOutlined /><span>预约日历</span><Tag color="blue">{appointments.length} 条安排</Tag></div><Button type="link" icon={<PlusOutlined />} disabled={!writable || !store} onClick={() => openNew()}>快速新增</Button></div><div className="appointment-grid-header"><div className="appointment-grid-corner"><span>时间</span></div>{columns.map(column => <div className="appointment-grid-column-title" key={column}><span className="appointment-avatar"><UserOutlined /></span><div><strong>{column}</strong><small>{viewMode === 'staff' ? '可预约' : '空闲房间'}</small></div></div>)}</div><div className="appointment-grid-body"><div className="appointment-time-axis">{slots.map(slot => <div key={slot}>{slot}</div>)}</div>{columns.map(column => <div className="appointment-grid-column" key={column}>{slots.map(slot => <button type="button" className="appointment-grid-cell" key={`${column}-${slot}`} aria-label={`${column} ${slot} 新增预约`} disabled={!writable || !store} onClick={() => openNew(slot)} />)}{appointments.filter(item => (viewMode === 'staff' ? item.staff : item.room) === column).map(item => <button type="button" className="appointment-event" key={item.id} style={{ top: `${minutesOf(item.start) * (64 / 60)}px`, height: `${Math.max(36, item.duration * (64 / 60) - 8)}px`, borderLeftColor: item.color }} onClick={event => { event.stopPropagation(); openEdit(item) }}><span className="appointment-event-time">{item.start} · {item.duration}分钟</span><strong>{item.customer}</strong><span>{item.service}</span><small>{viewMode === 'staff' ? item.room : item.staff} · {statusMeta(item.status).label}</small><span className="appointment-event-delete" role="button" aria-label={`删除${item.customer}预约`} onClick={event => { event.stopPropagation(); remove(item) }}><DeleteOutlined /></span></button>)}</div>)}</div>{query.loading && <div className="appointment-loading-overlay"><Spin /></div>}{!query.loading && appointments.length === 0 && <div className="appointment-empty-overlay"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下暂无预约" /><Button type="primary" disabled={!writable || !store} onClick={() => openNew()}>新增第一条预约</Button></div>}</section>
    <div className="appointment-footnote"><CheckCircleOutlined /> 预约已接入企业数据，保存后可在门店端同步查看。</div>
    <AppointmentEditor open={editor.open} appointment={editor.appointment} defaultStart={editor.start} viewMode={viewMode} staffOptions={staffColumns} roomOptions={roomColumns} serviceOptions={serviceOptions} onClose={() => setEditor({ open: false, start: '10:00' })} onSave={save} />
  </div>
}
