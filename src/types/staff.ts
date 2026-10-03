export interface StaffStore { id: number; name: string }
export interface StaffMember { id: number; nickname: string; phone?: string; positionId?: number; positionName?: string; participating: number }
export interface ShiftPeriod { start: string; end: string }
export interface StaffShift { id: number; name: string; color: string; storeIds: number[]; storeNames: string[]; periods: ShiftPeriod[] }
export interface StaffAssignment { userId: number; workDate: string; shiftId: number; shiftName: string; color: string }
export interface StaffCalendar { staff: StaffMember[]; assignments: StaffAssignment[] }
