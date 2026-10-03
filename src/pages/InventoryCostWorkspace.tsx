import { useEffect, useMemo, useRef, useState, type Key } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { App, Button, DatePicker, Drawer, Empty, Input, InputNumber, Pagination, Select, Space, Spin, Table, Tabs, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, DownloadOutlined, InfoCircleOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { errorMessage, QueryError, paginationOptions } from '@/components/iam/shared'
import { catalogRequest, useCatalogQuery } from '@/api/catalog'
import type { Department, PageResult } from '@/types/iam'
import type { CatalogItem, CostAccountingPage, CostAccountingRow, CostAdjustmentLine, CostAdjustmentRecord, CostDetailResult, InventoryRow } from '@/types/catalog'

type RangeValue = [Dayjs, Dayjs] | undefined

function currency(value: number | string | undefined) {
  return `¥${Number(value ?? 0).toFixed(2)}`
}

function quantity(value: number | string | undefined) {
  return Number(value ?? 0).toFixed(3).replace(/\.000$/, '')
}

function dateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '—'
}

function stores(departments: Department[]) {
  return departments.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name }))
}

function csvDownload(filename: string, headers: string[], rows: Array<Array<string | number | undefined | null>>) {
  if (!rows.length) return false
  const quote = (value: string | number | undefined | null) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [headers, ...rows].map(row => row.map(quote).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return true
}

function rangeQuery(range: RangeValue) {
  return range ? `&startDate=${range[0].format('YYYY-MM-DD')}&endDate=${range[1].format('YYYY-MM-DD')}` : ''
}

function CostDetailDrawer({ open, row, tenantId, range, onClose }: { open: boolean; row?: CostAccountingRow; tenantId?: number; range: RangeValue; onClose: () => void }) {
  const path = row ? `/inventory/cost-accounting/${row.id}/details?page=1&pageSize=10${rangeQuery(range)}` : '/inventory/cost-accounting/0/details?page=1&pageSize=10'
  const query = useCatalogQuery<CostDetailResult>(path, tenantId, 0, open && Boolean(row))
  const records = query.data?.records ?? []
  const detail = query.data?.metadata
  const summary = query.data?.summary
  const columns: ColumnsType<CostDetailResult['records'][number]> = [
    { title: '单号', dataIndex: 'documentNo', width: 170, render: value => value || '—' },
    { title: '出入库时间', dataIndex: 'occurredAt', width: 160, render: dateTime },
    { title: '类型', dataIndex: 'type', width: 110 },
    { title: '入库', children: [
      { title: '数量', dataIndex: 'inboundQuantity', width: 90, render: quantity },
      { title: '单位成本', dataIndex: 'inboundUnitCost', width: 100, render: currency },
      { title: '成本总额', dataIndex: 'inboundCost', width: 110, render: currency },
    ] },
    { title: '出库', children: [
      { title: '数量', dataIndex: 'outboundQuantity', width: 90, render: quantity },
      { title: '单位成本', dataIndex: 'outboundUnitCost', width: 100, render: currency },
      { title: '成本总额', dataIndex: 'outboundCost', width: 110, render: currency },
    ] },
    { title: '结余', children: [
      { title: '数量', dataIndex: 'balanceQuantity', width: 90, render: quantity },
      { title: '单位成本', dataIndex: 'balanceUnitCost', width: 100, render: currency },
      { title: '成本总额', dataIndex: 'balanceCost', width: 110, render: currency },
    ] },
    { title: '备注', dataIndex: 'remark', width: 180, render: value => value || '—' },
  ]
  return <Drawer className="cost-detail-drawer" placement="right" size="min(960px, calc(100vw - 32px))" open={open} onClose={onClose} title={<span>‹&nbsp; 成本明细</span>} footer={null} destroyOnHidden>
    <div className="cost-detail-meta">
      <span>商品编码：<strong>{detail?.itemCode ?? row?.itemCode ?? '—'}</strong></span>
      <span>商品名称：<strong>{detail?.itemName ?? row?.itemName ?? '—'}</strong></span>
      <span>商品品牌：<strong>{detail?.brand ?? row?.brand ?? '—'}</strong></span>
      <span>仓库：<strong>{detail?.departmentName ?? row?.departmentName ?? '—'}</strong></span>
      <span>系统时间：<strong>{detail?.startDate ?? range?.[0].format('YYYY/MM/DD') ?? '—'} ～ {detail?.endDate ?? range?.[1].format('YYYY/MM/DD') ?? '—'}</strong></span>
    </div>
    <QueryError error={query.error} onRetry={query.reload} />
    <Table<CostDetailResult['records'][number]> rowKey="id" loading={query.loading} columns={columns} dataSource={records} scroll={{ x: 1450 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无相关数据" /> }} />
    <div className="cost-detail-summary">
      <span>初期数量：<strong>{quantity(summary?.openingQuantity)}</strong></span>
      <span>初期单位成本：<strong>{currency(summary?.openingUnitCost)}</strong></span>
      <span>初期成本总额：<strong>{currency(summary?.openingCost)}</strong></span>
      <span>末期数量：<strong>{quantity(summary?.endingQuantity)}</strong></span>
      <span>末期单位成本：<strong>{currency(summary?.endingUnitCost)}</strong></span>
      <span>末期成本总额：<strong>{currency(summary?.endingCost)}</strong></span>
    </div>
    <div className="catalog-footer"><span>当前共搜索到 {query.data?.total ?? 0} 条记录</span><Pagination {...paginationOptions} current={1} pageSize={10} total={query.data?.total ?? 0} /></div>
  </Drawer>
}

function AccountingRules() {
  return <div className="cost-rule-copy">
    <strong>Note 1</strong>
    <p>1. 库存产品成本计算采用移动加权平均法；</p>
    <p>2. 成本核算历史数据不可考，对历史数据不生效；</p>
    <p>3. 成本核算可能因成本填写错误导致计算结果有误；</p>
    <p>4. 移动加权平均计算公式为：(每次进货的成本 + 原有库存成本) / (每次进货数量 + 原有库存数量)。</p>
    <strong>Note 2</strong>
    <p>以产品在一个月内的期初结存、采购入库和销售出库为基础，按每次入库后重新计算单位成本，再结转出库成本。</p>
  </div>
}

function CostAccountingWorkspace({ tenantId, platform, departments, products, revision }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number }) {
  const enabled = platform ? tenantId !== undefined : true
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [brand, setBrand] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [departmentId, setDepartmentId] = useState<number>()
  const [range, setRange] = useState<RangeValue>([dayjs().startOf('month'), dayjs()])
  const [detailRow, setDetailRow] = useState<CostAccountingRow>()
  const path = `/inventory/cost-accounting?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${brand ? `&brand=${encodeURIComponent(brand)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${departmentId ? `&departmentId=${departmentId}` : ''}${rangeQuery(range)}`
  const query = useCatalogQuery<CostAccountingPage>(path, tenantId, revision, enabled)
  const brands = useMemo(() => [...new Set(products.map(item => item.brand).filter(Boolean))] as string[], [products])
  const categories = useMemo(() => [...new Set(products.map(item => item.category).filter(Boolean))] as string[], [products])
  const rows = query.data?.records ?? []
  const summary = query.data?.summary
  const columns: ColumnsType<CostAccountingRow> = [
    { title: '产品信息', key: 'item', width: 230, fixed: 'left', render: (_value, row) => <div className="catalog-cell-stack"><strong>{row.itemName}</strong><span>编号：{row.itemCode || '—'}</span><span>品牌：{row.brand || '—'}</span></div> },
    { title: '所属类别', dataIndex: 'category', width: 110, render: value => value || '—' },
    { title: '单位', dataIndex: 'unit', width: 80, render: value => value || '—' },
    { title: '期初', children: [{ title: '数量', dataIndex: 'openingQuantity', width: 95, render: quantity }, { title: '成本', dataIndex: 'openingCost', width: 105, render: currency }, { title: <span>单位成本 <Tooltip title="移动加权平均单位成本"><InfoCircleOutlined /></Tooltip></span>, dataIndex: 'openingUnitCost', width: 110, render: currency }] },
    { title: '入库', children: [{ title: '数量', dataIndex: 'inboundQuantity', width: 95, render: quantity }, { title: '成本', dataIndex: 'inboundCost', width: 105, render: currency }, { title: <span>单位成本 <Tooltip title="入库成本 ÷ 入库数量"><InfoCircleOutlined /></Tooltip></span>, dataIndex: 'inboundUnitCost', width: 110, render: currency }] },
    { title: '出库', children: [{ title: '数量', dataIndex: 'outboundQuantity', width: 95, render: quantity }, { title: '成本', dataIndex: 'outboundCost', width: 105, render: currency }, { title: <span>单位成本 <Tooltip title="出库成本 ÷ 出库数量"><InfoCircleOutlined /></Tooltip></span>, dataIndex: 'outboundUnitCost', width: 110, render: currency }] },
    { title: '期末', children: [{ title: '数量', dataIndex: 'endingQuantity', width: 95, render: quantity }, { title: '成本', dataIndex: 'endingCost', width: 105, render: currency }, { title: '单位成本', dataIndex: 'endingUnitCost', width: 110, render: currency }] },
    { title: '所属仓库', dataIndex: 'departmentName', width: 180 },
    { title: '操作', key: 'action', width: 80, fixed: 'right', render: (_value, row) => <Button type="link" onClick={() => setDetailRow(row)}>明细</Button> },
  ]
  return <div className="inventory-cost-page">
    <div className="cost-toolbar"><Space wrap><Tooltip title={<AccountingRules />} overlayClassName="cost-rules-tooltip"><span className="cost-rule-link">成本核算规则 <InfoCircleOutlined /></span></Tooltip><Button icon={<DownloadOutlined />} onClick={() => { if (!csvDownload('成本核算.csv', ['产品名称', '产品编码', '类别', '单位', '期初数量', '期初成本', '入库数量', '入库成本', '出库数量', '出库成本', '期末数量', '期末成本', '仓库'], rows.map(row => [row.itemName, row.itemCode, row.category, row.unit, row.openingQuantity, row.openingCost, row.inboundQuantity, row.inboundCost, row.outboundQuantity, row.outboundCost, row.endingQuantity, row.endingCost, row.departmentName]))) void message.info('暂无可下载数据') }}>报表下载</Button></Space></div>
    <div className="cost-filter-row"><Select allowClear placeholder="全部仓库" value={departmentId} options={stores(departments)} onChange={value => { setDepartmentId(value); setPage(1) }} /><Select allowClear placeholder="全部品牌" value={brand} options={brands.map(value => ({ value, label: value }))} onChange={value => { setBrand(value); setPage(1) }} /><Select allowClear placeholder="请选择产品类别" value={category} options={categories.map(value => ({ value, label: value }))} onChange={value => { setCategory(value); setPage(1) }} /><DatePicker.RangePicker value={range} format="YYYY/MM/DD" allowClear={false} presets={[{ label: '本月', value: [dayjs().startOf('month'), dayjs()] }]} onChange={value => { if (value?.[0] && value?.[1]) { setRange([value[0], value[1]]); setPage(1) } }} /><Input.Search value={keyword} placeholder="请输入产品名称/编号" allowClear onChange={event => setKeyword(event.target.value)} onSearch={() => setPage(1)} /></div>
    <div className="cost-summary-cards"><div><span>期初成本总额</span><strong>{currency(summary?.openingCost)}</strong></div><div><span>入库成本总额</span><strong>{currency(summary?.inboundCost)}</strong></div><div><span>出库成本总额</span><strong>{currency(summary?.outboundCost)}</strong></div><div><span>期末成本总额</span><strong>{currency(summary?.endingCost)}</strong></div></div>
    <QueryError error={query.error} onRetry={query.reload} />
    <Table<CostAccountingRow> rowKey="id" loading={query.loading} columns={columns} dataSource={rows} scroll={{ x: 1900 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无相关数据" /> }} />
    <div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div>
    <CostDetailDrawer open={detailRow !== undefined} row={detailRow} tenantId={tenantId} range={range} onClose={() => setDetailRow(undefined)} />
  </div>
}

function CostAdjustmentProductDrawer({ open, tenantId, departmentId, products, lines, revision, onClose, onConfirm }: { open: boolean; tenantId?: number; departmentId?: number; products: CatalogItem[]; lines: CostAdjustmentLine[]; revision: number; onClose: () => void; onConfirm: (rows: CostAdjustmentLine[]) => void }) {
  const [category, setCategory] = useState<string>()
  const [brand, setBrand] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])
  const stock = useCatalogQuery<PageResult<InventoryRow>>(departmentId ? `/inventory?page=1&pageSize=100&departmentId=${departmentId}` : '/inventory?page=1&pageSize=100', tenantId, revision, open && Boolean(departmentId))
  useEffect(() => {
    if (open) setSelectedKeys(lines.map(line => line.itemId))
  }, [open, lines])
  const categories = useMemo(() => [...new Set(products.map(item => item.category).filter(Boolean))] as string[], [products])
  const brands = useMemo(() => [...new Set(products.map(item => item.brand).filter(Boolean))] as string[], [products])
  const rows = useMemo(() => products.filter(item => item.status === 1 && (!category || item.category === category) && (!brand || item.brand === brand) && (!keyword || `${item.name} ${item.code}`.toLowerCase().includes(keyword.toLowerCase()))).map(item => {
    const inventory = stock.data?.records.find(row => row.itemId === item.id)
    return { ...item, currentQuantity: Number(inventory?.quantity ?? 0), stockCost: Number(inventory?.costPrice ?? 0) }
  }), [brand, category, keyword, products, stock.data?.records])
  const columns: ColumnsType<typeof rows[number]> = [
    { title: '产品信息', key: 'item', width: 300, render: (_value, row) => <div className="catalog-cell-stack"><strong>{row.name}</strong><span>{row.code}</span></div> },
    { title: '产品品类', dataIndex: 'category', width: 150, render: value => value || '—' },
    { title: '成本价', dataIndex: 'stockCost', width: 120, render: currency },
    { title: '品牌', dataIndex: 'brand', width: 150, render: value => value || '—' },
    { title: '规格/单位', key: 'unit', width: 160, render: (_value, row) => `${row.spec || '—'}/${row.unit || '—'}` },
    { title: '库存余量', dataIndex: 'currentQuantity', width: 120, render: quantity },
  ]
  const confirm = () => {
    const selected = products.filter(item => selectedKeys.includes(item.id)).map(item => {
      const inventory = stock.data?.records.find(row => row.itemId === item.id)
      const previous = lines.find(line => line.itemId === item.id)
      const costPrice = Number(inventory?.costPrice ?? previous?.costPrice ?? 0)
      return { itemId: item.id, itemCode: item.code, itemName: item.name, brand: item.brand, category: item.category, unit: item.unit, spec: item.spec, currentQuantity: Number(inventory?.quantity ?? previous?.currentQuantity ?? 0), costPrice, unitCost: previous?.unitCost ?? costPrice, remark: previous?.remark }
    })
    onConfirm(selected)
  }
  return <Drawer className="cost-product-drawer" placement="right" size="min(960px, calc(100vw - 32px))" open={open} onClose={onClose} title={<span>‹&nbsp; 选择产品</span>} destroyOnHidden footer={<div className="drawer-actions"><Button onClick={onClose}>取消</Button><Button type="primary" onClick={confirm}>确认</Button></div>}>
    <div className="cost-selection-filters"><Select allowClear placeholder="请选择产品类别" value={category} options={categories.map(value => ({ value, label: value }))} onChange={setCategory} /><Select allowClear placeholder="请选择产品品牌" value={brand} options={brands.map(value => ({ value, label: value }))} onChange={setBrand} /><Input.Search value={keyword} allowClear placeholder="请输入产品名称或编号" onChange={event => setKeyword(event.target.value)} onSearch={setKeyword} /></div>
    <Table<typeof rows[number]> rowKey="id" loading={stock.loading} rowSelection={{ selectedRowKeys: selectedKeys, onChange: keys => setSelectedKeys(keys) }} columns={columns} dataSource={rows} scroll={{ x: 1000 }} pagination={{ ...paginationOptions, pageSize: 10 }} locale={{ emptyText: stock.loading ? <Spin /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无相关数据" /> }} />
  </Drawer>
}

function CostAdjustmentWorkspace({ tenantId, departments, products, revision, setRevision, writable }: { tenantId?: number; departments: Department[]; products: CatalogItem[]; revision: number; setRevision: (value: (current: number) => number) => void; writable: boolean }) {
  const { message } = App.useApp()
  const [departmentId, setDepartmentId] = useState<number>()
  const [operatorName, setOperatorName] = useState('负责人')
  const [remark, setRemark] = useState('')
  const [lines, setLines] = useState<CostAdjustmentLine[]>([])
  const [selectorOpen, setSelectorOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const stock = useCatalogQuery<PageResult<InventoryRow>>(departmentId ? `/inventory?page=1&pageSize=100&departmentId=${departmentId}` : '/inventory?page=1&pageSize=100', tenantId, revision, Boolean(departmentId))
  const stockRows = stock.data?.records ?? []
  useEffect(() => {
    if (!departmentId || !stockRows.length) return
    setLines(current => current.map(line => {
      const inventory = stockRows.find(row => row.itemId === line.itemId)
      return inventory ? { ...line, currentQuantity: Number(inventory.quantity ?? 0), costPrice: Number(inventory.costPrice ?? 0) } : line
    }))
  }, [departmentId, stockRows])
  const updateLine = (itemId: number, patch: Partial<CostAdjustmentLine>) => setLines(current => current.map(line => line.itemId === itemId ? { ...line, ...patch } : line))
  const addLines = (selected: CostAdjustmentLine[]) => { setLines(current => [...current.filter(line => !selected.some(row => row.itemId === line.itemId)), ...selected]); setSelectorOpen(false) }
  const submit = async () => {
    if (!writable) return
    if (!departmentId) { void message.warning('请选择仓库'); return }
    if (!lines.length) { void message.warning('请先添加产品'); return }
    try {
      await catalogRequest('/inventory/cost-adjustments', tenantId, { method: 'POST', body: JSON.stringify({ departmentId, operatorName, remark: remark || undefined, lines: lines.map(line => ({ itemId: line.itemId, unitCost: Number(line.unitCost || 0), remark: line.remark || undefined })) }) })
      void message.success('成本调整已提交')
      setLines([]); setRemark(''); setRevision(value => value + 1)
    } catch (cause) { void message.error(errorMessage(cause)) }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const parsed: CostAdjustmentLine[] = []
      for (const record of records) {
        const code = String(record['产品编码'] ?? record['编码'] ?? record.code ?? '').trim()
        const name = String(record['产品名称'] ?? record['名称'] ?? record.name ?? '').trim()
        const item = products.find(product => (code && product.code === code) || (name && product.name === name))
        const unitCost = Number(record['成本单价'] ?? record['成本价'] ?? record['成本'] ?? record.unitCost ?? 0)
        if (!item || !Number.isFinite(unitCost) || unitCost < 0) continue
        const inventory = stockRows.find(row => row.itemId === item.id)
        parsed.push({ itemId: item.id, itemCode: item.code, itemName: item.name, brand: item.brand, category: item.category, unit: item.unit, spec: item.spec, currentQuantity: Number(inventory?.quantity ?? 0), costPrice: Number(inventory?.costPrice ?? 0), unitCost, remark: String(record['备注'] ?? record.remark ?? '').slice(0, 15) })
      }
      if (!parsed.length) { void message.warning('未读取到可用的成本调整数据'); return }
      setLines(current => [...current.filter(line => !parsed.some(row => row.itemId === line.itemId)), ...parsed])
      void message.success(`已导入 ${parsed.length} 条调整明细`)
    } catch (cause) { void message.error(errorMessage(cause)) }
  }
  const total = lines.reduce((sum, line) => sum + Number(line.currentQuantity || 0) * Number(line.unitCost || 0), 0)
  const columns: ColumnsType<CostAdjustmentLine> = [
    { title: '#', key: 'index', width: 70, render: (_value, _row, index) => index + 1 },
    { title: '产品编码', dataIndex: 'itemCode', width: 160, render: value => value || '—' },
    { title: '产品名称', dataIndex: 'itemName', width: 260 },
    { title: '单位', dataIndex: 'unit', width: 90, render: value => value || '—' },
    { title: '库存余量', dataIndex: 'currentQuantity', width: 120, render: value => Number(value ?? 0).toFixed(2) },
    { title: '成本单价', dataIndex: 'unitCost', width: 170, render: (value, row) => <InputNumber min={0} precision={2} value={value} disabled={!writable} style={{ width: '100%' }} onChange={next => updateLine(row.itemId, { unitCost: Number(next ?? 0) })} /> },
    { title: '成本总额', key: 'total', width: 150, render: (_value, row) => currency(Number(row.currentQuantity || 0) * Number(row.unitCost || 0)) },
    { title: '备注', dataIndex: 'remark', width: 240, render: (value, row) => <Input value={value} maxLength={15} disabled={!writable} placeholder="最多输入15个字" onChange={event => updateLine(row.itemId, { remark: event.target.value })} /> },
    { title: '操作', key: 'action', width: 80, render: (_value, row) => <Button type="link" danger icon={<DeleteOutlined />} disabled={!writable} onClick={() => setLines(current => current.filter(line => line.itemId !== row.itemId))}>删除</Button> },
  ]
  return <div className="inventory-cost-adjustment-page">
    <div className="cost-adjustment-header"><div className="cost-adjustment-fields"><label><span>仓库：</span><Select allowClear placeholder="请选择仓库" value={departmentId} options={stores(departments)} disabled={!writable} onChange={setDepartmentId} /></label><label><span>经办人：</span><Input value={operatorName} disabled={!writable} onChange={event => setOperatorName(event.target.value)} /></label></div><Space wrap><Button icon={<DownloadOutlined />} onClick={() => { if (!csvDownload('成本调整.csv', ['产品编码', '产品名称', '单位', '库存余量', '成本单价', '成本总额', '备注'], lines.map(line => [line.itemCode, line.itemName, line.unit, line.currentQuantity, line.unitCost, Number(line.currentQuantity || 0) * Number(line.unitCost || 0), line.remark]))) void message.info('暂无可下载数据') }}>导出调整</Button><Button icon={<UploadOutlined />} disabled={!writable} onClick={() => fileRef.current?.click()}>导入调整</Button><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /><Button type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => { if (!departmentId) { void message.warning('请先选择仓库'); return } setSelectorOpen(true) }}>添加产品</Button></Space></div>
    <div className="cost-adjustment-table"><Table<CostAdjustmentLine> rowKey="itemId" columns={columns} dataSource={lines} pagination={false} scroll={{ x: 1300 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无相关数据" /> }} summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={4}>合计</Table.Summary.Cell><Table.Summary.Cell index={4}>{lines.reduce((sum, line) => sum + Number(line.currentQuantity || 0), 0).toFixed(2)}</Table.Summary.Cell><Table.Summary.Cell index={5} /><Table.Summary.Cell index={6}>{currency(total)}</Table.Summary.Cell><Table.Summary.Cell index={7} colSpan={2} /></Table.Summary.Row>} /></div>
    <label className="cost-adjustment-remark"><span>备注：</span><Input value={remark} maxLength={300} disabled={!writable} placeholder="请输入备注" onChange={event => setRemark(event.target.value)} /></label>
    <div className="cost-adjustment-bottom"><Button onClick={() => { setLines([]); setRemark('') }}>取消</Button><Button type="primary" disabled={!writable} onClick={() => void submit()}>提交</Button></div>
    <CostAdjustmentProductDrawer open={selectorOpen} tenantId={tenantId} departmentId={departmentId} products={products} lines={lines} revision={revision} onClose={() => setSelectorOpen(false)} onConfirm={addLines} />
  </div>
}

function CostAdjustmentRecords({ tenantId, platform, departments, revision }: { tenantId?: number; platform: boolean; departments: Department[]; revision: number }) {
  const enabled = platform ? tenantId !== undefined : true
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState<number>()
  const [keyword, setKeyword] = useState('')
  const [range, setRange] = useState<RangeValue>([dayjs().startOf('month'), dayjs()])
  const path = `/inventory/cost-adjustments?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}${departmentId ? `&departmentId=${departmentId}` : ''}${rangeQuery(range)}`
  const query = useCatalogQuery<PageResult<CostAdjustmentRecord>>(path, tenantId, revision, enabled)
  const columns: ColumnsType<CostAdjustmentRecord> = [
    { title: '单号', dataIndex: 'documentNo', width: 190 },
    { title: '所属仓库', dataIndex: 'warehouseName', width: 240 },
    { title: '调整时间', dataIndex: 'documentDate', width: 180, sorter: (a, b) => a.documentDate.localeCompare(b.documentDate), render: dateTime },
    { title: '制单人', key: 'creator', width: 180, render: (_value, row) => row.creatorName || row.operatorName || '—' },
    { title: '操作', key: 'action', width: 120, render: () => '—' },
  ]
  return <div className="inventory-cost-record-page"><div className="cost-record-filters"><Select allowClear placeholder="全部仓库" value={departmentId} options={stores(departments)} onChange={value => { setDepartmentId(value); setPage(1) }} /><DatePicker.RangePicker value={range} format="YYYY/MM/DD" allowClear={false} presets={[{ label: '本月', value: [dayjs().startOf('month'), dayjs()] }]} onChange={value => { if (value?.[0] && value?.[1]) { setRange([value[0], value[1]]); setPage(1) } }} /><Input.Search value={keyword} allowClear placeholder="请输入产品名称/编号" onChange={event => setKeyword(event.target.value)} onSearch={() => setPage(1)} /><Button type="primary" onClick={() => setPage(1)}>查询</Button></div><QueryError error={query.error} onRetry={query.reload} /><Table<CostAdjustmentRecord> rowKey="id" loading={query.loading} columns={columns} dataSource={query.data?.records ?? []} pagination={false} scroll={{ x: 900 }} locale={{ emptyText: query.loading ? <Spin /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无相关数据" /> }} /><div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div></div>
}

export default function InventoryCostWorkspace({ tenantId, platform, departments, products, revision, setRevision, writable }: { tenantId?: number; platform: boolean; departments: Department[]; products: CatalogItem[]; revision: number; setRevision: (value: (current: number) => number) => void; writable: boolean }) {
  const [tab, setTab] = useState('accounting')
  return <div className="inventory-cost-workspace"><Tabs activeKey={tab} onChange={setTab} items={[{ key: 'accounting', label: '成本核算' }, { key: 'adjustment', label: '成本调整' }, { key: 'records', label: '成本调整记录' }]} />{tab === 'accounting' && <CostAccountingWorkspace tenantId={tenantId} platform={platform} departments={departments} products={products} revision={revision} />}{tab === 'adjustment' && <CostAdjustmentWorkspace tenantId={tenantId} departments={departments} products={products} revision={revision} setRevision={setRevision} writable={writable} />}{tab === 'records' && <CostAdjustmentRecords tenantId={tenantId} platform={platform} departments={departments} revision={revision} />}</div>
}
