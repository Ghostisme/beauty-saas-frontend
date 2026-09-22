import type { TableColumnsType } from 'antd'
import type { RechargeReminderRecord } from '@/types/home-reminders'
import { CustomerCell, formatReminderAmount, formatReminderTime } from './ReminderCells'
import { ReminderListModal } from './ReminderListModal'
import type { ReminderDialogProps } from './ReminderListModal'

const columns: TableColumnsType<RechargeReminderRecord> = [
  { title: '会员姓名', key: 'customer', width: 220, render: (_, record) => <CustomerCell customer={record.customer} /> },
  { title: '跟踪员工', dataIndex: 'employeeName', width: 170, render: (value: string | null) => value || '—' },
  { title: '累计消费', key: 'totalSpent', width: 180, render: (_, record) => formatReminderAmount(record.totalSpent) },
  { title: '总到店次数', dataIndex: 'visitCount', width: 170 },
  { title: '所属门店', dataIndex: 'storeName', width: 240 },
  { title: '上次到店', dataIndex: 'lastVisitTime', width: 190, render: (value: string | null) => formatReminderTime(value) },
  { title: '余额不足的卡', key: 'insufficientCards', width: 240, render: (_, record) => record.insufficientCards.length ? record.insufficientCards.join('、') : '—' },
]

export function RechargeReminderModal(props: ReminderDialogProps<RechargeReminderRecord>) {
  return <ReminderListModal {...props} title="充值提醒" columns={columns} tableWidth={1410} />
}
