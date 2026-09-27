import { useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Tag, TimePicker } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined, UserOutlined } from '@ant-design/icons'
import '@/styles/appointment.css'

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'DONE' | 'CANCELLED'
type ViewMode = 'staff' | 'room'

interface Appointment {
  id: number
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
  note?: string
}

const staffColumns = ['小杨', '李老师', '王店长', '前台']
const roomColumns = ['护理间 A', '护理间 B', 'VIP 房', '公共区']
const stores = ['余乐圈美业管理中心', '余乐圈旗舰店']
const services = ['基础清洁护理', '补水修护护理', '肩颈舒缓', '产品试用咨询']
const statuses: Array<{ value: AppointmentStatus; label: string; color: string }> = [
  { value: 'PENDING', label: '待确认', color: '#faad14' },
  { value: 'CONFIRMED', label: '待服务', color: '#1677ff' },
  { value: 'ARRIVED', label: '已到店', color: '#13c2c2' },
  { value: 'DONE', label: '已完成', color: '#52c41a' },
  { value: 'CANCELLED', label: '已取消', color: '#bfbfbf' },
]
const colors = ['#1677ff', '#722ed1', '#13c2c2', '#fa8c16', '#eb2f96']
const slots = Array.from({ length: 10 }, (_, index) => `${String(index + 10).padStart(2, '0')}:00`)

const initialAppointments: Appointment[] = [
  { id: 1, start: '10:30', duration: 60, customer: '林女士', phone: '138****2018', service: '补水修护护理', staff: '小杨', room: '护理间 A', status: 'CONFIRMED', color: '#1677ff', note: '首次到店，关注敏感肌' },
  { id: 2, start: '13:00', duration: 90, customer: '周小姐', phone: '139****6630', service: '肩颈舒缓', staff: '李老师', room: '护理间 B', status: 'PENDING', color: '#fa8c16' },
  { id: 3, start: '15:00', duration: 60, customer: '陈女士', phone: '136****9012', service: '基础清洁护理', staff: '王店长', room: 'VIP 房', status: 'ARRIVED', color: '#13c2c2' },
]

function statusMeta(status: AppointmentStatus) {
  return statuses.find(item => item.value === status) ?? statuses[0]
}

function minutesOf(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return (hour - 10) * 60 + minute
}

function AppointmentEditor({ open, appointment, defaultStart, viewMode, onClose, onSave }: {
  open: boolean
  appointment?: Appointment
  defaultStart: string
  viewMode: ViewMode
  onClose: () => void
  onSave: (value: AppointmentFormValues) => void
}) {
  const [form] = Form.useForm<AppointmentFormValues>()
  const assigneeOptions = (viewMode === 'staff' ? staffColumns : roomColumns).map(value => ({ value, label: value }))

  function setDefaults() {
    form.setFieldsValue(appointment ? {
      customer: appointment.customer,
      phone: appointment.phone,
      service: appointment.service,
      start: dayjs(`2026-01-01 ${appointment.start}`),
      duration: appointment.duration,
      assignee: viewMode === 'staff' ? appointment.staff : appointment.room,
      status: appointment.status,
      note: appointment.note,
    } : {
      customer: '',
      service: services[0],
      start: dayjs(`2026-01-01 ${defaultStart}`),
      duration: 60,
      assignee: assigneeOptions[0]?.value,
      status: 'PENDING',
    })
  }

  return <Modal
    className="appointment-editor-modal"
    title={<span className="appointment-editor-title"><CalendarOutlined /> {appointment ? '编辑预约' : '新增预约'}</span>}
    open={open}
    width={520}
    centered
    destroyOnClose
    onCancel={onClose}
    footer={<div className="appointment-dialog-actions"><Button onClick={onClose}>取消</Button><Button type="primary" onClick={() => form.submit()}>保存预约</Button></div>}
    afterOpenChange={visible => { if (visible) setDefaults() }}
  >
    <Form form={form} layout="vertical" onFinish={onSave} className="appointment-editor-form">
      <div className="appointment-form-grid">
        <Form.Item name="customer" label="顾客姓名" rules={[{ required: true, whitespace: true, message: '请输入顾客姓名' }]}><Input placeholder="例如：林女士" maxLength={50} /></Form.Item>
        <Form.Item name="phone" label="联系电话"><Input placeholder="选填" maxLength={20} /></Form.Item>
      </div>
      <div className="appointment-form-grid">
        <Form.Item name="service" label="预约项目" rules={[{ required: true, message: '请选择预约项目' }]}><Select options={services.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="assignee" label={viewMode === 'staff' ? '服务人员' : '房间'} rules={[{ required: true, message: '请选择安排' }]}><Select options={assigneeOptions} /></Form.Item>
      </div>
      <div className="appointment-form-grid appointment-form-grid--three">
        <Form.Item name="start" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}><TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="duration" label="时长（分钟）" rules={[{ required: true, message: '请输入时长' }]}><InputNumber min={15} max={480} step={15} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={statuses.map(item => ({ value: item.value, label: item.label }))} /></Form.Item>
      </div>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} maxLength={200} placeholder="记录顾客偏好或注意事项" showCount /></Form.Item>
      <div className="appointment-color-help"><span>标记颜色</span><div className="appointment-color-dots">{colors.map(color => <span key={color} className="appointment-color-dot" style={{ background: color }} />)}</div><span className="appointment-color-tip">保存后可在日历中快速识别</span></div>
    </Form>
  </Modal>
}

