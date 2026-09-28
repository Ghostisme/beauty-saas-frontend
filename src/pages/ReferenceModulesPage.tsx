import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { App, Button, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { downloadCsvRows } from '@/lib/reportCsv'
import '@/styles/reference-modules.css'

type ModuleKind = 'marketing' | 'billing' | 'bookkeeping' | 'targets'
type BillingRow = { key: string; customer: string; orderNo: string; orderTime: string; content: string; staff: string; total: string }
type BookkeepingRow = { key: string; type: string; amount: number; payer: string; date: string; remark: string }

const marketingCards = [
  ['在线拼团', '创建在线拼团活动，支持1-5人团。支持虚拟团、私密团。'],
  ['限时秒杀', '限时限量抢购，低价抢客、回馈老客工具。'],
  ['抽奖/大转盘', '大转盘抽奖工具，老客激活、新客裂变等。'],
  ['大牌盲盒抽奖', '大牌盲盒抽奖，100%中奖。支持付费抽取。'],
  ['组合活动', '多个活动组合成一个链接推广'],
  ['组队接龙', '多人组队分享更多福利，支持购买后抽奖'],
  ['消费股东', '支持二级分销，分门店构架消费型股东'],
  ['智能送券', '满足N选X领券与周期性发券'],
] as const

function ModuleHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="reference-module-header"><div className="reference-module-tabs">{children}</div>{actions}</div>
}

function MarketingPage() {
  const [preview, setPreview] = useState<string>()
  const [active, setActive] = useState<string>()
  return <section className="reference-page" aria-label="营销">
    <div className="marketing-grid">{marketingCards.map(([title, description]) => <article className="marketing-card" key={title}>
      <div className="marketing-card-content"><div className="marketing-icon" aria-hidden>{title.slice(0, 1)}</div><div><h2>{title}</h2><p>{description}</p></div></div>
      <div className="marketing-card-actions">{title !== '消费股东' && title !== '智能送券' && <Button onClick={() => setPreview(title)}>查看示例活动</Button>}<Button type="primary" ghost onClick={() => setActive(title)}>立即使用</Button></div>
    </article>)}</div>
    <Modal title={preview ? `${preview}示例活动` : ''} open={Boolean(preview)} onCancel={() => setPreview(undefined)} footer={<Button type="primary" onClick={() => setPreview(undefined)}>知道了</Button>}>当前为示例活动预览，活动内容按企业配置展示。</Modal>
    <Modal title={active ? `立即使用${active}` : ''} open={Boolean(active)} onCancel={() => setActive(undefined)} footer={<Button type="primary" onClick={() => setActive(undefined)}>保存</Button>}><p>请在企业范围内配置活动内容后发布。</p></Modal>
  </section>
}

