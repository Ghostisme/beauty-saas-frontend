import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { Alert, App, Button, Form, Input, Modal, Result, Select, Space, Statistic, Table, Tag } from 'antd'
import { BankOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { request } from '@/lib/request'
import { errorMessage, paginationOptions, passwordRules, QueryError, StatusTag, statusOptions, useIamQuery } from '@/components/iam/shared'
import type { Enterprise, PlatformSummary } from '@/types/platform'
import type { PageResult } from '@/types/iam'
import '@/styles/iam.css'
import '@/styles/platform.css'

type Editor = { type: 'create' | 'edit' | 'admin' | 'reset'; enterprise?: Enterprise }
interface Values { code: string; name: string; status: number; adminUsername: string; adminName: string; adminPassword: string; confirmPassword: string; phone?: string }

function PlatformWorkspace() {
  const { message } = App.useApp()
  const [revision, setRevision] = useState(0)
  const [filters, setFilters] = useState<{ page: number; pageSize: number; keyword: string; status?: number }>({ page: 1, pageSize: 10, keyword: '' })
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize), keyword: filters.keyword })
  if (filters.status !== undefined) params.set('status', String(filters.status))
  const query = useIamQuery<PageResult<Enterprise>>(`/platform/tenants?${params}`, revision)
  const summary = useIamQuery<PlatformSummary>('/platform/summary', revision)
  const [editor, setEditor] = useState<Editor>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<Values>()
  const refresh = () => setRevision(value => value + 1)
  function open(type: Editor['type'], enterprise?: Enterprise) {
    flushSync(() => setEditor({ type, enterprise }))
    form.resetFields()
    form.setFieldsValue({ adminUsername: 'admin', status: enterprise?.status ?? 1, name: enterprise?.name, phone: enterprise?.adminPhone })
  }
  async function save(values: Values) {
    if (!editor) return
    setSaving(true)
    try {
      const id = editor.enterprise?.id
      if (editor.type === 'create') {
        await request('/platform/tenants', { method: 'POST', body: JSON.stringify({ code: values.code.trim().toLowerCase(), name: values.name.trim(), adminUsername: values.adminUsername.trim(), adminName: values.adminName.trim(), adminPassword: values.adminPassword, phone: values.phone ?? '' }) })
        void message.success(`企业 ${values.code} 及管理员 ${values.adminUsername} 已开通`)
      } else if (editor.type === 'edit') {
        await request(`/platform/tenants/${id}`, { method: 'PUT', body: JSON.stringify({ name: values.name.trim(), status: values.status }) })
        void message.success('企业信息已更新')
      } else if (editor.type === 'admin') {
        await request(`/platform/tenants/${id}/admin`, { method: 'POST', body: JSON.stringify({ username: values.adminUsername.trim(), nickname: values.adminName.trim(), password: values.adminPassword, phone: values.phone ?? '' }) })
        void message.success('企业管理员已开通')
      } else {
        await request(`/platform/tenants/${id}/admin/password`, { method: 'POST', body: JSON.stringify({ password: values.adminPassword }) })
        void message.success('企业管理员密码已重置，旧登录已失效')
      }
      form.resetFields(); setEditor(undefined); refresh()
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  const creating = editor?.type === 'create'
  const adminFields = creating || editor?.type === 'admin'
  const passwordFields = adminFields || editor?.type === 'reset'
  const title = editor?.type === 'edit' ? '编辑企业' : editor?.type === 'admin' ? '开通企业管理员' : editor?.type === 'reset' ? '重置企业管理员密码' : '开通企业'
  return <section className="iam-page" aria-labelledby="platform-title">
    <div className="iam-page-heading"><div><h1 id="platform-title"><BankOutlined /> 企业管理</h1><p>平台统一开通企业、分配企业管理员并查看全部企业数据</p></div><Tag color="blue" icon={<SafetyCertificateOutlined />}>平台超级管理员</Tag></div>
    <div className="platform-stats">
      {([['tenants', '企业总数'], ['users', '企业用户'], ['departments', '部门 / 门店'], ['rooms', '房间']] as const).map(([key, label]) => <div className="platform-stat" key={key}><Statistic title={label} value={summary.data?.[key] ?? '—'} loading={summary.loading} /></div>)}
    </div>
    <QueryError error={summary.error} onRetry={summary.reload} />
    <div className="iam-content platform-content">
      <Alert type="info" showIcon title="平台账号与企业管理员相互独立" description="当前账号可查看所有企业。开通企业时同步创建该企业专属管理员，企业管理员只能访问自己的企业。" />
      <div className="iam-toolbar">
        <Input.Search aria-label="搜索企业" placeholder="搜索企业名称 / 编码" allowClear maxLength={100} onSearch={keyword => setFilters(value => ({ ...value, keyword, page: 1 }))} />
        <Select aria-label="筛选企业状态" placeholder="全部状态" allowClear className="iam-status-filter" options={statusOptions} value={filters.status} onChange={status => setFilters(value => ({ ...value, status, page: 1 }))} />
        <div className="iam-toolbar-actions"><Button icon={<ReloadOutlined />} aria-label="刷新企业" onClick={refresh} /><Button type="primary" icon={<PlusOutlined />} aria-label="开通企业" onClick={() => open('create')}>开通企业</Button></div>
      </div>
      <QueryError error={query.error} onRetry={query.reload} />
      <Table<Enterprise> className="iam-panel" rowKey="id" size="middle" loading={query.loading} dataSource={query.data?.records ?? []} scroll={{ x: 1250 }} pagination={{ ...paginationOptions, current: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, onChange: (page, pageSize) => setFilters(value => ({ ...value, page, pageSize })) }} columns={[
        { title: '企业信息', key: 'enterprise', width: 260, render: (_, row) => <div className="iam-user-cell"><strong>{row.name}</strong><span>{row.code} · 租户 ID {row.id}</span></div> },
        { title: '企业管理员', key: 'admin', width: 190, render: (_, row) => row.adminUserId ? <div className="iam-user-cell"><strong>{row.adminName}</strong><span>{row.adminUsername}</span></div> : <Tag color="warning">待开通管理员</Tag> },
        { title: '用户', dataIndex: 'userCount', width: 70 }, { title: '部门 / 门店', dataIndex: 'departmentCount', width: 110 }, { title: '房间', dataIndex: 'roomCount', width: 70 },
        { title: '状态', dataIndex: 'status', width: 90, render: value => <StatusTag status={value} /> },
        { title: '操作', key: 'actions', width: 360, render: (_, row) => <Space size={4} wrap><Link to={`/user-management?tenantId=${row.id}`}>管理企业数据</Link><Button type="link" onClick={() => open('edit', row)}>编辑</Button>{row.adminUserId ? <Button type="link" onClick={() => open('reset', row)}>重置管理员密码</Button> : <Button type="link" onClick={() => open('admin', row)}>开通管理员</Button>}</Space> },
      ]} />
    </div>
    <Modal title={title} open={!!editor} onCancel={() => { if (!saving) { form.resetFields(); setEditor(undefined) } }} onOk={() => form.submit()} confirmLoading={saving} okText={creating || editor?.type === 'admin' ? '确认开通' : '保存'} okButtonProps={{ 'aria-label': creating || editor?.type === 'admin' ? '确认开通' : '保存' }} cancelText="取消" cancelButtonProps={{ disabled: saving }} centered width={600} className="iam-modal">
      <Form name="platform-enterprise-editor" form={form} layout="vertical" onFinish={save} disabled={saving} preserve={false}>
        {editor?.enterprise && <Alert className="iam-query-error" type="info" showIcon title={`${editor.enterprise.name}（${editor.enterprise.code}）`} />}
        {(creating || editor?.type === 'edit') && <>
          {creating && <Form.Item name="code" label="企业编码" extra="企业登录使用此编码，创建后不可修改。" rules={[{ required: true, message: '请输入企业编码' }, { pattern: /^[a-z0-9][a-z0-9-]{2,39}$/, message: '3–40 位小写字母、数字或连字符' }]}><Input maxLength={40} autoComplete="off" placeholder="例如 company-a" /></Form.Item>}
          <Form.Item name="name" label="企业名称" rules={[{ required: true, whitespace: true, message: '请输入企业名称' }]}><Input maxLength={100} /></Form.Item>
        </>}
        {editor?.type === 'edit' && <><Alert className="iam-query-error" type="warning" showIcon title="停用企业会立即撤销该企业所有账号的登录；平台仍可查看历史数据。" /><Form.Item name="status" label="企业状态" rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item></>}
        {adminFields && <div className="iam-form-grid">
          <Form.Item name="adminUsername" label="企业管理员账号" rules={[{ required: true, message: '请输入管理员账号' }, { pattern: /^[A-Za-z0-9_][A-Za-z0-9_.-]{2,49}$/, message: '3–50 位字母、数字、下划线、点或连字符' }]}><Input maxLength={50} autoComplete="off" /></Form.Item>
          <Form.Item name="adminName" label="管理员姓名" rules={[{ required: true, whitespace: true, message: '请输入管理员姓名' }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="phone" label="管理员手机号"><Input maxLength={20} inputMode="tel" /></Form.Item>
        </div>}
        {passwordFields && <>
          <Form.Item name="adminPassword" label={editor?.type === 'reset' ? '新密码' : '管理员初始密码'} rules={passwordRules}><Input.Password maxLength={72} autoComplete="new-password" /></Form.Item>
          <Form.Item name="confirmPassword" label="确认密码" dependencies={['adminPassword']} rules={[{ required: true, message: '请再次输入密码' }, ({ getFieldValue }) => ({ validator: (_, value: string) => !value || value === getFieldValue('adminPassword') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')) })]}><Input.Password maxLength={72} autoComplete="new-password" /></Form.Item>
          <p className="iam-hint">开通后将企业编码、管理员账号和初始密码交付给企业负责人。密码不会在列表中显示。</p>
        </>}
      </Form>
    </Modal>
  </section>
}

export default function PlatformTenantsPage() {
  const { session } = useAuth()
  return session?.userInfo.platformAdmin ? <PlatformWorkspace key={session.token} /> : <Result status="403" title="仅平台超级管理员可访问" subTitle="企业管理员只能管理自己的企业。" />
}
