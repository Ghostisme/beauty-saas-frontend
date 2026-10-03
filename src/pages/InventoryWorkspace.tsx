import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, DatePicker, Drawer, Form, Input, InputNumber, Modal, Pagination, Radio, Result, Select, Space, Spin, Switch, Table, Tabs, Tag, type FormInstance } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { errorMessage, QueryError, paginationOptions } from '@/components/iam/shared'
import { useAuth } from '@/context/AuthContext'
import { catalogRequest, useCatalogQuery } from '@/api/catalog'
import type { Department, PageResult } from '@/types/iam'
import type { CatalogItem, InventoryAccountRow, InventoryBatchRow, InventoryChangeRow, InventoryChangeType, InventoryDocumentDetail, InventoryDocumentLine, InventoryDocumentRow, InventoryDocumentStatus, InventoryDocumentType, InventoryRow, InventorySettings } from '@/types/catalog'
import InventoryLiquidationWorkspace from './InventoryLiquidationWorkspace'
import InventoryCostWorkspace from './InventoryCostWorkspace'
import '@/styles/catalog.css'

export const inventoryTabs = [
  { key: 'stock', label: '库存查询' },
  { key: 'opening', label: '期初期末库存查询' },
  { key: 'changes', label: '出入明细' },
  { key: 'batch', label: '批次管理' },
  { key: 'liquidation', label: '库存盘点' },
  { key: 'call', label: '调拨管理' },
  { key: 'account', label: '成本核算' },
  { key: 'settings', label: '库存设置' },
] as const
type InventoryView = typeof inventoryTabs[number]['key']

