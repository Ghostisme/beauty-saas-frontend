export interface LoginCredentials {
  tenantCode?: string
  loginType?: 'PLATFORM' | 'TENANT'
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  nickname?: string | null
  phone?: string | null
  avatar?: string | null
  tenantId: number
  tenantCode: string
  tenantName: string
  owner: boolean
  platformAdmin: boolean
  permissions: string[]
}

export interface AuthSession {
  token: string
  userInfo: UserInfo
}
