export interface LoginCredentials {
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  nickname?: string | null
  avatar?: string | null
}

export interface AuthSession {
  token: string
  userInfo: UserInfo
}

