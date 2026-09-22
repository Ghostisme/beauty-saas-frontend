import { useState } from 'react'
import { flushSync } from 'react-dom'
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { saveRecord } from '@/api/iam'
import { departmentOptions, departmentTree, errorMessage, QueryError, StatusTag, statusOptions, useDeleteRecord, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { Department } from '@/types/iam'

type Values = Omit<Department, 'id' | 'children' | 'parentId'> & { parentId?: number }

export function DepartmentPanel({ revision, onChanged }: IamPanelProps) {
  const request = useIamRequest()
  const { can } = useAuth()
  const { message } = App.useApp()
  const query = useIamQuery<Department[]>('/iam/departments', revision)
  const [editing, setEditing] = useState<Department | null>()
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm<Values>()
  const remove = useDeleteRecord(onChanged)
  const writable = can('departments:write')
  const departments = query.data ?? []
  const excluded = new Set<number>(editing ? [editing.id] : [])
  // Remove the current node and its descendants from parent choices, in addition to server validation.
  let changed = true
  while (changed) {
    changed = false
    for (const dept of departments) if (excluded.has(dept.parentId) && !excluded.has(dept.id)) { excluded.add(dept.id); changed = true }
  }
  function edit(department: Department | null) {
    flushSync(() => setEditing(department))
    form.resetFields()
    form.setFieldsValue(department ? { ...department, parentId: department.parentId || undefined } : { type: 'STORE', status: 1, sortOrder: 0 })
  }
  async function save(values: Values) {
    setSaving(true)
    try {
      await saveRecord('departments', editing?.id, { ...values, parentId: values.parentId ?? null }, request)
      void message.success('部门已保存'); setEditing(undefined); onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  const filtered = search.trim() ? departments.filter(item => `${item.name} ${item.code}`.toLowerCase().includes(search.trim().toLowerCase())) : departments
  return (
    <div className="iam-panel">
      <div className="iam-toolbar">
        <Input.Search aria-label="搜索部门" placeholder="搜索名称 / 编码" allowClear maxLength={100} onSearch={setSearch} />
        <div className="iam-toolbar-actions"><Button icon={<ReloadOutlined />} aria-label="刷新部门" onClick={query.reload} />{writable && <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => edit(null)}>新增部门</Button>}</div>
      </div>
      <p className="iam-hint">门店与部门采用同一棵组织树；房间挂在对应部门下，用户可以关联多个部门。</p>
      <QueryError error={query.error} onRetry={query.reload} />
      <Table<Department> rowKey="id" loading={query.loading} dataSource={departmentTree(filtered)} pagination={false} scroll={{ x: 760 }} size="middle" columns={[
        { title: '部门 / 门店名称', dataIndex: 'name', width: 220 },
        { title: '编码', dataIndex: 'code', width: 140 },
        { title: '类型', dataIndex: 'type', width: 100, render: value => <Tag color={value === 'STORE' ? 'blue' : 'default'}>{value === 'STORE' ? '门店' : '部门'}</Tag> },
        { title: '排序', dataIndex: 'sortOrder', width: 70 },
        { title: '状态', dataIndex: 'status', width: 90, render: value => <StatusTag status={value} /> },
        ...(writable ? [{ title: '操作', key: 'actions', width: 140, render: (_: unknown, row: Department) => <Space size={4}><Button type="link" onClick={() => edit(row)}>编辑</Button><Button type="link" danger onClick={() => remove('departments', row.id, row.name)}>删除</Button></Space> }] : []),
      ]} />
      <Modal title={editing ? '编辑部门 / 门店' : '新增部门 / 门店'} open={editing !== undefined} onCancel={() => !saving && setEditing(undefined)} onOk={() => form.submit()} confirmLoading={saving} okButtonProps={{ 'aria-label': '保存' }} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" centered width={560} className="iam-modal">
        <Form name="department-editor" form={form} layout="vertical" onFinish={save} disabled={saving}>
          <Form.Item label="上级部门" name="parentId" extra="留空为企业直属；不能选择自身或下级部门。"><Select allowClear showSearch optionFilterProp="label" placeholder="企业直属" options={departmentOptions(departments.filter(item => !excluded.has(item.id)))} /></Form.Item>
          <div className="iam-form-grid">
            <Form.Item label="部门名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入部门名称' }]}><Input maxLength={100} /></Form.Item>
            <Form.Item label="部门编码" name="code" rules={[{ required: true, whitespace: true, message: '请输入部门编码' }]}><Input maxLength={50} /></Form.Item>
            <Form.Item label="组织类型" name="type" rules={[{ required: true }]}><Select options={[{ value: 'STORE', label: '门店' }, { value: 'DEPARTMENT', label: '部门' }]} /></Form.Item>
            <Form.Item label="排序" name="sortOrder" rules={[{ required: true }]}><InputNumber min={0} max={99999} precision={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item label="状态" name="status" rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
