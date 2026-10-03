import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installIam } from './fixtures/iam'
import { session } from './fixtures/auth'
import type { SopCheck, SopRule, SopRow } from '../src/types/staff-sop'

async function installSop(page: Page) {
  await installIam(page)
  const rules: SopRule[] = []
  const checks: SopCheck[] = []
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = []
  let nextId = 20
  await page.route('**/api/staff/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/staff/', '')
    const method = route.request().method()
    expect(route.request().headers().authorization).toBe(`Bearer ${session.token}`)
    const respond = (data: unknown = null) => route.fulfill({ json: { code: 200, data } })
    if (method === 'GET' && path === 'scheduling/stores') return respond([{ id: 1, name: '中心店' }])
    if (method === 'GET' && path === 'sop/positions') return respond([{ id: 1, name: '店长', status: 1 }, { id: 2, name: '美容师', status: 1 }])
    if (method === 'GET' && path === 'sop/rules') return respond(rules)
    if (method === 'GET' && path === 'sop/monthly') {
      const people = [{ id: 1, nickname: '管理员' }, { id: 2, nickname: '张经理', positionId: 1, positionName: '店长' }]
      return respond({ staff: people.filter(person => !url.searchParams.get('positionId') || person.positionId === Number(url.searchParams.get('positionId'))).map(person => ({
        ...person,
        rows: rules.filter(rule => rule.allPositions || rule.positionIds.includes(person.positionId ?? 0)).flatMap(rule => rule.items.flatMap(item => (item.subitems.length ? item.subitems : [{ key: item.key, name: '' }]).map(child => ({ ruleId: rule.id, leafKey: child.key, itemName: item.name, subitemName: child.name, frequency: item.frequency } satisfies SopRow)))),
      })), checks })
    }
    const body = route.request().postDataJSON() ?? {}
    writes.push({ method, path, body })
    expect(body).not.toHaveProperty('tenantId')
    if (path === 'sop/checks') {
      const index = checks.findIndex(item => item.userId === body.userId && item.ruleId === body.ruleId && item.leafKey === body.leafKey && item.workDate === body.date)
      if (index >= 0) checks.splice(index, 1)
      if (body.checked) checks.push({ userId: body.userId, ruleId: body.ruleId, leafKey: body.leafKey, workDate: body.date, resultMode: body.mode ?? 'COMPLETE', resultValue: body.value ?? null } as SopCheck)
      return respond()
    }
    if (path.startsWith('sop/rules')) {
      const id = Number(path.split('/')[2]) || ++nextId
      const index = rules.findIndex(rule => rule.id === id)
      if (method === 'DELETE') { if (index >= 0) rules.splice(index, 1); return respond() }
      const saved = { ...body, id, positionNames: body.allPositions ? [] : ['店长'], updateTime: '2026-10-03T10:00:00', updaterName: '管理员' } as SopRule
      if (index >= 0) rules[index] = saved
      else rules.unshift(saved)
      return respond(id)
    }
    throw new Error(`Unexpected staff request: ${method} ${path}`)
  })
  return { rules, checks, writes }
}

