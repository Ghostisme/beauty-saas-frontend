import { useState } from 'react'
import { Button, Checkbox, DatePicker, Input, Modal, Radio, Select, Space, Table } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoalEmpty } from '@/components/GoalEmpty'
import '@/styles/reference-modules.css'

type CashierSection = 'consume' | 'card' | 'custom' | 'group'
type CashierConsumeTab = 'consume' | 'project' | 'product'
type CashierCardTab = 'all' | 'stored' | 'discount' | 'times' | 'period' | 'point' | 'package'
type CashierItem = { id: string; name: string; price: number; duration?: string; category: string; stock?: number }
type CashierLine = CashierItem & { quantity: number }

const cashierProjects: CashierItem[] = [
  { id: 'project-1', name: '轻颜焕肤管理', price: 448, duration: '45分钟', category: '全部项目' },
  { id: 'project-2', name: '家肽中胚管理', price: 448, duration: '40分钟', category: '全部项目' },
  { id: 'project-3', name: '白月光双光疗水光', price: 598, duration: '45分钟', category: '充值系统' },
  { id: 'project-4', name: '青春肌密管理', price: 688, duration: '60分钟', category: '全部项目' },
  { id: 'project-5', name: '细胞私定水光针-闪充...', price: 598, duration: '60分钟', category: '处方系统' },
  { id: 'project-6', name: '五维入肽方程式', price: 0, duration: '60分钟', category: '处方系统' },
  { id: 'project-7', name: '益生元精研管理', price: 448, duration: '45分钟', category: '入胚系统' },
  { id: 'project-8', name: '水置换新肌能量管理', price: 328, duration: '40分钟', category: '入胚系统' },
  { id: 'project-9', name: '逆龄水氧管理', price: 298, duration: '60分钟', category: '全部项目' },
  { id: 'project-10', name: '小吊瓶注氧嫩肤', price: 198, duration: '45分钟', category: '全部项目' },
  { id: 'project-11', name: 'AN01[M]时光少女肌', price: 1780, duration: '45分钟', category: '全部项目' },
  { id: 'project-12', name: 'PS07黑色素阻断疗法', price: 1780, duration: '45分钟', category: '处方系统' },
  { id: 'project-13', name: 'BBF09细胞新生抗衰疗法', price: 1780, duration: '45分钟', category: '处方系统' },
  { id: 'project-14', name: '微分子蛋白轻龄精雕管理', price: 1780, duration: '60分钟', category: '处方系统' },
  { id: 'project-15', name: '再生美学套餐', price: 1980, duration: '40分钟', category: '全部项目' },
  { id: 'project-16', name: '细胞私定水光针-星耀...', price: 718, duration: '45分钟', category: '充值系统' },
]

const cashierProducts: CashierItem[] = [
  { id: 'product-1', name: '余几分城精萃霜2号', price: 878, category: '余几', stock: 0 },
  { id: 'product-2', name: '余几分城精萃霜1号', price: 998, category: '余几', stock: 1 },
  { id: 'product-3', name: '余几分城精华液2号', price: 716, category: '余几', stock: 1 },
  { id: 'product-4', name: '余几分城精华液3号', price: 825, category: '余几', stock: 1 },
  { id: 'product-5', name: '余几分城精华液4号', price: 1628, category: '余几', stock: 1 },
  { id: 'product-6', name: '余几分城精华液5号', price: 758, category: '余几', stock: 1 },
  { id: 'product-7', name: '余几分城精华液6号', price: 680, category: '余几', stock: 1 },
  { id: 'product-8', name: '余几多重修护防晒霜...', price: 198, category: '余几', stock: 1 },
  { id: 'product-9', name: '净颜酵素洁面啫喱', price: 238, category: '测试', stock: 2 },
  { id: 'product-10', name: '艾地芙芬活面奶', price: 198, category: '测试', stock: 4 },
  { id: 'product-11', name: '氨基酸洁面膏(150g)', price: 238, category: '测试', stock: 0 },
  { id: 'product-12', name: '维生素B精华液（35m...', price: 328, category: '测试', stock: 4 },
  { id: 'product-13', name: '余几焕颜颈霜', price: 288, category: '余几', stock: 0 },
  { id: 'product-14', name: '家肽冻干面膜', price: 398, category: '测试', stock: 0 },
  { id: 'product-15', name: '甲壳素肌活液', price: 29.9, category: '余几', stock: 0 },
  { id: 'product-16', name: '余几海藻凝胶膜', price: 288, category: '余几', stock: 1 },
  { id: 'product-17', name: '余几三因肌源次抛精...', price: 398, category: '余几', stock: 4 },
  { id: 'product-18', name: '余几维生素C精华液', price: 268, category: '余几', stock: 3 },
]

