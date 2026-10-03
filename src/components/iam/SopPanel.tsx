import { useEffect, useMemo, useState } from 'react'
import { App, Button, DatePicker, Drawer, Empty, Grid, Input, InputNumber, Modal, Radio, Select, Space, Spin, Tabs } from 'antd'
import { CheckOutlined, FontSizeOutlined, NumberOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage, QueryError, useIamQuery } from './shared'
import { SopRuleManager } from './SopRuleManager'
import type { IamPanelProps } from './shared'
import type { StaffPosition } from '@/types/iam'
import type { StaffStore } from '@/types/staff'
import type { SopCheck, SopFrequency, SopMonthly, SopResultMode, SopRow, SopRule, SopStaff } from '@/types/staff-sop'
import '@/styles/staff-sop.css'

type CheckTarget = { storeId: number; person: SopStaff; row: SopRow; date: string; existing?: SopCheck; writable: boolean }
const checkKey = (storeId: number, check: Pick<SopCheck, 'userId' | 'ruleId' | 'leafKey' | 'workDate'>) =>
  `${storeId}:${check.userId}:${check.ruleId}:${check.leafKey}:${check.workDate}`

function due(frequency: SopFrequency, date: dayjs.Dayjs) {
  if (frequency === 'DAILY') return true
  if (frequency === 'WEEKLY') return date.day() === 1
  if (frequency === 'SEMIMONTHLY') return date.date() === 1 || date.date() === 16
  return date.date() === 1
}

