import { useState } from 'react'
import { App, Button, Checkbox, Input, Modal, Popconfirm, Space, TimePicker } from 'antd'
import { MinusCircleOutlined, PlusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage } from './shared'
import type { ShiftPeriod, StaffShift, StaffStore } from '@/types/staff'

const palette = [
  '#505050', '#8C8C8C', '#BFBFBF', '#FF4D4F', '#FA541C', '#FA8C16', '#FADB14', '#52C41A',
  '#13C2C2', '#36CFC9', '#40A9FF', '#597EF7', '#9254DE', '#F759AB', '#722ED1', '#2F54EB',
  '#13A8A8', '#389E0D', '#D46B08', '#AD2102', '#A8071A', '#531DAB', '#08979C', '#0050B3',
]

type Draft = { name: string; color: string; storeIds: number[]; periods: ShiftPeriod[] }
const emptyDraft = (): Draft => ({ name: '', color: '', storeIds: [], periods: [{ start: '', end: '' }] })

export function ShiftManager({ stores, shifts, writable, onChanged }: { stores: StaffStore[]; shifts: StaffShift[]; writable: boolean; onChanged: () => void }) {
  const request = useIamRequest()
  const { message } = App.useApp()
  const [editing, setEditing] = useState<StaffShift | null>()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [colorOpen, setColorOpen] = useState(false)
  const [pendingColor, setPendingColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number>()

  function open(shift: StaffShift | null) {
    setEditing(shift)
    setDraft(shift ? { name: shift.name, color: shift.color, storeIds: [...shift.storeIds], periods: shift.periods.map(period => ({ ...period })) } : emptyDraft())
  }

  function updatePeriod(index: number, patch: Partial<ShiftPeriod>) {
    setDraft(current => ({ ...current, periods: current.periods.map((period, i) => i === index ? { ...period, ...patch } : period) }))
  }

  async function save() {
    if (!draft.color) { void message.warning('请选择班次颜色'); return }
    if (!draft.name.trim()) { void message.warning('请输入班次名称'); return }
    if (!draft.storeIds.length) { void message.warning('请选择适用门店'); return }
    if (draft.periods.some(period => !period.start || !period.end)) { void message.warning('请填写完整的工作时段'); return }
    const sorted = [...draft.periods].sort((a, b) => a.start.localeCompare(b.start))
    if (sorted.some((period, index) => period.start >= period.end || index > 0 && period.start < sorted[index - 1].end)) {
      void message.warning('工作时段不能重叠，结束时间需晚于开始时间'); return
    }
    setSaving(true)
    try {
      await request(`/staff/scheduling/shifts${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ ...draft, name: draft.name.trim(), periods: sorted }),
      })
      void message.success('保存成功')
      setEditing(undefined)
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  async function remove(shift: StaffShift) {
    setDeleting(shift.id)
    try {
      await request(`/staff/scheduling/shifts/${shift.id}`, { method: 'DELETE' })
      void message.success('删除成功')
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setDeleting(undefined) }
  }

  return <div className="staff-shift-manager">
    {editing === undefined ? <>
      {writable && <Button className="staff-shift-add" type="dashed" icon={<PlusOutlined />} block onClick={() => open(null)}>添加班次</Button>}
      {shifts.map(shift => <article className="staff-shift-item" key={shift.id}>
        <div className="staff-shift-heading">
          <strong><span className="staff-color-dot" style={{ backgroundColor: shift.color }} />{shift.name}</strong>
          {writable && <Space size={0}>
            <Button type="link" onClick={() => open(shift)}>编辑</Button>
            <Popconfirm title="确认删除该班次？" description="已用于排班的班次不能删除。" okText="确认" cancelText="取消" onConfirm={() => remove(shift)}><Button type="link" danger loading={deleting === shift.id}>删除</Button></Popconfirm>
          </Space>}
        </div>
        <div className="staff-shift-detail"><span>适用门店（{shift.storeNames.length}）</span><div>{shift.storeNames.join('、')}</div></div>
        <div className="staff-shift-detail"><span>工作时间</span><div>{shift.periods.map(period => `${period.start} - ${period.end}`).join('，')}</div></div>
      </article>)}
      {!shifts.length && <div className="staff-shift-empty">暂无班次</div>}
    </> : <div className="staff-shift-form">
      <div className="staff-form-field"><label>班次颜色 <b>*</b></label><Button className="staff-color-button" style={draft.color ? { backgroundColor: draft.color, borderColor: draft.color, color: '#fff' } : undefined} onClick={() => { setPendingColor(draft.color); setColorOpen(true) }}>选择颜色</Button></div>
      <div className="staff-form-field"><label htmlFor="staff-shift-name">班次名称 <b>*</b></label><div className="staff-name-input"><Input id="staff-shift-name" placeholder="请输入排班名称" maxLength={100} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /><span>{draft.name.length}/100</span></div></div>
      <div className="staff-form-field"><label>适用门店 <b>*</b></label><Checkbox checked={draft.storeIds.length === stores.length && stores.length > 0} indeterminate={draft.storeIds.length > 0 && draft.storeIds.length < stores.length} onChange={event => setDraft(current => ({ ...current, storeIds: event.target.checked ? stores.map(store => store.id) : [] }))}>全选</Checkbox>
        <Checkbox.Group value={draft.storeIds} onChange={values => setDraft(current => ({ ...current, storeIds: values.map(Number) }))} className="staff-store-checkboxes">
          {stores.map(store => <Checkbox key={store.id} value={store.id}>{store.name}</Checkbox>)}
        </Checkbox.Group>
      </div>
      <div className="staff-form-field"><label>工作时段 <b>*</b></label>
        {draft.periods.map((period, index) => <div className="staff-time-row" key={index}>
          <TimePicker aria-label={`时段 ${index + 1} 开始时间`} format="HH:mm" minuteStep={5} value={period.start ? dayjs(`2000-01-01T${period.start}`) : null} onChange={(_, value) => updatePeriod(index, { start: value ?? '' })} placeholder="开始时间" />
          <span>至</span>
          <TimePicker aria-label={`时段 ${index + 1} 结束时间`} format="HH:mm" minuteStep={5} value={period.end ? dayjs(`2000-01-01T${period.end}`) : null} onChange={(_, value) => updatePeriod(index, { end: value ?? '' })} placeholder="结束时间" />
          <Button type="text" icon={<PlusCircleOutlined />} aria-label="增加工作时段" disabled={draft.periods.length >= 8} onClick={() => setDraft(current => ({ ...current, periods: [...current.periods, { start: '', end: '' }] }))} />
          {draft.periods.length > 1 && <Button type="text" icon={<MinusCircleOutlined />} aria-label={`删除时段 ${index + 1}`} onClick={() => setDraft(current => ({ ...current, periods: current.periods.filter((_, i) => i !== index) }))} />}
        </div>)}
      </div>
      <Space><Button type="primary" loading={saving} onClick={() => void save()}>保存</Button><Button disabled={saving} onClick={() => setEditing(undefined)}>取消</Button></Space>
    </div>}
    <Modal title="选择排班颜色" open={colorOpen} onCancel={() => setColorOpen(false)} onOk={() => { if (!pendingColor) { void message.warning('请选择颜色'); return }; setDraft(current => ({ ...current, color: pendingColor })); setColorOpen(false) }} okText="确定" cancelText="取消" width={420} centered>
      <div className="staff-color-palette">{palette.map(color => <button key={color} type="button" className={pendingColor === color ? 'is-selected' : ''} style={{ backgroundColor: color }} aria-label={`颜色 ${color}`} title={color} onClick={() => setPendingColor(color)} />)}</div>
    </Modal>
  </div>
}
