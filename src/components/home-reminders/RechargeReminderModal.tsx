import type { TableColumnsType } from 'antd'
import type { RechargeReminderRecord } from '@/types/home-reminders'
import { CustomerCell, formatReminderAmount } from './ReminderCells'
import { ReminderListModal } from './ReminderListModal'
import type { ReminderDialogProps } from './ReminderListModal'

// Only the columns visible in the reference are included until the remaining headings are confirmed.
const columns: TableColumnsType<RechargeReminderRecord> = [
  { title: '会员姓名', key: 'customer', width: 220, render: (_, record) => <CustomerCell customer={record.customer} /> },
  { title: '跟踪员工', dataIndex: 'employeeName', width: 170, render: (value: string | null) => value || '—' },
  { title: '累计消费', key: 'totalSpent', width: 180, render: (_, record) => formatReminderAmount(record.totalSpent) },
  { title: '总到店次数', dataIndex: 'visitCount', width: 170 },
  { title: '所属门店', dataIndex: 'storeName', width: 240 },
]

export function RechargeReminderModal(props: ReminderDialogProps<RechargeReminderRecord>) {
  return <ReminderListModal {...props} title="充值提醒" columns={columns} tableWidth={980} />
}
