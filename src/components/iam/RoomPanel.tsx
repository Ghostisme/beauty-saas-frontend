import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select, Space, Table } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { useIamRequest } from '@/context/IamScopeContext'
import { iamPath, saveRecord } from '@/api/iam'
import { departmentOptions, errorMessage, paginationOptions, QueryError, StatusTag, statusOptions, useDeleteRecord, useIamQuery } from './shared'
import type { IamPanelProps } from './shared'
import type { PageResult, Room } from '@/types/iam'

type Values = Omit<Room, 'id' | 'departmentName'>

export function RoomPanel({ options, revision, onChanged }: IamPanelProps) {
  const request = useIamRequest()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [filters, setFilters] = useState<{ page: number; pageSize: number; keyword?: string; departmentId?: number }>({ page: 1, pageSize: 10 })
  const query = useIamQuery<PageResult<Room>>(iamPath('rooms', filters), revision)
  const [editing, setEditing] = useState<Room | null>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<Values>()
  const remove = useDeleteRecord(onChanged)
  const writable = can('rooms:write')
  const departments = options.departments.filter(item => options.roomDepartmentIds.includes(item.id))
  function edit(room: Room | null) {
    flushSync(() => setEditing(room))
    form.resetFields(); form.setFieldsValue(room ?? { capacity: 1, status: 1, departmentId: filters.departmentId && options.roomDepartmentIds.includes(filters.departmentId) ? filters.departmentId : undefined })
  }
  async function save(values: Values) {
    setSaving(true)
    try { await saveRecord('rooms', editing?.id, values, request); void message.success('房间已保存'); setEditing(undefined); onChanged() }
    catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return (
    <div className="iam-panel">
      <div className="iam-toolbar">
        <Input.Search aria-label="搜索房间" placeholder="搜索名称 / 编码" allowClear maxLength={100} onSearch={keyword => setFilters(previous => ({ ...previous, page: 1, keyword }))} />
        <Select aria-label="筛选房间部门" placeholder="全部部门 / 门店" allowClear showSearch optionFilterProp="label" options={options.departments.map(item => ({ value: item.id, label: item.name }))} value={filters.departmentId} onChange={departmentId => setFilters(previous => ({ ...previous, page: 1, departmentId }))} />
        <div className="iam-toolbar-actions"><Button icon={<ReloadOutlined />} aria-label="刷新房间" onClick={query.reload} />{writable && <Button type="primary" icon={<PlusOutlined />} disabled={!departments.length} onClick={() => edit(null)}>新增房间</Button>}</div>
      </div>
      {writable && !departments.length && <Alert className="iam-query-error" type="info" showIcon title="请先创建可用的部门 / 门店，或联系管理员分配房间维护权限。" />}
      <QueryError error={query.error} onRetry={query.reload} />
      <Table<Room> rowKey="id" loading={query.loading} dataSource={query.data?.records ?? []} size="middle" scroll={{ x: 820 }} pagination={{ ...paginationOptions, current: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, onChange: (page, pageSize) => setFilters(previous => ({ ...previous, page, pageSize })) }} columns={[
        { title: '房间名称', dataIndex: 'name', width: 170 }, { title: '编码', dataIndex: 'code', width: 120 },
        { title: '所属部门 / 门店', dataIndex: 'departmentName', width: 180 }, { title: '容纳人数', dataIndex: 'capacity', width: 100 },
        { title: '状态', dataIndex: 'status', width: 90, render: value => <StatusTag status={value} /> },
        { title: '备注', dataIndex: 'remark', width: 180, ellipsis: true, render: value => value || '—' },
        ...(writable ? [{ title: '操作', key: 'actions', width: 140, render: (_: unknown, row: Room) => options.roomDepartmentIds.includes(row.departmentId) ? <Space size={4}><Button type="link" onClick={() => edit(row)}>编辑</Button><Button type="link" danger onClick={() => remove('rooms', row.id, row.name)}>删除</Button></Space> : <span className="iam-muted">只读</span> }] : []),
      ]} />
      <Modal title={editing ? '编辑房间' : '新增房间'} open={editing !== undefined} onCancel={() => !saving && setEditing(undefined)} onOk={() => form.submit()} confirmLoading={saving} okButtonProps={{ 'aria-label': '保存' }} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" centered width={560} className="iam-modal">
        <Form name="room-editor" form={form} layout="vertical" onFinish={save} disabled={saving}>
          <Form.Item label="所属部门 / 门店" name="departmentId" rules={[{ required: true, message: '请选择所属部门' }]}><Select showSearch optionFilterProp="label" options={departmentOptions(departments)} /></Form.Item>
          <div className="iam-form-grid">
            <Form.Item label="房间名称" name="name" rules={[{ required: true, whitespace: true, message: '请输入房间名称' }]}><Input maxLength={100} /></Form.Item>
            <Form.Item label="房间编码" name="code" rules={[{ required: true, whitespace: true, message: '请输入房间编码' }]}><Input maxLength={50} /></Form.Item>
            <Form.Item label="容纳人数" name="capacity" rules={[{ required: true, message: '请输入容纳人数' }]}><InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label="状态" name="status" rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item>
          </div>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