const cashierCards: Record<Exclude<CashierCardTab, 'all'>, CashierItem[]> = {
  stored: [
    { id: 'stored-1', name: '3980', price: 3980, category: '3980会员卡' },
    { id: 'stored-2', name: '8880', price: 8880, category: '8880会员卡' },
    { id: 'stored-3', name: '13800', price: 13800, category: '13800会员卡' },
    { id: 'stored-4', name: '21800', price: 21800, category: '21800会员卡' },
    { id: 'stored-5', name: '32800', price: 32800, category: '32800会员卡' },
  ],
  discount: [],
  times: [
    { id: 'times-1', name: '逆龄水氧管理10次卡', price: 1980, category: '全部分类' },
    { id: 'times-2', name: '小吊瓶注氧嫩肤10次卡', price: 1280, category: '全部分类' },
    { id: 'times-3', name: 'AN01[M]时光少女肌16次卡', price: 6980, category: '全部分类' },
    { id: 'times-4', name: 'PS07黑色素阻断疗法6次卡', price: 6980, category: '全部分类' },
    { id: 'times-5', name: 'BBF09细胞新生抗衰疗疗...', price: 6980, category: '全部分类' },
    { id: 'times-6', name: '轻颜焕肤管理10次卡', price: 3480, category: '全部分类' },
    { id: 'times-7', name: '微分子蛋白轻龄精雕管...', price: 6980, category: '全部分类' },
    { id: 'times-8', name: '家肽中胚管理10次卡', price: 2980, category: '全部分类' },
    { id: 'times-9', name: '再生美学套10次卡', price: 12800, category: '全部分类' },
    { id: 'times-10', name: '白月光双光疗水光10次卡', price: 3680, category: '全部分类' },
  ],
  period: [],
  point: [],
  package: [],
}

function CashierEmpty({ text }: { text: string }) {
  return <div className="cashier-empty" role="status" aria-label={text}><GoalEmpty /><span>{text}</span></div>
}

function CashierItemCard({ item, onAdd }: { item: CashierItem; onAdd: (item: CashierItem) => void }) {
  return <button type="button" className="cashier-item-card" onClick={() => onAdd(item)}><strong title={item.name}>{item.name}</strong><span><b>¥{item.price}</b>{item.duration && <em>{item.duration}</em>}{item.stock !== undefined && <em>{item.stock > 0 ? item.stock : '未入库'}</em>}</span></button>
}

function TakeOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'pending' | 'debt'>('pending')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()])
  const [keyword, setKeyword] = useState('')
  const columns = [
    { title: '顾客信息', key: 'customer' }, { title: '订单编号', key: 'orderNo' }, { title: '订单时间', key: 'time' }, { title: '订单内容', key: 'content' }, { title: '服务人员', key: 'staff' }, { title: '订单合计', key: 'total' }, { title: '操作', key: 'actions' },
  ]
  return <Modal rootClassName="cashier-take-order-modal-root" className="cashier-take-order-modal" title="取单" open={open} onCancel={onClose} closable={false} width="min(1640px, calc(100vw - 48px))" footer={<div className="cashier-take-order-footer"><Button onClick={onClose}>取消</Button><Button type="primary" onClick={onClose}>确定</Button></div>} destroyOnHidden>
    <div className="cashier-take-order-toolbar"><Space size={10}><Button type={tab === 'pending' ? 'primary' : 'default'} onClick={() => setTab('pending')}>待完成</Button><Button type={tab === 'debt' ? 'primary' : 'default'} onClick={() => setTab('debt')}>欠款单</Button>{tab === 'pending' ? <DatePicker.RangePicker value={range} onChange={dates => { if (dates?.[0] && dates[1]) setRange([dates[0], dates[1]]) }} format="YYYY/MM/DD" allowClear={false} /> : <Input.Search aria-label="搜索欠款单" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="输入顾客姓名/手机号/编号" allowClear />}</Space><Button type="text" icon={<CloseOutlined />} aria-label="关闭取单面板" onClick={onClose} /></div>
    <Table rowKey="id" columns={columns} dataSource={[]} pagination={false} locale={{ emptyText: <CashierEmpty text="暂无相关数据" /> }} className="cashier-take-order-table" />
  </Modal>
}

