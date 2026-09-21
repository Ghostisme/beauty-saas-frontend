export interface ReminderCustomer {
  name: string
  phone?: string | null
}

export interface BirthdayReminderRecord {
  id: string | number
  customer: ReminderCustomer
  dateType: string
  date: string
}

export interface PendingAppointmentReminderRecord {
  id: string | number
  customer: ReminderCustomer
  projects: string[]
  appointmentTime: string
  employeeName: string | null
}

export interface InactiveCardReminderRecord {
  id: string | number
  customer: ReminderCustomer
  lastVisitTime: string | null
}

export interface MembershipExpiryReminderRecord {
  id: string | number
  customer: ReminderCustomer
  cardName: string
  expiresAt: string | null
}

export interface RechargeReminderRecord {
  id: string | number
  customer: ReminderCustomer
  employeeName: string | null
  totalSpent: number
  visitCount: number
  storeName: string
}
