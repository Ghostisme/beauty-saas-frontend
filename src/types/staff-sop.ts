export type SopFrequency = 'DAILY' | 'WEEKLY' | 'SEMIMONTHLY' | 'MONTHLY'
export type SopResultMode = 'COMPLETE' | 'NUMBER' | 'TEXT'
export interface SopSubitem { key: string; name: string }
export interface SopItem { key: string; name: string; frequency: SopFrequency; subitems: SopSubitem[] }
export interface SopRule {
  id: number
  name: string
  allPositions: boolean
  positionIds: number[]
  positionNames: string[]
  items: SopItem[]
  updateTime: string
  updaterName?: string
}
export interface SopRow { ruleId: number; leafKey: string; itemName: string; subitemName: string; frequency: SopFrequency }
export interface SopStaff { id: number; nickname: string; positionId?: number; positionName?: string; rows: SopRow[] }
export interface SopCheck { userId: number; workDate: string; ruleId: number; leafKey: string; resultMode: SopResultMode; resultValue: string | null }
export interface SopMonthly { staff: SopStaff[]; checks: SopCheck[] }
