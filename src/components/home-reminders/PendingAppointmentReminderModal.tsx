import type { TableColumnsType } from 'antd'
import type { PendingAppointmentReminderRecord } from '@/types/home-reminders'
import { CustomerCell, formatReminderTime } from './ReminderCells'
import { ReminderListModal } from './ReminderListModal'
import type { ReminderDialogProps } from './ReminderListModal'

const columns: TableColumnsType<PendingAppointmentReminderRecord> = [
  { title: '顾客信息', key: 'customer', width: 240, render: (_, record) => <CustomerCell customer={record.customer} /> },
  { title: '预约项目', key: 'projects', width: 220, render: (_, record) => record.projects.join('、') || '—' },
  { title: '预约时间', key: 'appointmentTime', width: 200, render: (_, record) => formatReminderTime(record.appointmentTime) },
  { title: '预约员工', dataIndex: 'employeeName', width: 160, render: (value: string | null) => value || '—' },
]

export function PendingAppointmentReminderModal(props: ReminderDialogProps<PendingAppointmentReminderRecord>) {
  return <ReminderListModal {...props} title="待确认预约" columns={columns} width={1100} tableWidth={820} />
}
