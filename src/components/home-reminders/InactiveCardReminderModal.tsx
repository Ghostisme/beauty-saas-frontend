import type { TableColumnsType } from 'antd'
import type { InactiveCardReminderRecord } from '@/types/home-reminders'
import { CustomerCell, formatReminderTime } from './ReminderCells'
import { ReminderListModal } from './ReminderListModal'
import type { ReminderDialogProps } from './ReminderListModal'

const columns: TableColumnsType<InactiveCardReminderRecord> = [
  { title: '顾客信息', key: 'customer', width: 240, render: (_, record) => <CustomerCell customer={record.customer} /> },
  { title: '时间', key: 'lastVisitTime', width: 240, render: (_, record) => formatReminderTime(record.lastVisitTime) },
]

export function InactiveCardReminderModal(props: ReminderDialogProps<InactiveCardReminderRecord>) {
  return <ReminderListModal {...props} title="持卡未到店" columns={columns} tableWidth={480} />
}
