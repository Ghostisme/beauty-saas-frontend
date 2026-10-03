import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installIam } from './fixtures/iam'
import { session } from './fixtures/auth'
import type { StaffAssignment, StaffShift } from '../src/types/staff'

async function installStaff(page: Page) {
  const iam = await installIam(page)
  const participants = new Set<number>()
  const assignments: StaffAssignment[] = []
  const shifts: StaffShift[] = [{ id: 11, name: '晚班', color: '#40A9FF', storeIds: [1], storeNames: ['中心店'], periods: [{ start: '10:30', end: '20:00' }] }]
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = []
  let nextId = 100
  await page.route('**/api/staff/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/staff/', '')
    const method = route.request().method()
    expect(route.request().headers().authorization).toBe(`Bearer ${session.token}`)
    const respond = (data: unknown = null) => route.fulfill({ json: { code: 200, data } })
    if (method === 'GET' && path === 'positions') return respond(iam.positions)
    if (method === 'GET' && path === 'scheduling/stores') return respond([{ id: 1, name: '中心店' }])
    if (method === 'GET' && path === 'scheduling/staff') return respond([{ id: 2, nickname: '张经理', positionName: '店长', participating: participants.has(2) ? 1 : 0 }])
    if (method === 'GET' && path === 'scheduling/shifts') return respond(shifts)
    if (method === 'GET' && path === 'scheduling/calendar') return respond({
      staff: participants.has(2) ? [{ id: 2, nickname: '张经理', positionName: '店长', participating: 1 }] : [],
      assignments: assignments.filter(item => item.workDate >= url.searchParams.get('startDate')! && item.workDate <= url.searchParams.get('endDate')!),
    })
    const body = route.request().postDataJSON() ?? {}
    writes.push({ method, path, body })
    expect(body).not.toHaveProperty('tenantId')
    if (path === 'scheduling/participants') {
      participants.clear()
      for (const id of body.userIds) participants.add(id)
      return respond()
    }
    if (path === 'scheduling/assignments') {
      const index = assignments.findIndex(item => item.userId === body.userId && item.workDate === body.date)
      if (index >= 0) assignments.splice(index, 1)
      if (body.shiftId) {
        const shift = shifts.find(item => item.id === body.shiftId)!
        assignments.push({ userId: body.userId, workDate: body.date, shiftId: shift.id, shiftName: shift.name, color: shift.color })
      }
      return respond()
    }
    if (path === 'scheduling/copy-week') return respond(0)
    if (path.startsWith('scheduling/shifts')) {
      const id = Number(path.split('/')[2]) || ++nextId
      const index = shifts.findIndex(item => item.id === id)
      if (method === 'DELETE') { if (index >= 0) shifts.splice(index, 1); return respond() }
      const saved = { ...body, id, storeNames: ['中心店'] } as StaffShift
      if (index >= 0) shifts[index] = saved
      else shifts.unshift(saved)
      return respond(id)
    }
    if (path.startsWith('positions')) {
      const id = Number(path.split('/')[1]) || ++nextId
      const index = iam.positions.findIndex(item => item.id === id)
      if (method === 'DELETE') { if (index >= 0) iam.positions.splice(index, 1); return respond() }
      const saved = { ...body, id, createTime: '2026-10-03T10:00:00' }
      if (index >= 0) iam.positions[index] = saved
      else iam.positions.push(saved)
      return respond(id)
    }
    throw new Error(`Unexpected staff request: ${method} ${path}`)
  })
  return { iam, participants, assignments, shifts, writes }
}

