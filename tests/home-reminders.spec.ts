import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { mockProfile, session } from './fixtures/auth'

const cases = [
  { key: 'birthday', trigger: '顾客生日', title: '顾客生日', columns: ['顾客信息', '日期类型', '时间'] },
  { key: 'booking', trigger: '待确认预约', title: '待确认预约', columns: ['顾客信息', '预约项目', '预约时间', '预约员工'] },
  { key: 'absent', trigger: '持卡顾客7–100天未到店', title: '持卡未到店', columns: ['顾客信息', '时间'] },
  { key: 'expiry', trigger: '会员卡到期', title: '会员卡到期', columns: ['顾客信息', '卡名称', '到期时间'] },
  { key: 'balance', trigger: '充值提醒', title: '充值提醒', columns: ['会员姓名', '跟踪员工', '累计消费', '总到店次数', '所属门店'] },
]

async function expectDialogFits(page: Page, dialog: Locator) {
  await expect(dialog).not.toHaveClass(/ant-zoom-(appear|enter|leave)/)
  const bounds = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeInViewport()
  if (await page.locator('.workspace').getAttribute('data-layout-mode') === 'pad') {
    const frame = await page.locator('.workspace').boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(frame!.x)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(frame!.x + frame!.width)
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await mockProfile(page)
  await page.addInitScript(({ session, forcePad }) => {
    localStorage.setItem('beauty-saas.auth.v1', JSON.stringify(session))
    // Also cover manually selected PAD mode on a wide screen, not just native tablet dimensions.
    if (forcePad) localStorage.setItem('beauty-saas.display-mode.v1', 'pad')
  }, { session, forcePad: testInfo.project.name === 'desktop' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '业绩概览' })).toBeVisible()
})

for (const item of cases) {
  test(`${item.title}入口、对应表头、居中空态与弹窗关闭`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const trigger = page.getByRole('button', { name: item.trigger, exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: item.title, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('columnheader')).toHaveText(item.columns)
    const empty = dialog.getByRole('status', { name: `${item.title}暂无相关数据` })
    await expect(empty).toBeVisible()
    await expect(dialog.getByText('提醒服务尚未开通')).toHaveCount(0)
    await expectDialogFits(page, dialog)
    // Headers scroll independently, so the empty illustration stays centered even on a phone.
    const illustration = dialog.locator('.goal-illustration')
    const before = await illustration.boundingBox()
    const modal = await dialog.boundingBox()
    expect(Math.abs(before!.x + before!.width / 2 - modal!.x - modal!.width / 2)).toBeLessThanOrEqual(1)
    await mkdir('artifacts', { recursive: true })
    await page.screenshot({ path: `artifacts/reminder-${item.key}-${testInfo.project.name}.png`, animations: 'disabled' })
    const scroller = dialog.locator('.ant-table-content')
    await scroller.evaluate(element => { element.scrollLeft = element.scrollWidth })
    const after = await illustration.boundingBox()
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1)
    await expectDialogFits(page, dialog)
    if (page.viewportSize()!.width < 768) {
      expect(await scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    }
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.press('Enter')
    await expect(dialog).toBeVisible()
    expect(await dialog.locator('.ant-table-content').evaluate(element => element.scrollLeft)).toBe(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(4, 4)
    await expect(dialog).toBeHidden()
    expect(errors).toEqual([])
  })
}

test('提醒列表的数据展示、加载状态和失败重试（仅测试夹具）', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  async function mount(kind: string, state = 'rows') {
    await page.evaluate(async ({ kind, state }) => {
      const fixtureUrl = '/tests/fixtures/home-reminders.tsx'
      const { mountReminderFixture } = await import(fixtureUrl)
      mountReminderFixture(kind, state)
    }, { kind, state })
  }
  for (const item of cases) {
    await mount(item.key)
    const dialog = page.getByRole('dialog', { name: item.title, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('测试顾客', { exact: true })).toBeVisible()
    await expect(dialog.getByText('13800000000')).toBeVisible()
    await expect(dialog.getByRole('status')).toHaveCount(0)
    if (item.key === 'birthday') {
      await expect(dialog.getByText('公历', { exact: true })).toBeAttached()
      await expect(dialog.getByText('2026-09-21', { exact: true })).toBeAttached()
    } else if (item.key === 'booking') {
      await expect(dialog.getByText('补水护理、肩颈护理', { exact: true })).toBeAttached()
      await expect(dialog.getByText('2026-09-21 10:30', { exact: true })).toBeAttached()
    } else if (item.key === 'absent') {
      await expect(dialog.getByText('2026-08-21 15:30', { exact: true })).toBeAttached()
    } else if (item.key === 'expiry') {
      await expect(dialog.getByText('测试护理年卡', { exact: true })).toBeAttached()
      await expect(dialog.getByText('2026-09-30 23:59', { exact: true })).toBeAttached()
    } else {
      await expect(dialog.getByText(/1,280\.50/)).toBeAttached()
      await expect(dialog.getByText('12', { exact: true })).toBeAttached()
      await expect(dialog.getByText('测试门店', { exact: true })).toBeAttached()
    }
    await expectDialogFits(page, dialog)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(dialog).toBeHidden()
  }
  await mount('balance', 'loading')
  const dialog = page.getByRole('dialog', { name: '充值提醒', exact: true })
  await expect(dialog.getByRole('status', { name: '充值提醒加载中' })).toBeVisible()
  await expect(dialog.getByText('暂无相关数据')).toHaveCount(0)
  await mount('balance', 'error')
  await expect(dialog.getByRole('alert')).toContainText('测试服务暂时不可用')
  await expect(dialog.getByText('暂无相关数据')).toHaveCount(0)
  await dialog.getByRole('button', { name: /重\s*试/ }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByText('测试顾客', { exact: true })).toBeVisible()
  await expectDialogFits(page, dialog)
  await page.screenshot({ path: `artifacts/reminder-fixture-data-${testInfo.project.name}.png`, animations: 'disabled' })
  expect(errors).toEqual([])
})
