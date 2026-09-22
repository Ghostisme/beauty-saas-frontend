export interface PageResult<T> { records: T[]; total: number; page: number; pageSize: number }
export interface TenantInfo { id: number; code: string; name: string; status: number; adminUsername: string; adminName: string; createTime: string }
export interface Department { id: number; parentId: number; code: string; name: string; type: 'STORE' | 'DEPARTMENT'; sortOrder: number; status: number; children?: Department[] }
export interface Room { id: number; departmentId: number; departmentName: string; code: string; name: string; capacity: number; status: number; remark?: string }
export interface Role { id: number; code: string; name: string; builtin: number; status: number; description?: string; permissionCodes: string[] }
export interface RoleGrant { roleId: number; departmentId: number; roleName?: string; departmentName?: string }
export interface ManagedUser { id: number; username: string; nickname: string; phone?: string; email?: string; status: number; owner: boolean; departmentIds: number[]; departments: { id: number; name: string }[]; roleGrants: RoleGrant[]; createTime: string }
export interface Permission { code: string; name: string; module: string }
export interface IamOptions { departments: Department[]; roles: Role[]; permissions: Permission[]; companyPermissions: string[]; roomDepartmentIds: number[] }
export type ResourceKind = 'users' | 'departments' | 'rooms' | 'roles'
