import type { PageResult } from '@/types/iam'

export type ItemKind = 'PROJECT' | 'PRODUCT' | 'CARD'
export interface CatalogItem { id: number; tenantId: number; kind: ItemKind; code: string; name: string; brand?: string; category?: string; price: number; durationMinutes?: number; unit?: string; spec?: string; description?: string; status: number; createTime: string; updateTime: string }
export interface InventoryRow { id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; unit?: string; spec?: string; quantity: number; costPrice: number; warningValue: number; shortage?: number; version: number; updateTime: string }
export type InventoryChangeType = 'IN' | 'OUT' | 'ADJUST'
export interface InventoryChangeRow { id: number; inventoryId: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; changeType: InventoryChangeType; quantity: number; unitCost: number; reason?: string; referenceNo?: string; actorId: number; createTime: string }
export interface InventoryBatchRow { id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; unit?: string; spec?: string; batchName: string; productionDate?: string; expiryDate?: string; remark?: string; status: number; createTime: string; updateTime: string }
export type InventoryDocumentType = 'LIQUIDATION' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'COST_ADJUST'
export type InventoryDocumentStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export interface InventoryDocumentRow { id: number; docType: InventoryDocumentType; documentNo: string; sourceDepartmentId?: number; sourceDepartmentName?: string; targetDepartmentId?: number; targetDepartmentName?: string; documentDate: string; operatorName?: string; status: InventoryDocumentStatus; remark?: string; createTime: string; updateTime: string }
export interface InventoryAccountRow { id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; unit?: string; spec?: string; openingQuantity: number; inboundQuantity: number; outboundQuantity: number; endingQuantity: number; costPrice: number }
export type CommissionKind = 'PROJECT' | 'PRODUCT' | 'CARD' | 'STEP'
export interface CommissionRule { id?: number; itemId?: number; itemCode?: string; itemName?: string; minAmount: number; maxAmount?: number; basis: 'PERCENT' | 'AMOUNT'; rate: number; fixedAmount: number; sortOrder: number }
export interface CommissionScheme { id: number; tenantId: number; kind: CommissionKind; name: string; basis: 'PERCENT' | 'AMOUNT'; rate: number; fixedAmount: number; description?: string; status: number; version: number; rules: CommissionRule[]; createTime: string; updateTime: string }
export type CatalogPage<T> = PageResult<T>
