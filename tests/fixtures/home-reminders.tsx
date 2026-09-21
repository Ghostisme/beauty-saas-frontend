// Browser-test fixture, imported only by Playwright through Vite. Never imported by production src/.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { PreferencesProvider } from '../../src/context/PreferencesContext'
import { BirthdayReminderModal } from '../../src/components/home-reminders/BirthdayReminderModal'
import { PendingAppointmentReminderModal } from '../../src/components/home-reminders/PendingAppointmentReminderModal'
import { InactiveCardReminderModal } from '../../src/components/home-reminders/InactiveCardReminderModal'
import { MembershipExpiryReminderModal } from '../../src/components/home-reminders/MembershipExpiryReminderModal'
import { RechargeReminderModal } from '../../src/components/home-reminders/RechargeReminderModal'

type Kind = 'birthday' | 'booking' | 'absent' | 'expiry' | 'balance'
type State = 'rows' | 'loading' | 'error'
let root: Root | undefined
let host: HTMLDivElement | undefined

function Fixture({ kind, initialState }: { kind: Kind, initialState: State }) {
  const [open, setOpen] = useState(true)
  const [state, setState] = useState(initialState)
  const props = {
    open,
    onClose: () => setOpen(false),
    loading: state === 'loading',
    error: state === 'error' ? '测试服务暂时不可用' : undefined,
    onRetry: () => setState('rows'),
  }
  const customer = { name: '测试顾客', phone: '13800000000' }
  if (kind === 'birthday') return <BirthdayReminderModal {...props} records={[
    { id: 'birthday-1', customer, dateType: '公历', date: '2026-09-21' },
  ]} />
  if (kind === 'booking') return <PendingAppointmentReminderModal {...props} records={[
    { id: 'booking-1', customer, projects: ['补水护理', '肩颈护理'], appointmentTime: '2026-09-21T10:30:00', employeeName: '测试美容师' },
  ]} />
  if (kind === 'absent') return <InactiveCardReminderModal {...props} records={[
    { id: 'absent-1', customer, lastVisitTime: '2026-08-21T15:30:00' },
  ]} />
  if (kind === 'expiry') return <MembershipExpiryReminderModal {...props} records={[
    { id: 'expiry-1', customer, cardName: '测试护理年卡', expiresAt: '2026-09-30T23:59:00' },
  ]} />
  return <RechargeReminderModal {...props} records={[
    { id: 'balance-1', customer, employeeName: '测试美容师', totalSpent: 1280.5, visitCount: 12, storeName: '测试门店' },
  ]} />
}

export function mountReminderFixture(kind: Kind, state: State = 'rows') {
  root?.unmount()
  host?.remove()
  host = document.createElement('div')
  host.dataset.testFixture = 'home-reminders'
  document.body.appendChild(host)
  root = createRoot(host)
  root.render(<ConfigProvider locale={zhCN}><PreferencesProvider><Fixture kind={kind} initialState={state} /></PreferencesProvider></ConfigProvider>)
}
