import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, Checkbox, Empty, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Spin, Switch, Table, Tag, TimePicker } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined, QrcodeOutlined, WifiOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage, QueryError, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { StaffPosition } from '@/types/iam'
import type { StaffStore } from '@/types/staff'
import type { AttendanceConflict, AttendanceLocation, AttendanceRule, AttendanceStaff, AttendanceType, AttendanceWifi, AttendanceWorkday, OvertimeMode, PunchMethod } from '@/types/staff-attendance'
import '@/styles/staff-attendance.css'

const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

type Draft = {
  name: string
  attendanceType: AttendanceType
  allStores: boolean
  storeIds: number[]
  allEmployees: boolean
  userIds: number[]
  workdays: AttendanceWorkday[]
  overtimeEnabled: boolean
  overtimeMode: OvertimeMode
  overtimeMinutes: number
  overtimeStartTime?: string
  overtimeNonworkday: boolean
  punchMethod: PunchMethod
  radiusMeters: number
  locations: AttendanceLocation[]
  wifis: AttendanceWifi[]
}

function defaultWorkdays(): AttendanceWorkday[] {
  return weekdayNames.map((_, index) => ({ weekday: index + 1, enabled: index < 5, start: '09:00', end: '18:00' }))
}

function emptyDraft(): Draft {
  return {
    name: '', attendanceType: 'FIXED', allStores: false, storeIds: [], allEmployees: true, userIds: [], workdays: defaultWorkdays(),
    overtimeEnabled: true, overtimeMode: 'AFTER_END', overtimeMinutes: 60, overtimeNonworkday: true,
    punchMethod: 'LOCATION', radiusMeters: 100, locations: [], wifis: [],
  }
}

function draftFromRule(rule: AttendanceRule): Draft {
  return {
    name: rule.name, attendanceType: rule.attendanceType, allStores: rule.allStores, storeIds: [...rule.storeIds], allEmployees: rule.allEmployees, userIds: [...rule.userIds],
    workdays: rule.workdays?.length === 7 ? rule.workdays.map(day => ({ ...day, start: day.start.slice(0, 5), end: day.end.slice(0, 5) })) : defaultWorkdays(),
    overtimeEnabled: rule.overtimeEnabled, overtimeMode: rule.overtimeMode, overtimeMinutes: rule.overtimeMinutes ?? 60, overtimeStartTime: rule.overtimeStartTime?.slice(0, 5), overtimeNonworkday: rule.overtimeNonworkday,
    punchMethod: rule.punchMethod, radiusMeters: rule.radiusMeters ?? 100, locations: (rule.locations ?? []).map(location => ({ ...location })), wifis: (rule.wifis ?? []).map(wifi => ({ ...wifi })),
  }
}

function timeValue(value?: string): Dayjs | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return dayjs().hour(hour).minute(minute).second(0)
}

function valueTime(value: Dayjs | null): string | undefined { return value ? value.format('HH:mm') : undefined }

function formatUpdate(value?: string) { return value ? value.replace('T', ' ').slice(0, 19) : '—' }

function employeeLabel(rule: AttendanceRule) { return rule.allEmployees ? '全店员工' : rule.userNames ? Object.values(rule.userNames).join('、') || '指定员工' : `${rule.userIds.length} 名指定员工` }

function fixedSummary(rule: AttendanceRule) {
  if (rule.attendanceType === 'SCHEDULE') return '按排班考勤'
  return (rule.workdays ?? []).filter(day => day.enabled).map(day => `${weekdayNames[day.weekday - 1]}(${day.start.slice(0, 5)}-${day.end.slice(0, 5)})`).join('、') || '未设置工作日'
}

