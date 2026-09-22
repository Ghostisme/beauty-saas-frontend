export type OrderTab = 'all' | 'pending' | 'balance'
export type SearchType = 'CUSTOMER' | 'ORDER' | 'STAFF'
export interface OrderOption { value: string; label: string }
export interface OrderOptions { consumptionTypes: OrderOption[]; paymentMethods: OrderOption[] }
export interface OrderStore { id: number; name: string; code: string; status: number; tenantId: number; tenantName: string; tenantCode: string }
export interface OrderItem { id: number; consumptionType: string; name: string; quantity: string; unitPrice: string; amount: string }
export interface OrderStaff { id: number; staffName: string; staffPhone?: string; staffCode?: string }
export interface OrderPayment { id: number; method: string; category: string; amount: string }
export interface OrderRow {
  id: number
  tenantId: number
  tenantCode: string
  tenantName: string
  tenantStatus: number
  storeId: number
  storeName: string
  orderNo: string
  status: 'PENDING' | 'CONFIRMED'
  consumptionType: string
  customerName: string
  customerPhone?: string
  customerCode?: string
  orderTime: string
  totalAmount: string
  paidAmount: string
  outstandingAmount: string
  version: number
  verified: boolean
  verificationEnabled: boolean
  canVerify: boolean
  reviewedAt?: string
  remark?: string
  items: OrderItem[]
  staff: OrderStaff[]
  payments?: OrderPayment[]
}
export interface VerificationSettings { enabled: boolean; recheckAfterPerformanceChange: boolean; version: number }
export interface OrderFilters {
  searchType: SearchType
  keyword: string
  startDate?: string
  endDate?: string
  storeId?: number
  consumptionType?: string
  paymentMethod?: string
  verification?: string
  sortBy: 'orderNo' | 'orderTime'
  sortDirection: 'asc' | 'desc'
  page: number
  pageSize: number
}
