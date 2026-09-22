import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Department, ManagedUser, Permission, Role, Room } from '../../src/types/iam'
import { installSession, permissions, session } from './auth'

// Stateful browser-only API fixture. Tenant/RBAC enforcement is tested by the Java integration suite.
export async function installIam(page: Page, profile = session.userInfo, authenticated = true) {
  if (authenticated) await installSession(page, { ...session, userInfo: profile })
  const departments: Department[] = [
    { id: 1, parentId: 0, code: 'MAIN', name: '中心店', type: 'STORE', status: 1, sortOrder: 0 },
    { id: 2, parentId: 0, code: 'RIVER', name: '江湾店', type: 'STORE', status: 1, sortOrder: 1 },
  ]
  const labels = ['管理员', '店长', '主理人', '前台', '美容师', '员工', '顾客']
  const codes = ['ADMIN', 'STORE_MANAGER', 'HOST', 'FRONT_DESK', 'BEAUTICIAN', 'EMPLOYEE', 'CUSTOMER']
  const roles: Role[] = codes.map((code, index) => ({ id: index + 1, code, name: labels[index], builtin: 1, status: 1, permissionCodes: index === 0 ? permissions : ['home:read'] }))
  const catalog: Permission[] = [
    { code: 'home:read', name: '查看首页', module: '首页' },
    ...(['tenant', 'users', 'departments', 'rooms', 'roles'] as const).flatMap((key, i) => {
      const names = ['企业信息', '用户', '部门门店', '房间', '角色权限']
      return [{ code: `${key}:read`, name: `查看${names[i]}`, module: names[i] }, { code: `${key}:write`, name: `维护${names[i]}`, module: names[i] }]
    }),
  ]
  const users: ManagedUser[] = [
    { id: 1, username: 'admin', nickname: '管理员', status: 1, owner: true, departmentIds: [], departments: [], roleGrants: [{ roleId: 1, departmentId: 0, roleName: '管理员' }], createTime: '2026-09-22T10:00:00' },
    { id: 2, username: 'manager', nickname: '张经理', phone: '13800000000', status: 1, owner: false, departmentIds: [1], departments: [{ id: 1, name: '中心店' }], roleGrants: [{ roleId: 2, departmentId: 1, roleName: '店长', departmentName: '中心店' }], createTime: '2026-09-22T10:00:00' },
  ]
  const rooms: Room[] = [{ id: 1, code: 'A01', name: '舒适护理室', capacity: 2, departmentId: 1, departmentName: '中心店', status: 1 }]
  const state = { departments, roles, users, rooms, failNext: '', writes: [] as { method: string; path: string; body: Record<string, unknown> }[], tenantName: profile.tenantName }
  let nextId = 100
  await page.route('**/api/iam/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/iam/', '')
    const method = route.request().method()
    expect(route.request().headers().authorization).toBe(`Bearer ${session.token}`)
    const respond = (data: unknown = null) => route.fulfill({ json: { code: 200, data } })
    // Keep the outage stable across StrictMode's aborted first request; the test explicitly recovers it.
    if (state.failNext === path) return route.fulfill({ status: 503, json: { code: 503, message: 'test unavailable' } })
    if (path === 'me') return respond({ ...profile, tenantName: state.tenantName })
    if (path === 'options') return respond({ departments, roles, permissions: catalog, companyPermissions: ['tenant:read', 'tenant:write', 'users:write', 'departments:write', 'roles:read', 'roles:write'], roomDepartmentIds: profile.permissions.includes('rooms:write') ? departments.filter(d => d.status === 1).map(d => d.id) : [] })
    if (method === 'GET' && path === 'tenant') return respond({ id: 1, code: profile.tenantCode, name: state.tenantName, status: 1, adminUsername: 'admin', adminName: '管理员', createTime: '2026-09-22T10:00:00' })
    if (method === 'GET' && path === 'departments') return respond(departments)
    if (method === 'GET') {
      const pageNumber = Number(url.searchParams.get('page') || 1), pageSize = Number(url.searchParams.get('pageSize') || 10)
      const keyword = url.searchParams.get('keyword')?.toLowerCase() || ''
      const dept = Number(url.searchParams.get('departmentId'))
      const status = url.searchParams.get('status')
      let rows: (ManagedUser | Role | Room)[] = path === 'users' ? users : path === 'roles' ? roles : rooms
      rows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(keyword))
      if (dept) rows = rows.filter(row => 'departmentId' in row ? row.departmentId === dept : 'departmentIds' in row && row.departmentIds.includes(dept))
      if (status !== null) rows = rows.filter(row => row.status === Number(status))
      return respond({ records: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: rows.length, page: pageNumber, pageSize })
    }
    const body = route.request().postDataJSON() ?? {}
    state.writes.push({ method, path, body })
    expect(body).not.toHaveProperty('tenantId')
    if (path === 'tenant') { state.tenantName = body.name; return respond() }
    if (path === 'password' || path.endsWith('/password')) return respond()
    const [resource, recordId] = path.split('/')
    const id = recordId ? Number(recordId) : ++nextId
    const list = resource === 'users' ? users : resource === 'roles' ? roles : resource === 'departments' ? departments : rooms
    const index = list.findIndex(row => row.id === id)
    if (method === 'DELETE') { if (index >= 0) list.splice(index, 1); return respond() }
    let saved = { ...body, id }
    if (resource === 'users') saved = { ...saved, owner: id === 1, createTime: '2026-09-22T10:00:00', departments: departments.filter(d => body.departmentIds.includes(d.id)).map(d => ({ id: d.id, name: d.name })), roleGrants: body.roleGrants.map((grant: { roleId: number; departmentId: number | null }) => ({ ...grant, departmentId: grant.departmentId ?? 0, roleName: roles.find(role => role.id === grant.roleId)?.name, departmentName: departments.find(d => d.id === grant.departmentId)?.name })) }
    if (resource === 'roles') saved = { ...saved, builtin: index >= 0 ? (list[index] as Role).builtin : 0 }
    if (resource === 'rooms') saved = { ...saved, departmentName: departments.find(d => d.id === body.departmentId)?.name }
    // The mock is intentionally scoped to a fixture state, never to production storage.
    if (index >= 0) (list as unknown[])[index] = saved
    else (list as unknown[]).push(saved)
    return respond(id)
  })
  return state
}
