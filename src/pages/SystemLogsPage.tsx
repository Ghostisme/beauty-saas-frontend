import { App, Button, DatePicker, Input, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { GoalEmpty } from '@/components/GoalEmpty'
import { useAuth } from '@/context/AuthContext'
import '@/styles/data-reports.css'

type LogRow = { key: string; [key: string]: string }

const columns: ColumnsType<LogRow> = [
  { title: '操作时间', dataIndex: 'time', key: 'time', width: 170 },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 140 },
  { title: '操作模块', dataIndex: 'module', key: 'module', width: 150 },
  { title: '操作内容', dataIndex: 'content', key: 'content', width: 300 },
  { title: '操作结果', dataIndex: 'result', key: 'result', width: 120 },
]

export default function SystemLogsPage() {
  const { session, can } = useAuth()
  const { message } = App.useApp()
  if (!session?.userInfo.platformAdmin && !can('home:read')) return <div className="data-reports-page"><div className="data-reports-card">暂无系统日志权限</div></div>

  return <section className="data-reports-page" aria-label="系统日志">
    <div className="data-reports-nav"><strong className="system-logs-title">系统日志</strong><Button type="primary" onClick={() => message.info('日志导出接口待接入')}>导出日志</Button></div>
    <div className="data-reports-card">
      <div className="data-report-toolbar system-logs-toolbar">
        <DatePicker.RangePicker aria-label="日志日期范围" defaultValue={[dayjs().startOf('month'), dayjs()]} format="YYYY-MM-DD" allowClear={false} />
        <Select aria-label="日志模块" placeholder="全部模块" options={[{ value: 'login', label: '登录日志' }, { value: 'user', label: '用户管理' }, { value: 'report', label: '数据报表' }]} />
        <Input aria-label="搜索操作人" placeholder="请输入操作人" suffix={<SearchOutlined />} allowClear />
        <Button type="primary">查询</Button>
      </div>
      <div className="data-report-table-wrap">
        <Table<LogRow> rowKey="key" columns={columns} dataSource={[]} pagination={false} scroll={{ x: 900 }} locale={{ emptyText: <div className="data-report-empty"><GoalEmpty /><span>暂无相关数据</span></div> }} />
      </div>
    </div>
  </section>
}
