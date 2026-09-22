import { useState } from 'react'
import { BankOutlined, TeamOutlined } from '@ant-design/icons'
import { Alert, Grid, Result, Spin, Tabs, Tag } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DepartmentPanel } from '@/components/iam/DepartmentPanel'
import { RoomPanel } from '@/components/iam/RoomPanel'
import { RolePanel } from '@/components/iam/RolePanel'
import { UserPanel } from '@/components/iam/UserPanel'
import { TenantPanel } from '@/components/iam/TenantPanel'
import { QueryError, useIamQuery } from '@/components/iam/shared'
import { EnterpriseSelector, PlatformDataPanel } from '@/components/iam/PlatformDataPanel'
import { IamScopeContext } from '@/context/IamScopeContext'
import type { IamOptions, ResourceKind } from '@/types/iam'
import type { Enterprise } from '@/types/platform'
import '@/styles/iam.css'
import '@/styles/platform.css'

const tabs = [
  { key: 'users', label: '用户', permission: 'users:read', component: UserPanel },
  { key: 'departments', label: '部门 / 门店', permission: 'departments:read', component: DepartmentPanel },
  { key: 'rooms', label: '房间', permission: 'rooms:read', component: RoomPanel },
  { key: 'roles', label: '角色权限', permission: 'roles:read', component: RolePanel },
  { key: 'tenant', label: '企业信息', permission: 'tenant:read', component: TenantPanel },
]

function currentQuery(change: (params: URLSearchParams) => void) {
  // BrowserRouter can update history before a deferred parent render commits.
  // Merge against the current URL so rapid tab / enterprise changes cannot restore stale parameters.
  const next = new URLSearchParams(window.location.search)
  change(next)
  return next
}

function ManagementWorkspace({ enterprise }: { enterprise?: Enterprise }) {
  const { session, can, refreshProfile } = useAuth()
  const screens = Grid.useBreakpoint()
  const [searchParams, setSearchParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const query = useIamQuery<IamOptions>('/iam/options', revision)
  const visibleTabs = tabs.filter(tab => can(tab.permission))
  const activeKey = visibleTabs.find(tab => tab.key === searchParams.get('tab'))?.key ?? visibleTabs[0]?.key
  function onChanged() {
    setRevision(value => value + 1)
    void refreshProfile().catch(() => { /* The next API call still enforces current permissions. */ })
  }
  return (
    <section className="iam-page" aria-labelledby="iam-title">
      <div className="iam-page-heading">
        <div><h1 id="iam-title"><TeamOutlined /> 用户管理</h1><p>{enterprise ? `平台正在管理：${enterprise.name}（${enterprise.code}）` : '管理本企业的账号、组织、房间与角色权限'}</p></div>
        <Tag icon={<BankOutlined />} color="blue">{enterprise?.code ?? session?.userInfo.tenantCode}</Tag>
      </div>
      {enterprise?.status === 0 && <Alert type="warning" showIcon title="该企业已停用，目前可查看数据；维护前请在企业管理中启用。" />}
      <div className="iam-content">
        <QueryError error={query.error} onRetry={query.reload} />
        {query.loading && !query.data && <div className="iam-loading"><Spin tip="正在加载企业配置"><div /></Spin></div>}
        {query.data && <Tabs activeKey={activeKey} tabBarGutter={screens.md ? 32 : 8} onChange={key => setSearchParams(currentQuery(next => next.set('tab', key)))} destroyOnHidden items={visibleTabs.map(({ key, label, component: Panel }) => ({
          key, label, children: <Panel options={query.data!} revision={revision} onChanged={onChanged} />,
        }))} />}
      </div>
    </section>
  )
}

function SelectedEnterprise({ id }: { id: number }) {
  const query = useIamQuery<Enterprise>(`/platform/tenants/${id}`)
  if (query.error) return <QueryError error={query.error} onRetry={query.reload} />
  if (!query.data) return <div className="iam-loading"><Spin /></div>
  return <IamScopeContext.Provider value={id}><ManagementWorkspace enterprise={query.data} /></IamScopeContext.Provider>
}

function PlatformUserWorkspace() {
  const screens = Grid.useBreakpoint()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tenantId')
  const tenantId = raw ? Number(raw) : undefined
  const visibleTabs = tabs.filter(tab => tab.key !== 'tenant')
  const activeKey = visibleTabs.some(tab => tab.key === params.get('tab')) ? params.get('tab')! : 'users'
  function chooseEnterprise(id?: number) {
    setParams(currentQuery(next => { if (id) next.set('tenantId', String(id)); else next.delete('tenantId') }))
  }
  if (tenantId !== undefined && (!Number.isSafeInteger(tenantId) || tenantId <= 0)) return <Result status="404" title="企业参数不正确" />
  return <div className="platform-workspace">
    <EnterpriseSelector value={tenantId} onChange={chooseEnterprise} />
    {tenantId !== undefined ? <SelectedEnterprise key={tenantId} id={tenantId} /> : <section className="iam-page" aria-labelledby="platform-users-title">
      <div className="iam-page-heading"><div><h1 id="platform-users-title"><TeamOutlined /> 用户管理</h1><p>平台视图 · 查看所有企业的用户、组织、房间与角色</p></div><Tag color="blue">全部企业</Tag></div>
      <div className="iam-content"><Tabs activeKey={activeKey} tabBarGutter={screens.md ? 32 : 12} destroyOnHidden onChange={key => setParams(currentQuery(next => next.set('tab', key)))} items={visibleTabs.map(tab => ({ key: tab.key, label: tab.label, children: <PlatformDataPanel key={tab.key} kind={tab.key as ResourceKind} onSelect={chooseEnterprise} /> }))} /></div>
    </section>}
  </div>
}

export default function UserManagementPage() {
  const { session, can } = useAuth()
  if (session?.userInfo.platformAdmin) return <PlatformUserWorkspace key={session.token} />
  if (!tabs.some(tab => can(tab.permission))) return <Result status="403" title="暂无管理权限" subTitle="请联系本企业管理员分配相应的角色权限。" />
  // Discard open forms and cached queries completely when changing enterprises.
  return <ManagementWorkspace key={session?.token} />
}
