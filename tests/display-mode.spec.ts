import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProfile, session } from './fixtures/auth'

const displayModeKey = 'beauty-saas.display-mode.v1'

async function readLayout(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const { x, y, width, height, right } = document.querySelector(selector)!.getBoundingClientRect()
      return { x, y, width, height, right }
    }
    return {
      availableWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      workspace: rect('.workspace'),
      header: rect('.workspace-header'),
      sidebar: rect('.workspace-sidebar'),
      toggle: rect('.device-mode'),
      filter: rect('.performance-filters .ant-radio-button-wrapper'),
      settings: rect('.settings-button'),
    }
  })
}

test('电脑与 PAD 模式真实切换、记忆选择，并保留手机自适应', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  const originalViewport = page.viewportSize()!
  // Browser-only auth fixture; an unknown layout preference must safely fall back to the viewport.
  await mockProfile(page)
  await page.addInitScript(({ session, displayModeKey }) => {
    localStorage.setItem('beauty-saas.auth.v1', JSON.stringify(session))
    if (localStorage.getItem(displayModeKey) === null) localStorage.setItem(displayModeKey, 'unknown-layout')
  }, { session, displayModeKey })
  await page.goto('/')
  const workspace = page.locator('.workspace')
  const toggle = page.locator('.device-mode')
  await expect(workspace).toHaveAttribute('data-layout-mode', originalViewport.width < 768 ? 'mobile' : originalViewport.width < 992 ? 'pad' : 'pc')

  // Exercise the same preference on a wide screen and then on a phone, even for the mobile project.
  const desktopViewport = originalViewport.width < 768 ? { width: 1440, height: 1000 } : originalViewport
  if (originalViewport.width < 768) {
    await expect(toggle).toBeHidden()
    await page.setViewportSize(desktopViewport)
    await expect(workspace).toHaveAttribute('data-layout-mode', 'pc')
  } else if (originalViewport.width < 992) {
    await page.getByRole('button', { name: 'PAD模式', exact: true }).click()
  }

  await expect(workspace).toHaveAttribute('data-layout-mode', 'pc')
  await expect(toggle).toHaveText('电脑模式')
  await expect(toggle).toHaveAttribute('title', '切换为PAD模式')
  const pc = await readLayout(page)
  expect(pc.workspace.width).toBe(pc.availableWidth)
  expect(pc.workspace.x).toBe(0)
  expect(pc.sidebar.width).toBeGreaterThanOrEqual(184)

  await page.getByRole('radiogroup', { name: '目标范围' }).getByText('门店', { exact: true }).click()
  await page.getByRole('radiogroup', { name: '业绩日期范围' }).getByText('今天', { exact: true }).click()
  await toggle.focus()
  await toggle.press('Enter')
  await expect(workspace).toHaveAttribute('data-layout-mode', 'pad')
  await expect(toggle).toHaveText('PAD模式')
  await expect(toggle.locator('span').last()).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(toggle).toHaveAttribute('title', '切换为电脑模式')
  await expect(page.getByRole('radio', { name: '门店', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: '今天', exact: true })).toBeChecked()
  expect(await page.evaluate(key => localStorage.getItem(key), displayModeKey)).toBe('pad')

  const pad = await readLayout(page)
  expect(pad.workspace.width).toBe(Math.min(1024, pad.availableWidth))
  expect(Math.abs(pad.workspace.x - (pad.availableWidth - pad.workspace.width) / 2)).toBeLessThanOrEqual(1)
  expect(pad.header.x).toBe(pad.workspace.x)
  expect(pad.header.width).toBe(pad.workspace.width)
  expect(pad.sidebar.x).toBe(pad.workspace.x)
  expect(pad.sidebar.width).toBe(88)
  expect(pad.toggle.height).toBeGreaterThanOrEqual(44)
  expect(pad.filter.height).toBeGreaterThanOrEqual(40)
  expect(pad.settings.height).toBeGreaterThanOrEqual(44)
  expect(pad.documentWidth).toBeLessThanOrEqual(pad.availableWidth)

  // Portalled menus must remain anchored to the centered PAD frame.
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const settingsMenu = page.getByRole('menu', { name: '设置菜单' })
  await expect(settingsMenu).toBeVisible()
  const settingsBox = await settingsMenu.boundingBox()
  expect(settingsBox!.x).toBeGreaterThanOrEqual(pad.workspace.x)
  expect(settingsBox!.x + settingsBox!.width).toBeLessThanOrEqual(pad.workspace.right)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(settingsMenu).toBeHidden()
  await page.getByRole('button', { name: '登录信息', exact: true }).click()
  const accountMenu = page.locator('.account-popover-content')
  await expect(accountMenu).toBeVisible()
  const accountBox = await accountMenu.boundingBox()
  expect(accountBox!.x).toBeGreaterThanOrEqual(pad.workspace.x)
  expect(accountBox!.x + accountBox!.width).toBeLessThanOrEqual(pad.workspace.right)
  await page.getByRole('button', { name: '登录信息', exact: true }).click()
  await expect(accountMenu).toBeHidden()

  await page.getByRole('radiogroup', { name: '业绩日期范围' }).getByText('自定义', { exact: true }).click()
  await page.getByPlaceholder('开始日期').click()
  const calendar = page.locator('.responsive-range-popup')
  await expect(calendar).toBeVisible()
  await expect.poll(async () => {
    const box = await calendar.boundingBox()
    return box !== null && box.x >= pad.workspace.x && box.x + box.width <= pad.workspace.right
  }).toBe(true)
  await page.getByPlaceholder('开始日期').press('Escape')
  await expect(calendar).toBeHidden()
  await page.getByRole('radiogroup', { name: '业绩日期范围' }).getByText('今天', { exact: true }).click()

  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: `artifacts/display-mode-pad-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  await page.reload()
  await expect(workspace).toHaveAttribute('data-layout-mode', 'pad')
  await expect(toggle).toHaveText('PAD模式')
  expect((await readLayout(page)).workspace.width).toBe(pad.workspace.width)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(workspace).toHaveAttribute('data-layout-mode', 'mobile')
  await expect(toggle).toBeHidden()
  await expect(page.getByRole('button', { name: '打开导航' })).toBeVisible()
  const mobile = await readLayout(page)
  expect(mobile.workspace.width).toBe(mobile.availableWidth)
  expect(mobile.documentWidth).toBeLessThanOrEqual(mobile.availableWidth)
  expect(await page.evaluate(key => localStorage.getItem(key), displayModeKey)).toBe('pad')

  await page.setViewportSize(desktopViewport)
  await expect(workspace).toHaveAttribute('data-layout-mode', 'pad')
  await page.getByRole('button', { name: 'PAD模式', exact: true }).click()
  await expect(workspace).toHaveAttribute('data-layout-mode', 'pc')
  await expect(toggle).toHaveText('电脑模式')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(key => localStorage.getItem(key), displayModeKey)).toBe('pc')
  await page.reload()
  await expect(workspace).toHaveAttribute('data-layout-mode', 'pc')
  const restored = await readLayout(page)
  expect(restored.workspace.width).toBe(pc.workspace.width)
  expect(restored.header.width).toBe(pc.header.width)
  expect(restored.sidebar.width).toBe(pc.sidebar.width)
  expect(restored.documentWidth).toBeLessThanOrEqual(restored.availableWidth)
  await page.screenshot({ path: `artifacts/display-mode-pc-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
  if (originalViewport.width < 768) {
    await page.setViewportSize(originalViewport)
    await expect(workspace).toHaveAttribute('data-layout-mode', 'mobile')
    await expect(toggle).toBeHidden()
    expect(await page.evaluate(key => localStorage.getItem(key), displayModeKey)).toBe('pc')
  }
  expect(browserErrors).toEqual([])
})
