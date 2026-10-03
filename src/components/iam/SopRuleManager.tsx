import { useState } from 'react'
import { App, Button, Checkbox, Empty, Input, Modal, Popconfirm, Radio, Select, Space, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage } from './shared'
import type { StaffPosition } from '@/types/iam'
import type { SopFrequency, SopItem, SopRule } from '@/types/staff-sop'

type Draft = Pick<SopRule, 'name' | 'allPositions' | 'positionIds' | 'items'>
const newItem = (): SopItem => ({ key: crypto.randomUUID(), name: '', frequency: 'MONTHLY', subitems: [] })
const emptyDraft = (): Draft => ({ name: '', allPositions: true, positionIds: [], items: [newItem()] })
const frequencyOptions: { value: SopFrequency; label: string }[] = [
  { value: 'DAILY', label: '每天' }, { value: 'WEEKLY', label: '每周' },
  { value: 'SEMIMONTHLY', label: '每半月' }, { value: 'MONTHLY', label: '每月' },
]
const frequencyName = (value: SopFrequency) => frequencyOptions.find(item => item.value === value)?.label ?? value

export function SopRuleManager({ rules, positions, writable, loading, onChanged }: {
  rules: SopRule[]; positions: StaffPosition[]; writable: boolean; loading: boolean; onChanged: () => void
}) {
  const request = useIamRequest()
  const { message } = App.useApp()
  const [editing, setEditing] = useState<SopRule | null>()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number>()
  const [subitemEditor, setSubitemEditor] = useState<{ itemKey: string; subitemKey?: string }>()
  const [subitemName, setSubitemName] = useState('')
  const activePositions = positions.filter(position => position.status === 1 || draft.positionIds.includes(position.id))

  function open(rule: SopRule | null) {
    setEditing(rule)
    setDraft(rule ? { name: rule.name, allPositions: rule.allPositions, positionIds: [...rule.positionIds], items: rule.items.map(item => ({ ...item, subitems: item.subitems.map(subitem => ({ ...subitem })) })) } : emptyDraft())
    setSearch('')
  }

  function updateItem(key: string, patch: Partial<SopItem>) {
    setDraft(current => ({ ...current, items: current.items.map(item => item.key === key ? { ...item, ...patch } : item) }))
  }

  function openSubitem(itemKey: string, subitemKey?: string) {
    setSubitemEditor({ itemKey, subitemKey })
    setSubitemName(draft.items.find(item => item.key === itemKey)?.subitems.find(item => item.key === subitemKey)?.name ?? '')
  }

  function saveSubitem() {
    if (!subitemEditor) return
    const name = subitemName.trim()
    if (!name) { void message.warning('请输入自检子项'); return }
    const item = draft.items.find(row => row.key === subitemEditor.itemKey)
    if (!subitemEditor.subitemKey && (item?.subitems.length ?? 0) >= 10) { void message.warning('每个自检项最多 10 个子项'); return }
    updateItem(subitemEditor.itemKey, { subitems: subitemEditor.subitemKey
      ? (item?.subitems ?? []).map(row => row.key === subitemEditor.subitemKey ? { ...row, name } : row)
      : [...item?.subitems ?? [], { key: crypto.randomUUID(), name }] })
    setSubitemEditor(undefined)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) { void message.warning('请输入规则名称'); return }
    if (!draft.allPositions && !draft.positionIds.length) { void message.warning('请选择适用职位'); return }
    if (!draft.items.length || draft.items.some(item => !item.name.trim())) { void message.warning('请填写自检项名称'); return }
    setSaving(true)
    try {
      await request(`/staff/sop/rules${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name, allPositions: draft.allPositions, positionIds: draft.allPositions ? [] : draft.positionIds, items: draft.items.map(item => ({ ...item, name: item.name.trim() })) }),
      })
      void message.success(editing ? '保存成功' : '新增成功')
      setEditing(undefined)
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  async function remove(rule: SopRule) {
    setDeleting(rule.id)
    try {
      await request(`/staff/sop/rules/${rule.id}`, { method: 'DELETE' })
      void message.success('删除成功')
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setDeleting(undefined) }
  }

  return <div className="staff-sop-rules">
    <div className="staff-sop-rules-toolbar">{writable && <Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>新增规则</Button>}</div>
    {loading && !rules.length ? <div className="staff-sop-loading">加载中...</div> : rules.length ? rules.map(rule => <article className="staff-sop-rule" key={rule.id}>
      <div className="staff-sop-rule-head"><div><strong>{rule.name}</strong><span>最近更新：{rule.updateTime?.replace('T', ' ').slice(0, 19)}　更新人：{rule.updaterName ?? '管理员'}</span></div>
        {writable && <Space size={0}><Button type="link" icon={<EditOutlined />} onClick={() => open(rule)}>编辑</Button><Popconfirm title={`确认删除“${rule.name}”？`} description="删除后不再显示规则，已有自检记录仍会保留。" okText="确定" cancelText="取消" onConfirm={() => void remove(rule)}><Button type="link" danger icon={<DeleteOutlined />} loading={deleting === rule.id}>删除</Button></Popconfirm></Space>}
      </div>
      <div className="staff-sop-rule-body"><span>适用员工</span><div>{rule.allPositions ? <Tag>全部员工</Tag> : rule.positionNames.map(name => <Tag key={name}>{name}</Tag>)}</div>
        <span>自检项</span><p>{rule.items.map(item => `${item.name}${item.subitems.length ? `（${item.subitems.map(child => child.name).join('、')}）` : ''}·${frequencyName(item.frequency)}`).join('　')}</p>
      </div>
    </article>) : <Empty description="暂无自检规则" />}

    <Modal className="staff-sop-editor" title="规则 SOP 设置" open={editing !== undefined} onCancel={() => setEditing(undefined)} onOk={() => void save()} confirmLoading={saving} okText="确定" cancelText="取消" width={1120} destroyOnHidden>
      <div className="staff-sop-field"><label htmlFor="staff-sop-rule-name"><b>*</b> 规则名称</label><Input id="staff-sop-rule-name" maxLength={100} placeholder="请输入规则名称" value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></div>
      <div className="staff-sop-field"><label><b>*</b> 适用职位</label><Radio.Group value={draft.allPositions ? 'all' : 'specific'} onChange={event => setDraft(current => ({ ...current, allPositions: event.target.value === 'all', positionIds: event.target.value === 'all' ? [] : current.positionIds }))} options={[{ label: '全店适用', value: 'all' }, { label: '指定职位', value: 'specific' }]} />
        {!draft.allPositions && <div className="staff-sop-position-picker"><Input aria-label="搜索职位" placeholder="请输入职位名称" value={search} onChange={event => setSearch(event.target.value)} /><Checkbox.Group value={draft.positionIds} onChange={values => setDraft(current => ({ ...current, positionIds: values.map(Number) }))}>{activePositions.filter(position => position.name.includes(search.trim())).map(position => <Checkbox key={position.id} value={position.id}>{position.name}</Checkbox>)}</Checkbox.Group></div>}
      </div>
      <div className="staff-sop-field staff-sop-items-field"><div className="staff-sop-items-title"><label><b>*</b> 自检项</label><Button type="link" icon={<PlusOutlined />} disabled={draft.items.length >= 30} onClick={() => setDraft(current => ({ ...current, items: [...current.items, newItem()] }))}>添加一项</Button></div>
        <div className="staff-sop-table-scroll"><table className="staff-sop-items"><thead><tr><th>自检项</th><th>自检子项</th><th>自检周期</th><th>操作</th></tr></thead><tbody>{draft.items.map((item, index) => <tr key={item.key}>
          <td><Input aria-label={`自检项 ${index + 1}`} maxLength={100} placeholder="请输入自检项" value={item.name} onChange={event => updateItem(item.key, { name: event.target.value })} /></td>
          <td><div className="staff-sop-subitems">{item.subitems.map(child => <span key={child.key}>{child.name}<Button type="text" size="small" icon={<EditOutlined />} aria-label={`编辑子项 ${child.name}`} onClick={() => openSubitem(item.key, child.key)} /><Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`删除子项 ${child.name}`} onClick={() => updateItem(item.key, { subitems: item.subitems.filter(row => row.key !== child.key) })} /></span>)}<Button type="link" icon={<PlusOutlined />} onClick={() => openSubitem(item.key)}>添加子项</Button></div></td>
          <td><Select aria-label={`自检周期 ${index + 1}`} value={item.frequency} options={frequencyOptions} onChange={value => updateItem(item.key, { frequency: value })} /></td>
          <td><Button type="link" danger icon={<DeleteOutlined />} aria-label={`删除自检项 ${index + 1}`} onClick={() => setDraft(current => ({ ...current, items: current.items.filter(row => row.key !== item.key) }))}>删除</Button></td>
        </tr>)}</tbody></table></div>
      </div>
    </Modal>
    <Modal title="自检子项" open={subitemEditor !== undefined} onCancel={() => setSubitemEditor(undefined)} onOk={saveSubitem} okText="确定" cancelText="取消" width={420} destroyOnHidden>
      <Input aria-label="自检子项名称" maxLength={100} placeholder="请输入自检子项" value={subitemName} onChange={event => setSubitemName(event.target.value)} onPressEnter={saveSubitem} />
    </Modal>
  </div>
}
