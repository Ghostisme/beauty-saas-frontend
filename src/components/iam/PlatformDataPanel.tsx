import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { paginationOptions, QueryError, StatusTag, useIamQuery } from './shared'
import type { PageResult, ResourceKind } from '@/types/iam'
import type { Enterprise, PlatformDataRow } from '@/types/platform'

export function EnterpriseSelector({ value, onChange }: { value?: number; onChange: (id?: number) => void }) {
  const [keyword, setKeyword] = useState('')
  const query = useIamQuery<PageResult<Enterprise>>(`/platform/tenants?page=1&pageSize=100&keyword=${encodeURIComponent(keyword)}`)
  const selected = useIamQuery<Enterprise>(`/platform/tenants/${value}`, 0, value !== undefined)
  const choices = [...(query.data?.records ?? [])]
  if (selected.data && !choices.some(item => item.id === selected.data?.id)) choices.push(selected.data)
  return <div className="platform-scope-bar">
    <span className="platform-scope-label">查看范围</span>
    <Select aria-label="选择企业范围" value={value ?? 'all'} showSearch filterOption={false} onSearch={setKeyword} loading={query.loading} options={[
      { value: 'all', label: '全部企业 · 平台视图' }, ...choices.map(item => ({ value: item.id, label: `${item.name}（${item.code}）${item.status === 0 ? ' · 已停用' : ''}` })),
    ]} onChange={next => { setKeyword(''); onChange(typeof next === 'number' ? next : undefined) }} />
    <span className="platform-scope-detail">全部企业可汇总查看；选择企业后可维护其数据。</span>
    <QueryError error={query.error || selected.error} onRetry={() => { query.reload(); selected.reload() }} />
  </div>
}

export function PlatformDataPanel({ kind, onSelect }: { kind: ResourceKind; onSelect: (id: number) => void }) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, keyword: '' })
  const query = useIamQuery<PageResult<PlatformDataRow>>(`/platform/data/${kind}?${new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize), keyword: filters.keyword })}`)
  const columns: ColumnsType<PlatformDataRow> = [
    { title: '所属企业', key: 'tenant', width: 220, render: (_, row) => <div className="iam-user-cell"><strong>{row.tenantName} {row.tenantStatus === 0 && <Tag>已停用</Tag>}</strong><span>{row.tenantCode} · 租户 ID {row.tenantId}</span></div> },
  ]
  if (kind === 'users') columns.push(
    { title: '用户信息', key: 'user', width: 180, render: (_, row) => <div className="iam-user-cell"><strong>{row.nickname} {row.owner && <Tag color="blue">企业管理员</Tag>}</strong><span>{row.username}</span></div> },
    { title: '手机号', dataIndex: 'phone', width: 140, render: value => value || '—' },
    { title: '部门 / 门店', key: 'departments', width: 180, render: (_, row) => row.departmentNames?.join('、') || '未分配部门' },
    { title: '角色 / 授权范围', key: 'roles', width: 260, render: (_, row) => <Space wrap size={[0, 4]}>{row.roleNames?.map((role, index) => <Tag key={index}>{role}</Tag>)}</Space> },
  )
  else {
    columns.push({ title: kind === 'departments' ? '部门 / 门店' : kind === 'rooms' ? '房间名称' : '角色名称', dataIndex: 'name', width: 180 }, { title: '编码', dataIndex: 'code', width: 140 })
    if (kind === 'departments') columns.push({ title: '上级部门', dataIndex: 'parentName', width: 180, render: value => value || '顶级部门' }, { title: '类型', dataIndex: 'type', width: 100, render: value => value === 'STORE' ? '门店' : '部门' })
    if (kind === 'rooms') columns.push({ title: '所属部门 / 门店', dataIndex: 'departmentName', width: 180 }, { title: '容量', dataIndex: 'capacity', width: 80 }, { title: '备注', dataIndex: 'remark', width: 160, render: value => value || '—' })
    if (kind === 'roles') columns.push({ title: '权限', key: 'permissions', width: 320, render: (_, row) => <Space wrap size={[0, 4]}>{row.permissionCodes?.map(code => <Tag key={code}>{code}</Tag>)}</Space> })
  }
  columns.push({ title: '状态', dataIndex: 'status', width: 90, render: value => <StatusTag status={value} /> }, { title: '操作', key: 'actions', width: 140, render: (_, row) => <Button type="link" onClick={() => onSelect(row.tenantId)}>管理该企业</Button> })
  return <div className="iam-panel">
    <div className="iam-toolbar"><Input.Search aria-label="搜索全部企业数据" placeholder="搜索名称 / 账号 / 编码" allowClear maxLength={100} onSearch={keyword => setFilters(value => ({ ...value, page: 1, keyword }))} /><div className="iam-toolbar-actions"><Button icon={<ReloadOutlined />} aria-label="刷新平台数据" onClick={query.reload} /><Link to="/platform/tenants">开通企业 / 管理员</Link></div></div>
    <p className="iam-hint">当前显示全部企业的真实数据，包含停用企业。每条记录明确标注所属企业；维护前请先选择目标企业。</p>
    <QueryError error={query.error} onRetry={query.reload} />
    <Table<PlatformDataRow> rowKey="id" size="middle" columns={columns} loading={query.loading} dataSource={query.data?.records ?? []} scroll={{ x: kind === 'users' ? 1210 : 1080 }} pagination={{ ...paginationOptions, current: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, onChange: (page, pageSize) => setFilters(value => ({ ...value, page, pageSize })) }} />
  </div>
}
