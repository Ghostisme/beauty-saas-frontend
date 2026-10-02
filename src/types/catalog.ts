import type { PageResult } from '@/types/iam'

export type ItemKind = 'PROJECT' | 'PRODUCT' | 'CARD'
export interface CatalogItem { id: number; tenantId: number; kind: ItemKind; code: string; name: string; brand?: string; category?: string; price: number; durationMinutes?: number; unit?: string; spec?: string; description?: string; status: number; createTime: string; updateTime: string }
export interface InventoryRow { id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; unit?: string; spec?: string; quantity: number; costPrice: number; warningValue: number; shortage?: number; version: number; updateTime: string }
export type InventoryChangeType = 'IN' | 'OUT' | 'ADJUST'
export interface InventoryChangeRow { id: number; inventoryId: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; changeType: InventoryChangeType; quantity: number; unitCost: number; reason?: string; referenceNo?: string; actorId: number; createTime: string }
export interface InventoryBatchRow { id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; unit?: string; spec?: string; batchName: string; quantity?: number; productionDate?: string; expiryDate?: string; remark?: string; status: number; createTime: string; updateTime: string }
export type InventoryDocumentType = 'LIQUIDATION' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'COST_ADJUST'
export type InventoryDocumentStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export interface InventoryDocumentRow { id: number; docType: InventoryDocumentType; documentNo: string; sourceDepartmentId?: number; sourceDepartmentName?: string; targetDepartmentId?: number; targetDepartmentName?: string; documentDate: string; transferDate?: string; applicationTime?: string; operatorName?: string; creatorName?: string; status: InventoryDocumentStatus; remark?: string; createTime: string; updateTime: string }
export interface InventoryDocumentLine { id: number; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; unit?: string; spec?: string; quantity: number; unitCost: number; currentQuantity: number; remark?: string }
export interface InventoryDocumentDetail extends InventoryDocumentRow { lines: InventoryDocumentLine[] }
export interface InventoryAccountRow { id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; unit?: string; spec?: string; openingQuantity: number; inboundQuantity: number; outboundQuantity: number; endingQuantity: number; costPrice: number }
export interface CostAccountingRow {
  id: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string;
  brand?: string; category?: string; unit?: string; spec?: string;
  openingQuantity: number; openingCost: number; openingUnitCost: number;
  inboundQuantity: number; inboundCost: number; inboundUnitCost: number;
  outboundQuantity: number; outboundCost: number; outboundUnitCost: number;
  endingQuantity: number; endingCost: number; endingUnitCost: number;
}
export interface CostAccountingSummary { openingCost: number; inboundCost: number; outboundCost: number; endingCost: number }
export interface CostAccountingPage extends PageResult<CostAccountingRow> { summary: CostAccountingSummary; startDate?: string; endDate?: string }
export interface CostDetailRow {
  id: number; documentNo?: string; occurredAt: string; type: string;
  inboundQuantity: number; inboundUnitCost: number; inboundCost: number;
  outboundQuantity: number; outboundUnitCost: number; outboundCost: number;
  balanceQuantity: number; balanceUnitCost: number; balanceCost: number; remark?: string;
}
export interface CostDetailResult {
  metadata: { inventoryId: number; departmentId: number; departmentName: string; itemId: number; itemCode: string; itemName: string; brand?: string; unit?: string; startDate?: string; endDate?: string };
  records: CostDetailRow[]; total: number; page: number; pageSize: number;
  summary: { openingQuantity: number; openingUnitCost: number; openingCost: number; endingQuantity: number; endingUnitCost: number; endingCost: number };
}
export interface CostAdjustmentRecord { id: number; documentNo: string; documentDate: string; operatorName?: string; remark?: string; status: string; warehouseName?: string; creatorName?: string; createTime: string; updateTime?: string }
export interface CostAdjustmentLine { itemId: number; itemCode: string; itemName: string; brand?: string; category?: string; unit?: string; spec?: string; currentQuantity: number; costPrice: number; unitCost: number; remark?: string }
export interface InventorySettings { preventOrderOnShortage: boolean; transferAutoConfirmEnabled: boolean; transferAutoConfirmDays: number; stockAlertEnabled: boolean; stockAlertValue: number; expiryAlertEnabled: boolean; expiryAlertMonths: number; salesDeductInventory: boolean; deleteProductSyncInventory: boolean; version: number }
export type CommissionKind = 'PROJECT' | 'PRODUCT' | 'CARD' | 'STEP'
export interface CommissionRule { id?: number; itemId?: number; itemCode?: string; itemName?: string; minAmount: number; maxAmount?: number; basis: 'PERCENT' | 'AMOUNT'; rate: number; fixedAmount: number; sortOrder: number }
export interface CommissionScheme { id: number; tenantId: number; kind: CommissionKind; name: string; basis: 'PERCENT' | 'AMOUNT'; rate: number; fixedAmount: number; description?: string; status: number; version: number; rules: CommissionRule[]; createTime: string; updateTime: string }
export type CatalogPage<T> = PageResult<T>
