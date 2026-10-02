import { expect, test } from '@playwright/test'
import { installCustomers } from './fixtures/customers'

test.beforeEach(async ({ page }) => { await installCustomers(page) })

test('顾客回访任务弹窗支持日期、员工和话术交互', async ({ page }) => {
  await page.goto('/customers')
  await page.locator('.ant-table-row').filter({ hasText: '模拟顾客A' }).getByRole('button', { name: '详情', exact: true }).click()

  const drawer = page.getByRole('dialog', { name: '会员详情' })
  await drawer.getByRole('tab', { name: '服务日志/回访', exact: true }).click()
  const logs = drawer.locator('.customer-logs-tab')
  await logs.getByRole('tab', { name: '回访/客勤', exact: true }).click()
  await logs.getByRole('button', { name: '创建回访任务', exact: true }).click()

  const modal = page.getByRole('dialog', { name: '创建待回访任务' })
  await expect(modal.getByRole('radio', { name: '指定日期', exact: true })).toBeChecked()
  await modal.getByRole('button', { name: /确\s*认/ }).click()
  await expect(modal.getByText('请完善回访日期', { exact: true })).toBeVisible()
  await expect(modal.getByText('请输入回访话术', { exact: true })).toBeVisible()

  await modal.getByText('固定周期', { exact: true }).click()
  await modal.getByRole('button', { name: /确\s*认/ }).click()
  await expect(modal.getByText('请完善回访日期周期设置', { exact: true })).toBeVisible()

  await modal.getByRole('spinbutton', { name: '计划回访天数' }).fill('3')
  await modal.getByText('顾客跟踪员工', { exact: true }).click()
  await modal.getByText('单独设定', { exact: true }).click()
  await expect(modal.getByText(/天后提醒/)).toBeVisible()
  await modal.getByRole('textbox', { name: '回访话术' }).fill('请在下次到店前提醒顾客')
  await modal.getByRole('button', { name: /确\s*认/ }).click()

  await expect(modal).toBeHidden()
  await expect(logs.getByRole('cell', { name: '待回访', exact: true })).toBeVisible()
  await expect(logs.getByRole('cell', { name: '负责人', exact: true })).toBeVisible()

  await logs.getByRole('button', { name: '创建回访任务', exact: true }).click()
  const employeeModal = page.getByRole('dialog', { name: '创建待回访任务' })
  await employeeModal.getByText('指定员工', { exact: true }).click()
  await employeeModal.getByRole('combobox', { name: '指定回访员工' }).click()
  const employeeOptions = page.locator('.ant-select-dropdown:visible')
  const responsibleOption = employeeOptions.locator('.ant-select-item-option-content').filter({ hasText: '负责人' }).first()
  await expect(responsibleOption).toBeVisible()
  await responsibleOption.click()
  await employeeModal.getByRole('button', { name: /取\s*消/ }).click()
})
