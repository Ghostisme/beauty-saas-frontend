import type { TableColumnsType } from 'antd'
import type { BirthdayReminderRecord } from '@/types/home-reminders'
import { CustomerCell } from './ReminderCells'
import { ReminderListModal } from './ReminderListModal'
import type { ReminderDialogProps } from './ReminderListModal'

const columns: TableColumnsType<BirthdayReminderRecord> = [
  { title: '顾客信息', key: 'customer', width: 240, render: (_, record) => <CustomerCell customer={record.customer} /> },
  { title: '日期类型', dataIndex: 'dateType', width: 180 },
  { title: '时间', dataIndex: 'date', width: 200 },
]

export function BirthdayReminderModal(props: ReminderDialogProps<BirthdayReminderRecord>) {
  return <ReminderListModal {...props} title="顾客生日" columns={columns} tableWidth={620} />
}
