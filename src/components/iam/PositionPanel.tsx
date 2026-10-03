import { useState } from 'react'
import { flushSync } from 'react-dom'
import { App, Badge, Button, Form, Input, Modal, Popconfirm, Select, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage } from './shared'
import type { IamPanelProps } from './shared'
import type { StaffPosition } from '@/types/iam'

interface PositionValues { name: string; code?: string; remark?: string; status: number }

export function PositionPanel({ options, onChanged }: IamPanelProps) {
  const { can } = useAuth()
  const request = useIamRequest()
  const { message } = App.useApp()
  const [editing, setEditing] = useState<StaffPosition | null>()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number>()
  const [statusFilter, setStatusFilter] = useState<number>()
  const [form] = Form.useForm<PositionValues>()
  const writable = can('roles:write')

  function open(position: StaffPosition | null) {
    flushSync(() => setEditing(position))
    form.resetFields()
    form.setFieldsValue(position ? { name: position.name, code: position.code, remark: position.remark, status: position.status } : { status: 1 })
  }

  async function save(values: PositionValues) {
    setSaving(true)
    try {
      await request(`/staff/positions${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(values),
      })
      void message.success(editing ? '职位已更新' : '职位已添加')
      setEditing(undefined)
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  async function remove(position: StaffPosition) {
    setDeleting(position.id)
    try {
      await request(`/staff/positions/${position.id}`, { method: 'DELETE' })
      void message.success('职位已删除')
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setDeleting(undefined) }
  }

  const rows = options.positions.filter(item => statusFilter === undefined || item.status === statusFilter)
  return <div className="iam-panel">
    <div className="iam-toolbar">
      <Select aria-label="筛选职位状态" placeholder="全部状态" allowClear value={statusFilter} onChange={setStatusFilter} options={[{ value: 1, label: '可用' }, { value: 0, label: '停用' }]} />
      <div className="iam-toolbar-actions">{writable && <Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>添加职位</Button>}</div>
    </div>
    <Table<StaffPosition> rowKey="id" dataSource={rows} pagination={false} scroll={{ x: 760 }} columns={[
      { title: '职位编号', dataIndex: 'code', render: value => value || '—' },
      { title: '职位名称', dataIndex: 'name' },
      { title: '备注', dataIndex: 'remark', render: value => value || '—' },
      { title: '状态', dataIndex: 'status', render: value => <Badge status={value === 1 ? 'success' : 'default'} text={value === 1 ? '可用' : '停用'} /> },
      ...(writable ? [{ title: '操作', key: 'actions', render: (_: unknown, row: StaffPosition) => <Space size={0}>
        <Button type="link" onClick={() => open(row)}>编辑</Button>
        <Popconfirm title={`确定删除“${row.name}”这个职位吗？`} okText="确定" cancelText="取消" onConfirm={() => remove(row)}><Button type="link" danger loading={deleting === row.id}>删除</Button></Popconfirm>
        <Button type="link" disabled={deleting === row.id} onClick={() => void saveStatus(row)}>{row.status === 1 ? '停用' : '启用'}</Button>
      </Space> }] : []),
    ]} />
    <Modal title={editing ? '修改职位' : '新增职位'} open={editing !== undefined} onCancel={() => !saving && setEditing(undefined)} onOk={() => form.submit()} okText="确定" cancelText="取消" confirmLoading={saving} centered destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save} disabled={saving}>
        <Form.Item label="职位名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入职位名称' }]}><Input maxLength={100} placeholder="请输入职位名称" /></Form.Item>
        <Form.Item label="职位编号" name="code"><Input maxLength={50} placeholder="请输入职位编号（可选）" /></Form.Item>
        <Form.Item label="备注" name="remark"><Input maxLength={500} placeholder="可以设置职位说明" /></Form.Item>
        <Form.Item label="状态" name="status" rules={[{ required: true }]}><Select options={[{ value: 1, label: '可用' }, { value: 0, label: '停用' }]} /></Form.Item>
      </Form>
    </Modal>
  </div>

  async function saveStatus(position: StaffPosition) {
    setDeleting(position.id)
    try {
      await request(`/staff/positions/${position.id}`, { method: 'PUT', body: JSON.stringify({ name: position.name, code: position.code, remark: position.remark, status: position.status === 1 ? 0 : 1 }) })
      void message.success(position.status === 1 ? '职位已停用' : '职位已启用')
      onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setDeleting(undefined) }
  }
}
