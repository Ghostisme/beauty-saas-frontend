import { useMemo, useState } from 'react'
import type { Dayjs } from 'dayjs'
import { App, Button, DatePicker, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, Table, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { GoalEmpty } from '@/components/GoalEmpty'
import { errorMessage, QueryError, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { StaffStore } from '@/types/staff'
import type { PointRuleOption, PointStatus, PointType, StaffPointPage, StaffPointRecord, StaffPointStaff } from '@/types/staff-points'
import '@/styles/staff-points.css'

const statusOptions: { value: PointStatus; label: string }[] = [
  { value: 'PENDING', label: '待审批' }, { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' }, { value: 'CANCELLED', label: '已取消' },
]
const statusNames: Record<PointStatus, string> = { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已拒绝', CANCELLED: '已取消' }
const typeOptions: { value: PointType; label: string }[] = [{ value: 'DEDUCT', label: '扣除积分' }, { value: 'ADD', label: '增加积分' }]

type Draft = { userId?: number; pointType: PointType; points?: number; reason: string }
const emptyDraft = (): Draft => ({ pointType: 'DEDUCT', reason: '' })

function formatDateTime(value?: string) { return value ? value.replace('T', ' ').slice(0, 19) : '—' }
function statusColor(status: PointStatus) { return status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : status === 'PENDING' ? 'processing' : 'default' }

export function PointsPanel({ revision, onChanged }: IamPanelProps) {
  const { can } = useAuth()
  const request = useIamRequest()
  const { message } = App.useApp()
  const writable = can('users:write')
  const [localRevision, setLocalRevision] = useState(0)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>()
  const [storeId, setStoreId] = useState<number>()
  const [pointItem, setPointItem] = useState<string>()
  const [status, setStatus] = useState<PointStatus>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState<StaffPointRecord | null>()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number>()

  const storesQuery = useIamQuery<StaffStore[]>('/staff/points/stores', revision)
  const staffQuery = useIamQuery<StaffPointStaff[]>('/staff/points/staff', revision)
  const rulesQuery = useIamQuery<PointRuleOption[]>('/staff/points/rules', revision)
  const queryPath = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (dateRange) { params.set('from', dateRange[0].format('YYYY-MM-DD')); params.set('to', dateRange[1].format('YYYY-MM-DD')) }
    if (storeId !== undefined) params.set('storeId', String(storeId))
    if (pointItem) params.set('pointItem', pointItem)
    if (status) params.set('status', status)
    return `/staff/points/records?${params.toString()}`
  }, [dateRange, page, pageSize, pointItem, status, storeId])
  const recordsQuery = useIamQuery<StaffPointPage>(queryPath, revision + localRevision)

  const stores = storesQuery.data ?? []
  const staff = staffQuery.data ?? []
  const records = recordsQuery.data?.records ?? []

  function refresh() { setLocalRevision(value => value + 1); onChanged() }
  function resetPage() { setPage(1) }
  function open(record?: StaffPointRecord) {
    setEditing(record ?? null)
    setDraft(record ? { userId: record.userId, pointType: record.pointType, points: record.points, reason: record.reason } : emptyDraft())
  }
  function close() { if (!saving) setEditing(undefined) }

  async function save() {
    if (!draft.userId) { void message.warning('请选择员工'); return }
    if (!draft.points || !Number.isInteger(draft.points) || draft.points <= 0) { void message.warning('请输入大于 0 的整数积分'); return }
    if (!draft.reason.trim()) { void message.warning('请输入修改理由'); return }
    setSaving(true)
    try {
      await request(`/staff/points${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ userId: draft.userId, pointType: draft.pointType, points: draft.points, reason: draft.reason.trim() }),
      })
      void message.success('修改成功')
      setEditing(undefined)
      refresh()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  async function remove(record: StaffPointRecord) {
    setDeleting(record.id)
    try { await request(`/staff/points/${record.id}`, { method: 'DELETE' }); void message.success('删除成功'); refresh() }
    catch (cause) { void message.error(errorMessage(cause)) }
    finally { setDeleting(undefined) }
  }

  const columns = [
    { title: '员工信息', dataIndex: 'employeeName', width: 150, render: (_: string, record: StaffPointRecord) => <div className="staff-points-user"><strong>{record.employeeName}</strong><span>编号：{record.employeeNo} · 当前积分：{record.currentPoints}</span></div> },
    { title: '提交时间', dataIndex: 'submittedAt', width: 170, render: (value: string) => formatDateTime(value) },
    { title: '获取时间', dataIndex: 'effectiveDate', width: 110 },
    { title: '积分', dataIndex: 'points', width: 80, render: (value: number, record: StaffPointRecord) => <span className={`staff-points-number ${record.pointType === 'ADD' ? 'is-add' : 'is-deduct'}`}>{record.pointType === 'ADD' ? '+' : '-'}{value}</span> },
    { title: '积分项', dataIndex: 'pointItem', width: 120 },
    { title: '备注', dataIndex: 'reason', width: 210, render: (value: string) => value || '—' },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: PointStatus) => <Tag color={statusColor(value)}>{statusNames[value] ?? value}</Tag> },
    { title: '审核信息', dataIndex: 'reviewInfo', width: 140, render: (value?: string) => value || '—' },
    { title: '操作', key: 'actions', fixed: 'right' as const, width: writable ? 125 : 0, render: (_: unknown, record: StaffPointRecord) => writable ? <Space size={0}><Button type="link" icon={<EditOutlined />} onClick={() => open(record)}>编辑</Button><Popconfirm title={`确认删除${record.employeeName}的这条积分记录吗？`} description="删除后会从员工当前积分中扣除本条记录的影响。" okText="确定" cancelText="取消" onConfirm={() => void remove(record)}><Button type="link" danger icon={<DeleteOutlined />} loading={deleting === record.id}>删除</Button></Popconfirm></Space> : null },
  ]

  return <div className="staff-points iam-panel">
    <div className="staff-points-toolbar">
      <DatePicker.RangePicker allowEmpty={[true, true]} value={dateRange} separator="~" placeholder={['开始日期', '结束日期']} onChange={value => { setDateRange(value && value[0] && value[1] ? [value[0], value[1]] : undefined); resetPage() }} />
      <Select allowClear value={storeId} placeholder="请选择门店" options={stores.map(store => ({ value: store.id, label: store.name }))} onChange={value => { setStoreId(value); resetPage() }} />
      <Select className="staff-points-rule-select" allowClear showSearch optionFilterProp="label" value={pointItem} placeholder="搜索规则" options={rulesQuery.data ?? []} onChange={value => { setPointItem(value); resetPage() }} />
      <Select className="staff-points-status-select" allowClear value={status} placeholder="全部状态" options={statusOptions} onChange={value => { setStatus(value); resetPage() }} />
      {writable && <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>增加/扣除员工积分</Button>}
    </div>
    <p className="staff-points-summary">当前积分 = 已通过的增加积分 − 已通过的扣除积分；待审批、已拒绝和已取消记录不计入余额。</p>
    <QueryError error={storesQuery.error || staffQuery.error || rulesQuery.error || recordsQuery.error} onRetry={() => { storesQuery.reload(); staffQuery.reload(); rulesQuery.reload(); recordsQuery.reload() }} />
    {recordsQuery.loading && !recordsQuery.data ? <div className="iam-loading"><Spin /></div> : records.length ? <Table className="staff-points-table" rowKey="id" scroll={{ x: 1170 }} dataSource={records} columns={columns} pagination={{ current: recordsQuery.data?.page ?? page, pageSize: recordsQuery.data?.pageSize ?? pageSize, total: recordsQuery.data?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (total: number) => `共 ${total} 条`, onChange: (nextPage, nextSize) => { setPage(nextSize !== pageSize ? 1 : nextPage); setPageSize(nextSize) } }} /> : <div className="staff-points-empty" role="status"><GoalEmpty /><span>暂无数据</span></div>}

    <Modal className="staff-points-modal" title="修改员工积分" open={editing !== undefined} onCancel={close} onOk={() => void save()} confirmLoading={saving} okText="确认" cancelText="取消" destroyOnHidden>
      <div className="staff-points-modal-fields">
        <div className="staff-points-modal-field"><label>选择员工</label><Select showSearch optionFilterProp="label" placeholder="请选择员工" value={draft.userId} options={staff.map(person => ({ value: person.id, label: person.nickname }))} onChange={value => setDraft(current => ({ ...current, userId: value }))} /></div>
        <div className="staff-points-modal-field"><label>修改类型</label><Select value={draft.pointType} options={typeOptions} onChange={value => setDraft(current => ({ ...current, pointType: value }))} /></div>
        <div className="staff-points-modal-field"><label>修改积分数量</label><InputNumber min={1} precision={0} max={1_000_000_000} placeholder="请输入整数" value={draft.points} onChange={value => setDraft(current => ({ ...current, points: value ?? undefined }))} /></div>
        <div className="staff-points-modal-field"><label>修改理由</label><Input.TextArea rows={4} maxLength={500} showCount placeholder="请输入修改员工积分理由" value={draft.reason} onChange={event => setDraft(current => ({ ...current, reason: event.target.value }))} /></div>
        <p className="staff-points-modal-hint">保存后记录自动通过，员工当前积分将按已通过的增加与扣除记录重新计算。</p>
      </div>
    </Modal>
  </div>
}
