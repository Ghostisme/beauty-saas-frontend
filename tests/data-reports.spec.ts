import { expect, test } from '@playwright/test'
import { mockProfile, session, sessionKey } from './fixtures/auth'

test.beforeEach(async ({ page }) => {
  await mockProfile(page)
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: sessionKey, value: session })
})

test('数据报表工作台支持一级分类、二级视图和导出反馈', async ({ page }) => {
  await page.goto('/data-reports')
  await expect(page.getByRole('heading', { name: '数据报表' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '经营数据表', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('经营数据表', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '美容师统计表', exact: true }).click()
  await expect(page).toHaveURL(/report=staff$/)
  await expect(page.getByRole('tab', { name: '美容师数据汇总', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '员工考勤', exact: true }).click()
  await expect(page).toHaveURL(/report=staff&view=attendance$/)
  await page.getByRole('tab', { name: '报表中心', exact: true }).click()
  await page.getByRole('button', { name: '导出' }).first().click()
  await expect(page.getByText('报表导出接口待接入', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('移动端数据报表保持可横向查看且页面不溢出', async ({ page }) => {
  await page.goto('/data-reports?report=customer&view=visits')
  await expect(page.getByRole('heading', { name: '数据报表' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '客户到店动态', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByText('更多筛选', { exact: true }).click()
  await expect(page.getByPlaceholder('顾客标签')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
