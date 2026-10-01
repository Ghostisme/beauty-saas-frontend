import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import * as XLSX from 'xlsx'
import { App, Button, DatePicker, Drawer, Empty, Input, InputNumber, Pagination, Result, Select, Space, Spin, Steps, Switch, Table, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckOutlined, DownloadOutlined, FileAddOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons'
import { errorMessage, QueryError, paginationOptions } from '@/components/iam/shared'
import { catalogRequest, useCatalogQuery } from '@/api/catalog'
import type { Department, PageResult } from '@/types/iam'
import type { CatalogItem, InventoryDocumentRow, InventoryRow } from '@/types/catalog'
import '@/styles/catalog.css'

type LiquidationProps = {
  tenantId?: number
  platform: boolean
  departments: Department[]
  products: CatalogItem[]
  revision: number
  setRevision: (value: (current: number) => number) => void
  writable: boolean
}

type DraftLine = {
  itemId: number
  itemName: string
  itemCode: string
  brand?: string
  category?: string
  unit?: string
  spec?: string
  bookQuantity: number
  actualQuantity: number
  remark: string
}

type ImportLine = DraftLine & { rowId: string; error?: string }

type ImportResult = { status: 'success' | 'error'; message: string; count?: number }

const IMPORT_HEADERS = ['产品编号', '产品名称', '品牌', '产品分类', '账面库存', '实际盘点数量', '备注', '错误信息']

function departmentOptions(departments: Department[]) {
  return departments.filter(item => item.type === 'STORE' && item.status === 1).map(item => ({ value: item.id, label: item.name }))
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function textValue(value: unknown) { return String(value ?? '').trim() }

function normalized(value?: string) { return (value ?? '').trim().toLowerCase() }

function itemFromProduct(item: CatalogItem, bookQuantity: number): DraftLine {
  return { itemId: item.id, itemName: item.name, itemCode: item.code, brand: item.brand, category: item.category, unit: item.unit, spec: item.spec, bookQuantity, actualQuantity: bookQuantity, remark: '' }
}

export default function InventoryLiquidationWorkspace({ tenantId, platform, departments, products, revision, setRevision, writable }: LiquidationProps) {
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState<number>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>()
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newDepartmentId, setNewDepartmentId] = useState<number>()
  const [newOperatorName, setNewOperatorName] = useState('负责人')
  const [newRemark, setNewRemark] = useState('')
  const [newLines, setNewLines] = useState<DraftLine[]>([])
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectionKeyword, setSelectionKeyword] = useState('')
  const [selectionBrand, setSelectionBrand] = useState<string>()
  const [selectionCategory, setSelectionCategory] = useState<string>()
  const [importStep, setImportStep] = useState(1)
  const [importDepartmentId, setImportDepartmentId] = useState<number>()
  const [importOperatorName, setImportOperatorName] = useState('负责人')
  const [importRemark, setImportRemark] = useState('')
  const [importBrand, setImportBrand] = useState<string>()
  const [importCategory, setImportCategory] = useState<string>()
  const [importKeyword, setImportKeyword] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importLines, setImportLines] = useState<ImportLine[]>([])
  const [importPage, setImportPage] = useState(1)
  const [importSyncInventory, setImportSyncInventory] = useState(true)
  const [importResult, setImportResult] = useState<ImportResult>()
  const stockDepartmentId = newDepartmentId ?? importDepartmentId
  const stockQuery = useCatalogQuery<PageResult<InventoryRow>>(stockDepartmentId ? `/inventory?page=1&pageSize=100&departmentId=${stockDepartmentId}&keyword=` : '/inventory?page=1&pageSize=100&keyword=', tenantId, revision, platform ? tenantId !== undefined && Boolean(stockDepartmentId) : Boolean(stockDepartmentId))
  const stockRows = stockQuery.data?.records ?? []
  const stockByItem = useMemo(() => new Map(stockRows.map(row => [row.itemId, row])), [stockRows])
  const brands = useMemo(() => [...new Set(products.map(item => item.brand).filter(Boolean))] as string[], [products])
  const categories = useMemo(() => [...new Set(products.map(item => item.category).filter(Boolean))] as string[], [products])
  const enabled = platform ? tenantId !== undefined : true
  const query = useCatalogQuery<PageResult<InventoryDocumentRow>>(`/inventory/documents?docType=LIQUIDATION&page=${page}&pageSize=10${departmentId ? `&sourceDepartmentId=${departmentId}` : ''}${range ? `&startDate=${range[0].format('YYYY-MM-DD')}&endDate=${range[1].format('YYYY-MM-DD')}` : ''}`, tenantId, revision, enabled)

  useEffect(() => {
    if (!newOpen) return
    setNewDepartmentId(undefined); setNewOperatorName('负责人'); setNewRemark(''); setNewLines([]); setSelectedProductIds([]); setSelectionOpen(false)
  }, [newOpen])

  useEffect(() => {
    if (!importOpen) return
    setImportStep(1); setImportDepartmentId(undefined); setImportOperatorName('负责人'); setImportRemark(''); setImportBrand(undefined); setImportCategory(undefined); setImportKeyword(''); setImportFileName(''); setImportLines([]); setImportPage(1); setImportSyncInventory(true); setImportResult(undefined)
  }, [importOpen])

  function stockQuantity(itemId: number) { return Number(stockByItem.get(itemId)?.quantity ?? 0) }
  function resetPage() { setPage(1) }

  async function saveLiquidation(lines: Array<{ itemId: number; actualQuantity: number; remark?: string }>, department: number | undefined, operatorName: string, remark: string, status: 'DRAFT' | 'CONFIRMED', syncInventory: boolean) {
    if (!department) { void message.warning('请选择仓库'); return false }
    if (!lines.length) { void message.warning('请先添加产品明细'); return false }
    if (lines.some(line => !Number.isFinite(line.actualQuantity) || line.actualQuantity < 0)) { void message.warning('实际盘点数量不能小于 0'); return false }
    try {
      await catalogRequest('/inventory/liquidations', tenantId, { method: 'POST', body: JSON.stringify({ departmentId: department, documentDate: dayjs().format('YYYY-MM-DD'), operatorName: operatorName.trim() || '负责人', status, remark: remark.trim() || undefined, syncInventory, lines }) })
      onSaved(); return true
    } catch (cause) { void message.error(errorMessage(cause)); return false }
  }

  async function submitNew(status: 'DRAFT' | 'CONFIRMED') {
    const saved = await saveLiquidation(newLines.map(line => ({ itemId: line.itemId, actualQuantity: line.actualQuantity, remark: line.remark })), newDepartmentId, newOperatorName, newRemark, status, true)
    if (saved) { void message.success(status === 'DRAFT' ? '库存盘点单已暂存' : '库存盘点单已提交'); setNewOpen(false) }
  }

  function onSaved() { setRevision(value => value + 1) }

  function downloadWorkbook(filename: string, rows: Array<Array<string | number | undefined>>) {
    const sheet = XLSX.utils.aoa_to_sheet([IMPORT_HEADERS, ...rows])
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, '盘点导入'); XLSX.writeFile(workbook, filename)
  }

  function downloadTemplate() {
    if (!importDepartmentId) { void message.warning('请先选择仓库'); return }
    const filtered = products.filter(item => (!importBrand || normalized(item.brand) === normalized(importBrand)) && (!importCategory || normalized(item.category) === normalized(importCategory)) && (!importKeyword || `${item.name} ${item.code}`.toLowerCase().includes(importKeyword.trim().toLowerCase())))
    if (!filtered.length) { void message.info('当前筛选条件下暂无产品'); return }
    downloadWorkbook('商品盘点导入模板.xlsx', filtered.map(item => [item.code, item.name, item.brand ?? '', item.category ?? '', stockQuantity(item.id), stockQuantity(item.id), '', '']))
  }

  function downloadFailedWorkbook() {
    downloadWorkbook('商品盘点导入失败数据.xlsx', importLines.map(line => [line.itemCode, line.itemName, line.brand ?? '', line.category ?? '', line.bookQuantity, line.actualQuantity, line.remark, line.error ?? importResult?.message ?? '导入失败']))
  }

  function parseImportFile(file: File) {
    if (!importDepartmentId) { void message.warning('请先选择仓库'); return }
    void file.arrayBuffer().then(buffer => {
      const workbook = XLSX.read(buffer, { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('Excel 中没有可读取的工作表')
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
      if (!rows.length) throw new Error('导入文件没有数据')
      const header = rows[0].map(value => textValue(value)); const index = (names: string[]) => names.map(name => header.indexOf(name)).find(value => value >= 0) ?? -1
      const nameIndex = index(['产品名称', '商品名称']); if (nameIndex < 0) throw new Error('模板缺少“产品名称”列')
      const codeIndex = index(['产品编号', '商品编号']); const brandIndex = index(['品牌']); const categoryIndex = index(['产品分类', '产品品类']); const bookIndex = index(['账面库存', '当前库存']); const actualIndex = index(['实际盘点数量', '实际库存']); const remarkIndex = index(['备注'])
      const parsed = rows.slice(1).map((values, rowIndex): ImportLine | undefined => {
        const row = values as unknown[]; const code = textValue(codeIndex >= 0 ? row[codeIndex] : ''); const name = textValue(row[nameIndex]); const brand = textValue(brandIndex >= 0 ? row[brandIndex] : ''); const category = textValue(categoryIndex >= 0 ? row[categoryIndex] : ''); const workbookBook = numberValue(bookIndex >= 0 ? row[bookIndex] : undefined); const workbookActual = numberValue(actualIndex >= 0 ? row[actualIndex] : undefined); const remark = textValue(remarkIndex >= 0 ? row[remarkIndex] : '')
        if (!code && !name && !brand && !category && workbookBook === undefined && workbookActual === undefined && !remark) return undefined
        const matches = products.filter(item => (code ? normalized(item.code) === normalized(code) : normalized(item.name) === normalized(name)) && (!brand || normalized(item.brand) === normalized(brand)) && (!category || normalized(item.category) === normalized(category)))
        const item = matches[0]; const error = !item ? '未找到匹配的启用产品' : matches.length > 1 ? '匹配到多个产品，请补充产品编号' : workbookActual === undefined ? '实际盘点数量不能为空' : workbookActual < 0 ? '实际盘点数量不能小于 0' : undefined
        const bookQuantity = workbookBook ?? (item ? stockQuantity(item.id) : 0); const actualQuantity = workbookActual ?? bookQuantity
        return { rowId: `import-${rowIndex + 2}`, itemId: item?.id ?? 0, itemName: name || item?.name || '', itemCode: code || item?.code || '', brand: brand || item?.brand, category: category || item?.category, unit: item?.unit, spec: item?.spec, bookQuantity, actualQuantity, remark, error }
      }).filter((line): line is ImportLine => line !== undefined)
      if (!parsed.length) throw new Error('导入文件没有有效数据行')
      setImportLines(parsed); setImportFileName(file.name); setImportPage(1); setImportStep(2); setImportResult(undefined)
    }).catch(cause => { setImportResult({ status: 'error', message: errorMessage(cause) }); setImportStep(3) })
  }

  async function submitImport(status: 'DRAFT' | 'CONFIRMED') {
    if (importLines.some(line => line.error || !line.itemId)) { setImportResult({ status: 'error', message: '导入数据存在错误，请下载失败数据并修正后重新上传' }); setImportStep(3); return }
    const saved = await saveLiquidation(importLines.map(line => ({ itemId: line.itemId, actualQuantity: line.actualQuantity, remark: line.remark })), importDepartmentId, importOperatorName, importRemark, status, importSyncInventory)
    if (saved) { setImportResult({ status: 'success', message: status === 'DRAFT' ? '库存盘点单已暂存' : '恭喜，导入成功', count: importLines.length }); setImportStep(3) }
  }

  const mainColumns: ColumnsType<InventoryDocumentRow> = [
    { title: '单据号', dataIndex: 'documentNo', width: 180 },
    { title: '仓库/门店', dataIndex: 'sourceDepartmentName', width: 220, render: value => value || '—' },
    { title: '经办人', dataIndex: 'operatorName', width: 140, render: value => value || '负责人' },
    { title: '盘点时间', dataIndex: 'documentDate', width: 150 },
    { title: '制单人', dataIndex: 'creatorName', width: 140, render: value => value || '负责人' },
    { title: '备注', dataIndex: 'remark', width: 240, render: value => value || '—' },
    { title: '操作', key: 'actions', width: 100, render: () => <Button type="link" disabled>查看详情</Button> },
  ]

  const newProductRows = products.filter(item => item.status === 1 && (!selectionKeyword || `${item.name} ${item.code}`.toLowerCase().includes(selectionKeyword.trim().toLowerCase())) && (!selectionBrand || normalized(item.brand) === normalized(selectionBrand)) && (!selectionCategory || normalized(item.category) === normalized(selectionCategory)))
  const importPageRows = importLines.slice((importPage - 1) * 15, importPage * 15)
  const importBookTotal = importLines.reduce((sum, line) => sum + Number(line.bookQuantity || 0), 0)
  const importActualTotal = importLines.reduce((sum, line) => sum + Number(line.actualQuantity || 0), 0)
  const selectedDepartmentName = departments.find(item => item.id === newDepartmentId)?.name ?? '—'

  return <div className="inventory-liquidation-page">
    <div className="inventory-sub-actions"><Space wrap><Button type="primary" icon={<FileAddOutlined />} disabled={!writable} onClick={() => setImportOpen(true)}>导入库存盘点单</Button><Button type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => setNewOpen(true)}>新建库存盘点单</Button></Space></div>
    <div className="inventory-filter-row"><Select allowClear placeholder="全部门店" value={departmentId} onChange={value => { setDepartmentId(value); resetPage() }} options={departmentOptions(departments)} /><DatePicker.RangePicker value={range} onChange={value => { if (value?.[0] && value?.[1]) setRange([value[0], value[1]]); else setRange(undefined); resetPage() }} /></div>
    <QueryError error={query.error} onRetry={query.reload} />
    <Table<InventoryDocumentRow> rowKey="id" loading={query.loading} columns={mainColumns} dataSource={query.data?.records ?? []} scroll={{ x: 1120 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : <Empty description="暂无相关数据" /> }} />
    <div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div>

    <Drawer className="stocktake-drawer" placement="right" size="min(1480px, calc(100vw - 80px))" title="库存盘点" open={newOpen} onClose={() => setNewOpen(false)} destroyOnHidden footer={<div className="stocktake-drawer-footer"><div className="stocktake-footer-fields"><label>制单人<Input value="负责人" disabled /></label><label>备注<Input value={newRemark} onChange={event => setNewRemark(event.target.value)} placeholder="请输入备注" maxLength={300} /></label></div><Space><Button onClick={() => setNewOpen(false)}>取消</Button><Button onClick={() => void submitNew('DRAFT')}>暂存</Button><Button type="primary" onClick={() => void submitNew('CONFIRMED')}>提交盘点</Button></Space></div>}>
      <div className="stocktake-header-card"><div className="stocktake-header-fields"><label><span><em>*</em>仓库：</span><Select value={newDepartmentId} onChange={value => { setNewDepartmentId(value); setNewLines([]); setSelectedProductIds([]) }} options={departmentOptions(departments)} placeholder="请选择门店/仓库" /></label><label><span>经办人：</span><Input value={newOperatorName} onChange={event => setNewOperatorName(event.target.value)} placeholder="负责人" /></label></div><Button type="primary" disabled={!newDepartmentId} onClick={() => setSelectionOpen(true)}>添加产品</Button></div>
      <div className="stocktake-lines-card"><Table<DraftLine> rowKey="itemId" columns={[
        { title: '#', key: 'index', width: 54, render: (_value, _row, index) => index + 1 },
        { title: '编号', dataIndex: 'itemCode', width: 120, render: value => value || '—' },
        { title: '产品名称', dataIndex: 'itemName', width: 240 },
        { title: '类别', dataIndex: 'category', width: 140, render: value => value || '—' },
        { title: '当前库存', dataIndex: 'bookQuantity', width: 120 },
        { title: '实际盘点数量', key: 'actualQuantity', width: 150, render: (_value, row) => <InputNumber min={0} precision={3} value={row.actualQuantity} onChange={value => setNewLines(lines => lines.map(line => line.itemId === row.itemId ? { ...line, actualQuantity: Number(value ?? 0) } : line))} /> },
        { title: '备注', key: 'remark', width: 260, render: (_value, row) => <Input value={row.remark} onChange={event => setNewLines(lines => lines.map(line => line.itemId === row.itemId ? { ...line, remark: event.target.value } : line))} placeholder="请输入备注" maxLength={300} /> },
        { title: '操作', key: 'action', width: 90, render: (_value, row) => <Button type="link" danger onClick={() => { setNewLines(lines => lines.filter(line => line.itemId !== row.itemId)); setSelectedProductIds(ids => ids.filter(id => id !== row.itemId)) }}>删除</Button> },
      ]} dataSource={newLines} pagination={false} scroll={{ x: 1120 }} locale={{ emptyText: <div className="stocktake-empty"><div className="inventory-placeholder-icon"><PlusOutlined /></div><span>暂无相关数据</span><small>点击“添加产品”开始盘点</small></div> }} summary={current => current.length ? <Table.Summary><Table.Summary.Row><Table.Summary.Cell index={0} colSpan={4}>合计</Table.Summary.Cell><Table.Summary.Cell index={4}>{current.reduce((sum, line) => sum + Number(line.bookQuantity || 0), 0)}</Table.Summary.Cell><Table.Summary.Cell index={5}>{current.reduce((sum, line) => sum + Number(line.actualQuantity || 0), 0)}</Table.Summary.Cell><Table.Summary.Cell index={6} colSpan={2} /></Table.Summary.Row></Table.Summary> : undefined} /></div>
      <div className="stocktake-meta-bar"><span>仓库：{selectedDepartmentName}</span><span>已添加 {newLines.length} 个产品</span></div>
    </Drawer>

    <Drawer className="stocktake-drawer stocktake-import-drawer" placement="right" size="min(1480px, calc(100vw - 80px))" title="导入库存盘点单" open={importOpen} onClose={() => setImportOpen(false)} destroyOnHidden footer={importStep === 3 ? <div className="stocktake-drawer-footer stocktake-result-footer"><Button onClick={() => setImportOpen(false)}>返回列表</Button></div> : importStep === 1 ? <div className="stocktake-drawer-footer"><Button onClick={() => setImportOpen(false)}>取消</Button><Button type="primary" onClick={() => { if (!importFileName || !importLines.length) { void message.warning('请先选择有效的 Excel 文件'); return } setImportStep(2) }}>下一步</Button></div> : <div className="stocktake-drawer-footer"><Button onClick={() => setImportStep(1)}>上一步</Button><Space><Button onClick={() => void submitImport('DRAFT')}>暂存</Button><Button type="primary" onClick={() => void submitImport('CONFIRMED')}>提交盘点</Button></Space></div>}>
      <Steps className="stocktake-steps" current={importStep - 1} items={[{ title: '上传导入文件' }, { title: '导入预览' }, { title: '导入完成' }]} />
      {importStep === 1 && <div className="stocktake-import-step"><section className="stocktake-section"><h3>1. 选择盘点仓库</h3><div className="stocktake-header-fields"><label><span>门店/仓库：</span><Select value={importDepartmentId} onChange={value => { setImportDepartmentId(value); setImportLines([]); setImportFileName('') }} options={departmentOptions(departments)} placeholder="请选择门店/仓库" /></label><label><span>经办人：</span><Input value={importOperatorName} onChange={event => setImportOperatorName(event.target.value)} placeholder="负责人" /></label></div></section><section className="stocktake-section"><h3>2. 选择下载商品分类数据</h3><div className="stocktake-header-fields stocktake-import-filters"><label><span>产品品牌：</span><Select allowClear value={importBrand} onChange={setImportBrand} options={brands.map(value => ({ value, label: value }))} placeholder="请选择产品品牌" /></label><label><span>产品类别：</span><Select allowClear value={importCategory} onChange={setImportCategory} options={categories.map(value => ({ value, label: value }))} placeholder="请选择产品类别" /></label><label><span>产品名称/编号：</span><Input value={importKeyword} onChange={event => setImportKeyword(event.target.value)} placeholder="请输入产品名称或编号" /></label></div><Button type="primary" icon={<DownloadOutlined />} onClick={downloadTemplate}>下载盘点导入模板</Button></section><section className="stocktake-section"><h3>3. 上传盘点数据文件</h3><Upload.Dragger className="stocktake-upload" accept=".xlsx,.xls" showUploadList={false} disabled={!importDepartmentId} beforeUpload={file => { parseImportFile(file); return Upload.LIST_IGNORE }}><p className="ant-upload-drag-icon"><InboxOutlined /></p><p className="ant-upload-text">点击或拖拽文件到此处上传</p><p className="ant-upload-hint">支持 .xlsx .xls 格式文件</p>{importFileName && <p className="stocktake-upload-file"><FileAddOutlined /> {importFileName}</p>}</Upload.Dragger></section></div>}
      {importStep === 2 && <div className="stocktake-import-step"><div className="stocktake-preview-heading"><div><h3>导入预览</h3><span>共 {importLines.length} 条数据</span></div><span>仓库：{departments.find(item => item.id === importDepartmentId)?.name ?? '—'}</span></div>{importLines.some(line => line.error) && <div className="stocktake-import-alert">当前导入数据存在错误，请修正后重新上传。错误行：{importLines.filter(line => line.error).length}</div>}<Table<ImportLine> rowKey="rowId" className="stocktake-preview-table" columns={[
        { title: '#', key: 'index', width: 54, render: (_value, _row, index) => (importPage - 1) * 15 + index + 1 },
        { title: '编号', dataIndex: 'itemCode', width: 110, render: value => value || '—' },
        { title: '产品名称', dataIndex: 'itemName', width: 240 },
        { title: '类别', dataIndex: 'category', width: 120, render: value => value || '—' },
        { title: '品牌', dataIndex: 'brand', width: 100, render: value => value || '—' },
        { title: '单位', dataIndex: 'unit', width: 80, render: value => value || '—' },
        { title: '当前库存', dataIndex: 'bookQuantity', width: 110 },
        { title: '实际盘点数量', key: 'actualQuantity', width: 140, render: (_value, row) => <InputNumber min={0} precision={3} value={row.actualQuantity} onChange={value => setImportLines(lines => lines.map(line => line.rowId === row.rowId ? { ...line, actualQuantity: Number(value ?? 0), error: line.error === '实际盘点数量不能为空' ? undefined : line.error } : line))} /> },
        { title: '备注', key: 'remark', width: 220, render: (_value, row) => <Input value={row.remark} onChange={event => setImportLines(lines => lines.map(line => line.rowId === row.rowId ? { ...line, remark: event.target.value } : line))} placeholder="请输入备注" maxLength={300} /> },
        { title: '操作', key: 'action', width: 80, render: (_value, row) => <Button type="link" danger onClick={() => setImportLines(lines => lines.filter(line => line.rowId !== row.rowId))}>删除</Button> },
      ]} dataSource={importPageRows} pagination={false} scroll={{ x: 1250 }} rowClassName={row => row.error ? 'stocktake-error-row' : ''} locale={{ emptyText: '暂无导入数据' }} /><div className="stocktake-preview-summary"><span>账面库存合计：{importBookTotal}</span><span>实际盘点数量合计：{importActualTotal}</span><Pagination {...paginationOptions} current={importPage} pageSize={15} total={importLines.length} onChange={setImportPage} /></div><div className="stocktake-import-bottom"><label>备注<Input value={importRemark} onChange={event => setImportRemark(event.target.value)} placeholder="请输入备注" maxLength={300} /></label><label className="stocktake-switch-label">是否同步库存 <Switch checked={importSyncInventory} onChange={setImportSyncInventory} /></label></div></div>}
      {importStep === 3 && <div className="stocktake-import-result">{importResult?.status === 'success' ? <Result status="success" title={importResult.message} subTitle={`共 ${importResult.count ?? importLines.length} 条数据，成功处理 ${importResult.count ?? importLines.length} 条`} extra={[<Button type="primary" key="continue" onClick={() => { setImportStep(1); setImportFileName(''); setImportLines([]); setImportResult(undefined) }}>继续导入</Button>, <Button key="list" onClick={() => setImportOpen(false)}>返回列表</Button>]} /> : <Result status="error" title="导入失败" subTitle={importResult?.message ?? '导入内容存在错误，请下载失败数据，查看错误信息后重新上传。'} extra={[<Button key="download" onClick={downloadFailedWorkbook}>下载导入失败数据</Button>, <Button type="primary" key="retry" onClick={() => { setImportStep(1); setImportResult(undefined) }}>重新上传</Button>]} />}</div>}
    </Drawer>

    <Drawer className="stocktake-select-drawer" placement="right" size="min(1480px, calc(100vw - 80px))" title={<Space><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setSelectionOpen(false)} /><strong>选择产品</strong></Space>} closable={false} open={selectionOpen} onClose={() => setSelectionOpen(false)} footer={<div className="stocktake-drawer-footer"><Button onClick={() => setSelectionOpen(false)}>取消</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => { const selected = products.filter(item => selectedProductIds.includes(item.id)); setNewLines(current => [...current.filter(line => selectedProductIds.includes(line.itemId)), ...selected.filter(item => !current.some(line => line.itemId === item.id)).map(item => itemFromProduct(item, stockQuantity(item.id))) ]); setSelectionOpen(false) }}>确认</Button></div>}>
      <div className="stocktake-selection-filters"><Select allowClear value={selectionCategory} onChange={setSelectionCategory} options={categories.map(value => ({ value, label: value }))} placeholder="请选择产品类别" /><Select allowClear value={selectionBrand} onChange={setSelectionBrand} options={brands.map(value => ({ value, label: value }))} placeholder="请选择产品品牌" /><Input.Search allowClear value={selectionKeyword} onChange={event => setSelectionKeyword(event.target.value)} placeholder="请输入产品名称或编号" /></div>
      <Table<CatalogItem> rowKey="id" rowSelection={{ selectedRowKeys: selectedProductIds, onChange: keys => setSelectedProductIds(keys as number[]) }} dataSource={newProductRows} pagination={{ ...paginationOptions, pageSize: 10 }} columns={[{ title: '产品信息', key: 'item', width: 320, render: (_value, row) => <div className="catalog-cell-stack"><strong>{row.name}</strong><span>{row.code}</span></div> }, { title: '产品品类', dataIndex: 'category', width: 150, render: value => value || '—' }, { title: '成本价', key: 'cost', width: 110, render: (_value, row) => stockByItem.get(row.id)?.costPrice ?? 0 }, { title: '品牌', dataIndex: 'brand', width: 120, render: value => value || '—' }, { title: '规格/单位', key: 'spec', width: 160, render: (_value, row) => `${row.spec || '—'} / ${row.unit || '—'}` }, { title: '库存余量', key: 'stock', width: 110, render: (_value, row) => stockQuantity(row.id) }]} scroll={{ x: 1050 }} locale={{ emptyText: '暂无相关数据' }} />
    </Drawer>
  </div>
}