function QrPreview({ label }: { label: string }) {
  const cells = useMemo(() => Array.from({ length: 625 }, (_, index) => {
    const x = index % 25; const y = Math.floor(index / 25)
    const finder = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7 && (x === ox || x === ox + 6 || y === oy || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4))
    return finder(0, 0) || finder(18, 0) || finder(0, 18) || ((x * 17 + y * 31 + x * y) % 7 < 3)
  }), [])
  return <div className="staff-attendance-qr-wrap" aria-label={label}><div className="staff-attendance-qr">{cells.map((on, index) => <i key={index} className={on ? 'is-on' : ''} />)}</div></div>
}

function AttendanceEditor({ rule, stores, staff, positions, writable, onBack, onSaved }: {
  rule: AttendanceRule | null
  stores: StaffStore[]
  staff: AttendanceStaff[]
  positions: StaffPosition[]
  writable: boolean
  onBack: () => void
  onSaved: () => void
}) {
  const request = useIamRequest()
  const { message } = App.useApp()
  const [draft, setDraft] = useState<Draft>(() => rule ? draftFromRule(rule) : emptyDraft())
  const [saving, setSaving] = useState(false)
  const [positionId, setPositionId] = useState(0)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchStart, setBatchStart] = useState('09:00')
  const [batchEnd, setBatchEnd] = useState('18:00')
  const [locationOpen, setLocationOpen] = useState(false)
  const [scanLocationOpen, setScanLocationOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState({ latitude: '', longitude: '', name: '自定义位置', address: '' })
  const [wifiOpen, setWifiOpen] = useState(false)
  const [scanWifiOpen, setScanWifiOpen] = useState(false)
  const [wifiDraft, setWifiDraft] = useState({ name: '', macAddress: '' })
  const [conflicts, setConflicts] = useState<AttendanceConflict[]>([])
  const [conflictOpen, setConflictOpen] = useState(false)
  const [error, setError] = useState('')

  const activePositions = positions.filter(position => position.status === 1)
  const visibleStaff = staff.filter(person => positionId === 0 || person.positionId === positionId)
  const selectedAllDays = selectedDays.length === draft.workdays.length

  function patch(patchValue: Partial<Draft>) { setDraft(current => ({ ...current, ...patchValue })) }
  function setWorkday(weekday: number, value: Partial<AttendanceWorkday>) { setDraft(current => ({ ...current, workdays: current.workdays.map(day => day.weekday === weekday ? { ...day, ...value } : day) })) }

  function toggleAllStores(checked: boolean) { patch({ allStores: checked, storeIds: checked ? stores.map(store => store.id) : [] }) }
  function toggleStore(storeId: number, checked: boolean) { patch({ allStores: false, storeIds: checked ? Array.from(new Set([...draft.storeIds, storeId])) : draft.storeIds.filter(id => id !== storeId) }) }

  function toggleAllDays(checked: boolean) { setSelectedDays(checked ? draft.workdays.map(day => day.weekday) : []) }
  function toggleDay(weekday: number, checked: boolean) { setSelectedDays(current => checked ? [...new Set([...current, weekday])] : current.filter(day => day !== weekday)) }

  function applyBatch() {
    if (!batchStart || !batchEnd || batchStart >= batchEnd) { void message.warning('打卡开始时间必须早于结束时间'); return }
    setDraft(current => ({ ...current, workdays: current.workdays.map(day => selectedDays.includes(day.weekday) ? { ...day, enabled: true, start: batchStart, end: batchEnd } : day) }))
    setBatchOpen(false)
  }

  function validate(): boolean {
    const name = draft.name.trim()
    if (!name) { setError('请输入规则名称'); return false }
    if (!draft.allStores && draft.storeIds.length === 0) { setError('请选择适用门店'); return false }
    if (!draft.allEmployees && draft.userIds.length === 0) { setError('请选择员工'); return false }
    if (draft.attendanceType === 'FIXED' && draft.workdays.some(day => day.enabled && day.start >= day.end)) { setError('打卡开始时间必须早于结束时间'); return false }
    if (draft.overtimeEnabled && draft.overtimeMode === 'AT_TIME' && !draft.overtimeStartTime) { setError('请设置加班时间点'); return false }
    if (draft.punchMethod === 'WIFI' && draft.wifis.length === 0) { setError('WIFI列表不能为空'); return false }
    setError(''); return true
  }

  function payload(force: boolean) { return { ...draft, name: draft.name.trim(), storeIds: draft.allStores ? stores.map(store => store.id) : draft.storeIds, force } }

  async function persist(force: boolean) {
    setSaving(true)
    try {
      await request(`/staff/attendance/rules${rule ? `/${rule.id}` : ''}`, { method: rule ? 'PUT' : 'POST', body: JSON.stringify(payload(force)) })
      void message.success(rule ? '保存成功' : '新增成功')
      onSaved()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  async function save() {
    if (!writable || saving || !validate()) return
    setSaving(true)
    try {
      const found = await request<AttendanceConflict[]>('/staff/attendance/rules/conflicts', { method: 'POST', body: JSON.stringify(payload(false)) })
      if (found.length) { setConflicts(found); setConflictOpen(true); return }
      await request(`/staff/attendance/rules${rule ? `/${rule.id}` : ''}`, { method: rule ? 'PUT' : 'POST', body: JSON.stringify(payload(false)) })
      void message.success(rule ? '保存成功' : '新增成功')
      onSaved()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  function addLocation() {
    const latitude = Number(locationDraft.latitude); const longitude = Number(locationDraft.longitude)
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { void message.warning('请输入有效的经度和纬度'); return }
    patch({ locations: [...draft.locations, { name: locationDraft.name.trim() || '自定义位置', address: locationDraft.address.trim(), latitude, longitude }] })
    setLocationOpen(false); setLocationDraft({ latitude: '', longitude: '', name: '自定义位置', address: '' })
  }

  function addWifi() {
    const macAddress = wifiDraft.macAddress.trim().toUpperCase()
    if (!wifiDraft.name.trim() || !macAddress) { void message.warning('请输入 WIFI 名称和 MAC 地址'); return }
    if (draft.wifis.some(wifi => wifi.macAddress.toUpperCase() === macAddress)) { void message.warning('该 WIFI 地址已添加'); return }
    patch({ wifis: [...draft.wifis, { name: wifiDraft.name.trim(), macAddress }] })
    setWifiOpen(false); setWifiDraft({ name: '', macAddress: '' })
  }

  return <div className="staff-attendance-editor">
    <div className="staff-attendance-editor-head"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回考勤规则" onClick={onBack} /><h2>{rule ? '编辑考勤规则' : '新增考勤规则'}</h2></div>
    {!writable && <Tag color="warning">当前账号仅可查看</Tag>}
    {error && <div className="staff-attendance-error" role="alert">{error}</div>}
    <div className="staff-attendance-form">
      <section className="staff-attendance-section"><label className="staff-attendance-label required">规则名称</label><div className="staff-attendance-name"><Input maxLength={20} showCount value={draft.name} placeholder="请输入规则名称" onChange={event => patch({ name: event.target.value })} disabled={!writable || saving} /></div></section>

      <section className="staff-attendance-section"><label className="staff-attendance-label required">适用门店</label>
        <div className="staff-attendance-store-list"><Checkbox checked={draft.allStores} onChange={event => toggleAllStores(event.target.checked)} disabled={!writable || saving}>所有门店</Checkbox>
          {stores.map(store => <div className={`staff-attendance-store-row${draft.storeIds.includes(store.id) ? ' is-selected' : ''}`} key={store.id}><Checkbox checked={draft.allStores || draft.storeIds.includes(store.id)} onChange={event => toggleStore(store.id, event.target.checked)} disabled={draft.allStores || !writable || saving}>{store.name}</Checkbox></div>)}
        </div>
      </section>

      <section className="staff-attendance-section"><label className="staff-attendance-label required">考勤类型</label><Radio.Group value={draft.attendanceType} onChange={event => patch({ attendanceType: event.target.value })} disabled={!writable || saving} options={[{ label: '按固定时间考勤', value: 'FIXED' }, { label: '按排班考勤', value: 'SCHEDULE' }]} /></section>

      {draft.attendanceType === 'FIXED' && <section className="staff-attendance-section"><div className="staff-attendance-section-title"><label className="staff-attendance-label required">工作日设置</label><Button type="link" disabled={!writable || saving || !selectedDays.length} onClick={() => setBatchOpen(true)}>批量设置打卡时间</Button></div>
        <div className="staff-attendance-workday-scroll"><table className="staff-attendance-workdays"><thead><tr><th><Checkbox checked={selectedAllDays} indeterminate={selectedDays.length > 0 && !selectedAllDays} onChange={event => toggleAllDays(event.target.checked)} disabled={!writable || saving} /></th><th>工作日</th><th>是否打卡</th><th>打卡时间</th></tr></thead><tbody>{draft.workdays.map(day => <tr key={day.weekday}><td><Checkbox checked={selectedDays.includes(day.weekday)} onChange={event => toggleDay(day.weekday, event.target.checked)} disabled={!writable || saving} /></td><td>{weekdayNames[day.weekday - 1]}</td><td><Switch size="small" checked={day.enabled} onChange={checked => setWorkday(day.weekday, { enabled: checked })} disabled={!writable || saving} /></td><td>{day.enabled ? <div className="staff-attendance-time-range"><TimePicker value={timeValue(day.start)} format="HH:mm" minuteStep={5} allowClear={false} onChange={value => setWorkday(day.weekday, { start: valueTime(value) ?? day.start })} disabled={!writable || saving} /><span>至</span><TimePicker value={timeValue(day.end)} format="HH:mm" minuteStep={5} allowClear={false} onChange={value => setWorkday(day.weekday, { end: valueTime(value) ?? day.end })} disabled={!writable || saving} /></div> : <span className="staff-attendance-muted">休息</span>}</td></tr>)}</tbody></table></div>
      </section>}

      <section className="staff-attendance-section"><label className="staff-attendance-label required">添加考勤员工</label><Radio.Group value={draft.allEmployees ? 'all' : 'specific'} onChange={event => patch({ allEmployees: event.target.value === 'all', userIds: event.target.value === 'all' ? [] : draft.userIds })} disabled={!writable || saving} options={[{ label: '全店适用', value: 'all' }, { label: '指定员工', value: 'specific' }]} />
        {!draft.allEmployees && <div className="staff-attendance-employees"><Space wrap><Select aria-label="员工职位筛选" value={positionId} options={[{ label: '全部职位', value: 0 }, ...activePositions.map(position => ({ label: position.name, value: position.id }))]} onChange={setPositionId} disabled={!writable || saving} /></Space><div className="staff-attendance-count">共{draft.userIds.length}人</div><Checkbox.Group value={draft.userIds} onChange={values => patch({ userIds: values.map(Number) })} disabled={!writable || saving}><div className="staff-attendance-employee-grid">{visibleStaff.map(person => <Checkbox key={person.id} value={person.id}>{person.nickname}{person.positionName ? `（${person.positionName}）` : ''}</Checkbox>)}</div></Checkbox.Group>{!draft.userIds.length && <div className="staff-attendance-field-error">请选择员工</div>}</div>}
      </section>

      <section className="staff-attendance-section"><div className="staff-attendance-inline-label"><label className="staff-attendance-label">加班设置</label><Switch checked={draft.overtimeEnabled} onChange={overtimeEnabled => patch({ overtimeEnabled })} disabled={!writable || saving} /></div>
        {draft.overtimeEnabled && <div className="staff-attendance-overtime"><Radio.Group value={draft.overtimeMode} onChange={event => patch({ overtimeMode: event.target.value })} disabled={!writable || saving} options={[{ label: '超过下班时间', value: 'AFTER_END' }, { label: '指定时间开始', value: 'AT_TIME' }]} />
          {draft.overtimeMode === 'AFTER_END' ? <div className="staff-attendance-overtime-line">超过下班时间 <InputNumber min={0} max={1440} value={draft.overtimeMinutes} onChange={value => patch({ overtimeMinutes: value ?? 0 })} disabled={!writable || saving} /> 分钟 后算加班</div> : <div className="staff-attendance-overtime-line">从 <TimePicker value={timeValue(draft.overtimeStartTime)} format="HH:mm" minuteStep={5} placeholder="请选择时间" onChange={value => patch({ overtimeStartTime: valueTime(value) })} disabled={!writable || saving} /> 开始算加班{!draft.overtimeStartTime && <span className="staff-attendance-field-error">请设置加班时间点</span>}</div>}
          <div className="staff-attendance-overtime-line">非工作日打卡是否计算为加班 <Radio.Group value={draft.overtimeNonworkday ? 'yes' : 'no'} onChange={event => patch({ overtimeNonworkday: event.target.value === 'yes' })} disabled={!writable || saving} options={[{ label: '计算', value: 'yes' }, { label: '不计算', value: 'no' }]} /></div>
        </div>}
      </section>

      <section className="staff-attendance-section"><label className="staff-attendance-label required">打卡方式</label><Radio.Group value={draft.punchMethod} onChange={event => patch({ punchMethod: event.target.value })} disabled={!writable || saving} options={[{ label: <><EnvironmentOutlined /> 基于门店位置打卡</>, value: 'LOCATION' }, { label: <><WifiOutlined /> WIFI打卡</>, value: 'WIFI' }, { label: <><QrcodeOutlined /> 打卡码</>, value: 'CODE' }]} />
        {draft.punchMethod === 'LOCATION' && <div className="staff-attendance-punch-panel"><label>有效范围</label><InputNumber min={1} max={10000} value={draft.radiusMeters} onChange={value => patch({ radiusMeters: value ?? 100 })} addonAfter="米" disabled={!writable || saving} /><div className="staff-attendance-link-row"><Button type="link" icon={<QrcodeOutlined />} disabled={!writable || saving} onClick={() => setScanLocationOpen(true)}>扫描添加位置</Button><Button type="link" icon={<PlusOutlined />} disabled={!writable || saving} onClick={() => setLocationOpen(true)}>手动添加位置</Button></div><table className="staff-attendance-location-table"><thead><tr><th>位置</th><th>地址</th><th>操作</th></tr></thead><tbody><tr><td>门店位置</td><td>按所选门店的地址校验</td><td>—</td></tr>{draft.locations.map((location, index) => <tr key={`${location.name}-${index}`}><td>{location.name}</td><td>{location.address || `${location.latitude}, ${location.longitude}`}</td><td><Button type="link" danger onClick={() => patch({ locations: draft.locations.filter((_, itemIndex) => itemIndex !== index) })}>删除</Button></td></tr>)}</tbody></table></div>}
        {draft.punchMethod === 'WIFI' && <div className="staff-attendance-punch-panel"><div className="staff-attendance-link-row"><Button type="link" icon={<QrcodeOutlined />} disabled={!writable || saving} onClick={() => setScanWifiOpen(true)}>扫描添加WIFI</Button><Button type="link" icon={<PlusOutlined />} disabled={!writable || saving} onClick={() => setWifiOpen(true)}>手动添加WIFI</Button></div>{draft.wifis.length ? <table className="staff-attendance-location-table"><thead><tr><th>WIFI名称</th><th>Mac地址</th><th>操作</th></tr></thead><tbody>{draft.wifis.map((wifi, index) => <tr key={`${wifi.macAddress}-${index}`}><td>{wifi.name}</td><td>{wifi.macAddress}</td><td><Button type="link" danger onClick={() => patch({ wifis: draft.wifis.filter((_, itemIndex) => itemIndex !== index) })}>删除</Button></td></tr>)}</tbody></table> : <div className="staff-attendance-empty-wifi"><WifiOutlined /><span>暂无相关数据</span></div>}{!draft.wifis.length && <div className="staff-attendance-field-error">WIFI列表不能为空</div>}</div>}
        {draft.punchMethod === 'CODE' && <p className="staff-attendance-code-hint">打卡码：管理员可以出示二维码，员工扫码打卡</p>}
      </section>

      <div className="staff-attendance-form-actions"><Button type="primary" loading={saving} onClick={() => void save()} disabled={!writable}>{rule ? '保存规则' : '新增规则'}</Button></div>
    </div>

    <Modal title="批量设置打卡时间" open={batchOpen} onCancel={() => setBatchOpen(false)} onOk={applyBatch} okText="确定" cancelText="取消"><Space><TimePicker value={timeValue(batchStart)} format="HH:mm" minuteStep={5} allowClear={false} onChange={value => setBatchStart(valueTime(value) ?? batchStart)} /><span>至</span><TimePicker value={timeValue(batchEnd)} format="HH:mm" minuteStep={5} allowClear={false} onChange={value => setBatchEnd(valueTime(value) ?? batchEnd)} /></Space><p className="staff-attendance-modal-hint">将应用到已勾选的工作日。</p></Modal>
    <Modal title="扫码添加打卡位置" open={scanLocationOpen} onCancel={() => setScanLocationOpen(false)} footer={null} width={420}><div className="staff-attendance-scan-modal"><QrPreview label="扫码添加打卡位置二维码" /><p>使用手机微信扫描二维码选择门店地址</p></div></Modal>
    <Modal title="添加门店位置" open={locationOpen} onCancel={() => setLocationOpen(false)} onOk={addLocation} okText="保存" cancelText="取消"><div className="staff-attendance-modal-fields"><label>位置名称<Input value={locationDraft.name} maxLength={100} onChange={event => setLocationDraft(current => ({ ...current, name: event.target.value }))} /></label><label>经度<Input inputMode="decimal" placeholder="请输入门店位置的经度" value={locationDraft.longitude} onChange={event => setLocationDraft(current => ({ ...current, longitude: event.target.value }))} /></label><label>纬度<Input inputMode="decimal" placeholder="请输入门店位置的纬度" value={locationDraft.latitude} onChange={event => setLocationDraft(current => ({ ...current, latitude: event.target.value }))} /></label><label>地址<Input value={locationDraft.address} maxLength={255} onChange={event => setLocationDraft(current => ({ ...current, address: event.target.value }))} /></label></div></Modal>
    <Modal title="扫码添加WIFI" open={scanWifiOpen} onCancel={() => setScanWifiOpen(false)} footer={null} width={420}><div className="staff-attendance-scan-modal"><QrPreview label="扫码添加 WIFI 二维码" /><p>使用手机微信扫描二维码添加当前 WIFI</p></div></Modal>
    <Modal title="添加WIFI" open={wifiOpen} onCancel={() => setWifiOpen(false)} onOk={addWifi} okText="保存" cancelText="取消"><div className="staff-attendance-modal-fields"><label>WIFI名称<Input value={wifiDraft.name} maxLength={100} onChange={event => setWifiDraft(current => ({ ...current, name: event.target.value }))} /></label><label>Mac地址<Input placeholder="例如 AA:BB:CC:DD:EE:FF" value={wifiDraft.macAddress} onChange={event => setWifiDraft(current => ({ ...current, macAddress: event.target.value }))} /></label></div></Modal>
    <Modal className="staff-attendance-conflict" title="方案冲突处理" open={conflictOpen} onCancel={() => setConflictOpen(false)} footer={<Space><Button onClick={() => setConflictOpen(false)}>放弃该方案</Button><Button type="primary" loading={saving} onClick={() => { setConflictOpen(false); void persist(true) }}>确认保存</Button></Space>} width={760}><Table<AttendanceConflict> rowKey="ruleId" pagination={false} dataSource={conflicts} columns={[{ title: '员工', dataIndex: 'employeeName' }, { title: '所属门店', dataIndex: 'storeNames', render: (value: string[]) => value.join('、') || '全部门店' }, { title: '原方案', dataIndex: 'originalRule' }, { title: '当前方案', render: () => <Tag color="pink">{draft.name || '未命名规则'}</Tag> }]} /></Modal>
  </div>
}

export function AttendancePanel({ options, revision, onChanged }: IamPanelProps) {
  const { can } = useAuth()
  const request = useIamRequest()
  const { message } = App.useApp()
  const writable = can('users:write')
  const [localRevision, setLocalRevision] = useState(0)
  const [storeId, setStoreId] = useState<number>()
  const [editing, setEditing] = useState<AttendanceRule | null>()
  const storesQuery = useIamQuery<StaffStore[]>('/staff/attendance/stores', revision)
  const staffQuery = useIamQuery<AttendanceStaff[]>('/staff/attendance/staff', revision)
  const rulesQuery = useIamQuery<AttendanceRule[]>('/staff/attendance/rules', revision + localRevision)
  const stores = storesQuery.data ?? []
  const rules = (rulesQuery.data ?? []).filter(rule => storeId === undefined || rule.allStores || rule.storeIds.includes(storeId))

  useEffect(() => { if (storesQuery.data) setStoreId(current => storesQuery.data!.some(store => store.id === current) ? current : undefined) }, [storesQuery.data])

  function refresh() { setLocalRevision(value => value + 1); onChanged() }

  async function remove(rule: AttendanceRule) {
    try { await request(`/staff/attendance/rules/${rule.id}`, { method: 'DELETE' }); void message.success('删除成功'); refresh() }
    catch (cause) { void message.error(errorMessage(cause)) }
  }

  if (editing !== undefined) return <AttendanceEditor rule={editing} stores={stores} staff={staffQuery.data ?? []} positions={options.positions} writable={writable} onBack={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh() }} />

  return <div className="staff-attendance"><div className="staff-attendance-toolbar"><Select aria-label="考勤门店" allowClear value={storeId} placeholder="请选择考勤门店" options={stores.map(store => ({ value: store.id, label: store.name }))} onChange={setStoreId} /><Button type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => setEditing(null)}>新增考勤规则</Button></div>
    <QueryError error={storesQuery.error || staffQuery.error || rulesQuery.error} onRetry={() => { storesQuery.reload(); staffQuery.reload(); rulesQuery.reload() }} />
    {rulesQuery.loading && !rulesQuery.data ? <div className="staff-attendance-loading"><Spin /></div> : rules.length ? <div className="staff-attendance-rule-list">{rules.map(rule => <article className="staff-attendance-rule" key={rule.id}><div className="staff-attendance-rule-head"><div><strong>{rule.name}</strong><span>最近更新时间：{formatUpdate(rule.updateTime)}　更新人：{rule.updaterName ?? '管理员'}　考勤类型：{rule.attendanceType === 'FIXED' ? '按固定时间考勤' : '按排班考勤'}</span></div>{writable && <Space size={0}><Button type="link" icon={<EditOutlined />} onClick={() => setEditing(rule)}>编辑</Button><Popconfirm title={`确认删除${rule.name}这个规则吗？`} okText="确定" cancelText="取消" onConfirm={() => void remove(rule)}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space>}</div><div className="staff-attendance-rule-body"><span>适用门店</span><div>{rule.allStores ? <Tag>全部门店</Tag> : (rule.storeNames ?? []).map(name => <Tag key={name}>{name}</Tag>)}</div><span>适用员工</span><div><Tag>{employeeLabel(rule)}</Tag></div><span>考勤时间</span><p>{fixedSummary(rule)}</p></div></article>)}</div> : <Empty description="暂无考勤规则" />}
  </div>
}
