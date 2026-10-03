export type AttendanceType = 'FIXED' | 'SCHEDULE'
export type OvertimeMode = 'AFTER_END' | 'AT_TIME'
export type PunchMethod = 'LOCATION' | 'WIFI' | 'CODE'

export interface AttendanceWorkday {
  weekday: number
  enabled: boolean
  start: string
  end: string
}

export interface AttendanceLocation {
  name: string
  address?: string
  latitude: string | number
  longitude: string | number
}

export interface AttendanceWifi {
  name: string
  macAddress: string
}

export interface AttendanceRule {
  id: number
  name: string
  attendanceType: AttendanceType
  allStores: boolean
  storeIds: number[]
  storeNames: string[]
  allEmployees: boolean
  userIds: number[]
  userNames: Record<string, string> | Record<number, string>
  workdays: AttendanceWorkday[]
  overtimeEnabled: boolean
  overtimeMode: OvertimeMode
  overtimeMinutes?: number
  overtimeStartTime?: string
  overtimeNonworkday: boolean
  punchMethod: PunchMethod
  radiusMeters: number
  locations: AttendanceLocation[]
  wifis: AttendanceWifi[]
  updateTime?: string
  updaterName?: string
}

export interface AttendanceStaff {
  id: number
  nickname: string
  phone?: string
  positionId?: number
  positionName?: string
}

export interface AttendanceConflict {
  ruleId: number
  originalRule: string
  storeNames: string[]
  employeeName: string
}
