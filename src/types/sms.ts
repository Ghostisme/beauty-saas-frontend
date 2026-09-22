export type SmsTab = 'settings' | 'records' | 'billing'
export interface SmsStatus { sendingAvailable: boolean; paymentAvailable: boolean; message: string }
export interface ReminderConfig {
  leadMinutes?: number
  advanceDays?: number
  sendTime?: string
  visitNote?: string
  benefitNote?: string
  customBenefitEnabled?: boolean
}
export interface SmsTemplate {
  code: string
  name: string
  content: string
  configKind: 'NONE' | 'APPOINTMENT' | 'BIRTHDAY'
  enabled: boolean
  version: number
  config?: ReminderConfig
}
export interface SmsSettings { groups: { key: string; title: string; templates: SmsTemplate[] }[] }
export interface SmsRecordFilters { phone: string; startDate: string; endDate: string; page: number; pageSize: number }
export interface SmsRecord {
  id: number
  tenantId: number
  tenantName: string
  tenantCode: string
  phone: string
  templateCode: string
  templateName: string
  content: string
  status: string
  statusLabel: string
  billedUnits: number
  sendTime: string
  deliveredTime?: string
  failureReason?: string
}
export interface SmsPackage { id: number; code: string; name: string; units: number; price: string; version: number }
export interface SmsBilling { balance: string; aggregate: boolean; paymentAvailable: boolean; packages: SmsPackage[] }
export interface SmsRecharge {
  id: number
  tenantId: number
  tenantName: string
  tenantCode: string
  orderNo: string
  packageId: number
  packageVersion: number
  packageName: string
  units: number
  amount: string
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  version: number
  createTime: string
  paidTime?: string
  cancelledTime?: string
  canCancel: boolean
}
