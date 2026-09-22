import { useEffect, useState } from 'react'
import { Alert, App, Button, Descriptions, Form, Input, Spin, Typography } from 'antd'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { errorMessage, QueryError, StatusTag, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { TenantInfo } from '@/types/iam'

export function TenantPanel({ revision, onChanged }: IamPanelProps) {
  const request = useIamRequest()
  const { can, session } = useAuth()
  const { message } = App.useApp()
  const query = useIamQuery<TenantInfo>('/iam/tenant', revision)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ name: string }>()
  useEffect(() => { if (query.data) form.setFieldsValue({ name: query.data.name }) }, [query.data, form])
  async function save(values: { name: string }) {
    setSaving(true)
    try { await request('/iam/tenant', { method: 'PUT', body: JSON.stringify(values) }); void message.success('企业名称已保存'); onChanged() }
    catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return <div className="iam-panel iam-tenant-panel">
    <Alert type="info" showIcon title={session?.userInfo.platformAdmin ? '正在管理所选企业' : '企业由平台开通'} description={session?.userInfo.platformAdmin ? '当前以平台超管身份操作，修改仅作用于上方选择的企业。开通或重置企业管理员请前往企业管理。' : '此处仅管理当前企业。企业编码和租户 ID 是固定标识，企业管理员无法查看或开通其他企业。'} />
    <QueryError error={query.error} onRetry={query.reload} />
    <Spin spinning={query.loading}>
      {query.data && <Descriptions bordered column={{ xs: 1, sm: 1, md: 2 }} size="middle" items={[
        { key: 'id', label: '租户 ID', children: query.data.id },
        { key: 'code', label: '企业编码', children: <Typography.Text copyable>{query.data.code}</Typography.Text> },
        { key: 'name', label: '企业名称', children: query.data.name },
        { key: 'status', label: '状态', children: <StatusTag status={query.data.status} /> },
        { key: 'owner', label: '企业负责人', children: query.data.adminName || '待开通' },
        { key: 'admin', label: '管理员账号', children: query.data.adminUsername || '待平台开通' },
      ]} />}
      <Form name="tenant-editor" className="iam-tenant-form" form={form} layout="vertical" onFinish={save} disabled={saving || !can('tenant:write') || !query.data}>
        <Form.Item label="企业名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入企业名称' }]}><Input maxLength={100} /></Form.Item>
        {can('tenant:write') && <Button type="primary" htmlType="submit" loading={saving}>保存企业信息</Button>}
      </Form>
    </Spin>
  </div>
}
