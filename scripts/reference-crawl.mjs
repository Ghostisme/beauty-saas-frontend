import { chromium } from '@playwright/test'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

const CONTROL_SELECTOR = 'button:visible, a:visible, [role="button"]:visible, [role="tab"]:visible, [role="menuitem"]:visible, input:visible, select:visible, textarea:visible'
const OVERLAY_SELECTOR = '[role="dialog"]:visible, [role="menu"]:visible, [role="listbox"]:visible, .ant-drawer-open:visible, .ant-popover:visible, .ant-dropdown:visible'
const DEFAULT_REFERENCE_URL = 'https://saas.wikemi.com/operate/member/storeMember/content'

const MODULES = [
  { key: 'appointments', label: '预约模块', aliases: ['预约', '预约管理'], path: '/appointments' },
  { key: 'customers', label: '顾客模块', aliases: ['顾客', '顾客经营'], path: '/customers' },
  { key: 'orders', label: '订单模块', aliases: ['订单', '订单管理'], path: '/orders' },
  { key: 'reports', label: '数据报表', aliases: ['数据报表', '报表'], path: '/data-reports' },
  { key: 'inventory', label: '库存模块', aliases: ['库存管理', '库存'], path: '/inventory' },
  { key: 'sms', label: '短信模块', aliases: ['短信'], path: '/sms' },
  { key: 'account', label: '账号体系', aliases: ['用户管理', '账号管理', '角色权限'], path: '/user-management' },
  { key: 'stores', label: '门店管理', aliases: ['门店管理', '房间管理'], path: '/store-management?tab=departments' },
  { key: 'items', label: '品项模块', aliases: ['品项管理', '门店产品', '服务项目', '会员卡'], path: '/items?kind=PROJECT' },
  { key: 'staff', label: '门店员工管理模块', aliases: ['门店员工管理', '员工管理', '员工列表'], path: '/staff-management?tab=users' },
  { key: 'commissions', label: '提成模块', aliases: ['提成管理', '项目提成', '产品提成', '卡提成'], path: '/commissions?kind=PROJECT' },
]

const DANGEROUS = /删除|移除|注销|退出|保存|提交|确认|确定|支付|充值|发送|批量导出|导出|下载|作废|退款|清空|重置密码|禁用|启用|登记|创建订单|关闭|取消/i
const NAVIGATION_ONLY = /关闭|取消/i