export default function BillingWorkspace() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialAction = params.get('action')
  const initialSection: CashierSection = initialAction === 'card' ? 'card' : initialAction === 'custom' ? 'custom' : initialAction === 'group' ? 'group' : 'consume'
  const [section, setSection] = useState<CashierSection>(initialSection)
  const [consumeTab, setConsumeTab] = useState<CashierConsumeTab>('consume')
  const [cardTab, setCardTab] = useState<CashierCardTab>('all')
  const [projectCategory, setProjectCategory] = useState('全部项目')
  const [productCategory, setProductCategory] = useState('全部产品')
  const [cardCategory, setCardCategory] = useState('全部分类')
  const [keyword, setKeyword] = useState('')
  const [lines, setLines] = useState<CashierLine[]>([])
  const [takeOrderOpen, setTakeOrderOpen] = useState(false)
  const [customCardName, setCustomCardName] = useState('')
  const [customValidity, setCustomValidity] = useState('forever')
  const [coupon, setCoupon] = useState('')
  const [couponResult, setCouponResult] = useState<string>()
  const customerLabel = params.get('customerId') ? '183****5079' : '散客'
  const projectCategories = ['全部项目', '入胚系统', '处方系统', '充值系统']
  const productCategories = ['全部产品', '余几', '测试']
  const cardCategories = ['全部分类', '3980会员卡', '8880会员卡', '13800会员卡', '21800会员卡', '32800会员卡', '疗程卡']
  const addLine = (item: CashierItem) => setLines(current => { const existing = current.find(line => line.id === item.id); return existing ? current.map(line => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { ...item, quantity: 1 }] })
  const changeQuantity = (id: string, delta: number) => setLines(current => current.flatMap(line => line.id !== id ? [line] : line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []))
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const shownProjects = cashierProjects.filter(item => (!projectCategory || projectCategory === '全部项目' || item.category === projectCategory) && (!keyword.trim() || item.name.toLowerCase().includes(keyword.trim().toLowerCase())))
  const shownProducts = cashierProducts.filter(item => (!productCategory || productCategory === '全部产品' || item.category === productCategory) && (!keyword.trim() || item.name.toLowerCase().includes(keyword.trim().toLowerCase())))
  const shownCards = cardTab === 'all' ? [] : (cashierCards[cardTab] ?? []).filter(item => (!cardCategory || cardCategory === '全部分类' || item.category === cardCategory) && (!keyword.trim() || item.name.toLowerCase().includes(keyword.trim().toLowerCase())))
  const resetKeyword = (next: string) => { setKeyword(''); if (next === 'project') setProjectCategory('全部项目'); if (next === 'product') setProductCategory('全部产品'); if (next === 'card') setCardCategory('全部分类') }
  const renderOrderPanel = <section className="cashier-order-panel"><div className="cashier-order-heading"><strong>开单明细（{lines.length}）</strong><Button type="link" size="small">添加附加费</Button></div>{lines.length === 0 ? <CashierEmpty text="请在左侧选择开单内容" /> : <><div className="cashier-order-lines">{lines.map(line => <div className="cashier-order-line" key={line.id}><div><strong>{line.name}</strong><span>¥{line.price}</span></div><Space size={4}><Button type="text" size="small" aria-label={`减少${line.name}`} onClick={() => changeQuantity(line.id, -1)}>−</Button><span>{line.quantity}</span><Button type="text" size="small" aria-label={`增加${line.name}`} onClick={() => changeQuantity(line.id, 1)}>＋</Button></Space></div>)}</div><div className="cashier-order-total"><span>合计</span><strong>¥{total.toFixed(2)}</strong></div></>}</section>
  const renderCatalog = (kind: CashierConsumeTab | 'card') => {
    const isCard = kind === 'card'
    const categories = isCard ? cardCategories : kind === 'project' ? projectCategories : productCategories
    const activeCategory = isCard ? cardCategory : kind === 'project' ? projectCategory : productCategory
    const setCategory = isCard ? setCardCategory : kind === 'project' ? setProjectCategory : setProductCategory
    const items = isCard ? shownCards : kind === 'project' ? shownProjects : shownProducts
    return <div className="cashier-catalog"><aside className="cashier-category-list">{categories.map(category => <button type="button" key={category} className={activeCategory === category ? 'is-active' : ''} onClick={() => setCategory(category)}>{category}</button>)}</aside><div className="cashier-items-grid">{items.length === 0 ? <CashierEmpty text="暂无相关数据" /> : items.map(item => <CashierItemCard key={item.id} item={item} onAdd={addLine} />)}</div></div>
  }
  const renderConsume = <div className="cashier-split-layout"><section className="cashier-left-panel"><div className="cashier-subtabs">{([['consume', '消耗'], ['project', '项目'], ['product', '产品']] as const).map(([key, label]) => <button type="button" key={key} className={consumeTab === key ? 'is-active' : ''} onClick={() => { setConsumeTab(key); resetKeyword(key) }}>{label}</button>)}<div className="cashier-catalog-search">{consumeTab !== 'consume' && <Input.Search aria-label={consumeTab === 'project' ? '搜索项目' : '搜索产品'} placeholder={consumeTab === 'project' ? '输入项目名称、拼音、首字母' : '输入产品名称、拼音、首字母'} value={keyword} onChange={event => setKeyword(event.target.value)} allowClear />}</div></div>{consumeTab === 'consume' ? <CashierEmpty text="暂无相关数据" /> : renderCatalog(consumeTab)}</section>{renderOrderPanel}</div>
  const renderCards = <div className="cashier-split-layout"><section className="cashier-left-panel"><div className="cashier-subtabs">{([['all', '全部'], ['stored', '储值卡'], ['discount', '折扣卡'], ['times', '次卡'], ['period', '周期卡'], ['point', '点卡'], ['package', '套卡']] as const).map(([key, label]) => <button type="button" key={key} className={cardTab === key ? 'is-active' : ''} onClick={() => { setCardTab(key); resetKeyword('card') }}>{label}</button>)}<div className="cashier-catalog-search"><Input.Search aria-label="搜索卡" placeholder="输入卡名称..." value={keyword} onChange={event => setKeyword(event.target.value)} allowClear /></div></div>{cardTab === 'all' ? <CashierEmpty text="暂无相关数据" /> : renderCatalog('card')}</section>{renderOrderPanel}</div>
  const renderCustom = <section className="cashier-custom-card"><div className="cashier-form-row"><label>卡名称：<Input maxLength={100} showCount value={customCardName} onChange={event => setCustomCardName(event.target.value)} placeholder="请输入定制卡名称" /></label><span>定制次卡</span></div><div className="cashier-form-row"><span>有效期：</span><Radio.Group value={customValidity} onChange={event => setCustomValidity(event.target.value)} options={[{ value: 'forever', label: '永久有效' }, { value: 'range', label: '有效时间段' }, { value: 'days', label: '有效天数' }]} /></div><div className="cashier-form-row"><span>适用门店：</span><Radio checked>当前门店</Radio></div><div className="cashier-form-row cashier-card-content-row"><span>卡内容：</span><Button type="link" onClick={() => { setSection('consume'); setConsumeTab('project') }}>添加项目</Button></div><div className="cashier-form-row cashier-gift-row"><span>赠送权益：</span><Checkbox>赠送内容</Checkbox><Checkbox>赠送原价消费金额</Checkbox></div></section>
  const renderGroup = <section className="cashier-group-verify"><Space.Compact className="cashier-group-search"><Select value="美团" options={[{ value: '美团', label: '美团' }, { value: '大众点评', label: '大众点评' }]} /><Input aria-label="美团券码" placeholder="请输入美团券码" value={coupon} onChange={event => setCoupon(event.target.value)} /><Button type="primary" onClick={() => setCouponResult(coupon.trim() ? `已查询券码：${coupon.trim()}` : '请输入美团券码')}>查询</Button></Space.Compact>{couponResult && <span className="cashier-group-result">{couponResult}</span>}</section>
  return <div className="billing-cashier-workspace"><header className="cashier-header"><div className="cashier-customer-chip"><span>1</span><strong>{customerLabel}</strong><small>18326775079&nbsp;&nbsp;No：00001</small><button type="button" aria-label="切换顾客">⌄</button></div><nav className="cashier-main-tabs" aria-label="收银功能">{([['consume', '开单消耗'], ['card', '开卡'], ['custom', '定制次卡'], ['group', '团购核销']] as const).map(([key, label]) => <button type="button" key={key} className={section === key ? 'is-active' : ''} onClick={() => setSection(key)}>{label}</button>)}</nav><div className="cashier-header-actions"><span>当前门店&nbsp;⌄</span><Button type="link" onClick={() => setTakeOrderOpen(true)}>取单</Button><Button onClick={() => navigate('/customers')}>退出收银</Button></div></header>{section === 'consume' ? renderConsume : section === 'card' ? renderCards : section === 'custom' ? renderCustom : renderGroup}<TakeOrderDialog open={takeOrderOpen} onClose={() => setTakeOrderOpen(false)} /></div>
}
