import dayjs from 'dayjs'
import type { ReminderCustomer } from '@/types/home-reminders'

export function CustomerCell({ customer }: { customer: ReminderCustomer }) {
  return (
    <div className="reminder-customer">
      <span>{customer.name || '—'}</span>
      {customer.phone && <span className="reminder-customer-phone">{customer.phone}</span>}
    </div>
  )
}

export function formatReminderTime(value: string | null) {
  if (!value) return '—'
  const time = dayjs(value)
  return time.isValid() ? time.format('YYYY-MM-DD HH:mm') : '—'
}

export function formatReminderAmount(value: number) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value)
    : '—'
}
