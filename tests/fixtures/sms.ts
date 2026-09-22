import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import dayjs from 'dayjs'
import type { SmsPackage, SmsRecharge, SmsRecord, SmsSettings, SmsTemplate } from '../../src/types/sms'
import { installSession, mockProfile, session } from './auth'
import { installPlatform } from './platform'

const makeTemplate = (code: string, name: string, configKind: SmsTemplate['configKind'] = 'NONE'): SmsTemplate => ({ code, name, configKind, content: '亲爱的顾客，感谢您光临${shop_name}，详情可至会员中心查看。祝您生活愉快，欢迎下次光临～', enabled: false, version: 0 })
export function defaults(): SmsSettings {
  return { groups: [
    { key: 'transaction', title: '交易提醒', templates: [makeTemplate('CARD_RECHARGE', '储值卡-充值'), makeTemplate('CARD_EXCHANGE', '更换会员卡'), makeTemplate('CARD_OPEN', '开卡成功'), makeTemplate('OFFLINE_PAYMENT', '线下支付方式支付'), makeTemplate('MIXED_PAYMENT', '多种卡和线下支付方式支付')] },
    { key: 'appointment', title: '预约提醒', templates: [makeTemplate('APPOINTMENT_CREATED', '预约成功'), makeTemplate('APPOINTMENT_CHANGED', '预约时间修改'), makeTemplate('APPOINTMENT_CANCELLED', '取消预约'), makeTemplate('APPOINTMENT_REMINDER', '预约提醒', 'APPOINTMENT')] },
    { key: 'birthday', title: '特殊日期提醒', templates: [makeTemplate('BIRTHDAY_GREETING', '生日祝福', 'BIRTHDAY')] },
    { key: 'partner', title: '合伙人相关', templates: [makeTemplate('PARTNER_PAYOUT_SUCCEEDED', '提现成功'), makeTemplate('PARTNER_PAYOUT_FAILED', '提现失败'), makeTemplate('COUPON_RECEIVED', '获得赠券')] },
  ] }
}
export function smsRecord(id: number, tenantId = 1): SmsRecord {
  return { id, tenantId, tenantName: tenantId === 1 ? '上海美业企业' : '北京美业企业', tenantCode: tenantId === 1 ? 'company-a' : 'company-b', phone: `138${String(id).padStart(8, '0')}`, templateCode: 'CARD_OPEN', templateName: '开卡成功', content: `已成功办理会员卡${id}，欢迎下次光临`, status: 'DELIVERED', statusLabel: '送达成功', billedUnits: 1, sendTime: dayjs().format('YYYY-MM-DD') + 'T10:00:00' }
}
export async function installSms(page: Page, config: { platform?: boolean; permissions?: string[] } = {}) {
  const platform = config.platform ? await installPlatform(page) : undefined
  if (!config.platform) {
    const userInfo = { ...session.userInfo, ...(config.permissions ? { owner: false, permissions: config.permissions } : {}) }
    await installSession(page, { ...session, userInfo }); await mockProfile(page, userInfo)
  }
  const packages: SmsPackage[] = [1000, 3000, 6000, 10000, 50000].map((units, i) => ({ id: i + 1, code: `SMS_${units}`, name: `${units}条短信包`, units, price: ['68.00', '180.00', '360.00', '600.00', '2888.00'][i], version: 1 }))
  const state = { platform, fail: '', conflict: false, settings: new Map([[1, defaults()], [2, defaults()]]), rows: [] as SmsRecord[], recharges: [] as SmsRecharge[], requests: [] as { path: string; method: string; tenant?: string; params: Record<string, string>; body?: Record<string, unknown> }[] }
  await page.route(url => url.pathname === '/api/sms' || url.pathname.startsWith('/api/sms/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/sms', ''), method = req.method()
    const header = req.headers()['x-tenant-id'], tenant = config.platform ? header ? Number(header) : undefined : 1
    const body = req.postDataJSON() ?? undefined
    state.requests.push({ path, method, tenant: header, params: Object.fromEntries(url.searchParams), body })
    expect(req.headers().authorization).toBe(`Bearer ${session.token}`)
    const ok = (data: unknown) => route.fulfill({ json: { code: 200, data } })
    if (state.fail === path) return route.fulfill({ status: 503, json: { code: 503, message: 'fixture unavailable' } })
    if (path === '/status') return ok({ sendingAvailable: false, paymentAvailable: false, message: '短信发送与充值收款通道尚未接入。可保存通知设置和待支付充值单，暂不发送短信、扣款或增加余额。' })
    if (path === '/settings') return ok(state.settings.get(tenant!))
    if (path.startsWith('/settings/') && method === 'PUT') {
      const template = state.settings.get(tenant!)!.groups.flatMap(group => group.templates).find(item => item.code === path.split('/')[2])!
      if (state.conflict || template.version !== body.version) return route.fulfill({ status: 409, json: { code: 409, message: '短信设置已被其他人更新，请重新加载后保存' } })
      Object.assign(template, { ...body, version: template.version + 1 }); return ok(template)
    }
    if (path === '/billing') return ok({ balance: '0', aggregate: tenant === undefined, packages, paymentAvailable: false })
    const pageNum = Number(url.searchParams.get('page') || 1), pageSize = Number(url.searchParams.get('pageSize') || 10)
    if (path === '/records' || path === '/records/export') {
      const rows = state.rows.filter(row => (tenant === undefined || row.tenantId === tenant) && row.phone.includes(url.searchParams.get('phone') || ''))
      if (path.endsWith('/export')) return route.fulfill({ contentType: 'text/csv;charset=UTF-8', headers: { 'content-disposition': 'attachment; filename="sms-records.csv"' }, body: '\uFEFF手机号,短信内容\r\n' + rows.map(row => `${row.phone},${row.content}\r\n`).join('') })
      return ok({ records: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize), total: rows.length, page: pageNum, pageSize })
    }
    if (path === '/recharges' && method === 'GET') {
      const rows = state.recharges.filter(row => tenant === undefined || row.tenantId === tenant)
      return ok({ records: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize), total: rows.length, page: pageNum, pageSize })
    }
    if (path === '/recharges' && method === 'POST') {
      const pack = packages.find(item => item.id === body.packageId)!
      const row: SmsRecharge = { id: state.recharges.length + 1, tenantId: tenant!, tenantName: '上海美业企业', tenantCode: 'company-a', orderNo: `SMS20260922${state.recharges.length + 1}`, packageId: pack.id, packageVersion: pack.version, packageName: pack.name, units: pack.units, amount: pack.price, status: 'PENDING', version: 0, createTime: dayjs().format(), canCancel: true }
      state.recharges.unshift(row); return ok(row)
    }
    if (path.endsWith('/cancel') && method === 'POST') {
      const row = state.recharges.find(item => item.id === Number(path.split('/')[2]))!
      row.status = 'CANCELLED'; row.canCancel = false; row.version++; return ok(row)
    }
    throw new Error(`Unexpected SMS fixture request ${method} ${path}`)
  })
  return state
}