export default function AppointmentPage() {
  const { message } = App.useApp()
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [viewMode, setViewMode] = useState<ViewMode>('staff')
  const [store, setStore] = useState(stores[0])
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL')
  const [appointments, setAppointments] = useState(initialAppointments)
  const [editor, setEditor] = useState<{ open: boolean; appointment?: Appointment; start: string }>({ open: false, start: '10:00' })

  const columns = viewMode === 'staff' ? staffColumns : roomColumns
  const visibleAppointments = useMemo(() => appointments.filter(item => statusFilter === 'ALL' || item.status === statusFilter), [appointments, statusFilter])
  const counts = useMemo(() => statuses.map(status => ({ ...status, count: appointments.filter(item => item.status === status.value).length })), [appointments])

  function openNew(start = '10:00') { setEditor({ open: true, start }) }
  function openEdit(appointment: Appointment) { setEditor({ open: true, appointment, start: appointment.start }) }
  function save(values: AppointmentFormValues) {
    const next: Appointment = {
      id: editor.appointment?.id ?? Date.now(),
      start: values.start.format('HH:mm'), duration: values.duration, customer: values.customer.trim(), phone: values.phone?.trim(), service: values.service,
      staff: viewMode === 'staff' ? values.assignee : editor.appointment?.staff ?? staffColumns[0],
      room: viewMode === 'room' ? values.assignee : editor.appointment?.room ?? roomColumns[0],
      status: values.status, color: statusMeta(values.status).color, note: values.note?.trim(),
    }
    setAppointments(current => editor.appointment ? current.map(item => item.id === next.id ? next : item) : [...current, next])
    setEditor({ open: false, start: '10:00' })
    void message.success(editor.appointment ? '预约已更新' : '预约已创建')
  }
  function remove(appointment: Appointment) {
    setAppointments(current => current.filter(item => item.id !== appointment.id))
    void message.success('预约已删除')
  }

  return <div className="appointment-page">
    <div className="appointment-toolbar">
      <div className="appointment-date-control">
        <Button type="text" icon={<LeftOutlined />} aria-label="前一天" onClick={() => setDate(current => current.subtract(1, 'day'))} />
        <DatePicker bordered={false} value={date} allowClear={false} format="YYYY-MM-DD dddd" onChange={value => value && setDate(value)} />
        <Button type="text" icon={<RightOutlined />} aria-label="后一天" onClick={() => setDate(current => current.add(1, 'day'))} />
        <Button size="small" onClick={() => setDate(dayjs())}>今天</Button>
      </div>
      <div className="appointment-toolbar-actions">
        <Select value={store} onChange={setStore} options={stores.map(value => ({ value, label: value }))} aria-label="选择门店" />
        <Select value={viewMode} onChange={setViewMode} options={[{ value: 'staff', label: '技师维度' }, { value: 'room', label: '房间维度' }]} aria-label="选择日历维度" />
        <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ALL', label: '全部状态' }, ...statuses.map(item => ({ value: item.value, label: item.label }))]} aria-label="筛选预约状态" />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openNew()}>新增预约</Button>
      </div>
    </div>

    <section className="appointment-summary-card" aria-label="预约概览">
      <div className="appointment-summary-copy"><span className="appointment-summary-eyebrow">{store}</span><strong>{date.format('YYYY年MM月DD日 dddd')}</strong><span>今日营业预约一览</span></div>
      <div className="appointment-summary-stats">{counts.map(item => <button type="button" className="appointment-summary-stat" key={item.value} onClick={() => setStatusFilter(current => current === item.value ? 'ALL' : item.value)}><span className="appointment-summary-dot" style={{ background: item.color }} /><strong>{item.count}</strong><span>{item.label}</span></button>)}</div>
    </section>

    <section className="appointment-board" aria-label="预约日历">
      <div className="appointment-board-header"><div className="appointment-board-title"><ClockCircleOutlined /><span>预约日历</span><Tag color="blue">{visibleAppointments.length} 条安排</Tag></div><Button type="link" icon={<PlusOutlined />} onClick={() => openNew()}>快速新增</Button></div>
      <div className="appointment-grid-header"><div className="appointment-grid-corner"><span>时间</span></div>{columns.map(column => <div className="appointment-grid-column-title" key={column}><span className="appointment-avatar"><UserOutlined /></span><div><strong>{column}</strong><small>{viewMode === 'staff' ? '可预约' : '空闲房间'}</small></div></div>)}</div>
      <div className="appointment-grid-body">
        <div className="appointment-time-axis">{slots.map(slot => <div key={slot}>{slot}</div>)}</div>
        {columns.map(column => <div className="appointment-grid-column" key={column} onClick={event => { if (event.target === event.currentTarget) openNew('10:00') }}>
          {slots.map(slot => <button type="button" className="appointment-grid-cell" key={`${column}-${slot}`} aria-label={`${column} ${slot} 新增预约`} onClick={() => openNew(slot)} />)}
          {visibleAppointments.filter(item => (viewMode === 'staff' ? item.staff : item.room) === column).map(item => <button type="button" className="appointment-event" key={item.id} style={{ top: `${minutesOf(item.start) * (64 / 60)}px`, height: `${Math.max(36, item.duration * (64 / 60) - 8)}px`, borderLeftColor: item.color }} onClick={event => { event.stopPropagation(); openEdit(item) }}>
            <span className="appointment-event-time">{item.start} · {item.duration}分钟</span><strong>{item.customer}</strong><span>{item.service}</span><small>{viewMode === 'staff' ? item.room : item.staff} · {statusMeta(item.status).label}</small><span className="appointment-event-delete" role="button" aria-label={`删除${item.customer}预约`} onClick={event => { event.stopPropagation(); remove(item) }}><DeleteOutlined /></span>
          </button>)}
        </div>)}
      </div>
      {visibleAppointments.length === 0 && <div className="appointment-empty-overlay"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下暂无预约" /><Button type="primary" onClick={() => openNew()}>新增第一条预约</Button></div>}
    </section>

    <div className="appointment-footnote"><CheckCircleOutlined /> 预约只在当前浏览器中演示，后续接入预约接口后可同步到门店端。</div>
    <AppointmentEditor open={editor.open} appointment={editor.appointment} defaultStart={editor.start} viewMode={viewMode} onClose={() => setEditor({ open: false, start: '10:00' })} onSave={save} />
  </div>
}