test('职位新增、编辑、停启用及删除', async ({ page }, info) => {
  test.setTimeout(90_000)
  const state = await installStaff(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/staff-management?tab=positions')
  await expect(page.getByRole('tab', { name: '职位管理' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: '添加职位' }).click()
  let dialog = page.getByRole('dialog', { name: '新增职位' })
  await dialog.getByLabel('职位名称').fill('护理顾问')
  await dialog.getByLabel('职位编号').fill('CARE_ADVISOR')
  await dialog.getByRole('button', { name: /^确\s*定$/ }).click()
  await expect(dialog).toBeHidden()
  let row = page.getByRole('row').filter({ hasText: '护理顾问' })
  await expect(row).toBeVisible()
  expect(state.writes.at(-1)).toMatchObject({ method: 'POST', path: 'positions', body: { name: '护理顾问', code: 'CARE_ADVISOR', status: 1 } })
  await row.getByRole('button', { name: '编辑' }).click()
  dialog = page.getByRole('dialog', { name: '修改职位' })
  await dialog.getByLabel('职位名称').fill('资深护理顾问')
  await dialog.getByRole('button', { name: /^确\s*定$/ }).click()
  row = page.getByRole('row').filter({ hasText: '资深护理顾问' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '停用' }).click()
  await expect(row.getByText('停用', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: '启用' }).click()
  await expect(row.getByText('可用')).toBeVisible()
  await row.getByRole('button', { name: '删除' }).click()
  await page.getByRole('button', { name: /^确\s*定$/ }).last().click()
  await expect(row).toHaveCount(0)
  expect(state.writes.at(-1)).toMatchObject({ method: 'DELETE', path: expect.stringMatching(/^positions\/\d+$/) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: `artifacts/staff-positions-${info.project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})

test('排班员工、班次管理和日历排班', async ({ page }, info) => {
  test.setTimeout(90_000)
  await mkdir('artifacts', { recursive: true })
  const state = await installStaff(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/staff-management?tab=schedules')
  await expect(page.getByText('暂无参与排班员工')).toBeVisible()
  await page.getByRole('button', { name: '排班设置' }).click()
  const drawer = page.getByRole('dialog', { name: '排班设置' })
  await drawer.getByRole('checkbox', { name: /张经理/ }).check()
  await drawer.getByRole('button', { name: '保存设置' }).click()
  await expect.poll(() => state.participants.has(2)).toBe(true)
  await drawer.getByRole('tab', { name: '班次管理' }).click()
  await expect(drawer.getByText('晚班', { exact: true })).toBeVisible()
  await drawer.getByRole('button', { name: '添加班次' }).click()
  await drawer.getByRole('button', { name: '选择颜色' }).click()
  const colors = page.getByRole('dialog', { name: '选择排班颜色' })
  await colors.getByRole('button', { name: '颜色 #FA8C16' }).click()
  await colors.getByRole('button', { name: /^确\s*定$/ }).click()
  await drawer.getByLabel('班次名称').fill('早班')
  await drawer.getByRole('checkbox', { name: '中心店' }).check()
  await drawer.getByRole('textbox', { name: '时段 1 开始时间' }).fill('08:30')
  await drawer.getByRole('textbox', { name: '时段 1 开始时间' }).press('Tab')
  await drawer.getByRole('textbox', { name: '时段 1 结束时间' }).fill('18:00')
  await drawer.getByRole('textbox', { name: '时段 1 结束时间' }).press('Tab')
  await drawer.getByLabel('班次名称').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `artifacts/staff-shift-editor-${info.project.name}.png`, fullPage: true })
  await drawer.getByRole('button', { name: /^保\s*存$/ }).click()
  await expect(drawer.getByText('早班', { exact: true })).toBeVisible()
  expect(state.writes.at(-1)).toMatchObject({ method: 'POST', path: 'scheduling/shifts', body: { name: '早班', color: '#FA8C16', storeIds: [1], periods: [{ start: '08:30', end: '18:00' }] } })
  const early = drawer.locator('.staff-shift-item').filter({ hasText: '早班' })
  await early.getByRole('button', { name: '编辑' }).click()
  await drawer.getByLabel('班次名称').fill('晨班')
  await drawer.getByRole('button', { name: /^保\s*存$/ }).click()
  const morning = drawer.locator('.staff-shift-item').filter({ hasText: '晨班' })
  await expect(morning).toBeVisible()
  await morning.getByRole('button', { name: '删除' }).click()
  await page.getByRole('button', { name: /^确\s*认$/ }).last().click()
  await expect(morning).toHaveCount(0)
  await drawer.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(drawer).toBeHidden()
  await expect(page.locator('.staff-calendar .ant-spin-spinning')).toHaveCount(0)
  const cell = page.getByRole('combobox', { name: /张经理 .* 班次/ }).first()
  await cell.click()
  await page.locator('.ant-select-dropdown:visible').getByText('晚班', { exact: true }).click()
  expect(state.writes.at(-1)).toMatchObject({ method: 'PUT', path: 'scheduling/assignments', body: { storeId: 1, userId: 2, shiftId: 11 } })
  await page.getByRole('button', { name: '一键同步上周班表' }).click()
  await page.getByRole('button', { name: /^同\s*步$/ }).click()
  expect(state.writes.at(-1)).toMatchObject({ method: 'POST', path: 'scheduling/copy-week' })
  await page.getByLabel('排班维度').getByText('月维度').click()
  await expect(page.getByRole('button', { name: '一键同步上周班表' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `artifacts/staff-schedule-${info.project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})
