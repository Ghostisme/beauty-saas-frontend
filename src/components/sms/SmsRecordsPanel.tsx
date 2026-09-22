import { useState } from 'react'
import { Button, DatePicker, Input, Pagination, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { smsRecordsPath, useSmsQuery } from '@/api/sms'
import { GoalEmpty } from '@/components/GoalEmpty'
import { QueryError } from '@/components/iam/shared'
import type { PageResult } from '@/types/iam'
import type { SmsRecord, SmsRecordFilters } from '@/types/sms'

export function initialSmsFilters(): SmsRecordFilters {
  return { phone: '', startDate: dayjs().startOf('month').format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD'), page: 1, pageSize: 10 }
}
export function smsDate(value?: string) { return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—' }

export function SmsRecordsPanel({ filters, onFilters, tenantId, platform }: { filters: SmsRecordFilters; onFilters: (filters: SmsRecordFilters) => void; tenantId?: number; platform: boolean }) {
  const query = useSmsQuery<PageResult<SmsRecord>>(smsRecordsPath(filters), tenantId)
  const [draft, setDraft] = useState(filters.phone)
  const [validation, setValidation] = useState('')
  const rows = query.data?.records ?? []
  function search(value: string) {
    if (!/^[0-9+ -]{0,30}$/.test(value.trim())) { setValidation('请输入手机号，仅支持数字、加号、空格和连字符'); return }
    setValidation(''); onFilters({ ...filters, phone: value.trim(), page: 1 })
  }
  const columns: ColumnsType<SmsRecord> = [
    ...(platform && tenantId === undefined ? [{ title: '所属企业', dataIndex: 'tenantName', width: 160 }] : []),
    { title: '手机号', dataIndex: 'phone', width: 145 },
    { title: '短信类型', dataIndex: 'templateName', width: 170 },
    { title: '短信内容', dataIndex: 'content', width: 380, render: value => <span className="sms-record-content">{value}</span> },
    { title: '发送时间', dataIndex: 'sendTime', width: 180, render: smsDate },
    { title: '发送状态', key: 'status', width: 140, render: (_, row) => <Tag color={row.status === 'DELIVERED' ? 'success' : row.status === 'FAILED' ? 'error' : row.status === 'SUBMITTED' ? 'processing' : 'default'}>{row.statusLabel}</Tag> },
    { title: '计费条数', dataIndex: 'billedUnits', width: 100, align: 'right' },
    { title: '失败原因', dataIndex: 'failureReason', width: 230, render: value => value || '—' },
  ]
  return <section className="sms-records-card" aria-label="短信发送记录列表">
    <div className="sms-record-filters">
      <div className="sms-phone-filter"><Input.Search aria-label="搜索手机号" placeholder="输入手机号" maxLength={30} value={draft} allowClear status={validation ? 'error' : undefined} onChange={event => { setDraft(event.target.value); if (!event.target.value) search('') }} onSearch={search} />{validation && <span role="alert" className="sms-field-error">{validation}</span>}</div>
      <div className="sms-date-filter"><Button onClick={() => { const current = initialSmsFilters(); onFilters({ ...filters, startDate: current.startDate, endDate: current.endDate, page: 1 }) }}>本月</Button><DatePicker.RangePicker aria-label="短信发送日期范围" value={[dayjs(filters.startDate), dayjs(filters.endDate)]} format="YYYY/MM/DD" allowClear={false} inputReadOnly onChange={dates => { if (dates?.[0] && dates[1]) onFilters({ ...filters, startDate: dates[0].format('YYYY-MM-DD'), endDate: dates[1].format('YYYY-MM-DD'), page: 1 }) }} classNames={{ popup: { root: 'responsive-range-popup' } }} /></div>
      <Button className="sms-refresh" loading={query.loading} onClick={query.reload}>刷新</Button>
    </div>
    {query.loading && <div className="sms-state" role="status"><Spin /><span>正在加载发送记录</span></div>}
    <QueryError error={query.error} onRetry={query.reload} />
    {!query.loading && !query.error && (rows.length ? <>
      <Table<SmsRecord> aria-label="短信发送记录" rowKey="id" columns={columns} dataSource={rows} pagination={false} size="middle" scroll={{ x: platform && tenantId === undefined ? 1500 : 1340 }} />
    </> : <div className="sms-state"><GoalEmpty /><span>暂无数据</span></div>)}
    {!query.error && !query.loading && <div className="sms-table-footer"><span>共 {query.data?.total ?? 0} 条记录</span><Pagination size="small" current={filters.page} pageSize={filters.pageSize} total={query.data?.total ?? 0} hideOnSinglePage={query.data?.total === 0} showSizeChanger pageSizeOptions={[10, 20, 50, 100]} onChange={(page, pageSize) => onFilters({ ...filters, page: filters.pageSize !== pageSize ? 1 : page, pageSize })} /></div>}
  </section>
}
