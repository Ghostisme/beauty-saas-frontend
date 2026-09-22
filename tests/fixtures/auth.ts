import type { Page } from '@playwright/test'

export const sessionKey = 'beauty-saas.auth.v1'
export const permissions = ['home:read', 'tenant:read', 'tenant:write', 'users:read', 'users:write', 'departments:read', 'departments:write', 'rooms:read', 'rooms:write', 'roles:read', 'roles:write', 'orders:read', 'orders:write', 'order-settings:read', 'order-settings:write', 'sms-settings:read', 'sms-settings:write', 'sms-records:read', 'sms-records:write', 'sms-billing:read', 'sms-billing:write']
// Browser-only fixtures. They cannot authenticate against the real server.
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-only`
export const session = { token, userInfo: { id: 1, username: 'admin', nickname: '管理员', tenantId: 1, tenantCode: 'yulequan', tenantName: '余乐圈美业管理中心', owner: true, platformAdmin: false, permissions } }

export async function mockProfile(page: Page, profile = session.userInfo) {
  await page.route('**/api/iam/me', route => route.fulfill({ json: { code: 200, data: profile } }))
}

export async function installSession(page: Page, value = session) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: sessionKey, value })
}
