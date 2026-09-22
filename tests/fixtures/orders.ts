import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import dayjs from 'dayjs'
import type { OrderOptions, OrderRow, VerificationSettings } from '../../src/types/orders'
import { installSession, mockProfile, session } from './auth'
import { installPlatform } from './platform'

const consume = ['SERVICE:项目', 'PRODUCT:产品', 'OPEN_CARD:开卡', 'CARD_RECHARGE:卡充值', 'CARD_EXCHANGE:卡换卡', 'ORDER_REFUND:退单', 'CARD_REFUND:退卡', 'CROSS_STORE:跨店消费', 'SUPPLEMENT:补录单', 'MEITUAN_REDEEM:美团团购核销', 'CAMPAIGN_REDEEM:营销活动核销', 'ADDITIONAL_PAYMENT:补款单', 'DOUYIN_REDEEM:抖音团购核销', 'BALANCE_SETTLEMENT:尾款还清', 'PARTIAL_REFUND:退部分单']
const pay = ['RECEIPT:实收类', 'CARD_CONSUMPTION:卡耗类', 'OTHER:非实收非卡耗类', 'CARD_BUY_CARD:卡买卡', 'DEBT:欠款', 'WALLET:钱包', 'ALIPAY:支付宝', 'POS:POS', 'SHOUQIANBA:收钱吧', 'GIFT:赠送', 'CAMPAIGN:营销活动', 'POINTS:积分抵现', 'MEMBER_BENEFIT:通用会员权益', 'DOUYIN:抖音团购', 'MEITUAN:美团团购', 'CASH:现金', 'CARD_GIFT_BENEFIT:卡赠送权益', 'WAIVER:减免', 'MEMBERSHIP_CARD:会员卡', 'GIFT_REDEEM:赠品核销', 'GIFT_CREDIT:赠送消费金', 'WECHAT:微信', 'COUPON:券核销', 'CONTENT_REDEEM:营销内容核销']
const options = (values: string[]) => values.map(value => { const [code, label] = value.split(':'); return { value: code, label } })
export const orderOptions: OrderOptions = { consumptionTypes: options(consume), paymentMethods: options(pay) }
export function sampleOrder(id = 1, tenantId = 1): OrderRow {
  return { id, tenantId, tenantCode: tenantId === 1 ? 'company-a' : 'company-b', tenantName: tenantId === 1 ? '上海美业企业' : '北京美业企业', tenantStatus: 1, storeId: tenantId === 1 ? 11 : 21, storeName: tenantId === 1 ? '上海中心店' : '北京中心店', orderNo: `DD20260922${String(id).padStart(4, '0')}`, status: 'CONFIRMED', consumptionType: 'SERVICE', customerName: `测试顾客${id}`, customerPhone: '13800000000', customerCode: `VIP${id}`, orderTime: `${dayjs().format('YYYY-MM-DD')}T10:30:00`, totalAmount: '100.30', paidAmount: '60.10', outstandingAmount: '40.20', version: 0, verified: false, verificationEnabled: true, canVerify: true, items: [{ id: 1, consumptionType: 'SERVICE', name: '面部护理', quantity: '1.00', unitPrice: '100.30', amount: '100.30' }], staff: [{ id: 1, staffName: '测试美容师', staffCode: 'EMP001' }], payments: [{ id: 1, method: 'WECHAT', category: 'RECEIPT', amount: '60.10' }] }
}

