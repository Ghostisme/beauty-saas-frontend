import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Alert, App, Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { MinusCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { iamPath, saveRecord } from '@/api/iam'
import { departmentOptions, errorMessage, paginationOptions, passwordRules, QueryError, StatusTag, statusOptions, useDeleteRecord, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { ManagedUser, PageResult, RoleGrant } from '@/types/iam'

interface Values { username: string; nickname: string; phone?: string; email?: string; status: number; password?: string; departmentIds: number[]; roleGrants: RoleGrant[] }
type Filters = { page: number; pageSize: number; keyword?: string; departmentId?: number; status?: number }

export function UserPanel({ options, revision, onChanged }: IamPanelProps) {
  const request = useIamRequest()
  const { session, can } = useAuth()
  const { message } = App.useApp()
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 10 })
  const query = useIamQuery<PageResult<ManagedUser>>(iamPath('users', filters), revision)
  const [editing, setEditing] = useState<ManagedUser | null>()
  const [resetting, setResetting] = useState<ManagedUser>()
  const [saving, setSaving] = useState(false)
  const [resetSaving, setResetSaving] = useState(false)
  const [form] = Form.useForm<Values>()
  const [resetForm] = Form.useForm<{ password: string; confirmation: string }>()
  const memberDepartments: number[] = Form.useWatch('departmentIds', form) ?? []
  const grants: RoleGrant[] = Form.useWatch('roleGrants', form) ?? []
  const remove = useDeleteRecord(onChanged)
  const writable = can('users:write')
  const roles = options.roles.filter(role => role.code !== 'ADMIN' || editing?.owner)
  function edit(user: ManagedUser | null) {
    const employee = options.roles.find(role => role.code === 'EMPLOYEE' && role.status === 1)
    // Mount and connect the form before imperative initialization. Hidden force-rendered portals consume Escape.
    flushSync(() => setEditing(user))
    form.resetFields()
    form.setFieldsValue(user ? { ...user, roleGrants: user.roleGrants.map(grant => ({ roleId: grant.roleId, departmentId: grant.departmentId })) } : { status: 1, departmentIds: [], roleGrants: [{ roleId: employee?.id, departmentId: 0 }] })
  }
  async function save(values: Values) {
    setSaving(true)
    try {
      await saveRecord('users', editing?.id, {
        username: values.username, nickname: values.nickname, phone: values.phone ?? '', email: values.email ?? '', status: values.status,
        ...(editing ? {} : { password: values.password }), departmentIds: values.departmentIds ?? [],
        roleGrants: values.roleGrants.map(grant => ({ roleId: grant.roleId, departmentId: grant.departmentId || null })),
      }, request)
      void message.success('用户及关联权限已保存'); setEditing(undefined); onChanged()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  async function resetPassword(values: { password: string }) {
    if (!resetting) return
    setResetSaving(true)
    try {
      await request(`/iam/users/${resetting.id}/password`, { method: 'POST', body: JSON.stringify({ password: values.password }) })
      void message.success('密码已重置，该用户需要重新登录'); setResetting(undefined); resetForm.resetFields()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setResetSaving(false) }
  }
  return <div className="iam-panel">
    <div className="iam-toolbar">
      <Input.Search aria-label="搜索用户" placeholder="搜索账号 / 姓名 / 手机号" allowClear maxLength={100} onSearch={keyword => setFilters(previous => ({ ...previous, page: 1, keyword }))} />
      <Select aria-label="筛选用户部门" placeholder="全部部门 / 门店" allowClear showSearch optionFilterProp="label" options={options.departments.map(item => ({ value: item.id, label: item.name }))} value={filters.departmentId} onChange={departmentId => setFilters(previous => ({ ...previous, page: 1, departmentId }))} />
      <Select aria-label="筛选用户状态" placeholder="全部状态" allowClear className="iam-status-filter" options={statusOptions} value={filters.status} onChange={status => setFilters(previous => ({ ...previous, page: 1, status }))} />
      <div className="iam-toolbar-actions"><Button icon={<ReloadOutlined />} aria-label="刷新用户" onClick={query.reload} />{writable && <Button type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>新增用户</Button>}</div>
    </div>
    <p className="iam-hint">账号在本企业内唯一。用“角色 + 授权范围”明确员工在哪个门店担任什么身份，避免跨店混用权限。</p>
    <QueryError error={query.error} onRetry={query.reload} />
    <Table<ManagedUser> rowKey="id" loading={query.loading} dataSource={query.data?.records ?? []} size="middle" scroll={{ x: 1120 }} pagination={{ ...paginationOptions, current: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, onChange: (page, pageSize) => setFilters(previous => ({ ...previous, page, pageSize })) }} columns={[
      { title: '用户信息', dataIndex: 'nickname', width: 190, render: (name: string, row) => <div className="iam-user-cell"><strong>{name} {row.owner && <Tag color="blue">负责人</Tag>}</strong><span>{row.username}</span></div> },
      { title: '手机号', dataIndex: 'phone', width: 140, render: value => value || '—' },
      { title: '所属部门 / 门店', dataIndex: 'departments', width: 190, render: (departments: ManagedUser['departments']) => departments.length ? <Space wrap size={[0, 4]}>{departments.map(item => <Tag key={item.id}>{item.name}</Tag>)}</Space> : <span className="iam-muted">未分配部门</span> },
      { title: '角色 / 授权范围', dataIndex: 'roleGrants', width: 290, render: (roleGrants: RoleGrant[]) => <Space wrap size={[0, 4]}>{roleGrants.map(grant => <Tag key={`${grant.roleId}:${grant.departmentId}`}>{grant.roleName} · {grant.departmentId ? grant.departmentName : '企业范围'}</Tag>)}</Space> },
      { title: '状态', dataIndex: 'status', width: 90, render: value => <StatusTag status={value} /> },
      ...(writable ? [{ title: '操作', key: 'actions', width: 220, render: (_: unknown, row: ManagedUser) => <Space size={0}><Button type="link" onClick={() => edit(row)}>编辑</Button>{!row.owner && row.id !== session?.userInfo.id && <><Button type="link" onClick={() => { flushSync(() => setResetting(row)); resetForm.resetFields() }}>重置密码</Button><Button type="link" danger onClick={() => remove('users', row.id, row.nickname)}>删除</Button></>}</Space> }] : []),
    ]} />
    <Modal title={editing ? '编辑用户' : '新增用户'} open={editing !== undefined} onCancel={() => !saving && setEditing(undefined)} onOk={() => form.submit()} confirmLoading={saving} okButtonProps={{ 'aria-label': '保存' }} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" centered width={760} className="iam-modal">
      <Form name="user-editor" form={form} layout="vertical" onFinish={save} disabled={saving}>
        {editing?.owner && <Alert className="iam-query-error" type="info" showIcon title="企业负责人受保护：不能停用、删除或移除管理员身份。" />}
        <div className="iam-form-grid">
          <Form.Item label="登录账号" name="username" rules={[{ required: true, message: '请输入登录账号' }, { pattern: /^[A-Za-z0-9_][A-Za-z0-9_.-]{2,49}$/, message: '3–50 位字母、数字、下划线、点或连字符' }]}><Input maxLength={50} disabled={!!editing || saving} autoComplete="off" /></Form.Item>
          <Form.Item label="用户姓名" name="nickname" rules={[{ required: true, whitespace: true, message: '请输入用户姓名' }]}><Input maxLength={50} /></Form.Item>
          <Form.Item label="手机号" name="phone"><Input maxLength={20} inputMode="tel" autoComplete="off" /></Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入有效邮箱地址' }]}><Input maxLength={100} autoComplete="off" /></Form.Item>
          {!editing && <Form.Item label="初始密码" name="password" rules={passwordRules}><Input.Password maxLength={72} autoComplete="new-password" /></Form.Item>}
          <Form.Item label="状态" name="status" rules={[{ required: true }]}><Select disabled={saving || !!editing?.owner || editing?.id === session?.userInfo.id} options={statusOptions} /></Form.Item>
        </div>
        <Form.Item label="所属部门 / 门店" name="departmentIds" extra="可关联多个部门；部门范围的角色必须绑定在已选部门上。"><Select mode="multiple" showSearch optionFilterProp="label" placeholder="选择所属部门（可选）" options={departmentOptions(options.departments)} maxTagCount="responsive" /></Form.Item>
        <div className="iam-form-section-title">角色与授权范围</div>
        <Form.List name="roleGrants" rules={[{ validator: (_, value: RoleGrant[]) => value?.length ? Promise.resolve() : Promise.reject(new Error('至少分配一个角色')) }, { validator: (_, value: RoleGrant[]) => !value || new Set(value.map(grant => `${grant.roleId}:${grant.departmentId ?? 0}`)).size === value.length ? Promise.resolve() : Promise.reject(new Error('相同角色与授权范围不能重复')) }]}>
          {(fields, { add, remove: removeGrant }, { errors }) => <>
            {fields.map(field => {
              const role = options.roles.find(item => item.id === grants[field.name]?.roleId)
              const ownerGrant = !!editing?.owner && role?.code === 'ADMIN'
              const companyOnly = role?.permissionCodes.some(code => options.companyPermissions.includes(code)) ?? false
              return <div className="iam-role-row" key={field.key}>
                <Form.Item label={`角色 ${field.name + 1}`} name={[field.name, 'roleId']} rules={[{ required: true, message: '请选择角色' }]}><Select disabled={saving || ownerGrant} showSearch optionFilterProp="label" options={roles.map(item => ({ value: item.id, label: item.name, disabled: item.status !== 1 || item.code === 'ADMIN' && !ownerGrant }))} /></Form.Item>
                <Form.Item label={`授权范围 ${field.name + 1}`} name={[field.name, 'departmentId']} dependencies={['departmentIds', ['roleGrants', field.name, 'roleId']]} rules={[
                  { required: true, message: '请选择授权范围' },
                  { validator: (_, value: number) => !value || memberDepartments.includes(value) ? Promise.resolve() : Promise.reject(new Error('请先把该部门加入所属部门，或重新选择范围')) },
                  { validator: (_, value: number) => !value || !companyOnly ? Promise.resolve() : Promise.reject(new Error('该角色含企业级权限，只能选择企业范围')) },
                ]}><Select disabled={saving || ownerGrant} options={[{ value: 0, label: '企业范围（全部门店）' }, ...options.departments.filter(item => memberDepartments.includes(item.id)).map(item => ({ value: item.id, label: `${item.name}（含下级）`, disabled: companyOnly || item.status !== 1 }))]} /></Form.Item>
                <Button type="text" danger icon={<MinusCircleOutlined />} aria-label={`移除角色 ${field.name + 1}`} disabled={ownerGrant || saving} onClick={() => removeGrant(field.name)} />
              </div>
            })}
            <Form.ErrorList errors={errors} />
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ departmentId: 0 })} disabled={saving || fields.length >= 100} block>增加角色关联</Button>
          </>}
        </Form.List>
        <p className="iam-hint">企业信息、用户维护、组织维护及角色管理属于企业级权限；房间维护和用户查看可按门店授权。</p>
      </Form>
    </Modal>
    <Modal title={`重置密码 · ${resetting?.nickname ?? ''}`} open={!!resetting} onCancel={() => !resetSaving && setResetting(undefined)} onOk={() => resetForm.submit()} confirmLoading={resetSaving} okButtonProps={{ 'aria-label': '重置密码' }} cancelButtonProps={{ disabled: resetSaving }} okText="重置密码" cancelText="取消" centered className="iam-modal">
      <Alert className="iam-query-error" type="warning" showIcon title="保存后立即使该账号的旧登录失效，请通过安全方式交付新密码。" />
      <Form name="user-password-reset" form={resetForm} layout="vertical" onFinish={resetPassword} disabled={resetSaving}>
        <Form.Item label="新密码" name="password" rules={passwordRules}><Input.Password maxLength={72} autoComplete="new-password" /></Form.Item>
        <Form.Item label="确认新密码" name="confirmation" dependencies={['password']} rules={[{ required: true, message: '请再次输入新密码' }, ({ getFieldValue }) => ({ validator: (_, value: string) => !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')) })]}><Input.Password maxLength={72} autoComplete="new-password" /></Form.Item>
      </Form>
    </Modal>
  </div>
}
