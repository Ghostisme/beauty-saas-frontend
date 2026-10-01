import type { Page } from '@playwright/test'
import { installSession, mockProfile } from './auth'

export interface CustomerFixtureRow {
  id: number
  tenantId: number
  tenantName: string
  tenantCode: string
  name: string
  phone: string
  code: string
  level: string
  cardCount: number
  cardName?: string
  balance: number
  spent: number
  visitCount: number
  lastVisit: string
  tracker?: string
  adviser?: string
  storeId?: number | null
  storeName?: string
  source?: string
  birthday?: string
  gender?: string
  joinDate?: string
  remark?: string
}

export const customerRows: CustomerFixtureRow[] = [
  { id: 1, tenantId: 1, tenantName: '上海美业企业', tenantCode: 'company-a', name: '模拟顾客A', phone: '13800000001', code: 'M001', level: '无等级', cardCount: 1, cardName: '3980会员卡', balance: 120, spent: 680, visitCount: 3, lastVisit: '2026-09-20', tracker: '负责人', storeId: 11, storeName: '上海中心店', source: '默认', gender: '女', joinDate: '2026-08-01', remark: '重点跟进' },
  { id: 2, tenantId: 1, tenantName: '上海美业企业', tenantCode: 'company-a', name: '模拟顾客B', phone: '13800000002', code: 'M002', level: '无等级', cardCount: 0, balance: 0, spent: 0, visitCount: 0, lastVisit: '', storeId: 11, storeName: '上海中心店', source: '微信', gender: '男', joinDate: '2026-08-02' },
  { id: 3, tenantId: 1, tenantName: '上海美业企业', tenantCode: 'company-a', name: '模拟顾客C', phone: '13800000003', code: 'M003', level: '无等级', cardCount: 0, balance: 0, spent: 0, visitCount: 0, lastVisit: '', storeId: null, source: '默认', gender: '女', joinDate: '2026-08-03' },
]

const stores = [{ id: 11, tenantId: 1, name: '上海中心店', code: 'MAIN', type: 'STORE', status: 1 }]
const cards = [
  { id: 101, tenantId: 1, kind: 'CARD', code: 'CARD-3980', name: '3980会员卡', price: 3980, status: 1 },
  { id: 102, tenantId: 1, kind: 'CARD', code: 'CARD-8880', name: '8880会员卡', price: 8880, status: 1 },
  { id: 103, tenantId: 1, kind: 'CARD', code: 'CARD-13800', name: '13800会员卡', price: 13800, status: 1 },
  { id: 104, tenantId: 1, kind: 'CARD', code: 'CARD-21800', name: '21800会员卡', price: 21800, status: 1 },
  { id: 105, tenantId: 1, kind: 'CARD', code: 'CARD-32800', name: '32800会员卡', price: 32800, status: 1 },
]

export async function installCustomers(page: Page) {
  await installSession(page)
  await mockProfile(page)
  await page.route(url => url.pathname === '/api/customers' || url.pathname.startsWith('/api/customers/'), async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    if (path === '/customers/storage') return route.fulfill({ json: { code: 200, data: { records: [], total: 0, page: 1, pageSize: 100 } } })
    const id = Number(path.split('/')[2])
    if (path.startsWith('/customers/') && Number.isFinite(id)) {
      const row = customerRows.find(item => item.id === id)
      return row ? route.fulfill({ json: { code: 200, data: row } }) : route.fulfill({ status: 404, json: { code: 404, message: '顾客不存在' } })
    }
    return route.fulfill({ json: { code: 200, data: { records: customerRows, total: customerRows.length, page: 1, pageSize: 100 } } })
  })
  await page.route('**/api/iam/departments**', route => route.fulfill({ json: { code: 200, data: stores } }))
  await page.route('**/api/items**', route => route.fulfill({ json: { code: 200, data: { records: cards, total: cards.length, page: 1, pageSize: 100 } } }))
}