test('SOP 自检规则和员工月表完整交互', async ({ page }, info) => {
  test.setTimeout(120_000)
  const state = await installSop(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mkdir('artifacts', { recursive: true })
  await page.goto('/staff-management?tab=users')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('menuitem', { name: 'SOP自检' }).click()
  await expect(page).toHaveURL(/\/staff-management\?tab=sop/)
  await expect(page.getByRole('tab', { name: '员工 SOP 自检' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('暂无相关数据')).toBeVisible()
  await page.screenshot({ path: `artifacts/staff-sop-empty-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: '自检 SOP 设置' }).click()
  const drawer = page.getByRole('dialog', { name: '自检规则' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: '新增规则' }).click()
  const editor = page.getByRole('dialog', { name: '规则 SOP 设置' })
  await editor.getByLabel('规则名称').fill('月度仪容自检')
  await editor.getByRole('radio', { name: '指定职位' }).check()
  await editor.getByRole('checkbox', { name: '店长' }).check()
  await editor.getByRole('textbox', { name: '自检项 1', exact: true }).fill('仪容仪表检查')
  await editor.getByRole('button', { name: '添加子项' }).click()
  const subitem = page.getByRole('dialog', { name: '自检子项' })
  await subitem.getByLabel('自检子项名称').fill('工牌整洁')
  await subitem.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(subitem).toBeHidden()
  await expect(editor.getByText('工牌整洁')).toBeVisible()
  await page.screenshot({ path: `artifacts/staff-sop-editor-${info.project.name}.png`, fullPage: true })
  await editor.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(editor).toBeHidden()
  await expect(drawer.getByText('月度仪容自检')).toBeVisible()
  expect(state.writes.at(-1)).toMatchObject({ method: 'POST', path: 'sop/rules', body: { name: '月度仪容自检', allPositions: false, positionIds: [1] } })
  await drawer.getByRole('button', { name: '编辑' }).click()
  await editor.getByLabel('规则名称').fill('月度仪容自检（修订）')
  await editor.getByRole('button', { name: '添加一项' }).click()
  await editor.getByRole('textbox', { name: '自检项 2', exact: true }).fill('服务台检查')
  await editor.getByRole('combobox', { name: '自检周期 2' }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('每天', { exact: true }).click()
  await editor.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(drawer.getByText('月度仪容自检（修订）')).toBeVisible()
  await drawer.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(drawer).toBeHidden()
  await page.getByLabel('自检月份').click()
  await expect(page.locator('.ant-picker-dropdown:visible')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('combobox', { name: '自检职位' }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('店长', { exact: true }).click()
  await expect(page.getByRole('tab', { name: '管理员' })).toHaveCount(0)
  await page.getByRole('combobox', { name: '自检职位' }).click()
  await page.locator('.ant-select-dropdown:visible').getByText('全部职位', { exact: true }).click()
  await expect(page.getByRole('tab', { name: '管理员' })).toBeVisible()
  await page.getByRole('tab', { name: '张经理' }).click()
  const first = page.getByRole('button', { name: /张经理 仪容仪表检查 工牌整洁 .*\-01$/ })
  await first.click()
  const checkModal = page.getByRole('dialog', { name: '1自检' })
  await expect(checkModal.getByRole('radio', { name: '仅标记完成' })).toBeChecked()
  await checkModal.getByText('输入数字', { exact: true }).click()
  await page.screenshot({ path: `artifacts/staff-sop-number-${info.project.name}.png`, fullPage: true })
  await checkModal.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(checkModal).toBeVisible()
  await checkModal.getByLabel('自检数字').fill('1.5')
  await checkModal.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(checkModal).toBeHidden()
  await expect(first).toContainText('1.5')
  expect(state.writes.at(-1)).toMatchObject({ method: 'PUT', path: 'sop/checks', body: { userId: 2, checked: true, mode: 'NUMBER', value: '1.5' } })
  await first.click()
  await expect(checkModal.getByRole('radio', { name: '输入数字' })).toBeChecked()
  await expect(checkModal.getByLabel('自检数字')).toHaveValue('1.5')
  await checkModal.getByText('输入文字说明', { exact: true }).click()
  await checkModal.getByLabel('自检文字说明').fill('工牌整洁，已核对')
  await page.screenshot({ path: `artifacts/staff-sop-text-${info.project.name}.png`, fullPage: true })
  await checkModal.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(first).toContainText('工牌整洁，已核对')
  expect(state.writes.at(-1)).toMatchObject({ method: 'PUT', path: 'sop/checks', body: { userId: 2, checked: true, mode: 'TEXT', value: '工牌整洁，已核对' } })
  await first.click()
  await expect(checkModal.getByLabel('自检文字说明')).toHaveValue('工牌整洁，已核对')
  await checkModal.getByText('仅标记完成', { exact: true }).click()
  await checkModal.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(first).toHaveAttribute('title', '已完成')
  expect(state.writes.at(-1)).toMatchObject({ body: { checked: true, mode: 'COMPLETE', value: null } })
  await first.click()
  await checkModal.getByRole('button', { name: '清除记录' }).click()
  await expect(first).toHaveAttribute('title', '填写自检结果')
  expect(state.writes.at(-1)).toMatchObject({ body: { checked: false } })
  await page.screenshot({ path: `artifacts/staff-sop-monthly-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: '自检 SOP 设置' }).click()
  await drawer.getByRole('button', { name: '删除' }).click()
  await page.getByRole('button', { name: /^确\s*定$/ }).last().click()
  await expect(drawer.getByText('月度仪容自检（修订）')).toHaveCount(0)
  await drawer.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('暂无相关数据')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
