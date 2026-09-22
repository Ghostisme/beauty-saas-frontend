export interface Enterprise {
  id: number; code: string; name: string; status: number; createTime: string
  adminUserId?: number; adminUsername?: string; adminName?: string; adminPhone?: string
  userCount: number; departmentCount: number; roomCount: number
}
export interface PlatformSummary { tenants: number; users: number; departments: number; rooms: number }
export interface PlatformDataRow {
  id: number; tenantId: number; tenantCode: string; tenantName: string; tenantStatus: number; status: number
  name?: string; code?: string; username?: string; nickname?: string; phone?: string; email?: string; owner?: boolean
  departmentNames?: string[]; roleNames?: string[]; parentName?: string; type?: string
  departmentName?: string; capacity?: number; remark?: string; description?: string; permissionCodes?: string[]
}
