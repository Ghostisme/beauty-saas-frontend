import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Enterprise } from '../../src/types/platform'
import { session, permissions } from './auth'
import { installIam } from './iam'

export const platformSession = { ...session, userInfo: { ...session.userInfo, id: 1000, tenantId: 0, tenantCode: '', tenantName: '余乐圈平台管理中心', nickname: '超级管理员', owner: false, platformAdmin: true, permissions: [...permissions, 'platform:manage'] } }
export async function installPlatform(page: Page, authenticated = true) {
  const iam = await installIam(page, platformSession.userInfo, authenticated)
  const enterprises: Enterprise[] = [
    { id: 1, code: 'company-a', name: '上海美业企业', status: 1, adminUserId: 1, adminUsername: 'admin', adminName: '上海负责人', userCount: 2, departmentCount: 2, roomCount: 1, createTime: '2026-09-22T10:00:00' },
    { id: 2, code: 'company-b', name: '北京美业企业', status: 1, adminUserId: 3, adminUsername: 'admin', adminName: '北京负责人', userCount: 1, departmentCount: 1, roomCount: 1, createTime: '2026-09-22T10:00:00' },
    { id: 3, code: 'yulequan', name: '历史保留企业', status: 1, userCount: 0, departmentCount: 0, roomCount: 0, createTime: '2026-09-22T10:00:00' },
  ]
  const state = { enterprises, iam, failNext: '', writes: [] as { method: string; path: string; body: Record<string, unknown> }[], scopedWrites: [] as { tenant: string; path: string; body: Record<string, unknown> }[] }
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/iam/') && request.method() !== 'GET') state.scopedWrites.push({ tenant: request.headers()['x-tenant-id'], path, body: request.postDataJSON() })
  })
  await page.route('**/api/iam/users?**', route => {
    if (route.request().headers()['x-tenant-id'] !== '2') return route.fallback()
    return route.fulfill({ json: { code: 200, data: { records: [{ ...iam.users[0], id: 500, nickname: '北京独立管理员' }], total: 1, page: 1, pageSize: 10 } } })
  })
  let id = 100
  await page.route('**/api/platform/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/platform/', ''), method = request.method()
    expect(request.headers().authorization).toBe(`Bearer ${platformSession.token}`)
    expect(request.headers()['x-platform-key']).toBeUndefined()
    const respond = (data: unknown = null) => route.fulfill({ json: { code: 200, data } })
    if (path === state.failNext) return route.fulfill({ status: 503, json: { code: 503, message: 'test unavailable' } })
    if (path === 'summary') return respond({ tenants: enterprises.length, users: enterprises.reduce((n, e) => n + e.userCount, 0), departments: 3, rooms: 2 })
    if (method === 'GET' && path === 'tenants') {
      const pageNumber = Number(url.searchParams.get('page') || 1), pageSize = Number(url.searchParams.get('pageSize') || 10), keyword = url.searchParams.get('keyword') || '', status = url.searchParams.get('status')
      const rows = enterprises.filter(e => `${e.name} ${e.code}`.includes(keyword) && (status === null || e.status === Number(status)))
      return respond({ records: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: rows.length, page: pageNumber, pageSize })
    }
    const parts = path.split('/'), enterprise = enterprises.find(e => e.id === Number(parts[1]))
    if (method === 'GET' && parts[0] === 'tenants') return enterprise ? respond(enterprise) : route.fulfill({ status: 404, json: { code: 404, message: '企业不存在' } })
    if (method === 'GET' && parts[0] === 'data') {
      const rows = enterprises.filter(e => e.adminUserId).map((e, i) => ({ id: i + 1, tenantId: e.id, tenantCode: e.code, tenantName: e.name, tenantStatus: e.status, status: 1, username: e.adminUsername, nickname: e.adminName, owner: true, departmentNames: ['中心门店'], roleNames: ['管理员 · 企业范围'], name: parts[1] === 'roles' ? '管理员' : parts[1] === 'rooms' ? '护理室' : '中心门店', code: parts[1] === 'roles' ? 'ADMIN' : 'MAIN', capacity: 1, type: 'STORE', departmentName: '中心门店', permissionCodes: permissions }))
      return respond({ records: rows, total: rows.length, page: 1, pageSize: 10 })
    }
    const body = request.postDataJSON() ?? {}
    state.writes.push({ method, path, body })
    if (method === 'POST' && path === 'tenants') {
      if (enterprises.some(e => e.code === body.code)) return route.fulfill({ status: 409, json: { code: 409, message: '企业编码已存在' } })
      const created: Enterprise = { id: ++id, code: body.code, name: body.name, status: 1, adminUserId: id + 100, adminUsername: body.adminUsername, adminName: body.adminName, userCount: 1, departmentCount: 0, roomCount: 0, createTime: '2026-09-22T10:00:00' }
      enterprises.unshift(created); return respond({ tenantId: id, tenantCode: body.code, adminUserId: created.adminUserId, adminUsername: body.adminUsername })
    }
    if (!enterprise) return route.fulfill({ status: 404, json: { code: 404, message: '企业不存在' } })
    if (method === 'PUT') { enterprise.name = body.name; enterprise.status = body.status; return respond() }
    if (parts[2] === 'admin' && parts.length === 3) { Object.assign(enterprise, { adminUsername: body.username, adminName: body.nickname, adminUserId: ++id, userCount: 1 }); return respond(id) }
    if (parts[3] === 'password') return respond()
    throw new Error(`Unexpected platform fixture request ${method} ${path}`)
  })
  return state
}