function money(value: number | string | undefined) { return value === undefined ? '—' : `¥${Number(value).toFixed(2)}` }
function date(value?: string) { return value ? value.replace('T', ' ').slice(0, 16) : '—' }
function departmentOptions(departments: Department[]) { return departments.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name })) }
function productOptions(products: CatalogItem[]) { return products.filter(item => item.status === 1).map(item => ({ value: item.id, label: `${item.name} · ${item.code}` })) }
const DEFAULT_INVENTORY_SETTINGS: InventorySettings = { preventOrderOnShortage: false, transferAutoConfirmEnabled: false, transferAutoConfirmDays: 0, stockAlertEnabled: false, stockAlertValue: 0, expiryAlertEnabled: false, expiryAlertMonths: 6, salesDeductInventory: true, deleteProductSyncInventory: true, version: 0 }
function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | undefined | null>>) {
  if (!rows.length) return false
  const cell = (value: string | number | undefined | null) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [headers, ...rows].map(row => row.map(cell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
  return true
}

function InventoryMovementForm({ open, tenantId, departments, products, revision, initialType = 'IN', onClose, onSaved }: { open: boolean; tenantId?: number; departments: Department[]; products: CatalogItem[]; revision: number; initialType?: 'IN' | 'OUT'; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false); const { message } = App.useApp()
  const departmentId = Form.useWatch('departmentId', form) as number | undefined
  const stockQuery = useCatalogQuery<PageResult<InventoryRow>>(`/inventory?page=1&pageSize=100&keyword=${departmentId ? `&departmentId=${departmentId}` : ''}`, tenantId, revision, open && Boolean(departmentId))
  const submit = async (values: Record<string, unknown>) => {
    const lines = Array.isArray(values.lines) ? values.lines as Array<Record<string, unknown>> : []
    if (!lines.length) { void message.warning('请先添加产品明细'); return }
    setSaving(true)
    try {
      await catalogRequest('/inventory/documents/with-lines', tenantId, { method: 'POST', body: JSON.stringify({
        changeType: initialType,
        departmentId: values.departmentId,
        documentNo: values.documentNo || undefined,
        documentDate: (values.documentDate as Dayjs).format('YYYY-MM-DD'),
        operatorName: values.operatorName || undefined,
        status: 'CONFIRMED',
        remark: values.remark || undefined,
        lines: lines.map(line => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitCost: line.unitCost ?? 0,
          batchName: line.batchName || undefined,
          productionDate: line.productionDate ? (line.productionDate as Dayjs).format('YYYY-MM-DD') : undefined,
          expiryDate: line.expiryMonths && line.productionDate
            ? (line.productionDate as Dayjs).add(Number(line.expiryMonths), 'month').format('YYYY-MM-DD')
            : line.expiryDate ? (line.expiryDate as Dayjs).format('YYYY-MM-DD') : undefined,
          remark: line.remark || undefined,
        })),
      }) })
      void message.success(initialType === 'IN' ? '入库单已提交' : '出库单已提交'); onSaved(); onClose(); form.resetFields()
    } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) }
  }
  const isInbound = initialType === 'IN'
  return <Drawer className="inventory-movement-drawer" placement="right" size="min(960px, calc(100vw - 32px))" title={isInbound ? '产品入库' : '产品出库'} open={open} onClose={onClose} destroyOnHidden footer={<div className="drawer-actions"><Button onClick={onClose}>取消</Button><Button type="primary" onClick={() => form.submit()} loading={saving}>{isInbound ? '提交入库' : '提交出库'}</Button></div>} afterOpenChange={visible => { if (visible) { form.resetFields(); form.setFieldsValue({ documentDate: dayjs(), lines: [] }) } }}>
    <Form form={form} layout="vertical" onFinish={submit} initialValues={{ documentDate: dayjs(), lines: [] }}>
      <div className="movement-header-grid">
        <Form.Item name="departmentId" label={isInbound ? '入库仓库' : '出库仓库'} rules={[{ required: true, message: '请选择门店 / 仓库' }]}><Select options={departmentOptions(departments)} placeholder="请选择门店 / 仓库" /></Form.Item>
        <Form.Item label="单据类型"><Input value={initialType === 'IN' ? '产品入库' : '产品出库'} readOnly /></Form.Item>
        <Form.Item name="documentDate" label={isInbound ? '入库时间' : '出库时间'} rules={[{ required: true, message: '请选择时间' }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="operatorName" label="经办人"><Input placeholder="负责人" maxLength={80} /></Form.Item>
        <Form.Item name="documentNo" label="单据号"><Input placeholder="不填写则自动生成" maxLength={80} /></Form.Item>
      </div>
      <Form.List name="lines">
        {(fields, { add, remove }) => <><div className="movement-lines-heading"><strong>产品明细</strong><Button type="primary" ghost icon={<PlusOutlined />} onClick={() => add({ quantity: 1, unitCost: 0 })}>添加产品</Button></div><div className={`movement-lines-table ${isInbound ? 'is-inbound' : 'is-outbound'}`}>
          <div className="movement-line-header">{isInbound ? (<><span>#</span><span>编号</span><span>产品名称</span><span>单位</span><span>当前库存</span><span>入库数量</span><span>成本价</span><span>成本总额</span><span>生产日期</span><span>保质期(月)</span><span>批次</span><span>备注</span><span>操作</span></>) : (<><span>#</span><span>编号</span><span>产品名称</span><span>单位</span><span>当前库存</span><span>出库数量</span><span>备注</span><span>操作</span></>)}</div>
          {!fields.length && <div className="movement-empty"><div className="inventory-placeholder-icon"><PlusOutlined /></div><span>暂无相关数据</span><small>点击“添加产品”开始填写</small></div>}
          {fields.map((field, index) => <div className="movement-line-row" key={field.key}>
            <span className="movement-line-index">{index + 1}</span>
            <MovementLineCode form={form} name={field.name} products={products} />
            <Form.Item name={[field.name, 'itemId']} rules={[{ required: true, message: '请选择产品' }]}><Select showSearch optionFilterProp="label" options={productOptions(products)} placeholder="请选择产品" /></Form.Item>
            <MovementLineUnit form={form} name={field.name} products={products} />
            <MovementLineStock form={form} name={field.name} rows={stockQuery.data?.records ?? []} />
            <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: '请输入数量' }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item>
            {isInbound ? <><Form.Item name={[field.name, 'unitCost']} rules={[{ required: true, message: '请输入成本' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item><MovementLineTotal form={form} name={field.name} /><Form.Item name={[field.name, 'productionDate']}><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item name={[field.name, 'expiryMonths']}><InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="月数" /></Form.Item><Form.Item name={[field.name, 'batchName']}><Input placeholder="批次" maxLength={120} /></Form.Item><Form.Item name={[field.name, 'remark']}><Input placeholder="备注" maxLength={300} /></Form.Item></> : <><Form.Item name={[field.name, 'unitCost']} hidden initialValue={0}><InputNumber /></Form.Item><Form.Item name={[field.name, 'remark']}><Input placeholder="备注" maxLength={300} /></Form.Item></>}
            <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除第${index + 1}条产品`} onClick={() => remove(field.name)} />
          </div>)}
        </div></>}
      </Form.List>
      <div className="movement-footer-fields">
        <Form.Item label="制单人"><Input value="负责人" disabled /></Form.Item>
        <Form.Item name="remark" label="备注"><Input placeholder="请输入备注" maxLength={300} /></Form.Item>
      </div>
    </Form>
  </Drawer>
}

function MovementLineCode({ form, name, products }: { form: FormInstance; name: number; products: CatalogItem[] }) {
  const itemId = Form.useWatch(['lines', name, 'itemId'], form) as number | undefined
  return <span className="movement-line-meta">{products.find(item => item.id === itemId)?.code ?? '—'}</span>
}

function MovementLineUnit({ form, name, products }: { form: FormInstance; name: number; products: CatalogItem[] }) {
  const itemId = Form.useWatch(['lines', name, 'itemId'], form) as number | undefined
  return <span className="movement-line-meta">{products.find(item => item.id === itemId)?.unit ?? '—'}</span>
}

function MovementLineTotal({ form, name }: { form: FormInstance; name: number }) {
  const quantity = Form.useWatch(['lines', name, 'quantity'], form) as number | undefined
  const unitCost = Form.useWatch(['lines', name, 'unitCost'], form) as number | undefined
  return <span className="movement-line-total">¥{(Number(quantity || 0) * Number(unitCost || 0)).toFixed(2)}</span>
}

function MovementLineStock({ form, name, rows }: { form: FormInstance; name: number; rows: InventoryRow[] }) {
  const itemId = Form.useWatch(['lines', name, 'itemId'], form) as number | undefined
  const row = rows.find(item => item.itemId === itemId)
  return <span className="movement-line-stock">{row ? `${row.quantity} ${row.unit ?? ''}` : '—'}</span>
}

function StockWorkspace({ tenantId, platform, departments, products, revision, setRevision, onOpenMovement, onOpenDetail, onEditWarning }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number; setRevision: (value: (current: number) => number) => void; onOpenMovement: (type: 'IN' | 'OUT') => void; onOpenDetail: (row: InventoryRow, title: string) => void; onEditWarning: (row: InventoryRow) => void }) {
  const { can } = useAuth(); const { message } = App.useApp(); const [page, setPage] = useState(1); const [keyword, setKeyword] = useState(''); const [brand, setBrand] = useState<string>(); const [category, setCategory] = useState<string>(); const [departmentId, setDepartmentId] = useState<number>(); const [shortageOnly, setShortageOnly] = useState(false)
  const query = useCatalogQuery<PageResult<InventoryRow>>(`/inventory?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${brand ? `&brand=${encodeURIComponent(brand)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${departmentId ? `&departmentId=${departmentId}` : ''}&shortageOnly=${shortageOnly}`, tenantId, revision, platform ? tenantId !== undefined : true)
  const rows = query.data?.records ?? []
  const lowStock = rows.filter(row => row.shortage === 1 || row.quantity <= row.warningValue).length; const stockTotal = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const categories = [...new Set(products.map(item => item.category).filter(Boolean))] as string[]; const brands = [...new Set(products.map(item => item.brand).filter(Boolean))] as string[]
  const columns: ColumnsType<InventoryRow> = [
    { title: '产品信息', key: 'item', width: 250, render: (_: unknown, row) => <div className="catalog-cell-stack"><strong>{row.itemName}</strong><span>{row.itemCode} · {row.spec || row.unit || '—'}</span></div> },
    { title: '所属仓库', dataIndex: 'departmentName', width: 180 }, { title: '库存数量', dataIndex: 'quantity', width: 110, render: (value: number, row) => <strong className={row.shortage === 1 || value <= row.warningValue ? 'catalog-warning' : ''}>{value}</strong> },
    { title: '单位', dataIndex: 'unit', width: 80, render: value => value || '—' }, { title: '产品品牌', dataIndex: 'brand', width: 120, render: value => value || '—' }, { title: '产品品类', dataIndex: 'category', width: 120, render: value => value || '—' },
    { title: '产品价格', dataIndex: 'costPrice', width: 110, render: money }, { title: '库存下限', dataIndex: 'warningValue', width: 100 },
    { title: '操作', key: 'actions', width: 260, render: (_: unknown, row) => <Space wrap size={0}><Button type="link" onClick={() => onOpenDetail(row, '库存明细')}>库存明细</Button><Button type="link" onClick={() => onOpenDetail(row, '保质期明细')}>保质期明细</Button><Button type="link" onClick={() => onOpenDetail(row, '批次明细')}>批次明细</Button><Button type="link" disabled={!platform && !can('inventory:write')} onClick={() => onEditWarning(row)}>修改库存下限</Button></Space> },
  ]
  return <><div className="inventory-summary"><div><span>库存品项</span><strong>{query.data?.total ?? 0}</strong><small>当前页记录</small></div><div><span>库存总量</span><strong>{stockTotal.toFixed(2)}</strong><small>按当前页汇总</small></div><div className={lowStock ? 'is-warning' : ''}><span>库存预警</span><strong>{lowStock}</strong><small>{lowStock ? '需要及时补货' : '暂无预警'}</small></div></div><div className="inventory-action-bar"><Space wrap><Button type="primary" icon={<SwapOutlined />} disabled={!platform && !can('inventory:write')} onClick={() => onOpenMovement('OUT')}>产品出库</Button><Button type="primary" icon={<SwapOutlined />} disabled={!platform && !can('inventory:write')} onClick={() => onOpenMovement('IN')}>产品入库</Button><Button icon={<DownloadOutlined />} onClick={() => { if (!downloadCsv('库存查询.csv', ['产品信息', '门店', '库存数量', '单位', '品牌', '品类', '成本价', '库存下限'], rows.map(row => [row.itemName, row.departmentName, row.quantity, row.unit, row.brand, row.category, row.costPrice, row.warningValue]))) void message.info('暂无可下载数据') }}>报表下载</Button></Space></div><div className="inventory-filter-row"><Select allowClear placeholder="全部门店" value={departmentId} onChange={value => { setDepartmentId(value); setPage(1) }} options={departmentOptions(departments)} /><Select allowClear placeholder="请选择品牌" value={brand} onChange={value => { setBrand(value); setPage(1) }} options={brands.map(value => ({ value, label: value }))} /><Select allowClear placeholder="请选择分类" value={category} onChange={value => { setCategory(value); setPage(1) }} options={categories.map(value => ({ value, label: value }))} /><Input.Search aria-label="搜索库存" placeholder="请输入产品名称/编号" allowClear onSearch={value => { setKeyword(value.trim()); setPage(1) }} /><Space size={6}><Switch checked={shortageOnly} onChange={checked => { setShortageOnly(checked); setPage(1) }} /><span>只看库存不足</span></Space><Button icon={<ReloadOutlined />} aria-label="刷新库存" onClick={() => setRevision(value => value + 1)} /></div><QueryError error={query.error} onRetry={query.reload} /><Table<InventoryRow> rowKey="id" loading={query.loading} columns={columns} dataSource={rows} scroll={{ x: 1320 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : '暂无库存记录' }} /><div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div></>
}

function ChangeWorkspace({ tenantId, platform, departments, products, revision, setRevision, onOpenMovement, writable }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number; setRevision: (value: (current: number) => number) => void; onOpenMovement: (type: 'IN' | 'OUT') => void; writable: boolean }) {
  const { message } = App.useApp(); const [page, setPage] = useState(1); const [keyword, setKeyword] = useState(''); const [brand, setBrand] = useState<string>(); const [category, setCategory] = useState<string>(); const [departmentId, setDepartmentId] = useState<number>(); const [itemId, setItemId] = useState<number>(); const [types, setTypes] = useState<InventoryChangeType[]>([]); const [range, setRange] = useState<[Dayjs, Dayjs]>();
  const query = useCatalogQuery<PageResult<InventoryChangeRow>>(`/inventory/changes?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${brand ? `&brand=${encodeURIComponent(brand)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${departmentId ? `&departmentId=${departmentId}` : ''}${itemId ? `&itemId=${itemId}` : ''}${types.length ? `&changeType=${types.join(',')}` : ''}${range ? `&startDate=${range[0].format('YYYY-MM-DD')}&endDate=${range[1].format('YYYY-MM-DD')}` : ''}`, tenantId, revision, platform ? tenantId !== undefined : true)
  const brands = [...new Set(products.map(item => item.brand).filter(Boolean))] as string[]; const categories = [...new Set(products.map(item => item.category).filter(Boolean))] as string[]
  const columns: ColumnsType<InventoryChangeRow> = [{ title: '时间', dataIndex: 'createTime', width: 160, render: date }, { title: '门店', dataIndex: 'departmentName', width: 160 }, { title: '产品', key: 'item', width: 220, render: (_: unknown, row) => `${row.itemName} · ${row.itemCode}` }, { title: '类型', dataIndex: 'changeType', width: 100, render: (value: InventoryChangeType) => <Tag color={value === 'IN' ? 'green' : value === 'OUT' ? 'orange' : 'blue'}>{value === 'IN' ? '入库' : value === 'OUT' ? '出库' : '盘点'}</Tag> }, { title: '数量', dataIndex: 'quantity', width: 100 }, { title: '单位成本', dataIndex: 'unitCost', width: 110, render: money }, { title: '单据号', dataIndex: 'referenceNo', width: 140, render: value => value || '—' }, { title: '备注', dataIndex: 'reason', width: 180, render: value => value || '—' }]
  return <><div className="inventory-sub-actions"><Space wrap><Button type="primary" icon={<SwapOutlined />} disabled={!writable} onClick={() => onOpenMovement('IN')}>产品入库</Button><Button icon={<DownloadOutlined />} onClick={() => { if (!downloadCsv('出入明细.csv', ['时间', '门店', '产品', '类型', '数量', '单位成本', '单据号', '备注'], (query.data?.records ?? []).map(row => [date(row.createTime), row.departmentName, `${row.itemName} · ${row.itemCode}`, row.changeType, row.quantity, row.unitCost, row.referenceNo, row.reason]))) void message.info('暂无可下载数据') }}>报表下载</Button></Space></div><div className="inventory-filter-row"><Select allowClear placeholder="全部门店" value={departmentId} onChange={value => { setDepartmentId(value); setPage(1) }} options={departmentOptions(departments)} /><Select allowClear placeholder="请选择品牌" value={brand} onChange={value => { setBrand(value); setPage(1) }} options={brands.map(value => ({ value, label: value }))} /><Select allowClear placeholder="请选择分类" value={category} onChange={value => { setCategory(value); setPage(1) }} options={categories.map(value => ({ value, label: value }))} /><Select allowClear showSearch optionFilterProp="label" placeholder="选择产品" value={itemId} onChange={value => { setItemId(value); setPage(1) }} options={productOptions(products)} /><Select mode="multiple" allowClear placeholder="请选择入库类型" value={types} onChange={value => { setTypes(value as InventoryChangeType[]); setPage(1) }} options={[{ value: 'IN', label: '入库' }, { value: 'OUT', label: '出库' }, { value: 'ADJUST', label: '盘点' }]} /><DatePicker.RangePicker value={range} onChange={value => { if (value?.[0] && value?.[1]) setRange([value[0], value[1]]); else setRange(undefined); setPage(1) }} /><Input.Search aria-label="产品名称 / 编号 / 单据号" placeholder="产品名称 / 编号 / 单据号" allowClear onSearch={value => { setKeyword(value.trim()); setPage(1) }} /><Button icon={<ReloadOutlined />} onClick={() => setRevision(value => value + 1)} /></div><QueryError error={query.error} onRetry={query.reload} /><Table<InventoryChangeRow> rowKey="id" loading={query.loading} columns={columns} dataSource={query.data?.records ?? []} scroll={{ x: 1120 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : '暂无相关数据' }} /><div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div></>
}

function BatchWorkspace({ tenantId, platform, departments, products, revision, setRevision, writable }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number; setRevision: (value: (current: number) => number) => void; writable: boolean }) {
  const [page, setPage] = useState(1); const [keyword, setKeyword] = useState(''); const [departmentId, setDepartmentId] = useState<number>(); const [itemId, setItemId] = useState<number>(); const [open, setOpen] = useState(false); const { modal, message } = App.useApp()
  const query = useCatalogQuery<PageResult<InventoryBatchRow>>(`/inventory/batches?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${departmentId ? `&departmentId=${departmentId}` : ''}${itemId ? `&itemId=${itemId}` : ''}`, tenantId, revision, platform ? tenantId !== undefined : true)
  const columns: ColumnsType<InventoryBatchRow> = [{ title: '批次名称', dataIndex: 'batchName', width: 220, render: (value, row) => <div className="catalog-cell-stack"><strong>{value}</strong><span>{row.itemName} · {row.itemCode}</span></div> }, { title: '所属门店', dataIndex: 'departmentName', width: 180 }, { title: '数量', dataIndex: 'quantity', width: 100, render: value => value ?? 0 }, { title: '生产日期', dataIndex: 'productionDate', width: 120, render: value => value || '—' }, { title: '到期时间', dataIndex: 'expiryDate', width: 120, render: value => value || '—' }, { title: '创建时间', dataIndex: 'createTime', width: 160, render: date }, { title: '更新时间', dataIndex: 'updateTime', width: 160, render: date }, { title: '备注', dataIndex: 'remark', width: 200, render: value => value || '—' }, { title: '操作', key: 'actions', width: 90, render: (_: unknown, row) => <Button type="link" danger disabled={!writable} onClick={() => modal.confirm({ title: `删除“${row.batchName}”？`, okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', onOk: async () => { try { await catalogRequest(`/inventory/batches/${row.id}`, tenantId, { method: 'DELETE' }); setRevision(value => value + 1); void message.success('批次已删除') } catch (cause) { void message.error(errorMessage(cause)); throw cause } } })}>删除</Button> }]
  return <><div className="inventory-sub-actions"><Space wrap><Button type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => setOpen(true)}>新建批次</Button><Button icon={<ReloadOutlined />} onClick={() => setRevision(value => value + 1)}>刷新</Button></Space></div><div className="inventory-filter-row"><Input.Search aria-label="批次名称" placeholder="批次名称" allowClear onSearch={value => { setKeyword(value.trim()); setPage(1) }} /><Select allowClear placeholder="全部门店" value={departmentId} onChange={value => { setDepartmentId(value); setPage(1) }} options={departmentOptions(departments)} /><Select allowClear showSearch optionFilterProp="label" placeholder="选择产品" value={itemId} onChange={value => { setItemId(value); setPage(1) }} options={productOptions(products)} /></div><QueryError error={query.error} onRetry={query.reload} /><Table<InventoryBatchRow> rowKey="id" loading={query.loading} columns={columns} dataSource={query.data?.records ?? []} scroll={{ x: 1250 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : '暂无相关数据' }} /><div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div><InventoryBatchForm open={open} tenantId={tenantId} departments={departments} products={products} onClose={() => setOpen(false)} onSaved={() => setRevision(value => value + 1)} /></>
}

function InventoryBatchForm({ open, tenantId, departments, products, onClose, onSaved }: { open: boolean; tenantId?: number; departments: Department[]; products: CatalogItem[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false); const { message } = App.useApp()
  const submit = async (values: Record<string, unknown>) => { setSaving(true); try { await catalogRequest('/inventory/batches', tenantId, { method: 'POST', body: JSON.stringify({ ...values, productionDate: values.productionDate ? (values.productionDate as Dayjs).format('YYYY-MM-DD') : undefined, expiryDate: values.expiryDate ? (values.expiryDate as Dayjs).format('YYYY-MM-DD') : undefined }) }); void message.success('批次已创建'); onSaved(); onClose(); form.resetFields() } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) } }
  return <Modal className="catalog-modal" width={560} centered title="新建批次" open={open} onCancel={onClose} destroyOnClose footer={null}><Form form={form} layout="vertical" onFinish={submit} initialValues={{ status: 1, quantity: 0 }}><Form.Item name="departmentId" label="门店 / 部门" rules={[{ required: true, message: '请选择门店' }]}><Select options={departmentOptions(departments)} /></Form.Item><Form.Item name="itemId" label="产品" rules={[{ required: true, message: '请选择产品' }]}><Select showSearch optionFilterProp="label" options={productOptions(products)} /></Form.Item><Form.Item name="batchName" label="批次名称" rules={[{ required: true, message: '请输入批次名称' }]}><Input maxLength={120} /></Form.Item><Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}><InputNumber min={0} precision={3} style={{ width: '100%' }} /></Form.Item><Space className="catalog-form-row" align="start"><Form.Item name="productionDate" label="生产日期"><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item name="expiryDate" label="到期时间"><DatePicker style={{ width: '100%' }} /></Form.Item></Space><Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={300} /></Form.Item><div className="catalog-dialog-actions"><Button onClick={onClose}>取消</Button><Button type="primary" htmlType="submit" loading={saving}>保存</Button></div></Form></Modal>
}

type TransferDirection = 'IN' | 'OUT'
type TransferLineDraft = { itemId: number; itemName: string; itemCode: string; unit?: string; spec?: string; currentQuantity: number; quantity: number; unitCost: number; remark: string }

function transferStatusLabel(status: InventoryDocumentStatus) {
  return status === 'DRAFT' ? '草稿' : status === 'PENDING' ? '待审批' : status === 'CONFIRMED' ? '已确认' : '已取消'
}

function transferListStatusLabel(status: InventoryDocumentStatus, docType: InventoryDocumentType) {
  return docType === 'TRANSFER_IN' && status === 'PENDING' ? '出库中' : transferStatusLabel(status)
}

function TransferProductDrawer({ open, tenantId, onClose, onSaved }: { open: boolean; tenantId?: number; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false); const { message } = App.useApp()
  async function submit(values: Record<string, unknown>) {
    setSaving(true)
    try {
      await catalogRequest('/items?kind=PRODUCT', tenantId, { method: 'POST', body: JSON.stringify({ ...values, status: 1 }) })
      void message.success('产品已创建'); onSaved(); form.resetFields(); onClose()
    } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) }
  }
  return <Drawer className="transfer-product-drawer" placement="right" width={480} title="添加新产品" open={open} onClose={onClose} destroyOnHidden footer={<div className="drawer-actions"><Button onClick={onClose}>取消</Button><Button type="primary" loading={saving} onClick={() => void form.submit()}>保存</Button></div>}>
    <Form form={form} layout="vertical" initialValues={{ price: 0 }} onFinish={submit}>
      <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}><Input maxLength={64} /></Form.Item>
      <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input maxLength={150} /></Form.Item>
      <Form.Item name="price" label="售价" rules={[{ required: true, message: '请输入售价' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
      <Form.Item name="brand" label="品牌"><Input maxLength={100} /></Form.Item>
      <Form.Item name="category" label="分类"><Input maxLength={100} /></Form.Item>
      <Space className="catalog-form-row" align="start"><Form.Item name="unit" label="单位"><Input maxLength={30} /></Form.Item><Form.Item name="spec" label="规格"><Input maxLength={80} /></Form.Item></Space>
      <Form.Item name="description" label="说明"><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
    </Form>
  </Drawer>
}

function TransferDocumentDrawer({ open, tenantId, departments, products, revision, direction, onClose, onSaved, onReopen }: { open: boolean; tenantId?: number; departments: Department[]; products: CatalogItem[]; revision: number; direction: TransferDirection; onClose: () => void; onSaved: () => void; onReopen: () => void }) {
  const { message } = App.useApp()
  const [sourceDepartmentId, setSourceDepartmentId] = useState<number>()
  const [targetDepartmentId, setTargetDepartmentId] = useState<number>()
  const [operatorName, setOperatorName] = useState('负责人')
  const [remark, setRemark] = useState('')
  const [lines, setLines] = useState<TransferLineDraft[]>([])
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectionKeyword, setSelectionKeyword] = useState('')
  const [selectionBrand, setSelectionBrand] = useState<string>()
  const [selectionCategory, setSelectionCategory] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [newProductOpen, setNewProductOpen] = useState(false)
  const stockQuery = useCatalogQuery<PageResult<InventoryRow>>(sourceDepartmentId ? `/inventory?page=1&pageSize=100&departmentId=${sourceDepartmentId}&keyword=` : '/inventory?page=1&pageSize=100&keyword=', tenantId, revision, open && Boolean(sourceDepartmentId))
  const stockRows = stockQuery.data?.records ?? []
  const stockByItem = useMemo(() => new Map(stockRows.map(row => [row.itemId, row])), [stockRows])
  const brands = useMemo(() => [...new Set(products.map(item => item.brand).filter(Boolean))] as string[], [products])
  const categories = useMemo(() => [...new Set(products.map(item => item.category).filter(Boolean))] as string[], [products])
  const selectedDepartmentId = direction === 'IN' ? targetDepartmentId : sourceDepartmentId
  const selectedDepartmentName = departments.find(item => item.id === selectedDepartmentId)?.name ?? '—'
  const selectedProducts = products.filter(item => item.status === 1 && (!selectionKeyword || `${item.name} ${item.code}`.toLowerCase().includes(selectionKeyword.trim().toLowerCase())) && (!selectionBrand || item.brand === selectionBrand) && (!selectionCategory || item.category === selectionCategory))
  const title = direction === 'IN' ? '新增调拨入库' : '新增调拨出库'
  const actionText = direction === 'IN' ? '调拨入库' : '调拨出库'

  useEffect(() => {
    if (!open) return
    setSourceDepartmentId(undefined); setTargetDepartmentId(undefined); setOperatorName('负责人'); setRemark(''); setLines([]); setSelectionOpen(false); setSelectedProductIds([]); setSelectionKeyword(''); setSelectionBrand(undefined); setSelectionCategory(undefined); setSuccessOpen(false); setNewProductOpen(false)
  }, [open, direction])
  useEffect(() => {
    if (!stockRows.length) return
    setLines(current => current.map(line => ({ ...line, currentQuantity: Number(stockByItem.get(line.itemId)?.quantity ?? 0) })))
  }, [stockByItem, stockRows.length])

  function stockQuantity(itemId: number) { return Number(stockByItem.get(itemId)?.quantity ?? 0) }
  function addProducts() {
    const selected = products.filter(item => selectedProductIds.includes(item.id))
    setLines(current => [...current, ...selected.filter(item => !current.some(line => line.itemId === item.id)).map(item => ({ itemId: item.id, itemName: item.name, itemCode: item.code, unit: item.unit, spec: item.spec, currentQuantity: stockQuantity(item.id), quantity: 1, unitCost: Number(stockByItem.get(item.id)?.costPrice ?? item.price ?? 0), remark: '' }))])
    setSelectionOpen(false)
  }
  function updateLine(itemId: number, patch: Partial<TransferLineDraft>) { setLines(current => current.map(line => line.itemId === itemId ? { ...line, ...patch } : line)) }
  async function submit(status: 'DRAFT' | 'PENDING') {
    if (!sourceDepartmentId || !targetDepartmentId) { void message.warning('请选择调出仓库和调入仓库'); return }
    if (sourceDepartmentId === targetDepartmentId) { void message.warning('调出仓库和调入仓库不能相同'); return }
    if (!lines.length) { void message.warning('请先添加产品明细'); return }
    if (lines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0)) { void message.warning('调拨数量必须大于 0'); return }
    setSaving(true)
    try {
      await catalogRequest('/inventory/transfers', tenantId, { method: 'POST', body: JSON.stringify({ docType: direction === 'IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT', sourceDepartmentId, targetDepartmentId, documentDate: dayjs().format('YYYY-MM-DD'), operatorName: operatorName.trim() || '负责人', status, remark: remark.trim() || undefined, lines: lines.map(line => ({ itemId: line.itemId, quantity: line.quantity, unitCost: line.unitCost, remark: line.remark.trim() || undefined })) }) })
      onSaved(); onClose()
      if (status === 'PENDING') setSuccessOpen(true)
      else void message.success('调拨单已暂存')
    } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) }
  }
  return <>
    <Drawer className="transfer-drawer" placement="right" size="min(960px, calc(100vw - 32px))" title={title} open={open} onClose={onClose} destroyOnHidden footer={<div className="transfer-drawer-footer"><div className="transfer-footer-fields"><label>制单人<Input value="负责人" disabled /></label><label>备注<Input value={remark} onChange={event => setRemark(event.target.value)} placeholder="请输入备注" maxLength={300} /></label></div><Space><Button type="primary" onClick={() => void submit('PENDING')} loading={saving}>{actionText}</Button><Button onClick={() => void submit('DRAFT')} loading={saving}>暂存</Button></Space></div>}>
      <div className="transfer-header-card"><div className="transfer-header-fields"><label><span><em>*</em>调出仓库：</span><Select value={sourceDepartmentId} onChange={value => { setSourceDepartmentId(value); setLines([]); setSelectedProductIds([]) }} options={departmentOptions(departments)} placeholder="请选择门店/仓库" /></label><label><span><em>*</em>调入仓库：</span><Select value={targetDepartmentId} onChange={setTargetDepartmentId} options={departmentOptions(departments)} placeholder="请选择门店/仓库" /></label><label><span>经办人：</span><Input value={operatorName} onChange={event => setOperatorName(event.target.value)} placeholder="负责人" /></label></div><Button type="primary" disabled={!sourceDepartmentId || !targetDepartmentId} onClick={() => { setSelectedProductIds(lines.map(line => line.itemId)); setSelectionOpen(true) }}>添加产品</Button></div>
      <div className="transfer-lines-card"><Table<TransferLineDraft> rowKey="itemId" columns={[
        { title: '#', key: 'index', width: 54, render: (_value, _row, index) => index + 1 },
        { title: '编号', dataIndex: 'itemCode', width: 120 },
        { title: '产品名称', dataIndex: 'itemName', width: 240 },
        { title: '当前库存', dataIndex: 'currentQuantity', width: 120 },
        { title: '调拨数量', key: 'quantity', width: 130, render: (_value, row) => <InputNumber min={0.001} precision={3} value={row.quantity} onChange={value => updateLine(row.itemId, { quantity: Number(value ?? 0) })} /> },
        { title: '调拨单价', key: 'unitCost', width: 130, render: (_value, row) => <InputNumber min={0} precision={2} value={row.unitCost} onChange={value => updateLine(row.itemId, { unitCost: Number(value ?? 0) })} /> },
        { title: '备注', key: 'remark', width: 260, render: (_value, row) => <Input value={row.remark} onChange={event => updateLine(row.itemId, { remark: event.target.value })} placeholder="请输入备注" maxLength={300} /> },
        { title: '操作', key: 'action', width: 90, render: (_value, row) => <Button type="link" danger onClick={() => { setLines(current => current.filter(line => line.itemId !== row.itemId)); setSelectedProductIds(ids => ids.filter(id => id !== row.itemId)) }}>删除</Button> },
      ]} dataSource={lines} pagination={false} scroll={{ x: 1160 }} locale={{ emptyText: <div className="transfer-empty"><div className="inventory-placeholder-icon"><PlusOutlined /></div><span>暂无相关数据</span><small>点击“添加产品”开始调拨</small></div> }} summary={current => current.length ? <Table.Summary><Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}>合计</Table.Summary.Cell><Table.Summary.Cell index={3}>{current.reduce((sum, line) => sum + Number(line.currentQuantity || 0), 0)}</Table.Summary.Cell><Table.Summary.Cell index={4}>{current.reduce((sum, line) => sum + Number(line.quantity || 0), 0)}</Table.Summary.Cell><Table.Summary.Cell index={5} colSpan={3} /></Table.Summary.Row></Table.Summary> : undefined} /></div>
      <div className="transfer-meta-bar"><span>{direction === 'IN' ? '调入仓库' : '调出仓库'}：{selectedDepartmentName}</span><span>已添加 {lines.length} 个产品</span></div>
    </Drawer>
    <Drawer className="transfer-select-drawer" placement="right" size="min(960px, calc(100vw - 32px))" title={<Space><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setSelectionOpen(false)} /><strong>选择产品</strong></Space>} extra={<Space><Button onClick={() => setSelectionOpen(false)}>取消</Button><Button type="primary" icon={<CheckOutlined />} onClick={addProducts}>确认</Button></Space>} closable={false} open={selectionOpen} onClose={() => setSelectionOpen(false)}>
      <div className="transfer-selection-filters"><div className="transfer-selection-fields"><Select allowClear value={selectionCategory} onChange={setSelectionCategory} options={categories.map(value => ({ value, label: value }))} placeholder="请选择产品类别" /><Select allowClear value={selectionBrand} onChange={setSelectionBrand} options={brands.map(value => ({ value, label: value }))} placeholder="请选择产品品牌" /><Input.Search allowClear value={selectionKeyword} onChange={event => setSelectionKeyword(event.target.value)} placeholder="请输入产品名称或编号" /></div><Button onClick={() => setNewProductOpen(true)}>添加新产品</Button></div>
      <Table<CatalogItem> rowKey="id" rowSelection={{ selectedRowKeys: selectedProductIds, onChange: keys => setSelectedProductIds(keys as number[]) }} dataSource={selectedProducts} pagination={{ ...paginationOptions, pageSize: 10 }} columns={[{ title: '产品信息', key: 'item', width: 320, render: (_value, row) => <div className="catalog-cell-stack"><strong>{row.name}</strong><span>{row.code}</span></div> }, { title: '产品品类', dataIndex: 'category', width: 150, render: value => value || '—' }, { title: '成本价', key: 'cost', width: 110, render: (_value, row) => stockByItem.get(row.id)?.costPrice ?? row.price ?? 0 }, { title: '品牌', dataIndex: 'brand', width: 120, render: value => value || '—' }, { title: '规格/单位', key: 'spec', width: 160, render: (_value, row) => `${row.spec || '—'} / ${row.unit || '—'}` }, { title: '库存余量', key: 'stock', width: 110, render: (_value, row) => stockQuantity(row.id) }]} scroll={{ x: 1050 }} locale={{ emptyText: '暂无相关数据' }} />
    </Drawer>
    <TransferProductDrawer open={newProductOpen} tenantId={tenantId} onClose={() => setNewProductOpen(false)} onSaved={onSaved} />
    <Modal className="catalog-modal" width={560} centered title={actionText + '完成!'} open={successOpen} onCancel={() => setSuccessOpen(false)} footer={<Space><Button type="primary" onClick={() => { setSuccessOpen(false); onReopen() }}>新建{actionText}</Button><Button onClick={() => setSuccessOpen(false)}>返回调拨管理</Button></Space>}><Result status="success" title={actionText + '完成!'} /></Modal>
  </>
}

function TransferDocumentDetailDrawer({ open, id, tenantId, revision, onClose, onChanged }: { open: boolean; id?: number; tenantId?: number; revision: number; onClose: () => void; onChanged: () => void }) {
  const { message } = App.useApp()
  const query = useCatalogQuery<InventoryDocumentDetail>(id ? `/inventory/documents/${id}` : '/inventory/documents/0', tenantId, revision, open && Boolean(id))
  const [saving, setSaving] = useState(false)
  const detail = query.data
  async function revoke() {
    if (!id) return
    setSaving(true)
    try { await catalogRequest(`/inventory/documents/${id}/revoke`, tenantId, { method: 'POST' }); void message.success('调拨单已撤销'); onChanged(); onClose() } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) }
  }
  async function accept() {
    if (!id) return
    setSaving(true)
    try { await catalogRequest(`/inventory/documents/${id}/accept`, tenantId, { method: 'POST' }); void message.success('已确认收货'); onChanged(); onClose() } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) }
  }
  async function reject() {
    if (!id) return
    setSaving(true)
    try { await catalogRequest(`/inventory/documents/${id}/reject`, tenantId, { method: 'POST' }); void message.success('已拒收调拨单'); onChanged(); onClose() } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) }
  }
  const columns: ColumnsType<InventoryDocumentLine> = [
    { title: '#', key: 'index', width: 54, render: (_value, _row, index) => index + 1 },
    { title: '产品信息', key: 'item', width: 280, render: (_value, row) => <div className="catalog-cell-stack"><strong>{row.itemName}</strong><span>{row.itemCode}</span></div> },
    { title: '单位', dataIndex: 'unit', width: 90, render: value => value || '—' },
    { title: '调拨数量', dataIndex: 'quantity', width: 120 },
    { title: '当前库存', dataIndex: 'currentQuantity', width: 120 },
    { title: '调拨单价', dataIndex: 'unitCost', width: 120, render: money },
    { title: '备注', dataIndex: 'remark', width: 220, render: value => value || '—' },
  ]
  const inboundPending = detail?.docType === 'TRANSFER_IN' && detail.status === 'PENDING'
  return <Drawer className="transfer-detail-drawer" placement="right" size="min(960px, calc(100vw - 32px))" title={detail?.docType === 'TRANSFER_OUT' ? '调拨出库明细' : '调拨入库明细'} open={open} onClose={onClose} destroyOnHidden footer={detail && inboundPending ? <div className="drawer-actions"><Button danger loading={saving} onClick={() => void reject()}>拒收</Button><Button type="primary" loading={saving} onClick={() => void accept()}>确认收货</Button></div> : detail && (detail.status === 'PENDING' || detail.status === 'DRAFT') ? <div className="drawer-actions"><Button danger type="primary" loading={saving} onClick={() => void revoke()}>撤销</Button></div> : null}>
    <QueryError error={query.error} onRetry={query.reload} />
     {detail && <><div className="transfer-detail-header"><div><span>{detail.docType === 'TRANSFER_OUT' ? '调出门店' : '调入门店'}：</span><strong>{(detail.docType === 'TRANSFER_OUT' ? detail.sourceDepartmentName : detail.targetDepartmentName) || '—'}</strong><span>调拨单号：</span><strong>{detail.documentNo}</strong><span>状态：</span><strong>{transferListStatusLabel(detail.status, detail.docType)}</strong><span>备注信息：</span><strong>{detail.remark || '—'}</strong></div><div><span>经办人：</span><strong>{detail.operatorName || '负责人'}</strong><span>制单人：</span><strong>{detail.creatorName || '负责人'}</strong><span>制单时间：</span><strong>{date(detail.createTime)}</strong></div></div><Table<InventoryDocumentLine> rowKey="id" columns={columns} dataSource={detail.lines ?? []} pagination={false} scroll={{ x: 1020 }} locale={{ emptyText: query.loading ? <Spin /> : '暂无相关数据' }} summary={current => current.length ? <Table.Summary><Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}>总计</Table.Summary.Cell><Table.Summary.Cell index={3}>{current.reduce((sum, line) => sum + Number(line.quantity || 0), 0)}</Table.Summary.Cell><Table.Summary.Cell index={4} /><Table.Summary.Cell index={5}>{money(current.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0))}</Table.Summary.Cell><Table.Summary.Cell index={6} /></Table.Summary.Row></Table.Summary> : undefined} /></>}
  </Drawer>
}

function DocumentTable({ query, page, setPage, onDetail }: { query: { data?: PageResult<InventoryDocumentRow>; error: string; loading: boolean; reload: () => void }; page: number; setPage: (page: number) => void; onDetail: (row: InventoryDocumentRow) => void }) {
  const columns: ColumnsType<InventoryDocumentRow> = [{ title: '单据号', dataIndex: 'documentNo', width: 180 }, { title: '调出仓', dataIndex: 'sourceDepartmentName', width: 170, render: value => value || '—' }, { title: '调入仓', dataIndex: 'targetDepartmentName', width: 170, render: value => value || '—' }, { title: '调出时间', dataIndex: 'documentDate', width: 140, render: (value, row) => row.status === 'CONFIRMED' ? value || '—' : '—' }, { title: '调入时间', dataIndex: 'transferDate', width: 140, render: value => value || '—' }, { title: '申请时间', dataIndex: 'applicationTime', width: 160, render: (value, row) => date(value || row.createTime) }, { title: '制单人', dataIndex: 'creatorName', width: 120, render: value => value || '负责人' }, { title: '状态', dataIndex: 'status', width: 100, render: (value: InventoryDocumentStatus, row) => <Tag color={value === 'CONFIRMED' ? 'success' : value === 'CANCELLED' ? 'default' : 'processing'}>{transferListStatusLabel(value, row.docType)}</Tag> }, { title: '操作', key: 'actions', width: 90, render: (_value, row) => <Button type="link" onClick={() => onDetail(row)}>详情</Button> }]
  return <><QueryError error={query.error} onRetry={query.reload} /><Table<InventoryDocumentRow> rowKey="id" loading={query.loading} columns={columns} dataSource={query.data?.records ?? []} scroll={{ x: 1180 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : '暂无相关数据' }} /><div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div></>
}

function CallWorkspace({ tenantId, platform, departments, products, revision, setRevision, writable }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number; setRevision: (value: (current: number) => number) => void; writable: boolean }) {
  const { message } = App.useApp(); const [direction, setDirection] = useState<TransferDirection>('IN'); const [page, setPage] = useState(1); const [keyword, setKeyword] = useState(''); const [status, setStatus] = useState<InventoryDocumentStatus>(); const [sourceDepartmentId, setSourceDepartmentId] = useState<number>(); const [targetDepartmentId, setTargetDepartmentId] = useState<number>(); const [transferRange, setTransferRange] = useState<[Dayjs, Dayjs]>(); const [applyRange, setApplyRange] = useState<[Dayjs, Dayjs]>(); const [open, setOpen] = useState(false); const [detailId, setDetailId] = useState<number>();
  const docType: InventoryDocumentType = direction === 'IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT'
  useEffect(() => { setStatus(direction === 'OUT' ? 'PENDING' : undefined); setPage(1) }, [direction])
  const query = useCatalogQuery<PageResult<InventoryDocumentRow>>(`/inventory/documents?docType=${docType}&page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${status ? `&status=${status}` : ''}${sourceDepartmentId ? `&sourceDepartmentId=${sourceDepartmentId}` : ''}${targetDepartmentId ? `&targetDepartmentId=${targetDepartmentId}` : ''}${transferRange ? `&transferStartDate=${transferRange[0].format('YYYY-MM-DD')}&transferEndDate=${transferRange[1].format('YYYY-MM-DD')}` : ''}${applyRange ? `&applyStartDate=${applyRange[0].format('YYYY-MM-DD')}&applyEndDate=${applyRange[1].format('YYYY-MM-DD')}` : ''}`, tenantId, revision, platform ? tenantId !== undefined : true)
  function resetFilters() { setKeyword(''); setStatus(undefined); setSourceDepartmentId(undefined); setTargetDepartmentId(undefined); setTransferRange(undefined); setApplyRange(undefined); setPage(1); setRevision(value => value + 1) }
  return <><Tabs activeKey={direction} items={[{ key: 'IN', label: '调拨入库管理' }, { key: 'OUT', label: '调拨出库管理' }]} onChange={next => { setDirection(next as TransferDirection); setDetailId(undefined) }} /><div className="inventory-sub-actions"><Space wrap><Button type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => setOpen(true)}>{direction === 'IN' ? '新建调拨入库' : '新建调拨出库'}</Button><Button icon={<DownloadOutlined />} onClick={() => { if (!downloadCsv('调拨管理.csv', ['单据号', '调出仓', '调入仓', '调出时间', '调入时间', '申请时间', '制单人', '状态'], (query.data?.records ?? []).map(row => [row.documentNo, row.sourceDepartmentName, row.targetDepartmentName, row.status === 'CONFIRMED' ? row.documentDate : '', row.transferDate || '', date(row.applicationTime || row.createTime), row.creatorName, transferListStatusLabel(row.status, row.docType)]))) void message.info('暂无可下载数据') }}>报表下载</Button></Space></div><div className="inventory-filter-row"><Select allowClear placeholder="调入仓库" value={targetDepartmentId} onChange={value => { setTargetDepartmentId(value); setPage(1) }} options={departmentOptions(departments)} /><Select allowClear placeholder="调出仓库" value={sourceDepartmentId} onChange={value => { setSourceDepartmentId(value); setPage(1) }} options={departmentOptions(departments)} /><Select allowClear placeholder="请选择调拨状态" value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PENDING', label: direction === 'IN' ? '出库中' : '待审批' }, { value: 'CONFIRMED', label: '已确认' }, { value: 'CANCELLED', label: '已取消' }]} /><DatePicker.RangePicker placeholder={[direction === 'IN' ? '调入开始日期' : '调出开始日期', direction === 'IN' ? '调入结束日期' : '调出结束日期']} value={transferRange} onChange={value => { setTransferRange(value?.[0] && value?.[1] ? [value[0], value[1]] : undefined); setPage(1) }} /><DatePicker.RangePicker placeholder={['申请开始日期', '申请结束日期']} value={applyRange} onChange={value => { setApplyRange(value?.[0] && value?.[1] ? [value[0], value[1]] : undefined); setPage(1) }} /><Input.Search aria-label="单据号" placeholder="请输入单据号" allowClear enterButton="搜索" onSearch={value => { setKeyword(value.trim()); setPage(1) }} /><Button onClick={resetFilters}>重置</Button></div><DocumentTable query={query} page={page} setPage={setPage} onDetail={row => setDetailId(row.id)} /><TransferDocumentDrawer open={open} tenantId={tenantId} departments={departments} products={products} revision={revision} direction={direction} onClose={() => setOpen(false)} onSaved={() => setRevision(value => value + 1)} onReopen={() => setOpen(true)} /><TransferDocumentDetailDrawer open={detailId !== undefined} id={detailId} tenantId={tenantId} revision={revision} onClose={() => setDetailId(undefined)} onChanged={() => setRevision(value => value + 1)} /></>
}

function OpeningInventoryWorkspace({ tenantId, platform, departments, products, revision, onOpenMovement, writable }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number; onOpenMovement: (type: 'IN' | 'OUT') => void; writable: boolean }) {
  const [page, setPage] = useState(1); const [keyword, setKeyword] = useState(''); const [brand, setBrand] = useState<string>(); const [category, setCategory] = useState<string>(); const [departmentId, setDepartmentId] = useState<number>(); const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs(), dayjs()])
  const query = useCatalogQuery<PageResult<InventoryAccountRow>>(`/inventory/account?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${brand ? `&brand=${encodeURIComponent(brand)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${departmentId ? `&departmentId=${departmentId}` : ''}&startDate=${range[0].format('YYYY-MM-DD')}&endDate=${range[1].format('YYYY-MM-DD')}`, tenantId, revision, platform ? tenantId !== undefined : true)
  const brands = [...new Set(products.map(item => item.brand).filter(Boolean))] as string[]; const categories = [...new Set(products.map(item => item.category).filter(Boolean))] as string[]
  const columns: ColumnsType<InventoryAccountRow> = [
    { title: '产品信息', key: 'item', width: 250, render: (_: unknown, row) => <div className="catalog-cell-stack"><strong>{row.itemName}</strong><span>{row.itemCode}</span></div> },
    { title: '所属仓库', dataIndex: 'departmentName', width: 180 },
    { title: '单位', dataIndex: 'unit', width: 80, render: value => value || '—' },
    { title: '产品品牌', dataIndex: 'brand', width: 120, render: value => value || '—' },
    { title: '产品品类', dataIndex: 'category', width: 120, render: value => value || '—' },
    { title: '本期入库数', dataIndex: 'inboundQuantity', width: 120, sorter: (left, right) => Number(left.inboundQuantity) - Number(right.inboundQuantity) },
    { title: '本期出库数', dataIndex: 'outboundQuantity', width: 120, sorter: (left, right) => Number(left.outboundQuantity) - Number(right.outboundQuantity) },
    { title: '期初库存', dataIndex: 'openingQuantity', width: 110, sorter: (left, right) => Number(left.openingQuantity) - Number(right.openingQuantity) },
    { title: '期末库存', dataIndex: 'endingQuantity', width: 110, sorter: (left, right) => Number(left.endingQuantity) - Number(right.endingQuantity) },
    { title: '本期库存变化', key: 'change', width: 130, render: (_: unknown, row) => Number(row.inboundQuantity || 0) - Number(row.outboundQuantity || 0) },
  ]
  function download() {
    const rows = query.data?.records ?? []
    if (!downloadCsv('期初期末库存查询.csv', ['产品信息', '所属仓库', '单位', '产品品牌', '产品品类', '本期入库数', '本期出库数', '期初库存', '期末库存', '本期库存变化'], rows.map(row => [row.itemName, row.departmentName, row.unit, row.brand, row.category, row.inboundQuantity, row.outboundQuantity, row.openingQuantity, row.endingQuantity, Number(row.inboundQuantity || 0) - Number(row.outboundQuantity || 0)]))) return
  }
  return <div className="opening-inventory-page">
    <div className="inventory-settings-summary"><div><strong>0</strong><span>待确认收货</span></div><div><strong>0</strong><span>调拨申请处理</span></div><div><strong>0</strong><span>预警库存</span></div><div><strong>0</strong><span>保质期预警</span></div></div>
    <div className="inventory-action-bar"><Space wrap><Button type="primary" icon={<SwapOutlined />} disabled={!writable} onClick={() => onOpenMovement('OUT')}>产品出库</Button><Button type="primary" icon={<SwapOutlined />} disabled={!writable} onClick={() => onOpenMovement('IN')}>产品入库</Button><Button icon={<DownloadOutlined />} onClick={download}>报表下载</Button></Space></div>
    <div className="inventory-filter-row"><Select allowClear placeholder="全部门店" value={departmentId} onChange={value => { setDepartmentId(value); setPage(1) }} options={departmentOptions(departments)} /><Select allowClear placeholder="请选择品牌" value={brand} onChange={value => { setBrand(value); setPage(1) }} options={brands.map(value => ({ value, label: value }))} /><Select allowClear placeholder="请选择分类" value={category} onChange={value => { setCategory(value); setPage(1) }} options={categories.map(value => ({ value, label: value }))} /><DatePicker.RangePicker value={range} format="YYYY-MM-DD" allowClear={false} onChange={value => { if (value?.[0] && value?.[1]) { setRange([value[0], value[1]]); setPage(1) } }} /><Input.Search aria-label="搜索产品名称或编号" placeholder="请输入产品名称/编号" allowClear onSearch={value => { setKeyword(value.trim()); setPage(1) }} /></div>
    <QueryError error={query.error} onRetry={query.reload} />
    <Table<InventoryAccountRow> rowKey="id" loading={query.loading} columns={columns} dataSource={query.data?.records ?? []} scroll={{ x: 1320 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : '暂无相关数据' }} />
    <div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div>
  </div>
}

function InventoryWarningForm({ open, row, tenantId, onClose, onSaved }: { open: boolean; row?: InventoryRow; tenantId?: number; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false); const { message } = App.useApp()
  const submit = async (values: Record<string, unknown>) => { if (!row) return; setSaving(true); try { await catalogRequest(`/inventory/${row.id}/warning`, tenantId, { method: 'PUT', body: JSON.stringify({ warningValue: values.warningValue }) }); void message.success('库存下限已更新'); onSaved(); onClose() } catch (cause) { void message.error(errorMessage(cause)) } finally { setSaving(false) } }
  return <Modal className="catalog-modal" width={480} centered title="修改库存下限" open={open} onCancel={onClose} destroyOnClose footer={null} afterOpenChange={visible => { if (visible && row) form.setFieldsValue({ warningValue: row.warningValue }) }}><Form form={form} layout="vertical" initialValues={{ warningValue: row?.warningValue ?? 0 }} onFinish={submit}><p className="catalog-form-hint">{row?.itemName ?? '库存品项'} · {row?.departmentName ?? '门店'}</p><Form.Item name="warningValue" label="库存下限" rules={[{ required: true, message: '请输入库存下限' }]}><InputNumber min={0} precision={3} style={{ width: '100%' }} /></Form.Item><div className="catalog-dialog-actions"><Button onClick={onClose}>取消</Button><Button type="primary" htmlType="submit" loading={saving}>保存</Button></div></Form></Modal>
}

function InventoryRowDetail({ open, title, row, tenantId, onClose }: { open: boolean; title: string; row?: InventoryRow; tenantId?: number; onClose: () => void }) {
  const isStock = title === '库存明细'; const isExpiry = title === '保质期明细'; const [range, setRange] = useState<[Dayjs, Dayjs]>()
  const dateQuery = range ? `&startDate=${range[0].format('YYYY-MM-DD')}&endDate=${range[1].format('YYYY-MM-DD')}` : ''
  const changePath = row ? `/inventory/${row.id}/changes?page=1&pageSize=50${dateQuery}` : '/inventory/1/changes?page=1&pageSize=50'
  const batchPath = row ? `/inventory/batches?page=1&pageSize=100&departmentId=${row.departmentId}&itemId=${row.itemId}` : '/inventory/batches?page=1&pageSize=100'
  const changes = useCatalogQuery<PageResult<InventoryChangeRow>>(changePath, tenantId, 0, open && isStock && Boolean(row))
  const batches = useCatalogQuery<PageResult<InventoryBatchRow>>(batchPath, tenantId, 0, open && !isStock && Boolean(row))
  const changeColumns: ColumnsType<InventoryChangeRow> = [
    { title: '操作时间', dataIndex: 'createTime', width: 160, render: date },
    { title: '出入库类型', dataIndex: 'changeType', width: 110, render: (value: InventoryChangeType) => <Tag color={value === 'IN' ? 'green' : value === 'OUT' ? 'orange' : 'blue'}>{value === 'IN' ? '入库' : value === 'OUT' ? '出库' : '盘点'}</Tag> },
    { title: '数量', dataIndex: 'quantity', width: 100 }, { title: '单位成本', dataIndex: 'unitCost', width: 110, render: money },
    { title: '单据号', dataIndex: 'referenceNo', width: 150, render: value => value || '—' }, { title: '备注', dataIndex: 'reason', width: 220, render: value => value || '—' },
  ]
  const batchColumns: ColumnsType<InventoryBatchRow> = [
    { title: '批次', dataIndex: 'batchName', width: 180 }, { title: '数量', dataIndex: 'quantity', width: 100, render: value => value ?? 0 },
    { title: '生产日期', dataIndex: 'productionDate', width: 120, render: value => value || '—' }, { title: '保质期至', dataIndex: 'expiryDate', width: 120, render: value => value || '—' },
    ...(isExpiry ? [{ title: '有效期状态', key: 'expiryStatus', width: 110, render: (_: unknown, batch: InventoryBatchRow) => { if (!batch.expiryDate) return <Tag>未设置</Tag>; const days = dayjs(batch.expiryDate).diff(dayjs(), 'day'); return <Tag color={days < 0 ? 'error' : days <= 30 ? 'warning' : 'success'}>{days < 0 ? '已过期' : days <= 30 ? '临期' : '正常'}</Tag> } }] : []),
    { title: '备注', dataIndex: 'remark', width: 220, render: value => value || '—' },
  ]
  return <Modal className="catalog-modal inventory-detail-modal" width={980} centered title={title} open={open} onCancel={onClose} destroyOnClose footer={null}>
    <div className="catalog-detail-grid"><span>产品信息</span><strong>{row?.itemName ?? '—'}</strong><span>产品编码</span><strong>{row?.itemCode ?? '—'}</strong><span>所属门店</span><strong>{row?.departmentName ?? '—'}</strong><span>当前库存</span><strong>{row ? `${row.quantity} ${row.unit ?? ''}` : '—'}</strong></div>
    {isStock && <div className="inventory-detail-filters"><span>出入库时间</span><DatePicker.RangePicker value={range} onChange={value => { if (value?.[0] && value?.[1]) setRange([value[0], value[1]]); else setRange(undefined) }} /></div>}
    {isStock ? <><QueryError error={changes.error} onRetry={changes.reload} /><Table<InventoryChangeRow> rowKey="id" loading={changes.loading} columns={changeColumns} dataSource={changes.data?.records ?? []} scroll={{ x: 860 }} pagination={false} locale={{ emptyText: changes.loading ? <Spin /> : '暂无库存流水' }} /></> : <><QueryError error={batches.error} onRetry={batches.reload} /><Table<InventoryBatchRow> rowKey="id" loading={batches.loading} columns={batchColumns} dataSource={batches.data?.records ?? []} scroll={{ x: 860 }} pagination={false} locale={{ emptyText: batches.loading ? <Spin /> : isExpiry ? '暂无保质期记录' : '暂无批次记录' }} /></>}
  </Modal>
}

function InventorySettingsWorkspace({ tenantId, platform, revision, setRevision, onOpenMovement, writable }: { tenantId?: number; platform: boolean; revision: number; setRevision: (value: (current: number) => number) => void; onOpenMovement: (type: 'IN' | 'OUT') => void; writable: boolean }) {
  const [form] = Form.useForm<InventorySettings>(); const { message } = App.useApp(); const enabled = platform ? tenantId !== undefined : true
  const query = useCatalogQuery<InventorySettings>('/inventory/settings', tenantId, revision, enabled)
  const values = Form.useWatch([], form) as Partial<InventorySettings> | undefined
  useEffect(() => { if (query.data) form.setFieldsValue({ ...DEFAULT_INVENTORY_SETTINGS, ...query.data }) }, [form, query.data])
  const save = async () => {
    try {
      const settings = await form.validateFields()
      await catalogRequest('/inventory/settings', tenantId, { method: 'PUT', body: JSON.stringify(settings) })
      void message.success('库存设置已保存'); setRevision(value => value + 1)
    } catch (cause) { if (cause instanceof Error) void message.error(errorMessage(cause)) }
  }
  const settingRows = [
    <div className="inventory-setting-row" key="shortage"><div><strong>库存不足无法进行开单</strong><span>开启后当产品数量小于等于 0 时，系统无法开单售卖该产品。</span></div><Form.Item name="preventOrderOnShortage" valuePropName="checked" noStyle><Switch disabled={!writable} /></Form.Item></div>,
    <div className="inventory-setting-row" key="transfer"><div><strong>调拨自动确认收货设置</strong><span>开启后，自调拨出库时间起，发货时间大于设定天数，系统将自动确认调拨收货。</span></div><div className="inventory-setting-control"><Form.Item name="transferAutoConfirmDays" noStyle><InputNumber min={0} precision={0} disabled={!writable || !values?.transferAutoConfirmEnabled} /></Form.Item><span>天</span><Form.Item name="transferAutoConfirmEnabled" valuePropName="checked" noStyle><Switch disabled={!writable} /></Form.Item></div></div>,
    <div className="inventory-setting-row" key="stock-alert"><div><strong>库存预警提示</strong><span>设置库存预警提示数值，库存低于该数值时提醒。</span></div><div className="inventory-setting-control"><Form.Item name="stockAlertValue" noStyle><InputNumber min={0} precision={3} disabled={!writable || !values?.stockAlertEnabled} /></Form.Item><Form.Item name="stockAlertEnabled" valuePropName="checked" noStyle><Switch disabled={!writable} /></Form.Item></div></div>,
    <div className="inventory-setting-row" key="expiry-alert"><div><strong>产品保质期预警提示</strong><span>设置产品保质期提醒，到期前进入预警周期。</span></div><div className="inventory-setting-control"><span>到期前</span><Form.Item name="expiryAlertMonths" noStyle><Select disabled={!writable || !values?.expiryAlertEnabled} options={[{ value: 3, label: '3个月' }, { value: 6, label: '6个月' }, { value: 12, label: '12个月' }]} /></Form.Item><Form.Item name="expiryAlertEnabled" valuePropName="checked" noStyle><Switch disabled={!writable} /></Form.Item></div></div>,
    <div className="inventory-setting-row" key="deduct"><div><strong>通过开单销售的产品是否扣除库存</strong><span>仅扣除已入库商品，未入库商品不扣除库存。</span></div><Form.Item name="salesDeductInventory" noStyle><Radio.Group disabled={!writable} options={[{ value: true, label: '扣除系统库存' }, { value: false, label: '不扣除系统库存' }]} /></Form.Item></div>,
    <div className="inventory-setting-row" key="delete-sync"><div><strong>删除产品后库存管理同步删除</strong><span>开启后删除产品的同时，库存管理将同步删除该产品。</span></div><Form.Item name="deleteProductSyncInventory" valuePropName="checked" noStyle><Switch disabled={!writable} /></Form.Item></div>,
  ]
  return <div className="inventory-settings-page">
    <div className="inventory-settings-summary">
      <div><strong>0</strong><span>待确认收货</span></div>
      <div><strong>0</strong><span>调拨申请处理</span></div>
      <div><strong>0</strong><span>预警库存</span></div>
      <div><strong>0</strong><span>保质期预警</span></div>
    </div>
    <div className="inventory-settings-toolbar"><Space wrap><Button type="primary" icon={<SwapOutlined />} disabled={!writable} onClick={() => onOpenMovement('OUT')}>产品出库</Button><Button type="primary" icon={<SwapOutlined />} disabled={!writable} onClick={() => onOpenMovement('IN')}>产品入库</Button><Button icon={<ReloadOutlined />} onClick={() => setRevision(value => value + 1)}>刷新</Button></Space></div>
    <QueryError error={query.error} onRetry={query.reload} />
    <Form form={form} layout="vertical" initialValues={DEFAULT_INVENTORY_SETTINGS}>
      <Form.Item name="version" hidden><InputNumber /></Form.Item>
      <div className="inventory-settings-list">{settingRows}</div>
      <div className="inventory-settings-actions"><Button type="primary" disabled={!writable} loading={query.loading} onClick={() => void save()}>保存设置</Button></div>
    </Form>
  </div>
}

export default function InventoryWorkspace({ tenantId, platform }: { tenantId?: number; platform: boolean }) {
  const { can } = useAuth(); const [params, setParams] = useSearchParams(); const rawView = params.get('view'); const view = (inventoryTabs.some(item => item.key === rawView) ? rawView : 'stock') as InventoryView; const [revision, setRevision] = useState(0); const [movementType, setMovementType] = useState<'IN' | 'OUT'>(); const [warningRow, setWarningRow] = useState<InventoryRow>(); const [detail, setDetail] = useState<{ row: InventoryRow; title: string }>(); const enabled = platform ? tenantId !== undefined : true; const items = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=PRODUCT&page=1&pageSize=100&status=1', tenantId, revision, enabled); const departments = useCatalogQuery<Department[]>('/iam/departments', tenantId, revision, enabled); const writable = platform || can('inventory:write')
  if (!platform && !can('inventory:read')) return <Result status="403" title="暂无库存管理权限" />
  const products = items.data?.records ?? []; const stores = departments.data ?? []
  function selectView(next: string) { setParams(currentParams => { currentParams.set('view', next); return currentParams }); }
  function openMovement(type: 'IN' | 'OUT') { setMovementType(type) }
  return <section className="catalog-panel inventory-catalog-panel"><div className="catalog-tabs-row"><Tabs activeKey={view} items={inventoryTabs.map(item => ({ key: item.key, label: item.label }))} onChange={selectView} /><Space className="catalog-actions"><Button icon={<ReloadOutlined />} aria-label="刷新库存" onClick={() => setRevision(value => value + 1)} /></Space></div><QueryError error={items.error || departments.error} onRetry={() => { items.reload(); departments.reload() }} />{view === 'stock' && <StockWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} setRevision={setRevision} onOpenMovement={openMovement} onOpenDetail={(row, title) => setDetail({ row, title })} onEditWarning={setWarningRow} />}{view === 'opening' && <OpeningInventoryWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} onOpenMovement={openMovement} writable={writable} />}{view === 'changes' && <ChangeWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} setRevision={setRevision} onOpenMovement={openMovement} writable={writable} />}{view === 'batch' && <BatchWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} setRevision={setRevision} writable={writable} />}{view === 'liquidation' && <InventoryLiquidationWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} setRevision={setRevision} writable={writable} />}{view === 'call' && <CallWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} setRevision={setRevision} writable={writable} />}{view === 'account' && <InventoryCostWorkspace tenantId={tenantId} platform={platform} departments={stores} products={products} revision={revision} setRevision={setRevision} writable={writable} />}{view === 'settings' && <InventorySettingsWorkspace tenantId={tenantId} platform={platform} revision={revision} setRevision={setRevision} onOpenMovement={openMovement} writable={writable} />}<InventoryMovementForm open={movementType !== undefined} tenantId={tenantId} departments={stores} products={products} revision={revision} initialType={movementType ?? 'IN'} onClose={() => setMovementType(undefined)} onSaved={() => setRevision(value => value + 1)} /><InventoryWarningForm open={warningRow !== undefined} row={warningRow} tenantId={tenantId} onClose={() => setWarningRow(undefined)} onSaved={() => setRevision(value => value + 1)} /><InventoryRowDetail open={detail !== undefined} title={detail?.title ?? '库存明细'} row={detail?.row} tenantId={tenantId} onClose={() => setDetail(undefined)} /></section>
}