function arg(name) {
  const prefix = `--${name}=`
  const item = process.argv.find(value => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : undefined
}

function slug(value) {
  return String(value || 'unknown').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 90) || 'unknown'
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isSameOrigin(href, baseUrl) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false
  try {
    return new URL(href, baseUrl).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

async function exists(file) {
  try {
    await access(file, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function waitForApp(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined)
  await page.waitForTimeout(Number(process.env.REFERENCE_SETTLE_MS || 600))
}

async function visible(locator) {
  try {
    return await locator.isVisible({ timeout: 900 })
  } catch {
    return false
  }
}

async function collectControls(root) {
  const controls = root.locator(CONTROL_SELECTOR)
  const count = await controls.count()
  const result = []
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index)
    const data = await control.evaluate(element => {
      const tag = element.tagName.toLowerCase()
      const role = element.getAttribute('role') || tag
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim()
      const aria = element.getAttribute('aria-label') || ''
      const title = element.getAttribute('title') || ''
      const placeholder = element.getAttribute('placeholder') || ''
      const href = element.getAttribute('href') || ''
      return { tag, role, text, aria, title, placeholder, href }
    }).catch(() => undefined)
    if (!data) continue
    const name = normalize(data.aria || data.text || data.title || data.placeholder)
    if (!name && !data.href) continue
    const signature = [data.tag, data.role, name, data.href].join('|')
    if (result.some(item => item.signature === signature)) continue
    result.push({ index, signature, name, ...data })
  }
  return result
}

async function findControl(root, descriptor) {
  const controls = root.locator(CONTROL_SELECTOR)
  const count = await controls.count()
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index)
    const data = await control.evaluate(element => ({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      name: (element.getAttribute('aria-label') || element.innerText || element.textContent || element.getAttribute('title') || element.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim(),
      href: element.getAttribute('href') || '',
    })).catch(() => undefined)
    if (!data) continue
    if (data.tag !== descriptor.tag) continue
    if (normalize(data.name) !== normalize(descriptor.name)) continue
    return control
  }
  return undefined
}

async function closeTransientUi(page) {
  await page.keyboard.press('Escape').catch(() => undefined)
  await page.waitForTimeout(150)
}

async function isLoginPage(page) {
  if (/\/login(?:\?|$)/i.test(page.url())) return true
  const passwordField = page.locator('input[type="password"]:visible')
  const loginButton = page.locator('button:visible').filter({ hasText: /登录/ })
  return await passwordField.count().catch(() => 0) > 0 && await loginButton.count().catch(() => 0) > 0
}

async function capture(page, outputDir, filename) {
  const target = path.join(outputDir, filename)
  await page.screenshot({ path: target, animations: 'disabled', caret: 'hide' }).catch(() => undefined)
  return target
}

async function visibleOverlays(page) {
  const overlays = page.locator(OVERLAY_SELECTOR)
  const count = await overlays.count()
  const result = []
  for (let index = 0; index < count; index += 1) {
    const item = overlays.nth(index)
    const text = await item.innerText().catch(() => '')
    const role = await item.getAttribute('role').catch(() => '')
    result.push({ role, text: normalize(text).slice(0, 1000) })
  }
  return result
}

async function auditOverlayControls(page, moduleDir, parentName, result) {
  const overlays = page.locator(OVERLAY_SELECTOR)
  const overlayCount = await overlays.count()
  if (!overlayCount) return
  const overlay = overlays.nth(overlayCount - 1)
  const controls = (await collectControls(overlay)).slice(0, Number(process.env.REFERENCE_MAX_OVERLAY_CONTROLS || 24))
  for (const control of controls) {
    const interaction = { name: `${parentName} > ${control.name}`, tag: control.tag, role: control.role, status: 'pending', nested: true, screenshot: undefined, overlays: [], error: undefined }
    try {
      if (DANGEROUS.test(control.name)) {
        interaction.status = NAVIGATION_ONLY.test(control.name) ? 'skipped-navigation' : 'skipped-destructive'
        result.interactions.push(interaction)
        continue
      }
      const target = await findControl(overlay, control)
      if (!target || !await visible(target)) {
        interaction.status = 'not-found'
      } else if (control.tag === 'input' || control.tag === 'textarea') {
        await target.click({ timeout: 2000 })
        interaction.status = 'focused'
      } else if (control.tag === 'select') {
        await target.click({ timeout: 2000 })
        interaction.status = 'opened'
      } else {
        await target.click({ timeout: 2000 })
        await page.waitForTimeout(300)
        interaction.status = 'clicked'
      }
      interaction.overlays = await visibleOverlays(page)
      const number = String(result.interactions.length + 1).padStart(3, '0')
      interaction.screenshot = await capture(page, moduleDir, `${number}-nested-${slug(parentName)}-${slug(control.name)}.png`)
      result.overlays.push(...interaction.overlays)
    } catch (error) {
      interaction.status = 'failed'
      interaction.error = String(error)
      const number = String(result.interactions.length + 1).padStart(3, '0')
      interaction.screenshot = await capture(page, moduleDir, `${number}-nested-${slug(parentName)}-${slug(control.name)}-failed.png`)
    } finally {
      await closeTransientUi(page)
    }
    result.interactions.push(interaction)
  }
}

async function clickModuleEntry(page, module) {
  for (const alias of module.aliases) {
    const candidates = [
      page.getByRole('link', { name: new RegExp(`^${escapeRegExp(alias)}$`) }),
      page.getByRole('menuitem', { name: new RegExp(`^${escapeRegExp(alias)}$`) }),
      page.getByRole('button', { name: new RegExp(`^${escapeRegExp(alias)}$`) }),
    ]
    for (const candidate of candidates) {
      const count = await candidate.count().catch(() => 0)
      for (let index = 0; index < count; index += 1) {
        const item = candidate.nth(index)
        if (!await visible(item)) continue
        await item.click({ timeout: 2500 }).catch(() => undefined)
        await waitForApp(page)
        return { alias, href: page.url() }
      }
    }
  }
  return undefined
}

async function openNavigation(page) {
  const toggles = page.getByRole('button', { name: /菜单|导航|展开菜单|打开菜单/i })
  const count = await toggles.count().catch(() => 0)
  for (let index = 0; index < count; index += 1) {
    const item = toggles.nth(index)
    if (!await visible(item)) continue
    await item.click({ timeout: 1500 }).catch(() => undefined)
    await page.waitForTimeout(150)
    return
  }
}

async function auditModule(page, module, rootUrl, outputDir) {
  const moduleDir = path.join(outputDir, slug(module.key))
  await mkdir(moduleDir, { recursive: true })
  const result = {
    key: module.key,
    label: module.label,
    status: 'pending',
    entry: undefined,
    url: undefined,
    title: undefined,
    screenshots: [],
    controls: [],
    interactions: [],
    overlays: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    errors: [],
  }
  const onConsole = message => { if (message.type() === 'error') result.consoleErrors.push(message.text()) }
  const onPageError = error => result.pageErrors.push(String(error))
  const onRequestFailed = request => result.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' })
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('requestfailed', onRequestFailed)
  try {
    await page.goto(rootUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await waitForApp(page)
    if (await isLoginPage(page)) {
      result.status = 'auth-required'
      result.errors.push('当前页面处于登录页，需要提供登录后的 storageState 或 CDP 会话。')
      result.screenshots.push(await capture(page, moduleDir, 'auth-required.png'))
      return result
    }
    await openNavigation(page)
    const clicked = await clickModuleEntry(page, module)
    if (clicked) result.entry = clicked
    if (!clicked && process.env.REFERENCE_ROUTE_FALLBACK === '1') {
      const routeUrl = new URL(module.path, rootUrl).toString()
      await page.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await waitForApp(page)
      result.entry = { alias: 'route-fallback', href: routeUrl }
    }
    if (!result.entry) {
      result.status = 'missing-entry'
      result.errors.push(`未找到入口：${module.aliases.join(' / ')}`)
      result.screenshots.push(await capture(page, moduleDir, 'entry-missing.png'))
      return result
    }
    result.url = page.url()
    result.title = await page.title().catch(() => '')
    if (await isLoginPage(page)) {
      result.status = 'auth-required'
      result.errors.push('当前页面处于登录页，需要提供登录后的 storageState 或 CDP 会话。')
      result.screenshots.push(await capture(page, moduleDir, 'auth-required.png'))
      return result
    }
    result.screenshots.push(await capture(page, moduleDir, 'page.png'))
    result.overlays.push(...await visibleOverlays(page))
    result.controls = await collectControls(page)
    const limit = Number(process.env.REFERENCE_MAX_CONTROLS || 80)
    const candidates = result.controls.slice(0, limit)
    for (const control of candidates) {
      const interaction = { name: control.name, tag: control.tag, role: control.role, status: 'pending', screenshot: undefined, overlays: [], error: undefined }
      try {
        if (DANGEROUS.test(control.name)) {
          interaction.status = NAVIGATION_ONLY.test(control.name) ? 'skipped-navigation' : 'skipped-destructive'
          result.interactions.push(interaction)
          continue
        }
        await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await waitForApp(page)
        const target = await findControl(page, control)
        if (!target || !await visible(target)) {
          interaction.status = 'not-found-after-reset'
        } else if (control.tag === 'input' || control.tag === 'textarea') {
          await target.click({ timeout: 2000 })
          await page.waitForTimeout(250)
          interaction.status = 'focused'
        } else if (control.tag === 'select') {
          await target.click({ timeout: 2000 })
          await page.waitForTimeout(250)
          interaction.status = 'opened'
        } else if (control.href && !isSameOrigin(control.href, result.url)) {
          interaction.status = 'skipped-external'
        } else {
          await target.click({ timeout: 2500 })
          await waitForApp(page)
          interaction.status = 'clicked'
        }
        interaction.overlays = await visibleOverlays(page)
        const number = String(result.interactions.length + 1).padStart(3, '0')
        interaction.screenshot = await capture(page, moduleDir, `${number}-${slug(control.name)}.png`)
        result.overlays.push(...interaction.overlays)
        await auditOverlayControls(page, moduleDir, control.name, result)
      } catch (error) {
        interaction.status = 'failed'
        interaction.error = String(error)
        const number = String(result.interactions.length + 1).padStart(3, '0')
        interaction.screenshot = await capture(page, moduleDir, `${number}-${slug(control.name)}-failed.png`)
      } finally {
        await closeTransientUi(page)
      }
      result.interactions.push(interaction)
    }
    result.status = result.interactions.some(item => item.status === 'failed') ? 'completed-with-errors' : 'completed'
  } catch (error) {
    result.status = 'failed'
    result.errors.push(String(error))
    result.screenshots.push(await capture(page, moduleDir, 'module-failed.png'))
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('requestfailed', onRequestFailed)
  }
  return result
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('用法：pnpm verify:reference -- --url=https://... [--module=customers] [--output=artifacts/reference-crawl/run]')
    console.log('已登录 Chrome：设置 REFERENCE_CDP_URL=http://127.0.0.1:9222 后执行 pnpm verify:reference')
    console.log('可选环境变量：REFERENCE_STORAGE_STATE、REFERENCE_HEADLESS、REFERENCE_MAX_CONTROLS、REFERENCE_MAX_OVERLAY_CONTROLS、REFERENCE_ROUTE_FALLBACK')
    return
  }
  const cdpUrl = arg('cdp') || process.env.REFERENCE_CDP_URL
  const configuredUrl = arg('url') || process.env.REFERENCE_URL || DEFAULT_REFERENCE_URL
  const storageState = arg('storage') || process.env.REFERENCE_STORAGE_STATE
  const outputDir = path.resolve(arg('output') || process.env.REFERENCE_AUDIT_DIR || path.join('artifacts', 'reference-crawl', new Date().toISOString().replace(/[:.]/g, '-')))
  const moduleFilter = arg('module') || process.env.REFERENCE_MODULE
  const headless = process.env.REFERENCE_HEADLESS !== '0'
  const selectedModules = moduleFilter ? MODULES.filter(module => module.key === moduleFilter || module.label.includes(moduleFilter) || module.aliases.some(alias => alias.includes(moduleFilter))) : MODULES
  if (!selectedModules.length) throw new Error(`未找到模块：${moduleFilter}`)
  await mkdir(outputDir, { recursive: true })

  let browser
  let context
  let ownsBrowser = false
  if (cdpUrl) {
    browser = await chromium.connectOverCDP(cdpUrl)
    context = browser.contexts()[0] || await browser.newContext()
  } else {
    browser = await chromium.launch({ headless, channel: process.env.REFERENCE_CHANNEL || 'chrome' })
    ownsBrowser = true
    context = await browser.newContext({
      storageState: storageState && await exists(storageState) ? storageState : undefined,
      viewport: { width: 2560, height: 1431 },
    })
  }
  const page = context.pages()[0] || await context.newPage()
  const rootUrl = configuredUrl || page.url()
  if (!rootUrl || rootUrl === 'about:blank') throw new Error('CDP 当前没有可用网页，请先打开目标网站。')
  const report = {
    generatedAt: new Date().toISOString(),
    rootUrl,
    cdp: Boolean(cdpUrl),
    modules: selectedModules.map(module => ({ key: module.key, label: module.label })),
    results: [],
  }
  for (const module of selectedModules) {
    process.stdout.write(`\n[reference-crawl] ${module.label}\n`)
    const result = await auditModule(page, module, rootUrl, outputDir)
    report.results.push(result)
    process.stdout.write(`  ${result.status} controls=${result.controls.length} interactions=${result.interactions.length}\n`)
  }
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  process.stdout.write(`\n报告：${path.resolve(outputDir, 'report.json')}\n`)
  if (ownsBrowser) await browser.close()
}

main().catch(error => {
  process.stderr.write(`[reference-crawl] ${String(error)}\n`)
  process.exitCode = 1
})
