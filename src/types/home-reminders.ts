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