export function SopPanel({ revision }: IamPanelProps) {
  const { session, can } = useAuth()
  const request = useIamRequest()
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const [month, setMonth] = useState(() => dayjs().startOf('month'))
  const [storeId, setStoreId] = useState<number>()
  const [positionId, setPositionId] = useState<number>()
  const [employeeId, setEmployeeId] = useState<number>()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [localRevision, setLocalRevision] = useState(0)
  const [savingCell, setSavingCell] = useState('')
  const [checkOverrides, setCheckOverrides] = useState<Record<string, SopCheck | null>>({})
  const [target, setTarget] = useState<CheckTarget>()
  const [resultMode, setResultMode] = useState<SopResultMode>('COMPLETE')
  const [numberValue, setNumberValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const storesQuery = useIamQuery<StaffStore[]>('/staff/scheduling/stores', revision)
  const positionsQuery = useIamQuery<StaffPosition[]>('/staff/sop/positions', revision)
  const rulesQuery = useIamQuery<SopRule[]>('/staff/sop/rules', revision + localRevision)
  const monthlyQuery = useIamQuery<SopMonthly>(`/staff/sop/monthly?storeId=${storeId}&month=${month.format('YYYY-MM')}${positionId ? `&positionId=${positionId}` : ''}`, revision + localRevision, storeId !== undefined)
  const stores = storesQuery.data ?? []
  const positions = positionsQuery.data ?? []
  const people = monthlyQuery.data?.staff ?? []
  const selected = people.find(person => person.id === employeeId) ?? people[0]
  const days = useMemo(() => Array.from({ length: month.daysInMonth() }, (_, index) => month.date(index + 1)), [month.valueOf()])
  const checks = new Map((monthlyQuery.data?.checks ?? []).map(item => [checkKey(storeId!, item), { ...item, resultMode: item.resultMode ?? 'COMPLETE', resultValue: item.resultValue ?? null }]))
  Object.entries(checkOverrides).forEach(([key, value]) => { if (value) checks.set(key, value); else checks.delete(key) })
  const hasRows = people.some(person => person.rows.length > 0)

  useEffect(() => {
    if (storesQuery.data) setStoreId(current => storesQuery.data!.some(store => store.id === current) ? current : storesQuery.data![0]?.id)
  }, [storesQuery.data])

  useEffect(() => { setCheckOverrides({}) }, [monthlyQuery.data])

  function refresh() { setLocalRevision(value => value + 1) }

  function openCheck(person: SopStaff, row: SopRow, date: string, existing: SopCheck | undefined, writable: boolean) {
    if (!storeId) return
    setTarget({ storeId, person, row, date, existing, writable })
    setResultMode(existing?.resultMode ?? 'COMPLETE')
    setNumberValue(existing?.resultMode === 'NUMBER' ? existing.resultValue ?? '' : '')
    setTextValue(existing?.resultMode === 'TEXT' ? existing.resultValue ?? '' : '')
  }

  async function submitCheck(checked: boolean) {
    if (!target || !target.writable) return
    const value = resultMode === 'NUMBER' ? numberValue.trim() : resultMode === 'TEXT' ? textValue.trim() : null
    if (checked && resultMode === 'NUMBER' && (!value || !Number.isFinite(Number(value)))) {
      void message.warning('请输入有效数字'); return
    }
    if (checked && resultMode === 'TEXT' && !value) { void message.warning('请输入文字说明'); return }
    const { storeId, person, row, date } = target
    const key = checkKey(storeId, { userId: person.id, ruleId: row.ruleId, leafKey: row.leafKey, workDate: date })
    setSavingCell(key)
    try {
      await request('/staff/sop/checks', { method: 'PUT', body: JSON.stringify({ storeId, userId: person.id, ruleId: row.ruleId, leafKey: row.leafKey, date, checked, mode: checked ? resultMode : undefined, value: checked ? value : undefined }) })
      setCheckOverrides(current => ({ ...current, [key]: checked ? { userId: person.id, ruleId: row.ruleId, leafKey: row.leafKey, workDate: date, resultMode, resultValue: value } : null }))
      setTarget(undefined)
      refresh()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSavingCell('') }
  }

  return <div className="staff-sop">
    <div className="staff-sop-toolbar">
      <Space wrap>
        <DatePicker aria-label="自检月份" picker="month" allowClear={false} value={month} format="YYYY年M月" onChange={value => { if (value) setMonth(value.startOf('month')) }} />
        <Select aria-label="自检门店" className="staff-store-select" placeholder="选择门店" value={storeId} options={stores.map(store => ({ value: store.id, label: store.name }))} onChange={setStoreId} />
        <Select aria-label="自检职位" className="staff-sop-position" placeholder="请选择职位" allowClear value={positionId} options={[{ label: '全部职位', value: 0 }, ...positions.map(position => ({ label: position.name, value: position.id }))]} onChange={setPositionId} />
      </Space>
      <Button icon={<SettingOutlined />} onClick={() => setRulesOpen(true)}>自检 SOP 设置</Button>
    </div>
    <QueryError error={storesQuery.error || positionsQuery.error || rulesQuery.error || monthlyQuery.error} onRetry={() => { storesQuery.reload(); positionsQuery.reload(); rulesQuery.reload(); monthlyQuery.reload() }} />
    {monthlyQuery.loading && !monthlyQuery.data ? <div className="staff-sop-loading"><Spin /></div> :
      !stores.length || !hasRows ? <div className="staff-sop-empty"><Empty description={!stores.length ? '暂无可用门店' : '暂无相关数据'} /></div> : <div className="staff-sop-calendar">
        <Tabs size="small" activeKey={String(selected?.id)} onChange={key => setEmployeeId(Number(key))} items={people.map(person => ({ key: String(person.id), label: person.nickname }))} />
        {selected && <div className="staff-sop-grid-scroll"><table className="staff-sop-grid"><thead><tr>
          <th className="staff-sop-work">工作内容</th>
          {days.map(date => <th key={date.date()}><strong>{date.date()}</strong><small>周{'日一二三四五六'[date.day()]}</small></th>)}
        </tr></thead><tbody>{selected.rows.length ? selected.rows.map(row => <tr key={`${row.ruleId}:${row.leafKey}`}>
          <th className="staff-sop-work"><span>{row.itemName}</span>{row.subitemName && <small>{row.subitemName}</small>}</th>
          {days.map(date => {
            const dateText = date.format('YYYY-MM-DD')
            const key = checkKey(storeId!, { userId: selected.id, ruleId: row.ruleId, leafKey: row.leafKey, workDate: dateText })
            const check = checks.get(key)
            const applicable = due(row.frequency, date)
            const writable = (can('users:write') || session?.userInfo.id === selected.id) && !date.isAfter(dayjs(), 'day')
            return <td key={dateText}>{applicable && (writable || check) && <button type="button" className={`staff-sop-day-cell${check ? ' is-filled' : ''}`}
              aria-label={`${selected.nickname} ${row.itemName} ${row.subitemName} ${dateText}`} disabled={savingCell === key}
              title={check?.resultValue ?? (check ? '已完成' : '填写自检结果')}
              onClick={() => openCheck(selected, row, dateText, check, Boolean(writable))}>
              {check ? check.resultMode === 'COMPLETE' ? <CheckOutlined /> : <span>{check.resultValue}</span> : <PlusOutlined />}
            </button>}</td>
          })}
        </tr>) : <tr><td colSpan={days.length + 1}><Empty description="该员工暂无适用的自检项" /></td></tr>}</tbody></table></div>}
      </div>}
    <Drawer className="staff-sop-drawer" title="自检规则" placement="right" size={screens.md ? '80vw' : '100vw'} open={rulesOpen} onClose={() => setRulesOpen(false)} destroyOnHidden>
      <SopRuleManager rules={rulesQuery.data ?? []} positions={positions} writable={can('users:write')} loading={rulesQuery.loading} onChanged={refresh} />
    </Drawer>
    <Modal className="staff-sop-check-modal" title={target ? `${dayjs(target.date).date()}自检` : '自检'} open={target !== undefined}
      onCancel={() => setTarget(undefined)} width={560} destroyOnHidden footer={<div className="staff-sop-check-footer">
        {target?.existing && target.writable ? <Button danger disabled={Boolean(savingCell)} onClick={() => void submitCheck(false)}>清除记录</Button> : <span />}
        <Space><Button disabled={Boolean(savingCell)} onClick={() => setTarget(undefined)}>取消</Button><Button type="primary" loading={Boolean(savingCell)} disabled={!target?.writable} onClick={() => void submitCheck(true)}>确定</Button></Space>
      </div>}>
      <Radio.Group className="staff-sop-result-modes" value={resultMode} onChange={event => setResultMode(event.target.value)} disabled={!target?.writable}>
        <Radio.Button value="COMPLETE"><CheckOutlined />仅标记完成</Radio.Button>
        <Radio.Button value="NUMBER"><NumberOutlined />输入数字</Radio.Button>
        <Radio.Button value="TEXT"><FontSizeOutlined />输入文字说明</Radio.Button>
      </Radio.Group>
      {resultMode === 'NUMBER' && <InputNumber<string> className="staff-sop-result-number" aria-label="自检数字" stringMode placeholder="请输入数字" value={numberValue || null} onChange={value => setNumberValue(value ?? '')} disabled={!target?.writable} />}
      {resultMode === 'TEXT' && <Input.TextArea aria-label="自检文字说明" rows={3} maxLength={1000} showCount placeholder="请输入文字说明" value={textValue} onChange={event => setTextValue(event.target.value)} disabled={!target?.writable} />}
    </Modal>
  </div>
}
