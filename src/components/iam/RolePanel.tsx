import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Alert, App, Button, Checkbox, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { iamPath, saveRecord } from '@/api/iam'
import { errorMessage, paginationOptions, QueryError, StatusTag, statusOptions, useDeleteRecord, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { PageResult, Permission, Role } from '@/types/iam'

type Values = Pick<Role, 'code' | 'name' | 'status' | 'description' | 'permissionCodes'>

function PermissionPicker({ value = [], onChange, permissions, disabled }: { value?: string[]; onChange?: (value: string[]) => void; permissions: Permission[]; disabled: boolean }) {
  const { can } = useAuth()
  const modules = [...new Set(permissions.map(item => item.module))]
  function toggle(code: string, checked: boolean) {
    const next = new Set(value)
    if (checked) { next.add(code); if (code.endsWith(':write')) next.add(code.replace(':write', ':read')) }
    else { next.delete(code); if (code.endsWith(':read')) next.delete(code.replace(':read', ':write')) }
    onChange?.([...next])
  }
  return <div className="iam-permission-list">{modules.map(module => <div className="iam-permission-group" key={module}>
    <strong>{module}</strong>
    <div>{permissions.filter(item => item.module === module).map(item => <Checkbox key={item.code} checked={value.includes(item.code)} disabled={disabled || !can(item.code)} onChange={event => toggle(item.code, event.target.checked)}>{item.name}</Checkbox>)}</div>
  </div>)}</div>
}

export function RolePanel({ options, revision, onChanged }: IamPanelProps) {
  const request = useIamRequest()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, keyword: '' })
  const query = useIamQuery<PageResult<Role>>(iamPath('roles', filters), revision)
  const [editing, setEditing] = useState<Role | null>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<Values>()
  const remove = useDeleteRecord(onChanged)
  const writable = can('roles:write')
  const readOnly = !writable || editing?.code === 'ADMIN'
  function edit(role: Role | null) {
    flushSync(() => setEditing(role))
    form.resetFields(); form.setFieldsValue(role ?? { status: 1, permissionCodes: ['home:read'] })
  }
  async function save(values: Values) {
    if (readOnly) return
    setSaving(true)
    try { await saveRecord('roles', editing?.id, values, request); void message.success('角色权限已保存，下次请求立即生效'); setEditing(undefined); onChanged() }
    catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return (
    <div className="iam-panel">
      <div className="iam-toolbar">
        <Input.Search aria-label="搜索角色" placeholder="搜索角色名称 / 编码" allowClear maxLength={100} onSearch={keyword => setFilters(previous => ({ ...previous, page: 1, keyword }))} />
        <div className="iam-toolbar-actions"><Button icon={<ReloadOutlined />} aria-label="刷新角色" onClick={query.reload} />{writable && <Button type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>新增角色</Button>}</div>
      </div>
      <p className="iam-hint">内置七种身份。管理员保留全部权限，其余角色默认只可查看首页，可按实际职责授权。</p>
      <QueryError error={query.error} onRetry={query.reload} />
      <Table<Role> rowKey="id" loading={query.loading} dataSource={query.data?.records ?? []} size="middle" scroll={{ x: 800 }} pagination={{ ...paginationOptions, current: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, onChange: (page, pageSize) => setFilters(previous => ({ ...previous, page, pageSize })) }} columns={[
        { title: '角色名称', dataIndex: 'name', width: 160, render: (name: string, row) => <Space wrap size={4}>{name}{row.builtin === 1 && <Tag>内置</Tag>}</Space> },
        { title: '编码', dataIndex: 'code', width: 170 },
        { title: '模块权限', dataIndex: 'permissionCodes', width: 100, render: (value: string[]) => `${value.length} 项` },
        { title: '状态', dataIndex: 'status', width: 90, render: value => <StatusTag status={value} /> },
        { title: '说明', dataIndex: 'description', width: 180, ellipsis: true, render: value => value || '—' },
        { title: '操作', key: 'actions', width: 140, render: (_, row) => <Space size={4}><Button type="link" onClick={() => edit(row)}>{writable && row.code !== 'ADMIN' ? '编辑' : '查看'}</Button>{writable && row.builtin !== 1 && <Button type="link" danger onClick={() => remove('roles', row.id, row.name)}>删除</Button>}</Space> },
      ]} />
      <Modal title={readOnly ? '查看角色权限' : editing ? '编辑角色权限' : '新增角色'} open={editing !== undefined} onCancel={() => !saving && setEditing(undefined)} onOk={() => form.submit()} confirmLoading={saving} okButtonProps={{ 'aria-label': '保存' }} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" footer={readOnly ? <Button onClick={() => setEditing(undefined)}>关闭</Button> : undefined} centered width={680} className="iam-modal">
        <Form name="role-editor" form={form} layout="vertical" onFinish={save} disabled={saving || readOnly}>
          {editing?.code === 'ADMIN' && <Alert className="iam-query-error" type="info" showIcon title="管理员角色固定绑定企业负责人，不可删除或修改权限。" />}
          <div className="iam-form-grid">
            <Form.Item label="角色名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入角色名称' }]}><Input maxLength={50} /></Form.Item>
            <Form.Item label="角色编码" name="code" normalize={(value: string) => value.toUpperCase()} rules={[{ required: true, message: '请输入角色编码' }, { pattern: /^[A-Z][A-Z0-9_]{1,49}$/, message: '2–50 位大写字母、数字或下划线，以字母开头' }]}><Input disabled={saving || readOnly || editing?.builtin === 1} maxLength={50} placeholder="例如：STORE_ASSISTANT" /></Form.Item>
          </div>
          <Form.Item label="状态" name="status" rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item>
          <Form.Item label="模块权限" name="permissionCodes" extra="勾选维护权限会同时勾选查看权限；只可授予自己具备的企业范围权限。"><PermissionPicker permissions={options.permissions} disabled={saving || readOnly} /></Form.Item>
          <Form.Item label="说明" name="description"><Input.TextArea rows={2} maxLength={500} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