export async function installOrders(page: Page, config: { platform?: boolean; empty?: boolean; permissions?: string[] } = {}) {
  if (config.platform) await installPlatform(page)
  else {
    const userInfo = { ...session.userInfo, ...(config.permissions ? { owner: false, permissions: config.permissions } : {}) }
    await installSession(page, { ...session, userInfo }); await mockProfile(page, userInfo)
  }
  const state = {
    rows: config.empty ? [] as OrderRow[] : [sampleOrder(), { ...sampleOrder(2), status: 'PENDING' as const, canVerify: false }, sampleOrder(3, 2)],
    settings: new Map<number, VerificationSettings>([[1, { enabled: true, recheckAfterPerformanceChange: true, version: 0 }], [2, { enabled: true, recheckAfterPerformanceChange: true, version: 0 }]]),
    fail: '', conflict: false,
    requests: [] as { method: string; path: string; tenant?: string; params: Record<string, string>; body?: Record<string, unknown> }[],
  }
  await page.route(url => url.pathname === '/api/orders' || url.pathname.startsWith('/api/orders/'), async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/orders', '') || '/', method = request.method()
    const tenantHeader = request.headers()['x-tenant-id'], tenant = config.platform ? (tenantHeader ? Number(tenantHeader) : undefined) : 1
    const body = request.postDataJSON() ?? undefined
    state.requests.push({ method, path, tenant: tenantHeader, params: Object.fromEntries(url.searchParams), body })
    expect(request.headers().authorization).toBe(`Bearer ${session.token}`)
    const respond = (data: unknown = null) => route.fulfill({ json: { code: 200, data } })
    if (state.fail === path) return route.fulfill({ status: 503, json: { code: 503, message: 'fixture unavailable' } })
    if (path === '/options') return respond(orderOptions)
    if (path === '/stores') {
      const records = [{ id: 11, tenantId: 1, name: '上海中心店', code: 'MAIN', status: 1, tenantName: '上海美业企业', tenantCode: 'company-a' }, { id: 21, tenantId: 2, name: '北京中心店', code: 'MAIN', status: 1, tenantName: '北京美业企业', tenantCode: 'company-b' }].filter(store => (tenant === undefined || store.tenantId === tenant) && store.name.includes(url.searchParams.get('keyword') ?? ''))
      return respond({ records, total: records.length, page: 1, pageSize: 100 })
    }
    if (path === '/verification-settings') {
      if (tenant === undefined) return route.fulfill({ status: 400, json: { code: 400, message: '请先选择要管理的企业' } })
      const setting = state.settings.get(tenant)!
      if (method === 'GET') return respond(setting)
      if (state.conflict || setting.version !== body.version) return route.fulfill({ status: 409, json: { code: 409, message: '设置已被其他人更新，请重新加载后保存' } })
      state.settings.set(tenant, { enabled: body.enabled, recheckAfterPerformanceChange: body.recheckAfterPerformanceChange, version: setting.version + 1 })
      return respond(state.settings.get(tenant))
    }
    let records = state.rows.filter(row => tenant === undefined || row.tenantId === tenant)
    const id = Number(path.split('/')[1]), row = records.find(item => item.id === id)
    if (path.endsWith('/verification') && row && method === 'POST') { row.verified = body.verified; row.version += 1; return respond() }
    if (path !== '/') return row ? respond(row) : route.fulfill({ status: 404, json: { code: 404, message: '订单不存在' } })
    const p = url.searchParams, tab = p.get('tab')
    records = records.filter(row => row.status === (tab === 'pending' ? 'PENDING' : 'CONFIRMED'))
    if (tab === 'balance') records = records.filter(row => row.outstandingAmount !== '0.00')
    if (p.get('keyword')) records = records.filter(row => (p.get('searchType') === 'ORDER' ? row.orderNo : p.get('searchType') === 'STAFF' ? row.staff.map(person => `${person.staffName} ${person.staffCode}`).join() : `${row.customerName} ${row.customerPhone} ${row.customerCode}`).includes(p.get('keyword')!))
    if (p.get('storeId')) records = records.filter(row => row.storeId === Number(p.get('storeId')))
    if (p.get('consumptionType')) records = records.filter(row => row.consumptionType === p.get('consumptionType'))
    if (p.get('paymentMethod')) records = records.filter(row => row.payments?.some(payment => payment.method === p.get('paymentMethod') || payment.category === p.get('paymentMethod')))
    if (p.get('verification')) records = records.filter(row => row.verified === (p.get('verification') === 'VERIFIED'))
    const field = p.get('sortBy') === 'orderNo' ? 'orderNo' : 'orderTime'
    records.sort((a, b) => a[field].localeCompare(b[field]) * (p.get('sortDirection') === 'asc' ? 1 : -1))
    const pageNumber = Number(p.get('page') || 1), pageSize = Number(p.get('pageSize') || 10)
    return respond({ records: records.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: records.length, page: pageNumber, pageSize })
  })
  return state
}
