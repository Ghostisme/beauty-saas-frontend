import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import dayjs from 'dayjs'
import { mockProfile, session, sessionKey } from './fixtures/auth'

test.beforeEach(async ({ page }) => { await mockProfile(page) })

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
  await page.getByText('企业登录', { exact: true }).click()
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('请输入企业编码', { exact: true })).toBeVisible()
  await expect(page.getByText('请输入账号', { exact: true })).toBeVisible()
  await expect(page.getByText('请输入密码', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '忘记密码' }).click()
  await expect(page.getByText('请联系企业管理员核实账号并重置密码；企业管理员请联系平台。')).toBeVisible()
  await page.getByRole('button', { name: '知道了' }).click()
  await page.getByRole('tab', { name: '短信登录' }).click()
  await expect(page.getByText('短信登录暂未开通')).toBeVisible()
  await page.getByRole('button', { name: '使用密码登录' }).click()
  let accepted = false
  await page.route('**/api/user/login', async route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ loginType: 'TENANT', tenantCode: 'yulequan', username: 'admin', password: 'admin123' })
    await route.fulfill({ status: accepted ? 200 : 401, json: accepted
      ? { code: 200, data: session }
      : { code: 401, message: '用户名或密码错误', data: null } })
  })
  await page.getByLabel('企业编码', { exact: true }).fill('yulequan')
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
  await expect(page.getByRole('menuitem', { name: '修改密码' })).toBeVisible()
  await page.getByRole('menuitem', { name: '修改密码' }).click()
  await expect(page.getByRole('dialog', { name: '修改密码' })).toBeVisible()
  await page.getByRole('dialog', { name: '修改密码' }).getByRole('button', { name: /取\s*消/ }).click()
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
    await expect(navigation.getByRole('menuitem')).toHaveCount(4)
    await expect(navigation.getByRole('link', { name: '订单管理', exact: true })).toBeVisible()
    await navigation.getByRole('link', { name: '首页' }).click()
    await expect(navigation).toBeHidden()
  } else {
    await expect(page.getByLabel('主导航', { exact: true }).getByRole('menuitem')).toHaveCount(4)
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
  const birthdayDialog = page.getByRole('dialog', { name: '顾客生日', exact: true })
  await expect(birthdayDialog.getByRole('columnheader')).toHaveText(['顾客信息', '日期类型', '时间'])
  await expect(birthdayDialog.getByRole('status', { name: '顾客生日暂无相关数据' })).toBeVisible()
  await birthdayDialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(birthdayDialog).toBeHidden()
  await page.getByRole('button', { name: '顾客回访提醒', exact: true }).click()
  await expect(page.getByText('提醒服务尚未开通')).toBeVisible()
  await page.getByRole('button', { name: '知道了' }).click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByRole('menu', { name: '设置菜单' })).toBeVisible()
  await page.getByRole('menuitem', { name: '显示设置' }).click()
  await page.getByRole('textbox', { name: '门店显示名称' }).fill('测试门店')
  await expectNoOverflow(page)
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.locator('.store-name')).toHaveText('测试门店')
  await page.reload()
  await expect(page.locator('.store-name')).toHaveText('测试门店')
  expect(browserErrors).toEqual([])
})

test('首页随窗口高度铺满屏幕，小屏可滚动且卡片不裁切', async ({ page }, testInfo) => {
  await signInFixture(page)
  const viewport = page.viewportSize()!

  async function readLayout() {
    return page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      const content = rect('.workspace-content')
      const goals = rect('.goals-panel')
      const performance = rect('.performance-panel')
      const footer = rect('.workspace-body > .app-footer')
      const columns = getComputedStyle(document.querySelector('.metrics-grid')!).gridTemplateColumns.split(' ').length
      return {
        documentHeight: document.documentElement.scrollHeight,
        contentBottom: content.bottom,
        goalsHeight: goals.height,
        performanceHeight: performance.height,
        performanceBottom: performance.bottom,
        footerTop: footer.top,
        footerBottom: footer.bottom,
        columns,
        cardsFit: [...document.querySelectorAll('.dashboard-panel')].every(card => card.scrollHeight <= card.clientHeight + 1),
        metricsFit: [...document.querySelectorAll('.metric')].every(metric => {
          const box = metric.getBoundingClientRect()
          return box.top >= performance.top && box.bottom <= performance.bottom
            && box.left >= performance.left && box.right <= performance.right
        }),
      }
    })
  }

  const layout = await readLayout()
  await expectNoOverflow(page)
  expect(layout.cardsFit).toBe(true)
  expect(layout.metricsFit).toBe(true)
  expect(layout.columns).toBe(viewport.width < 768 ? 2 : 3)
  expect(Math.abs(layout.performanceBottom - layout.contentBottom)).toBeLessThanOrEqual(1)
  expect(Math.abs(layout.contentBottom - layout.footerTop)).toBeLessThanOrEqual(1)
  expect(Math.abs(layout.footerBottom - layout.documentHeight)).toBeLessThanOrEqual(1)

  if (testInfo.project.name === 'mobile') {
    expect(layout.documentHeight).toBeGreaterThan(viewport.height)
    await page.locator('.metric').last().scrollIntoViewIfNeeded()
    await expect(page.locator('.metric').last()).toBeInViewport()
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
    await expect(page.getByRole('contentinfo')).toBeInViewport()
  } else {
    expect(Math.abs(layout.documentHeight - viewport.height)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.footerBottom - viewport.height)).toBeLessThanOrEqual(1)

    // Growing the window must expand the cards themselves, not just the background.
    await page.setViewportSize({ width: viewport.width, height: viewport.height + 240 })
    await expect.poll(async () => (await readLayout()).documentHeight).toBe(viewport.height + 240)
    const taller = await readLayout()
    expect(taller.goalsHeight).toBeGreaterThan(layout.goalsHeight)
    expect(taller.performanceHeight).toBeGreaterThan(layout.performanceHeight)
    expect(Math.abs(taller.footerBottom - viewport.height - 240)).toBeLessThanOrEqual(1)
    expect(taller.cardsFit).toBe(true)
    expect(taller.metricsFit).toBe(true)

    // Shrink the same window again to catch fixed heights left behind after resize.
    await page.setViewportSize(viewport)
    await expect.poll(async () => (await readLayout()).documentHeight).toBe(viewport.height)
    await expectNoOverflow(page)
  }
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
