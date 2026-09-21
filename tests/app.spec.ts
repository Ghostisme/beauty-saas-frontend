import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import dayjs from 'dayjs'

const sessionKey = 'beauty-saas.auth.v1'
// Fixtures are confined to browser tests. Production login always calls the backend.
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-only`
const session = { token, userInfo: { id: 1, username: 'admin', nickname: '管理员' } }

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function signInFixture(page: Page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: sessionKey, value: session })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '业绩概览' })).toBeVisible()
}

test('登录校验、错误提示、接口契约与退出', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: '余乐圈' })).toBeVisible()
  await expectNoOverflow(page)
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: `artifacts/login-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('请输入账号', { exact: true })).toBeVisible()
  await expect(page.getByText('请输入密码', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '忘记密码' }).click()
  await expect(page.getByText('请联系门店管理员核实账号并重置密码。')).toBeVisible()
  await page.getByRole('button', { name: '知道了' }).click()
  await page.getByRole('tab', { name: '短信登录' }).click()
  await expect(page.getByText('短信登录暂未开通')).toBeVisible()
  await page.getByRole('button', { name: '使用密码登录' }).click()
  let accepted = false
  await page.route('**/api/user/login', async route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ username: 'admin', password: 'admin123' })
    await route.fulfill({ json: accepted
      ? { code: 200, data: session }
      : { code: 500, message: '用户名或密码错误', data: null } })
  })
  await page.getByRole('textbox', { name: '账号', exact: true }).fill('admin')
  await page.getByLabel('密码', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '用户名或密码错误' })).toBeVisible()
  accepted = true
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '业绩概览' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '业绩概览' })).toBeVisible()
  await page.getByRole('button', { name: '登录信息', exact: true }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(key => localStorage.getItem(key), sessionKey)).toBeNull()
  expect(browserErrors).toEqual([])
})

test('首页响应式、筛选、设置和移动导航', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  await signInFixture(page)
  await expectNoOverflow(page)
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: `artifacts/home-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '打开导航' }).click()
    const navigation = page.getByRole('navigation', { name: '移动端主导航' })
    await expect(navigation.getByRole('menuitem')).toHaveCount(1)
    await navigation.getByRole('link', { name: '首页' }).click()
    await expect(navigation).toBeHidden()
  } else {
    await expect(page.getByLabel('主导航', { exact: true }).getByRole('menuitem')).toHaveCount(1)
  }
  await page.getByRole('radiogroup', { name: '目标范围' }).getByText('门店', { exact: true }).click()
  await expect(page.getByRole('radio', { name: '门店', exact: true })).toBeChecked()
  await expect(page.getByRole('status', { name: '门店本月暂无目标数据' })).toBeVisible()
  const previous = await page.getByTestId('performance-date').innerText()
  await page.getByRole('radiogroup', { name: '业绩日期范围' }).getByText('今天', { exact: true }).click()
  await expect(page.getByTestId('performance-date')).not.toHaveText(previous)
  await page.getByRole('radiogroup', { name: '业绩日期范围' }).getByText('自定义', { exact: true }).click()
  await page.getByPlaceholder('开始日期').click()
  await expect(page.locator('.responsive-range-popup')).toBeVisible()
  await expectNoOverflow(page)
  const startDate = dayjs().subtract(6, 'day')
  const endDate = dayjs().subtract(1, 'day')
  await page.locator('.responsive-range-popup').getByTitle(startDate.format('YYYY-MM-DD'), { exact: true }).first().click()
  await page.locator('.responsive-range-popup').getByTitle(endDate.format('YYYY-MM-DD'), { exact: true }).first().click()
  await expect(page.getByTestId('performance-date')).toHaveText(`${startDate.format('YYYY年MM月DD日')} - ${endDate.format('YYYY年MM月DD日')}`)
  await page.getByRole('radiogroup', { name: '业绩日期范围' }).getByText('近7天', { exact: true }).click()
  await page.getByRole('button', { name: '顾客生日', exact: true }).click()
  await expect(page.getByText('提醒服务尚未开通')).toBeVisible()
  await page.getByRole('button', { name: '知道了' }).click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('textbox', { name: '门店显示名称' }).fill('测试门店')
  await expectNoOverflow(page)
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.locator('.store-name')).toHaveText('测试门店')
  await page.reload()
  await expect(page.locator('.store-name')).toHaveText('测试门店')
  expect(browserErrors).toEqual([])
})

test('损坏或过期的本地登录信息安全回到登录页', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(key => localStorage.setItem(key, '{broken'), sessionKey)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  const expiredToken = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"exp":1}').toString('base64url')}.test-only`
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: sessionKey, value: { ...session, token: expiredToken } })
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expectNoOverflow(page)
})
