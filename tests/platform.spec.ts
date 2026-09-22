import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { installPlatform, platformSession } from './fixtures/platform'
import { installIam } from './fixtures/iam'

async function fits(page: Page, dialog?: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (dialog) {
    await expect(dialog).not.toHaveClass(/ant-zoom-(appear|enter|leave)/)
    const bounds = (await dialog.boundingBox())!, viewport = page.viewportSize()!
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1)
  }
}
async function selectEnterprise(page: Page, label: string) {
  await page.getByLabel('选择企业范围', { exact: true }).click()
  await page.locator('.ant-select-dropdown:visible').getByText(label, { exact: true }).click()
}

test('平台账号默认无企业编码登录、身份展示与企业管理员入口分离', async ({ page }) => {
  await installPlatform(page, false)
  await page.goto('/login')
  await expect(page.getByLabel('企业编码', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('请输入账号', { exact: true })).toBeVisible()
  await page.getByText('企业登录', { exact: true }).click()
  await expect(page.getByLabel('企业编码', { exact: true })).toBeVisible()
  await page.getByLabel('企业编码', { exact: true }).fill('company-a')
  await page.getByText('平台登录', { exact: true }).click()
  await expect(page.getByLabel('企业编码', { exact: true })).toHaveCount(0)
  await page.route('**/api/user/login', route => {
    expect(route.request().postDataJSON()).toEqual({ loginType: 'PLATFORM', username: 'admin', password: 'admin123' })
    return route.fulfill({ json: { code: 200, data: platformSession } })
  })
  await page.getByLabel('账号', { exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/platform\/tenants$/)
  await expect(page.getByRole('heading', { name: '企业管理' })).toBeVisible()
  await page.getByRole('button', { name: '登录信息', exact: true }).click()
  await expect(page.getByText('身份：平台超级管理员', { exact: true })).toBeVisible()
  await expect(page.getByText('企业：yulequan', { exact: true })).toHaveCount(0)
  await fits(page)
})

test('平台页面直接开通企业与管理员、密码校验及弹窗响应式', async ({ page }, info) => {
  const state = await installPlatform(page)
  await page.goto('/platform/tenants')
  await page.getByRole('button', { name: '开通企业', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '开通企业', exact: true })
  await dialog.getByLabel('企业编码', { exact: true }).fill('new-enterprise')
  await dialog.getByLabel('企业名称', { exact: true }).fill('新开通美业企业')
  await expect(dialog.getByLabel('企业管理员账号', { exact: true })).toHaveValue('admin')
  await dialog.getByLabel('管理员姓名', { exact: true }).fill('李负责人')
  await dialog.getByLabel('管理员初始密码', { exact: true }).fill('CompanyTest123!')
  await dialog.getByLabel('确认密码', { exact: true }).fill('mismatch')
  await dialog.getByRole('button', { name: '确认开通' }).click()
  await expect(dialog.getByText('两次输入的密码不一致')).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await dialog.getByLabel('确认密码', { exact: true }).fill('CompanyTest123!')
  await fits(page, dialog)
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: `artifacts/platform-create-${info.project.name}.png`, fullPage: true })
  await dialog.getByRole('button', { name: '确认开通' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: '新开通美业企业' })).toContainText('李负责人')
  expect(state.writes[0]).toMatchObject({ method: 'POST', path: 'tenants', body: { code: 'new-enterprise', adminUsername: 'admin', adminPassword: 'CompanyTest123!' } })
  await fits(page)
  await page.screenshot({ path: `artifacts/platform-tenants-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: '开通企业', exact: true }).click()
  await expect(dialog.getByLabel('企业编码', { exact: true })).toHaveValue('')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('平台为历史企业开通管理员、重置其密码及停用企业', async ({ page }) => {
  const state = await installPlatform(page)
  await page.goto('/platform/tenants')
  let row = page.getByRole('row').filter({ hasText: '历史保留企业' })
  await expect(row).toContainText('待开通管理员')
  await row.getByRole('button', { name: '开通管理员', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '开通企业管理员', exact: true })
  await dialog.getByLabel('管理员姓名', { exact: true }).fill('新负责人')
  await dialog.getByLabel('管理员初始密码', { exact: true }).fill('AdminTest123!')
  await dialog.getByLabel('确认密码', { exact: true }).fill('AdminTest123!')
  await dialog.getByRole('button', { name: '确认开通' }).click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText('新负责人')
  expect(state.writes.at(-1)?.path).toBe('tenants/3/admin')
  await row.getByRole('button', { name: '重置管理员密码', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '重置企业管理员密码', exact: true })
  await dialog.getByLabel('新密码', { exact: true }).fill('ResetOwner123!')
  await dialog.getByLabel('确认密码', { exact: true }).fill('ResetOwner123!')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(state.writes.at(-1)).toMatchObject({ path: 'tenants/3/admin/password', body: { password: 'ResetOwner123!' } })
  await row.getByRole('button', { name: '编辑', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '编辑企业', exact: true })
  await dialog.getByLabel('企业名称', { exact: true }).fill('停用的历史企业')
  await dialog.getByLabel('企业状态', { exact: true }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('停用', { exact: true }).click()
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  row = page.getByRole('row').filter({ hasText: '停用的历史企业' })
  await expect(row.getByText('停用', { exact: true })).toBeVisible()
  expect(state.writes.at(-1)?.body.status).toBe(0)
  await fits(page)
})

test('平台汇总查看全部企业、按企业管理时携带明确范围且切换不串数据', async ({ page }) => {
  test.setTimeout(60_000)
  const state = await installPlatform(page)
  await page.goto('/user-management')
  await expect(page.getByRole('columnheader', { name: '所属企业', exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toContainText('上海美业企业')
  await expect(page.getByRole('table')).toContainText('北京美业企业')
  await expect(page.getByRole('button', { name: '新增用户', exact: true })).toHaveCount(0)
  for (const name of ['部门 / 门店', '房间', '角色权限', '用户']) {
    await page.getByRole('tab', { name, exact: true }).click()
    await expect(page.getByRole('columnheader', { name: '所属企业', exact: true })).toBeVisible()
    await fits(page)
  }
  await selectEnterprise(page, '上海美业企业（company-a）')
  await expect(page.getByText('平台正在管理：上海美业企业（company-a）')).toBeVisible()
  await expect(page.getByRole('tab', { name: '企业信息', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '部门 / 门店', exact: true }).click()
  await expect(page).toHaveURL(/tenantId=1/)
  await page.getByRole('button', { name: '新增部门', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增部门 / 门店', exact: true })
  await dialog.getByLabel('部门名称', { exact: true }).fill('平台新增门店')
  await dialog.getByLabel('部门编码', { exact: true }).fill('PLATFORM_STORE')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(state.scopedWrites.at(-1)).toMatchObject({ tenant: '1', path: '/api/iam/departments', body: { name: '平台新增门店' } })
  await page.getByRole('tab', { name: '用户', exact: true }).click()
  // Switch immediately, without waiting for the tab's deferred render to settle.
  // The new enterprise must preserve the latest URL tab, not a stale parent render's tab.
  await selectEnterprise(page, '北京美业企业（company-b）')
  await expect(page.getByRole('tab', { name: '用户', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/tab=users&tenantId=2/)
  await expect(page.getByRole('row').filter({ hasText: '北京独立管理员' })).toBeVisible()
  await expect(page.getByRole('table')).not.toContainText('张经理')
  await selectEnterprise(page, '全部企业 · 平台视图')
  await expect(page.getByRole('columnheader', { name: '所属企业', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '企业信息', exact: true })).toHaveCount(0)
  await fits(page)
})

test('平台加载失败可重试，企业账号即使直达平台地址也不会发平台数据请求', async ({ page }) => {
  const state = await installPlatform(page)
  state.failNext = 'tenants'
  await page.goto('/platform/tenants')
  await expect(page.getByText('加载失败', { exact: true })).toBeVisible()
  state.failNext = ''
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('上海美业企业')
  const business = await page.context().browser()!.newPage({ viewport: page.viewportSize()! })
  try {
    await installIam(business)
    const calls: string[] = []
    business.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/platform/')) calls.push(request.url()) })
    await business.goto('http://127.0.0.1:5173/platform/tenants')
    await expect(business.getByText('仅平台超级管理员可访问', { exact: true })).toBeVisible()
    await expect(business.getByRole('link', { name: '企业管理', exact: true })).toHaveCount(0)
    expect(calls).toEqual([])
  } finally { await business.close() }
})
