import type { TableColumnsType } from 'antd'
import type { MembershipExpiryReminderRecord } from '@/types/home-reminders'
import { CustomerCell, formatReminderTime } from './ReminderCells'
import { ReminderListModal } from './ReminderListModal'
import type { ReminderDialogProps } from './ReminderListModal'

const columns: TableColumnsType<MembershipExpiryReminderRecord> = [
  { title: '顾客信息', key: 'customer', width: 240, render: (_, record) => <CustomerCell customer={record.customer} /> },
  { title: '卡名称', dataIndex: 'cardName', width: 200 },
  { title: '到期时间', key: 'expiresAt', width: 240, render: (_, record) => formatReminderTime(record.expiresAt) },
]

export function MembershipExpiryReminderModal(props: ReminderDialogProps<MembershipExpiryReminderRecord>) {
  return <ReminderListModal {...props} title="会员卡到期" columns={columns} tableWidth={680} />
}