function BillingPage() {
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [rows, setRows] = useState<BillingRow[]>([])
  const [form] = Form.useForm<{ customer: string; content: string; staff: string; total: number }>()
  const filtered = useMemo(() => keyword.trim() ? rows.filter(row => `${row.customer}${row.orderNo}`.includes(keyword.trim())) : rows, [keyword, rows])
  const columns: ColumnsType<BillingRow> = [
    { title: '顾客信息', dataIndex: 'customer', width: 180 }, { title: '订单编号', dataIndex: 'orderNo', width: 180 }, { title: '订单时间', dataIndex: 'orderTime', width: 170 }, { title: '订单内容', dataIndex: 'content', width: 260 }, { title: '服务人员', dataIndex: 'staff', width: 160 }, { title: '订单合计', dataIndex: 'total', width: 120 }, { title: '操作', key: 'actions', width: 120, render: () => <Button type="link" onClick={() => void message.info('订单详情将在当前订单模块展示')}>详情</Button> },
  ]
  const save = async () => { const values = await form.validateFields(); setRows(current => [{ key: `${Date.now()}`, customer: values.customer, orderNo: `ORDER-${Date.now()}`, orderTime: dayjs().format('YYYY-MM-DD HH:mm'), content: values.content, staff: values.staff, total: `¥${values.total.toFixed(2)}` }, ...current]); form.resetFields(); setModalOpen(false) }
  return <section className="reference-page billing-page" aria-label="开单">
    <div className="billing-search"><Input.Search value={keyword} onChange={event => setKeyword(event.target.value)} onSearch={setKeyword} placeholder="请输入顾客编号、姓名、手机号搜索" enterButton={<SearchOutlined />} allowClear /><Space><Button type="link" onClick={() => setModalOpen(true)}>散客开单</Button><Button type="link" onClick={() => setModalOpen(true)}>新建顾客档案</Button></Space></div>
    <div className="reference-card"><Tabs items={[{ key: 'pending', label: '待完成订单', children: <Table<BillingRow> rowKey="key" columns={columns} dataSource={filtered} pagination={false} locale={{ emptyText: <Empty description="暂无相关数据" /> }} scroll={{ x: 1100 }} /> }, { key: 'today', label: '今日订单', children: <Table<BillingRow> rowKey="key" columns={columns} dataSource={filtered.filter(row => row.orderTime.startsWith(dayjs().format('YYYY-MM-DD')))} pagination={false} locale={{ emptyText: <Empty description="暂无相关数据" /> }} scroll={{ x: 1100 }} /> }]} /></div>
    <Modal title="散客开单" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => void save()} okText="保存" cancelText="取消"><Form form={form} layout="vertical"><Form.Item name="customer" label="顾客信息" rules={[{ required: true, message: '请输入顾客信息' }]}><Input placeholder="请输入顾客姓名或手机号" /></Form.Item><Form.Item name="content" label="订单内容" rules={[{ required: true, message: '请输入订单内容' }]}><Input /></Form.Item><Form.Item name="staff" label="服务人员" rules={[{ required: true, message: '请输入服务人员' }]}><Input /></Form.Item><Form.Item name="total" label="订单合计" rules={[{ required: true, message: '请输入订单合计' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Form></Modal>
  </section>
}

function BookkeepingPage() {
  const { message } = App.useApp(); const [active, setActive] = useState('expense'); const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]); const [type, setType] = useState<string>(); const [payer, setPayer] = useState(''); const [rows, setRows] = useState<BookkeepingRow[]>([]); const [open, setOpen] = useState(false); const [form] = Form.useForm<{ type: string; amount: number; payer: string; remark?: string }>()
  const shown = active === 'expense' ? rows : []
  const save = async () => { const values = await form.validateFields(); setRows(current => [{ key: `${Date.now()}`, type: values.type, amount: values.amount, payer: values.payer, date: dayjs().format('YYYY-MM-DD'), remark: values.remark ?? '' }, ...current]); form.resetFields(); setOpen(false); void message.success('支出已保存') }
  return <section className="reference-page" aria-label="收支"><ModuleHeader actions={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增支出</Button><Button icon={<DownloadOutlined />} onClick={() => { downloadCsvRows('收支记录.csv', ['支出类型', '金额', '付款人', '日期', '备注'], shown.map(row => [row.type, row.amount.toFixed(2), row.payer, row.date, row.remark])); void message.success('报表已下载') }}>下载报表</Button></Space>}><Tabs activeKey={active} onChange={setActive} items={[{ key: 'expense', label: '支出记录' }, { key: 'income', label: '其他收入记录' }]} /></ModuleHeader><div className="reference-card bookkeeping-card"><div className="reference-filter-row"><Select value="当前门店" options={[{ value: '当前门店', label: '当前门店' }]} /><Select value={type} onChange={setType} allowClear placeholder="请选择支出类型" options={[{ value: '房租', label: '房租' }, { value: '采购', label: '采购' }, { value: '人工', label: '人工' }]} /><DatePicker.RangePicker value={range} onChange={dates => { if (dates?.[0] && dates[1]) setRange([dates[0], dates[1]]) }} /><Input value={payer} onChange={event => setPayer(event.target.value)} placeholder="付款人" suffix={<SearchOutlined />} /></div><Table<BookkeepingRow> rowKey="key" columns={[{ title: '支出类型', dataIndex: 'type' }, { title: '金额', dataIndex: 'amount', render: value => `¥${Number(value).toFixed(2)}` }, { title: '付款人', dataIndex: 'payer' }, { title: '日期', dataIndex: 'date' }, { title: '备注', dataIndex: 'remark' }]} dataSource={shown.filter(row => (!type || row.type === type) && (!payer || row.payer.includes(payer)))} pagination={false} locale={{ emptyText: <Empty description="暂无相关数据" /> }} /></div><Modal title="新增支出" open={open} onCancel={() => setOpen(false)} onOk={() => void save()} okText="保存" cancelText="取消"><Form form={form} layout="vertical"><Form.Item name="type" label="支出类型" rules={[{ required: true, message: '请选择支出类型' }]}><Select placeholder="请选择支出类型" options={[{ value: '房租', label: '房租' }, { value: '采购', label: '采购' }, { value: '人工', label: '人工' }]} /></Form.Item><Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item><Form.Item name="payer" label="付款人" rules={[{ required: true, message: '请输入付款人' }]}><Input /></Form.Item><Form.Item name="remark" label="备注"><Input /></Form.Item></Form></Modal></section>
}

function TargetsPage() {
  const [active, setActive] = useState('target'); const [month, setMonth] = useState(dayjs()); const [open, setOpen] = useState(false); const [action, setAction] = useState('')
  return <section className="reference-page" aria-label="目标"><ModuleHeader actions={<Space><Button type="primary" onClick={() => { setAction('行动计划设置'); setOpen(true) }}>行动计划设置</Button><Button onClick={() => { setAction('基础设置'); setOpen(true) }}>基础设置</Button></Space>}><Tabs activeKey={active} onChange={setActive} items={[{ key: 'target', label: '员工目标' }, { key: 'plan', label: '员工行动计划' }]} /></ModuleHeader><div className="reference-card target-card"><div className="reference-filter-row"><DatePicker picker="month" value={month} onChange={value => value && setMonth(value)} format="M月/YYYY年" /><Select value="当前门店" options={[{ value: '当前门店', label: '当前门店' }]} /></div><div className="reference-section-title">员工信息</div><Empty description="暂无相关数据" /></div><Modal title={action} open={open} onCancel={() => setOpen(false)} footer={<Button type="primary" onClick={() => setOpen(false)}>保存</Button>}><p>请配置{action}内容。</p></Modal></section>
}

export default function ReferenceModulesPage({ kind }: { kind: ModuleKind }) {
  if (kind === 'marketing') return <MarketingPage />
  if (kind === 'billing') return <BillingPage />
  if (kind === 'bookkeeping') return <BookkeepingPage />
  return <TargetsPage />
}
