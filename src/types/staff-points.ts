export type PointType = 'ADD' | 'DEDUCT'
export type PointStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface StaffPointStaff {
  id: number
  nickname: string
  phone?: string
  positionId?: number
  positionName?: string
}

export interface PointRuleOption {
  value: string
  label: string
}

export interface StaffPointRecord {
  id: number
  userId: number
  employeeName: string
  employeeNo: string
  storeId: number
  storeName?: string
  submittedAt?: string
  effectiveDate?: string
  points: number
  pointType: PointType
  pointItem: string
  reason: string
  status: PointStatus
  reviewInfo?: string
  currentPoints: number
}

export interface StaffPointPage {
  records: StaffPointRecord[]
  total: number
  page: number
  pageSize: number
}
