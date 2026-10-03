import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installIam } from './fixtures/iam'
import { session } from './fixtures/auth'
import type { AttendanceRule } from '../src/types/staff-attendance'

async function installAttendance(page: Page) {
  await installIam(page)
  const rules: AttendanceRule[] = []
  const staff = [
    { id: 1, nickname: '管理员', positionId: 1, positionName: '店长' },
    { id: 2, nickname: '张经理', positionId: 2, positionName: '美容师' },
  ]
  await page.route('**/api/staff/attendance/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/staff/attendance/', '')
    const method = route.request().method()
    expect(route.request().headers().authorization).toBe(`Bearer ${session.token}`)
    const respond = (data: unknown = null) => route.fulfill({ json: { code: 200, data } })
    if (method === 'GET' && path === 'stores') return respond([{ id: 1, name: '中心店' }, { id: 2, name: '江湾店' }])
    if (method === 'GET' && path === 'staff') return respond(staff)
    if (method === 'GET' && path === 'rules') return respond(rules)
    if (method === 'POST' && path === 'rules/conflicts') return respond([])
    if (method === 'POST' || method === 'PUT') {
      const body = route.request().postDataJSON() as Omit<AttendanceRule, 'id'> & { force: boolean }
      const id = method === 'PUT' ? Number(path.split('/').at(-1)) : (rules.length + 10)
      const saved = { ...body, id, storeNames: body.storeIds.map(storeId => storeId === 1 ? '中心店' : '江湾店'), userNames: {}, updateTime: '2026-10-03T17:00:00', updaterName: '管理员' } as AttendanceRule
      const index = rules.findIndex(rule => rule.id === id)
      if (index >= 0) rules[index] = saved
      else rules.unshift(saved)
      return respond(id)
    }
    if (method === 'DELETE') { const id = Number(path.split('/').at(-1)); const index = rules.findIndex(rule => rule.id === id); if (index >= 0) rules.splice(index, 1); return respond() }
    throw new Error(`Unexpected attendance request: ${method} ${path}`)
  })
  return rules
}

test('考勤打卡规则新增表单的关键切换', async ({ page }) => {
  const rules = await installAttendance(page)
  await page.goto('/staff-management?tab=users')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('menuitem', { name: '考勤打卡' }).click()
  await expect(page).toHaveURL(/tab=attendance/)
  await expect(page.getByRole('tab', { name: '考勤打卡' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: '新增考勤规则' }).click()
  await expect(page.getByRole('heading', { name: '新增考勤规则' })).toBeVisible()
  await page.getByPlaceholder('请输入规则名称').fill('门店早晚班')
  await page.getByText('所有门店', { exact: true }).click()
  await page.getByRole('radio', { name: '指定员工' }).check()
  await page.getByRole('checkbox', { name: /张经理/ }).check()
  await page.getByRole('radio', { name: 'WIFI打卡' }).check()
  await expect(page.getByText('WIFI列表不能为空')).toBeVisible()
  await page.getByRole('button', { name: '手动添加WIFI' }).click()
  const wifi = page.getByRole('dialog', { name: '添加WIFI' })
  await wifi.getByLabel('WIFI名称').fill('中心店 WIFI')
  await wifi.getByLabel('Mac地址').fill('AA:BB:CC:DD:EE:FF')
  await page.locator('.ant-modal:visible .ant-btn-primary').click()
  await page.getByRole('radio', { name: '按排班考勤' }).check()
  await page.getByRole('radio', { name: '打卡码' }).check()
  await expect(page.getByText('管理员可以出示二维码，员工扫码打卡')).toBeVisible()
  await page.screenshot({ path: 'artifacts/staff-attendance-editor.png', fullPage: true })
  await page.getByRole('button', { name: '新增规则' }).click()
  await expect(page.getByText('门店早晚班')).toBeVisible()
  expect(rules).toHaveLength(1)
})
