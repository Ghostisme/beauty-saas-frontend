import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { mockProfile, session, sessionKey } from './fixtures/auth'

test.beforeEach(async ({ page }) => {
  await mockProfile(page)
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: sessionKey, value: session })
})

test('数据报表工作台支持一级分类、二级视图和报表中心反馈', async ({ page }) => {
  await page.goto('/data-reports')
  await expect(page.getByRole('heading', { name: '数据报表' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '经营数据表', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('日维度', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '现金' }).first()).toBeVisible()
  await page.getByRole('tab', { name: '美容师统计表', exact: true }).click()
  await expect(page).toHaveURL(/report=staff$/)
  await expect(page.getByRole('tab', { name: '美容师数据汇总', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '员工考勤', exact: true }).click()
  await expect(page).toHaveURL(/report=staff&view=attendance$/)
  await page.getByRole('tab', { name: '品项卡报表', exact: true }).click()
  await expect(page.getByText('项目统计', { exact: true })).toBeVisible()
  await page.getByText('产品统计', { exact: true }).click()
  await expect(page).toHaveURL(/report=items&view=product$/)
  await page.getByRole('tab', { name: '报表中心', exact: true }).click()
  await expect(page.getByRole('button', { name: '下载到本地' })).toHaveCount(0)
  await page.getByRole('button', { name: '导出报表' }).first().click()
  await expect(page.getByText('顾客剩余资产导出接口待接入', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('日月维度按报表独立保存，切换页面不串状态', async ({ page }) => {
  await page.goto('/data-reports')
  await page.getByText('月维度', { exact: true }).click()
  await expect(page.locator('.ant-segmented-item-selected')).toContainText('月维度')
  await page.getByRole('tab', { name: '新客数据表', exact: true }).click()
  await expect(page.locator('.ant-segmented-item-selected')).toContainText('日维度')
  await page.getByRole('tab', { name: '美容师统计表', exact: true }).click()
  await expect(page.locator('.ant-segmented-item-selected')).toContainText('日维度')
  await page.getByRole('tab', { name: '经营数据表', exact: true }).click()
  await expect(page.locator('.ant-segmented-item-selected')).toContainText('月维度')
})

test('下载到本地只导出当前可见表格，空报表不可下载', async ({ page }) => {
  await page.goto('/data-reports')
  const colors = await page.getByRole('button', { name: '下载到本地' }).evaluate(button => {
    const primary = getComputedStyle(document.querySelector('.app-theme')!).getPropertyValue('--primary')
    const probe = document.createElement('span')
    probe.style.backgroundColor = primary
    document.body.append(probe)
    const expected = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { actual: getComputedStyle(button).backgroundColor, expected }
  })
  expect(colors.actual).toBe(colors.expected)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载到本地' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^经营数据表_日维度_\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = await readFile(await download.path(), 'utf8')
  expect(csv.charCodeAt(0)).toBe(0xfeff)
  expect(csv).toContain('数据 / 分类')
  expect(csv).toContain('"现金"')
  expect(csv).toMatch(/"现金","基础","¥0"/)
  expect(csv).toContain('"","人头","0"')
  expect(csv).not.toContain('明细')

  await page.getByText('月维度', { exact: true }).click()
  const [monthlyDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载到本地' }).click(),
  ])
  expect(monthlyDownload.suggestedFilename()).toContain('月维度')
  expect(await readFile(await monthlyDownload.path(), 'utf8')).toContain('"1月"')

  await page.getByRole('tab', { name: '美容师统计表', exact: true }).click()
  await page.getByRole('tab', { name: '员工考勤', exact: true }).click()
  const [attendanceDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载到本地' }).click(),
  ])
  const attendanceCsv = await readFile(await attendanceDownload.path(), 'utf8')
  expect(attendanceCsv).toContain('"21天"')
  expect(attendanceCsv).not.toContain('"操作"')

  await page.getByRole('tab', { name: '品项卡报表', exact: true }).click()
  await expect(page.getByRole('button', { name: '下载到本地' })).toBeDisabled()
})

test('移动端数据报表保持可横向查看且页面不溢出', async ({ page }) => {
  await page.goto('/data-reports?report=customer&view=visits')
  await expect(page.getByRole('tab', { name: '客户到店动态', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('combobox', { name: '客户分类' })).toBeVisible()
  await expect(page.getByPlaceholder('姓名/手机号/编号')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('客户盘点、员工业绩、员工考勤和负债顾客报表展示与参考页面一致的表格行结构', async ({ page }) => {
  await page.goto('/data-reports?report=customer')
  await expect(page.getByText('共搜索到3个顾客').first()).toBeVisible()
  await expect(page.getByText('模拟顾客B', { exact: true })).toBeVisible()
  await expect(page.getByText('模拟顾客C', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: '美容师统计表', exact: true }).click()
  await page.getByRole('tab', { name: '员工工绩汇总', exact: true }).click()
  await expect(page.getByText('模拟负责人', { exact: true })).toBeVisible()
  await expect(page.getByText('模拟员工A', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: '员工考勤', exact: true }).click()
  await expect(page.getByText('21天', { exact: true })).toBeVisible()
  await page.getByText('考勤明细', { exact: true }).click()
  await expect(page.getByText('未签到', { exact: true }).first()).toBeVisible()

  await page.getByRole('tab', { name: '负债报表', exact: true }).click()
  await expect(page.getByText('当前共搜索到3条记录')).toBeVisible()
  await expect(page.getByText('汇总', { exact: true })).toBeVisible()
})
