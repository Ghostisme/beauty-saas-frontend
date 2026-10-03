import { useEffect, useMemo, useState } from 'react'
import { App, Button, Checkbox, Drawer, Popconfirm, Segmented, Select, Space, Table, Tabs } from 'antd'
import { LeftOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage, QueryError, useIamQuery } from './shared'
import { ShiftManager } from './ShiftManager'
import type { IamPanelProps } from './shared'
import type { StaffAssignment, StaffCalendar, StaffMember, StaffShift, StaffStore } from '@/types/staff'
import '@/styles/staff-scheduling.css'

type ViewMode = 'week' | 'month'

function weekStart(value: dayjs.Dayjs) { return value.subtract((value.day() + 6) % 7, 'day').startOf('day') }

export function SchedulePanel({ revision }: IamPanelProps) {
  const { can } = useAuth()
  const request = useIamRequest()
  const { message } = App.useApp()
  const [mode, setMode] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(dayjs)
  const [storeId, setStoreId] = useState<number>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('participants')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [savingParticipants, setSavingParticipants] = useState(false)
  const [savingCell, setSavingCell] = useState('')
  const [copying, setCopying] = useState(false)
  const [localRevision, setLocalRevision] = useState(0)
  const writable = can('users:write')
  const storesQuery = useIamQuery<StaffStore[]>('/staff/scheduling/stores', revision)
  const stores = storesQuery.data ?? []
  const staffQuery = useIamQuery<StaffMember[]>(`/staff/scheduling/staff?storeId=${storeId}`, revision + localRevision, storeId !== undefined)
  const shiftsQuery = useIamQuery<StaffShift[]>('/staff/scheduling/shifts', revision + localRevision)
  const shifts = shiftsQuery.data ?? []
  const start = mode === 'week' ? weekStart(anchor) : anchor.startOf('month')
  const end = mode === 'week' ? start.add(6, 'day') : anchor.endOf('month')
  const calendarQuery = useIamQuery<StaffCalendar>(`/staff/scheduling/calendar?storeId=${storeId}&startDate=${start.format('YYYY-MM-DD')}&endDate=${end.format('YYYY-MM-DD')}`, revision + localRevision, storeId !== undefined)
  const days = useMemo(() => Array.from({ length: end.diff(start, 'day') + 1 }, (_, index) => start.add(index, 'day')), [start.valueOf(), end.valueOf()])

  useEffect(() => {
    if (!storesQuery.data) return
    setStoreId(previous => storesQuery.data!.some(store => store.id === previous) ? previous : storesQuery.data![0]?.id)
  }, [storesQuery.data])
  useEffect(() => {
    if (staffQuery.data) setSelectedIds(staffQuery.data.filter(person => person.participating === 1).map(person => person.id))
  }, [staffQuery.data])

  function refresh() { setLocalRevision(value => value + 1) }

  async function saveParticipants() {
    if (!storeId) return
    setSavingParticipants(true)
    try {
      await request('/staff/scheduling/participants', { method: 'PUT', body: JSON.stringify({ storeId, userIds: selectedIds }) })
      void message.success('排班员工设置已保存')
      refresh()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSavingParticipants(false) }
  }

  async function saveAssignment(person: StaffMember, date: string, shiftId?: number) {
    if (!storeId) return
    const key = `${person.id}:${date}`
    setSavingCell(key)
    try {
      await request('/staff/scheduling/assignments', { method: 'PUT', body: JSON.stringify({ storeId, userId: person.id, date, shiftId: shiftId ?? null }) })
      refresh()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSavingCell('') }
  }

  async function copyPreviousWeek() {
    if (!storeId) return
    setCopying(true)
    try {
      const count = await request<number>('/staff/scheduling/copy-week', { method: 'POST', body: JSON.stringify({ storeId, startDate: start.format('YYYY-MM-DD') }) })
      void message.success(`已同步 ${count} 条排班`)
      refresh()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setCopying(false) }
  }

  const assignmentMap = new Map<string, StaffAssignment>((calendarQuery.data?.assignments ?? []).map(row => [`${row.userId}:${row.workDate}`, row]))
  const selectedStaff = (staffQuery.data ?? []).filter(person => selectedIds.includes(person.id))
  const shiftOptions = shifts.filter(shift => storeId !== undefined && shift.storeIds.includes(storeId)).map(shift => ({
    value: shift.id, label: <span className="staff-shift-option"><span className="staff-color-dot" style={{ backgroundColor: shift.color }} />{shift.name}</span>,
  }))

  return <div className="staff-schedule">
    <div className="staff-schedule-toolbar">
      <Space wrap>
        <Segmented<ViewMode> aria-label="排班维度" options={[{ label: '周维度', value: 'week' }, { label: '月维度', value: 'month' }]} value={mode} onChange={setMode} />
        <Button icon={<LeftOutlined />} aria-label={mode === 'week' ? '上周' : '上月'} onClick={() => setAnchor(current => current.subtract(1, mode))} />
        <Button onClick={() => setAnchor(dayjs())}>{mode === 'week' ? '本周' : '本月'}</Button>
        <span className="staff-schedule-range">{start.format('MM/DD')} - {end.format('MM/DD')}</span>
        <Button icon={<RightOutlined />} aria-label={mode === 'week' ? '下周' : '下月'} onClick={() => setAnchor(current => current.add(1, mode))} />
      </Space>
      <Space wrap>
        <Select aria-label="排班门店" className="staff-store-select" placeholder="选择门店" value={storeId} options={stores.map(store => ({ value: store.id, label: store.name }))} onChange={setStoreId} />
        {mode === 'week' && writable && storeId && <Popconfirm title="同步上周班表？" description="只填充本周尚未安排的日期，已有排班不会覆盖。" okText="同步" cancelText="取消" onConfirm={copyPreviousWeek}><Button loading={copying}>一键同步上周班表</Button></Popconfirm>}
        <Button icon={<SettingOutlined />} onClick={() => { setSettingsTab('participants'); setSettingsOpen(true) }}>排班设置</Button>
      </Space>
    </div>
    <QueryError error={storesQuery.error || staffQuery.error || shiftsQuery.error || calendarQuery.error} onRetry={() => { storesQuery.reload(); staffQuery.reload(); shiftsQuery.reload(); calendarQuery.reload() }} />
    {!storesQuery.loading && !stores.length ? <div className="staff-schedule-empty">暂无可用门店</div> :
      !calendarQuery.loading && !calendarQuery.data?.staff.length ? <div className="staff-schedule-empty">暂无参与排班员工 {writable && <Button type="link" onClick={() => { setSettingsTab('participants'); setSettingsOpen(true) }}>去设置</Button>}</div> :
      <Table<StaffMember> className="staff-calendar" rowKey="id" loading={calendarQuery.loading} pagination={false} dataSource={calendarQuery.data?.staff ?? []} scroll={{ x: mode === 'week' ? 1050 : days.length * 116 + 160 }} columns={[
        { title: '员工', dataIndex: 'nickname', key: 'name', width: 150, fixed: 'left', render: (name: string, row) => <div className="staff-calendar-name"><strong>{name}</strong><span>{row.positionName ?? ''}</span></div> },
        ...days.map(date => {
          const day = date.format('YYYY-MM-DD')
          return { title: <span>{date.format('MM/DD')}<small>周{'日一二三四五六'[date.day()]}</small></span>, key: day, width: mode === 'week' ? 132 : 116,
            render: (_: unknown, person: StaffMember) => {
              const assignment = assignmentMap.get(`${person.id}:${day}`)
              return <Select aria-label={`${person.nickname} ${day} 班次`} className="staff-calendar-select" placeholder="排班" value={assignment?.shiftId} allowClear={writable && person.participating === 1} disabled={!writable || person.participating !== 1 || savingCell === `${person.id}:${day}`} options={shiftOptions} onChange={(value: number | undefined) => void saveAssignment(person,day,value)} />
            } }
        }),
      ]} />}
    <Drawer className="staff-settings-drawer" title="排班设置" placement="right" size="min(960px, calc(100vw - 32px))" open={settingsOpen} onClose={() => setSettingsOpen(false)} destroyOnHidden>
      <Tabs activeKey={settingsTab} onChange={setSettingsTab} items={[
        { key: 'participants', label: '排班员工设置', children: <div className="staff-participant-settings">
          <h3>参与排班的员工</h3>
          <div className="staff-participant-selected"><span>已选员工</span><div>{selectedStaff.length ? selectedStaff.map(person => <span key={person.id}>{person.nickname}{person.positionName ? `（${person.positionName}）` : ''}</span>) : '暂无'}</div></div>
          <div className="staff-participant-available"><span>可选员工</span><Checkbox.Group disabled={!writable} value={selectedIds} onChange={values => setSelectedIds(values.map(Number))}>
            {(staffQuery.data ?? []).map(person => <Checkbox key={person.id} value={person.id}>{person.nickname}{person.positionName ? `（${person.positionName}）` : ''}</Checkbox>)}
          </Checkbox.Group></div>
          {writable && <Button type="primary" loading={savingParticipants} onClick={() => void saveParticipants()}>保存设置</Button>}
        </div> },
        { key: 'shifts', label: '班次管理', children: <ShiftManager stores={stores} shifts={shifts} writable={writable} onChanged={refresh} /> },
      ]} />
    </Drawer>
  </div>
}
