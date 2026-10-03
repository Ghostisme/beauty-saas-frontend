import { useEffect, useMemo, useState } from 'react'
import { App, Button, Checkbox, Drawer, Empty, Input, InputNumber, Modal, Pagination, Result, Select, Space, Spin, Switch, Table, Tabs, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, CheckOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { catalogRequest, useCatalogQuery } from '@/api/catalog'
import { errorMessage, paginationOptions, QueryError } from '@/components/iam/shared'
import { useAuth } from '@/context/AuthContext'
import type { Department, ManagedUser, PageResult } from '@/types/iam'
import type { CatalogItem, CommissionKind, CommissionRule, CommissionScheme } from '@/types/catalog'

const commissionTabs: Array<{ key: CommissionKind; label: string }> = [
  { key: 'PROJECT', label: '项目提成' },
  { key: 'PRODUCT', label: '产品提成' },
  { key: 'CARD', label: '卡提成' },
  { key: 'STEP', label: '阶梯提成' },
]

type ProjectMetric = 'SERVICE_CASH' | 'SERVICE_CARD' | 'SERVICE_GIFT' | 'SERVICE_COST' | 'SALES_CASH' | 'SALES_CARD' | 'SALES_COST' | 'CARD_SERVICE' | 'CARD_SALES'
type ProjectRuleType = 'ALL' | 'CATEGORY' | 'ITEM'
type SettingUnit = 'PERCENT' | 'AMOUNT'

interface ProjectSetting {
  designated: number
  rotation: number
  guestDesignated: number
  guestRotation: number
  unit: SettingUnit
}

interface CardRate {
  designated: number
  rotation: number
  unit: SettingUnit
}

interface ProjectRuleConfig {
  key: string
  label: string
  type: ProjectRuleType
  category?: string
  itemId?: number
  values: Partial<Record<ProjectMetric, ProjectSetting>>
  cardIds?: Partial<Record<'CARD_SERVICE' | 'CARD_SALES', number[]>>
  cardRates?: Partial<Record<'CARD_SERVICE' | 'CARD_SALES', Record<string, CardRate>>>
}

interface ProjectCommissionConfig {
  version: 1
  storeIds: number[]
  staffIds: number[]
  rules: ProjectRuleConfig[]
}

interface ProjectCommissionWorkspaceProps {
  tenantId?: number
  platform: boolean
}

interface ProjectEditorProps {
  scheme?: CommissionScheme
  tenantId?: number
  writable: boolean
  stores: Department[]
  staff: ManagedUser[]
  items: CatalogItem[]
  cards: CatalogItem[]
  onBack: () => void
  onSaved: () => void
}

interface ProjectTableRow extends ProjectRuleConfig {
  depth: number
}

interface SettingModalProps {
  open: boolean
  title: string
  initial?: ProjectSetting
  syncChildren: boolean
  allowSync: boolean
  batch: boolean
  onCancel: () => void
  onConfirm: (setting: ProjectSetting, syncChildren: boolean) => void
}

interface CardSelectionDrawerProps {
  open: boolean
  cards: CatalogItem[]
  selectedIds: number[]
  selectedRates: Record<string, CardRate>
  onCancel: () => void
  onConfirm: (ids: number[], rates: Record<string, CardRate>) => void
}

const metricDefinitions: Array<{ key: ProjectMetric; group: string; label: string; card?: boolean }> = [
  { key: 'SERVICE_CASH', group: '服务提成', label: '实收款' },
  { key: 'SERVICE_CARD', group: '服务提成', label: '耗卡' },
  { key: 'SERVICE_GIFT', group: '服务提成', label: '赠送' },
  { key: 'SERVICE_COST', group: '服务提成', label: '扣除成本' },
  { key: 'SALES_CASH', group: '销售提成', label: '实收款' },
  { key: 'SALES_CARD', group: '销售提成', label: '耗卡' },
  { key: 'SALES_COST', group: '销售提成', label: '扣除成本' },
  { key: 'CARD_SERVICE', group: '指定卡提成', label: '服务', card: true },
  { key: 'CARD_SALES', group: '指定卡提成', label: '销售', card: true },
]

const metricLabel = (metric: ProjectMetric) => metricDefinitions.find(item => item.key === metric)?.label ?? metric
const metricIsCard = (metric: ProjectMetric) => metric === 'CARD_SERVICE' || metric === 'CARD_SALES'
const cellId = (ruleKey: string, metric: ProjectMetric) => `${ruleKey}::${metric}`

function defaultSetting(): ProjectSetting {
  return { designated: 0, rotation: 0, guestDesignated: 0, guestRotation: 0, unit: 'PERCENT' }
}

function defaultCardRate(): CardRate {
  return { designated: 0, rotation: 0, unit: 'PERCENT' }
}

function normaliseCardRate(value: unknown): CardRate {
  if (!value || typeof value !== 'object') return defaultCardRate()
  const source = value as Record<string, unknown>
  return {
    designated: typeof source.designated === 'number' && Number.isFinite(source.designated) ? source.designated : 0,
    rotation: typeof source.rotation === 'number' && Number.isFinite(source.rotation) ? source.rotation : 0,
    unit: source.unit === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
  }
}

function normaliseSetting(value: unknown): ProjectSetting {
  if (!value || typeof value !== 'object') return defaultSetting()
  const source = value as Record<string, unknown>
  const unit = source.unit === 'AMOUNT' ? 'AMOUNT' : 'PERCENT'
  return {
    designated: typeof source.designated === 'number' && Number.isFinite(source.designated) ? source.designated : 0,
    rotation: typeof source.rotation === 'number' && Number.isFinite(source.rotation) ? source.rotation : 0,
    guestDesignated: typeof source.guestDesignated === 'number' && Number.isFinite(source.guestDesignated) ? source.guestDesignated : (typeof source.designated === 'number' && Number.isFinite(source.designated) ? source.designated : 0),
    guestRotation: typeof source.guestRotation === 'number' && Number.isFinite(source.guestRotation) ? source.guestRotation : (typeof source.rotation === 'number' && Number.isFinite(source.rotation) ? source.rotation : 0),
    unit,
  }
}

function categoryRows(items: CatalogItem[]): ProjectRuleConfig[] {
  const grouped = new Map<string, CatalogItem[]>()
  items.forEach(item => {
    const category = item.category?.trim() || '未分类'
    grouped.set(category, [...(grouped.get(category) ?? []), item])
  })
  const rows: ProjectRuleConfig[] = [{ key: 'all', label: '全部项目', type: 'ALL', values: {} }]
  grouped.forEach((groupItems, category) => {
    rows.push({ key: `category:${category}`, label: category, type: 'CATEGORY', category, values: {} })
    groupItems.forEach(item => rows.push({ key: `item:${item.id}`, label: item.name, type: 'ITEM', category, itemId: item.id, values: {} }))
  })
  return rows
}

function parseProjectConfig(raw?: string): Partial<ProjectCommissionConfig> | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return undefined
    return parsed as Partial<ProjectCommissionConfig>
  } catch {
    return undefined
  }
}

function hydrateConfig(scheme: CommissionScheme | undefined, items: CatalogItem[], stores: Department[], staff: ManagedUser[]): ProjectCommissionConfig {
  const fallbackRows = categoryRows(items)
  const parsed = parseProjectConfig(scheme?.configJson)
  const sourceRules = Array.isArray(parsed?.rules) ? parsed.rules : []
  const sourceByKey = new Map<string, ProjectRuleConfig>()
  sourceRules.forEach(value => {
    if (!value || typeof value !== 'object') return
    const candidate = value as ProjectRuleConfig
    if (typeof candidate.key !== 'string') return
    const values: Partial<Record<ProjectMetric, ProjectSetting>> = {}
    if (candidate.values && typeof candidate.values === 'object') {
      Object.entries(candidate.values).forEach(([key, entry]) => {
        if (metricDefinitions.some(metric => metric.key === key)) values[key as ProjectMetric] = normaliseSetting(entry)
      })
    }
    const cardIds: Partial<Record<'CARD_SERVICE' | 'CARD_SALES', number[]>> = {}
    if (candidate.cardIds && typeof candidate.cardIds === 'object') {
      ;(['CARD_SERVICE', 'CARD_SALES'] as const).forEach(metric => {
        const value = candidate.cardIds?.[metric]
        if (Array.isArray(value)) cardIds[metric] = value.filter(item => typeof item === 'number' && Number.isSafeInteger(item))
      })
    }
    const cardRates: Partial<Record<'CARD_SERVICE' | 'CARD_SALES', Record<string, CardRate>>> = {}
    if (candidate.cardRates && typeof candidate.cardRates === 'object') {
      ;(['CARD_SERVICE', 'CARD_SALES'] as const).forEach(metric => {
        const value = candidate.cardRates?.[metric]
        if (!value || typeof value !== 'object') return
        const rates: Record<string, CardRate> = {}
        Object.entries(value).forEach(([cardId, rate]) => { rates[cardId] = normaliseCardRate(rate) })
        cardRates[metric] = rates
      })
    }
    sourceByKey.set(candidate.key, { ...candidate, values, cardIds, cardRates })
  })
  // Keep project schemes created by the previous generic form editable: the
  // legacy SERVICE_CASH rule is promoted to the rich matrix's item row.
  if (!sourceRules.length && scheme?.rules?.length) {
    scheme.rules.forEach(rule => {
      if (!rule.itemId || sourceByKey.has(`item:${rule.itemId}`)) return
      const row = fallbackRows.find(item => item.key === `item:${rule.itemId}`)
      if (!row) return
      const unit: SettingUnit = rule.basis === 'AMOUNT' ? 'AMOUNT' : 'PERCENT'
      const amount = unit === 'PERCENT' ? Number(rule.rate ?? 0) : Number(rule.fixedAmount ?? 0)
      sourceByKey.set(row.key, { ...row, values: { SERVICE_CASH: { designated: amount, rotation: 0, guestDesignated: amount, guestRotation: 0, unit } } })
    })
  }
  const rules = fallbackRows.map(row => {
    const existing = sourceByKey.get(row.key)
    return existing ? { ...row, ...existing, values: existing.values ?? {}, cardIds: existing.cardIds ?? {} } : row
  })
  const storeIds = Array.isArray(parsed?.storeIds) ? parsed.storeIds.filter(value => typeof value === 'number' && Number.isSafeInteger(value)) : stores.map(store => store.id)
  const staffIds = Array.isArray(parsed?.staffIds) ? parsed.staffIds.filter(value => typeof value === 'number' && Number.isSafeInteger(value)) : staff.map(user => user.id)
  return { version: 1, storeIds, staffIds, rules }
}

function cloneConfig(config: ProjectCommissionConfig): ProjectCommissionConfig {
  return JSON.parse(JSON.stringify(config)) as ProjectCommissionConfig
}

function settingHasValue(setting?: ProjectSetting, cards?: number[]): boolean {
  return Boolean(setting && (setting.designated > 0 || setting.rotation > 0 || setting.guestDesignated > 0 || setting.guestRotation > 0)) || Boolean(cards?.length)
}

function settingText(value: number, unit: SettingUnit) {
  return unit === 'PERCENT' ? `${value}%` : `¥${value.toFixed(2)}`
}

function SettingSummary({ setting, cards, rates }: { setting?: ProjectSetting; cards?: number[]; rates?: Record<string, CardRate> }) {
  if (!settingHasValue(setting, cards)) return <span className="project-commission-empty-cell">—</span>
  const safe = setting ?? defaultSetting()
  return <div className="project-commission-setting-summary">
    <span className="project-commission-customer-label">会员</span>
    <span><Tag color="purple">指定</Tag>{settingText(safe.designated, safe.unit)}</span>
    <span><Tag color="magenta">轮牌</Tag>{settingText(safe.rotation, safe.unit)}</span>
    <span className="project-commission-customer-label">散客</span>
    {cards?.length ? <span className="project-commission-card-count">已指定 {cards.length} 张卡{rates && Object.keys(rates).length ? `（${settingText(Object.values(rates)[0].designated, Object.values(rates)[0].unit)} 起）` : ''}</span> : <><span><Tag color="purple">指定</Tag>{settingText(safe.guestDesignated, safe.unit)}</span><span><Tag color="magenta">轮牌</Tag>{settingText(safe.guestRotation, safe.unit)}</span></>}
  </div>
}

function ProjectSettingModal({ open, title, initial, syncChildren: initialSync, allowSync, batch, onCancel, onConfirm }: SettingModalProps) {
  const [draft, setDraft] = useState<ProjectSetting>(initial ?? defaultSetting())
  const [syncChildren, setSyncChildren] = useState(initialSync)
  useEffect(() => {
    if (!open) return
    setDraft(initial ?? defaultSetting())
    setSyncChildren(initialSync)
  }, [initial, initialSync, open])
  const update = (key: 'designated' | 'rotation' | 'guestDesignated' | 'guestRotation', value: number | null) => setDraft(current => ({ ...current, [key]: value ?? 0 }))
  return <Modal className="project-commission-setting-modal" title={title} open={open} onCancel={onCancel} destroyOnClose footer={null} width={520} centered>
    <div className="project-setting-modal-body">
      <div className="project-setting-customer-block">
        <strong>会员</strong>
        <div className="project-setting-input-line"><Tag color="purple">指定</Tag><InputNumber min={0} max={draft.unit === 'PERCENT' ? 100 : undefined} precision={2} value={draft.designated} onChange={value => update('designated', value)} /><Select value={draft.unit} onChange={unit => setDraft(current => ({ ...current, unit }))} options={[{ value: 'PERCENT', label: '%' }, { value: 'AMOUNT', label: '元' }]} /></div>
        <div className="project-setting-input-line"><Tag color="magenta">轮牌</Tag><InputNumber min={0} max={draft.unit === 'PERCENT' ? 100 : undefined} precision={2} value={draft.rotation} onChange={value => update('rotation', value)} /><span className="project-setting-unit-hint">{draft.unit === 'PERCENT' ? '%' : '元'}</span></div>
      </div>
       <div className="project-setting-customer-block">
         <strong>散客</strong>
         <div className="project-setting-input-line"><Tag color="purple">指定</Tag><InputNumber min={0} max={draft.unit === 'PERCENT' ? 100 : undefined} precision={2} value={draft.guestDesignated} onChange={value => update('guestDesignated', value)} /><span className="project-setting-unit-hint">{draft.unit === 'PERCENT' ? '%' : '元'}</span></div>
         <div className="project-setting-input-line"><Tag color="magenta">轮牌</Tag><InputNumber min={0} max={draft.unit === 'PERCENT' ? 100 : undefined} precision={2} value={draft.guestRotation} onChange={value => update('guestRotation', value)} /><span className="project-setting-unit-hint">{draft.unit === 'PERCENT' ? '%' : '元'}</span></div>
       </div>
      {allowSync && <div className="project-setting-sync-row"><span>同步子内容</span><Switch checked={syncChildren} onChange={setSyncChildren} /></div>}
      {batch && <p className="project-setting-modal-hint">本次设置将应用到已选中的 {title.replace(/[^0-9]/g, '') || '多个'} 个单元格。</p>}
    </div>
    <div className="catalog-dialog-actions"><Button onClick={onCancel}>取消</Button><Button type="primary" onClick={() => onConfirm(draft, syncChildren)}>确定</Button></div>
  </Modal>
}

function CardSelectionDrawer({ open, cards, selectedIds, selectedRates, onCancel, onConfirm }: CardSelectionDrawerProps) {
  const [search, setSearch] = useState('')
  const [draftIds, setDraftIds] = useState<number[]>(selectedIds)
  const [draftRates, setDraftRates] = useState<Record<string, CardRate>>({})
  const [bulkDesignated, setBulkDesignated] = useState<number | null>(null)
  const [bulkRotation, setBulkRotation] = useState<number | null>(null)
  const [bulkUnit, setBulkUnit] = useState<SettingUnit>('PERCENT')
  useEffect(() => { if (open) { setDraftIds(selectedIds); setSearch(''); setDraftRates(selectedRates) } }, [open, selectedIds, selectedRates])
  const filteredCards = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return cards.filter(card => !keyword || card.name.toLowerCase().includes(keyword) || card.code.toLowerCase().includes(keyword))
  }, [cards, search])
  const rateFor = (id: number) => draftRates[String(id)] ?? defaultCardRate()
  const updateRate = (id: number, key: 'designated' | 'rotation' | 'unit', value: number | string | null) => setDraftRates(current => ({ ...current, [String(id)]: { ...(current[String(id)] ?? defaultCardRate()), [key]: key === 'unit' ? value : value ?? 0 } as CardRate }))
  const applyBulk = () => setDraftRates(Object.fromEntries(draftIds.map(id => [String(id), { designated: bulkDesignated ?? 0, rotation: bulkRotation ?? 0, unit: bulkUnit }])))
  const columns: ColumnsType<CatalogItem> = [
    { title: '卡名称', dataIndex: 'name', width: 230, render: (value: string, row) => <div className="project-card-name"><strong>{value}</strong><span>{row.code}</span></div> },
    { title: '会员指定提卡', width: 220, render: (_: unknown, row) => <div className="project-card-rate-input"><InputNumber min={0} max={rateFor(row.id).unit === 'PERCENT' ? 100 : undefined} precision={2} value={rateFor(row.id).designated} onChange={value => updateRate(row.id, 'designated', value)} /><Select value={rateFor(row.id).unit} onChange={value => updateRate(row.id, 'unit', value)} options={[{ value: 'PERCENT', label: '%' }, { value: 'AMOUNT', label: '元' }]} /></div> },
    { title: '会员轮牌耗卡', width: 220, render: (_: unknown, row) => <div className="project-card-rate-input"><InputNumber min={0} max={rateFor(row.id).unit === 'PERCENT' ? 100 : undefined} precision={2} value={rateFor(row.id).rotation} onChange={value => updateRate(row.id, 'rotation', value)} /><span>{rateFor(row.id).unit === 'PERCENT' ? '%' : '元'}</span></div> },
    { title: '操作', key: 'actions', width: 90, render: (_: unknown, row) => <Button type="link" onClick={() => setDraftIds(current => current.filter(id => id !== row.id))}>删除</Button> },
  ]
  return <Drawer className="project-card-selection-drawer" placement="right" width={760} title={<Space><ArrowLeftOutlined onClick={onCancel} className="project-drawer-back" /><strong>品项选择</strong></Space>} open={open} onClose={onCancel} destroyOnHidden extra={<Space><Button onClick={onCancel}>取消</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => onConfirm(draftIds, draftRates)}>确认选择</Button></Space>}>
    <div className="project-card-selection-search"><Input.Search allowClear value={search} onChange={event => setSearch(event.target.value)} placeholder="请输入名称或编码搜索" /></div>
    <div className="project-card-selection-summary"><span>已选择 ({draftIds.length})</span><Button type="link" onClick={() => setDraftIds([])}>清空</Button><span className="project-card-bulk-label">批量设置</span><InputNumber min={0} max={bulkUnit === 'PERCENT' ? 100 : undefined} precision={2} value={bulkDesignated} onChange={setBulkDesignated} placeholder="指定" /><InputNumber min={0} max={bulkUnit === 'PERCENT' ? 100 : undefined} precision={2} value={bulkRotation} onChange={setBulkRotation} placeholder="轮牌" /><Select value={bulkUnit} onChange={setBulkUnit} options={[{ value: 'PERCENT', label: '%' }, { value: 'AMOUNT', label: '元' }]} /><Button type="link" onClick={applyBulk} disabled={!draftIds.length}>应用</Button></div>
    <Table<CatalogItem> rowKey="id" size="small" columns={columns} dataSource={filteredCards} pagination={false} scroll={{ y: 'calc(100dvh - 300px)' }} rowSelection={{ selectedRowKeys: draftIds, onChange: keys => setDraftIds(keys.map(key => Number(key))) }} locale={{ emptyText: <Empty description="暂无可选会员卡" /> }} />
  </Drawer>
}

function ProjectCommissionEditor({ scheme, tenantId, writable, stores, staff, items, cards, onBack, onSaved }: ProjectEditorProps) {
  const { message } = App.useApp()
  const [name, setName] = useState(scheme?.name ?? '')
  const [config, setConfig] = useState<ProjectCommissionConfig>(() => hydrateConfig(scheme, items, stores, staff))
  const [saving, setSaving] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(categoryRows(items).filter(row => row.type === 'CATEGORY').map(row => row.key)))
  const [hoveredCell, setHoveredCell] = useState<string>()
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [settingTarget, setSettingTarget] = useState<{ ruleKey: string; metric: ProjectMetric }>()
  const [batchOpen, setBatchOpen] = useState(false)
  const [cardTarget, setCardTarget] = useState<{ ruleKey: string; metric: 'CARD_SERVICE' | 'CARD_SALES' }>()
  useEffect(() => {
    setConfig(hydrateConfig(scheme, items, stores, staff))
    setExpandedCategories(new Set(categoryRows(items).filter(row => row.type === 'CATEGORY').map(row => row.key)))
    setSelectedCells(new Set())
  }, [items, scheme, staff, stores])
  const allRows = config.rules
  const tableRows = useMemo<ProjectTableRow[]>(() => allRows.filter(row => row.type !== 'ITEM' || !row.category || expandedCategories.has(`category:${row.category}`)).map(row => ({ ...row, depth: row.type === 'ITEM' ? 1 : 0 })), [allRows, expandedCategories])
  const findRule = (key: string) => config.rules.find(rule => rule.key === key)
  const settingFor = (ruleKey: string, metric: ProjectMetric) => findRule(ruleKey)?.values[metric]
  const selectedCount = selectedCells.size
  const storeOptions = stores.filter(store => store.status === 1).map(store => ({ value: store.id, label: store.name }))
  const activeStaff = staff.filter(user => user.status === 1)
  const updateConfig = (updater: (current: ProjectCommissionConfig) => ProjectCommissionConfig) => setConfig(current => updater(current))
  const toggleCategory = (key: string) => setExpandedCategories(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const toggleBatchCell = (key: string) => setSelectedCells(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const applySetting = (targets: string[], setting: ProjectSetting, syncChildren: boolean) => {
    updateConfig(current => {
      const next = cloneConfig(current)
      const targetSet = new Set(targets)
      const expandedTargets = new Set(targets)
      if (syncChildren) {
        targets.forEach(target => {
          const [ruleKey, metric] = target.split('::') as [string, ProjectMetric]
          const source = next.rules.find(rule => rule.key === ruleKey)
          if (!source || source.type === 'ITEM') return
          next.rules.filter(rule => {
            const descendant = source.type === 'ALL' || (source.type === 'CATEGORY' && rule.category === source.category)
            return descendant && rule.key !== source.key
          }).forEach(rule => expandedTargets.add(cellId(rule.key, metric)))
        })
      }
      expandedTargets.forEach(target => {
        const [ruleKey, metric] = target.split('::') as [string, ProjectMetric]
        const rule = next.rules.find(entry => entry.key === ruleKey)
        if (!rule) return
        rule.values = { ...rule.values, [metric]: { ...setting } }
        if (metricIsCard(metric) && !rule.cardIds) rule.cardIds = {}
      })
      if (!targetSet.size) return current
      return next
    })
    setSettingTarget(undefined)
    setBatchOpen(false)
    setSelectedCells(new Set())
  }
  const setCardIds = (ids: number[], rates: Record<string, CardRate>) => {
    if (!cardTarget) return
    updateConfig(current => {
      const next = cloneConfig(current)
      const rule = next.rules.find(entry => entry.key === cardTarget.ruleKey)
      if (rule) {
        rule.cardIds = { ...(rule.cardIds ?? {}), [cardTarget.metric]: ids }
        rule.cardRates = { ...(rule.cardRates ?? {}), [cardTarget.metric]: Object.fromEntries(ids.map(id => [String(id), rates[String(id)] ?? defaultCardRate()])) }
      }
      return next
    })
    setCardTarget(undefined)
  }
  const toggleStaff = (staffId: number) => setConfig(current => ({ ...current, staffIds: current.staffIds.includes(staffId) ? current.staffIds.filter(id => id !== staffId) : [...current.staffIds, staffId] }))
  const save = async () => {
    if (!writable) return
    if (!name.trim()) { void message.error('请输入方案名称'); return }
    if (!config.storeIds.length) { void message.error('请选择适用门店'); return }
    if (!config.staffIds.length) { void message.error('请选择适用员工'); return }
    const legacyRules: CommissionRule[] = config.rules.filter(rule => rule.itemId).slice(0, 100).map((rule, index) => {
      const setting = rule.values.SERVICE_CASH ?? defaultSetting()
      return { itemId: rule.itemId, minAmount: 0, basis: setting.unit, rate: setting.unit === 'PERCENT' ? setting.designated : 0, fixedAmount: setting.unit === 'AMOUNT' ? setting.designated : 0, sortOrder: index }
    })
    if (!legacyRules.length) legacyRules.push({ minAmount: 0, basis: 'PERCENT', rate: 0, fixedAmount: 0, sortOrder: 0 })
    setSaving(true)
    try {
      const payload = { kind: 'PROJECT', name: name.trim(), basis: 'PERCENT', rate: 0, fixedAmount: 0, description: `适用 ${config.storeIds.length} 家门店，${config.staffIds.length} 名员工`, status: scheme?.status ?? 1, rules: legacyRules, configJson: JSON.stringify(config) }
      await catalogRequest(`/commissions${scheme ? `/${scheme.id}` : ''}`, tenantId, { method: scheme ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      void message.success(scheme ? '项目提成方案已更新' : '项目提成方案已创建')
      onSaved()
      onBack()
    } catch (cause) {
      void message.error(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }
  const renderSettingCell = (rule: ProjectRuleConfig, metric: ProjectMetric) => {
    const id = cellId(rule.key, metric)
    const setting = rule.values[metric]
    const cardsForCell = metricIsCard(metric) ? rule.cardIds?.[metric] : undefined
    const ratesForCell = metricIsCard(metric) ? rule.cardRates?.[metric] : undefined
    const selected = selectedCells.has(id)
    const card = metricIsCard(metric)
    return <div className={`project-commission-cell ${selected ? 'is-selected' : ''}`} onMouseEnter={() => setHoveredCell(id)} onMouseLeave={() => setHoveredCell(current => current === id ? undefined : current)} onClick={() => selectedCells.size ? toggleBatchCell(id) : setSettingTarget({ ruleKey: rule.key, metric })}>
      <SettingSummary setting={setting} cards={cardsForCell} rates={ratesForCell} />
      <div className={`project-commission-cell-actions ${hoveredCell === id || selected ? 'is-visible' : ''}`}>
        <Button type="link" size="small" onClick={event => { event.stopPropagation(); setSettingTarget({ ruleKey: rule.key, metric }) }}>设置</Button>
        {card ? <Button type="link" size="small" onClick={event => { event.stopPropagation(); setCardTarget({ ruleKey: rule.key, metric: metric as 'CARD_SERVICE' | 'CARD_SALES' }) }}>编辑</Button> : <Button type="link" size="small" onClick={event => { event.stopPropagation(); setSelectedCells(current => new Set([...current, id])) }}>批量设置</Button>}
      </div>
      {selected && <CheckOutlined className="project-commission-cell-check" />}
    </div>
  }
  const columns: ColumnsType<ProjectTableRow> = [
    { title: '项目/分类', dataIndex: 'label', fixed: 'left', width: 280, render: (value: string, row) => <div className={`project-commission-row-label depth-${row.depth}`}>
      {(row.type === 'CATEGORY' || row.type === 'ITEM') && row.type !== 'ITEM' && <Button type="text" size="small" className="project-commission-expand" onClick={() => toggleCategory(row.key)}>{expandedCategories.has(row.key) ? '−' : '+'}</Button>}
      {row.type === 'CATEGORY' ? <span className="project-commission-folder">▱</span> : row.type === 'ITEM' ? <span className="project-commission-item-dot">•</span> : null}<span>{value}</span>
    </div> },
    ...(['服务提成', '销售提成', '指定卡提成'] as const).map(group => ({ title: group, children: metricDefinitions.filter(metric => metric.group === group).map(metric => ({ title: metric.label, key: metric.key, width: metric.card ? 150 : 128, render: (_: unknown, row: ProjectTableRow) => renderSettingCell(row, metric.key) })) })),
    { title: '操作', key: 'actions', fixed: 'right', width: 190, render: (_: unknown, row: ProjectTableRow) => <Space size={0} wrap><Button type="link" size="small" onClick={() => setSettingTarget({ ruleKey: row.key, metric: 'SERVICE_CASH' })}>编辑</Button>{row.type === 'CATEGORY' && <Button type="link" size="small" onClick={() => setSelectedCells(current => new Set([...current, cellId(row.key, 'SERVICE_CASH')]))}>批量设置</Button>}</Space> },
  ]
  return <section className="catalog-panel project-commission-editor-shell">
    <div className="project-commission-editor-heading"><Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回项目提成</Button><h2>{scheme ? '编辑项目提成方案' : '新增项目提成方案'}</h2></div>
    <div className="project-commission-editor-card">
      <div className="project-commission-form-grid"><label className="project-commission-field required"><span>方案名称</span><Input value={name} maxLength={100} showCount onChange={event => setName(event.target.value)} placeholder="请输入" /></label><label className="project-commission-field required"><span>适用门店</span><Select mode="multiple" value={config.storeIds} options={storeOptions} onChange={value => setConfig(current => ({ ...current, storeIds: value }))} placeholder="请选择门店" maxTagCount="responsive" /></label></div>
      <div className="project-commission-field required project-commission-staff-field"><span>适用员工</span><div className="project-commission-staff-panel"><div className="project-commission-selected-staff"><span>已选员工</span><Space wrap>{config.staffIds.map(id => { const user = activeStaff.find(item => item.id === id); return user ? <Tag key={id} closable onClose={() => toggleStaff(id)}>{user.nickname}{user.positionName ? `（${user.positionName}）` : ''}</Tag> : null })}</Space></div><div className="project-commission-available-staff"><span>可选员工</span><div className="project-commission-staff-options">{activeStaff.map(user => <Checkbox key={user.id} checked={config.staffIds.includes(user.id)} onChange={() => toggleStaff(user.id)}>{user.nickname}{user.positionName ? `（${user.positionName}）` : ''}</Checkbox>)}</div></div></div></div>
    </div>
    <div className="project-commission-rules-section"><div className="project-commission-section-heading"><strong>规则设置</strong><span>点击单元格设置提成；悬浮后可进行批量设置，已保留现有点击与悬浮行为。</span>{selectedCount > 0 && <Tag className="project-commission-batch-tag" closable closeIcon={<CloseCircleOutlined />} onClick={() => setBatchOpen(true)} onClose={event => { event.stopPropagation(); setSelectedCells(new Set()) }}>批量设置({selectedCount})</Tag>}</div><div className="project-commission-table-wrap"><Table<ProjectTableRow> rowKey="key" size="small" bordered columns={columns} dataSource={tableRows} pagination={false} scroll={{ x: 1780 }} locale={{ emptyText: <Empty description="暂无项目" /> }} /></div></div>
    <div className="project-commission-editor-footer"><Button onClick={onBack}>取消</Button><Button type="primary" loading={saving} disabled={!writable} onClick={save}>保存方案</Button></div>
    <ProjectSettingModal open={Boolean(settingTarget)} title={settingTarget ? `${findRule(settingTarget.ruleKey)?.label ?? ''} — ${metricDefinitions.find(metric => metric.key === settingTarget.metric)?.group ?? ''} · ${metricLabel(settingTarget.metric)}` : '设置提成'} initial={settingTarget ? settingFor(settingTarget.ruleKey, settingTarget.metric) : undefined} syncChildren={false} allowSync={Boolean(settingTarget && findRule(settingTarget.ruleKey)?.type !== 'ITEM')} batch={false} onCancel={() => setSettingTarget(undefined)} onConfirm={(setting, sync) => settingTarget && applySetting([cellId(settingTarget.ruleKey, settingTarget.metric)], setting, sync)} />
    <ProjectSettingModal open={batchOpen} title={`批量设置(${selectedCount})`} initial={defaultSetting()} syncChildren={false} allowSync={false} batch onCancel={() => setBatchOpen(false)} onConfirm={(setting, sync) => applySetting(Array.from(selectedCells), setting, sync)} />
    <CardSelectionDrawer open={Boolean(cardTarget)} cards={cards} selectedIds={cardTarget ? findRule(cardTarget.ruleKey)?.cardIds?.[cardTarget.metric] ?? [] : []} selectedRates={cardTarget ? findRule(cardTarget.ruleKey)?.cardRates?.[cardTarget.metric] ?? {} : {}} onCancel={() => setCardTarget(undefined)} onConfirm={setCardIds} />
  </section>
}

function ProjectCommissionWorkspace({ tenantId, platform }: ProjectCommissionWorkspaceProps) {
  const { can } = useAuth()
  const [, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [storeFilter, setStoreFilter] = useState<number>()
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<CommissionScheme>()
  const [creating, setCreating] = useState(false)
  const { modal, message } = App.useApp()
  const enabled = platform ? tenantId !== undefined : true
  const storesQuery = useCatalogQuery<Department[]>('/iam/departments', tenantId, revision, enabled)
  const staffQuery = useCatalogQuery<PageResult<ManagedUser>>('/iam/users?page=1&pageSize=100&status=1', tenantId, revision, enabled)
  const itemsQuery = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=PROJECT&page=1&pageSize=100&status=1', tenantId, revision, enabled)
  const cardsQuery = useCatalogQuery<PageResult<CatalogItem>>('/items?kind=CARD&page=1&pageSize=100&status=1', tenantId, revision, enabled)
  const query = useCatalogQuery<PageResult<CommissionScheme>>(`/commissions?kind=PROJECT&page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}`, tenantId, revision, enabled)
  const writable = platform || can('commissions:write')
  const stores = storesQuery.data ?? []
  const staff = staffQuery.data?.records ?? []
  const items = itemsQuery.data?.records ?? []
  const cards = cardsQuery.data?.records ?? []
  const records = (query.data?.records ?? []).filter(row => storeFilter === undefined || (parseProjectConfig(row.configJson)?.storeIds ?? []).includes(storeFilter))
  const resetEditor = () => { setCreating(false); setEditing(undefined) }
  const remove = (row: CommissionScheme) => modal.confirm({ title: `停用“${row.name}”？`, content: '停用后历史提成记录仍可追溯，列表中会保留该方案。', okText: '停用', okButtonProps: { danger: true }, cancelText: '取消', onOk: async () => { try { await catalogRequest(`/commissions/${row.id}?kind=PROJECT`, tenantId, { method: 'DELETE' }); void message.success('项目提成方案已停用'); setRevision(value => value + 1) } catch (cause) { void message.error(errorMessage(cause)); throw cause } } })
  if (!platform && !can('commissions:read')) return <Result status="403" title="暂无提成管理权限" />
  const changeTab = (key: string) => { setPage(1); setParams(current => { current.set('kind', key); return current }) }
  if (creating || editing) return <ProjectCommissionEditor scheme={editing} tenantId={tenantId} writable={writable} stores={stores.filter(store => store.type === 'STORE')} staff={staff} items={items} cards={cards} onBack={resetEditor} onSaved={() => setRevision(value => value + 1)} />
  const columns: ColumnsType<CommissionScheme> = [
    { title: '方案名称', dataIndex: 'name', width: 230, render: (value: string, row) => <div className="project-scheme-name"><strong>{value}</strong><span>更新于 {row.updateTime?.replace('T', ' ').slice(0, 16) || '—'}</span></div> },
    { title: '适用门店', key: 'stores', width: 220, render: (_: unknown, row) => { const ids = parseProjectConfig(row.configJson)?.storeIds ?? []; return ids.length ? ids.map(id => stores.find(store => store.id === id)?.name).filter(Boolean).join('、') || `${ids.length} 家门店` : '全部门店' } },
    { title: '适用员工', key: 'staff', width: 220, render: (_: unknown, row) => { const ids = parseProjectConfig(row.configJson)?.staffIds ?? []; return ids.length ? `${ids.slice(0, 3).map(id => staff.find(user => user.id === id)?.nickname).filter(Boolean).join('、')}${ids.length > 3 ? ` 等 ${ids.length} 人` : ''}` : '全部员工' } },
    { title: '规则设置', key: 'rules', width: 140, render: (_: unknown, row) => { const count = parseProjectConfig(row.configJson)?.rules?.filter(rule => Object.keys(rule.values ?? {}).length > 0).length ?? row.rules?.length ?? 0; return `${count} 项` } },
    { title: '状态', dataIndex: 'status', width: 100, render: (value: number) => <Tag color={value === 1 ? 'success' : 'default'}>{value === 1 ? '启用' : '停用'}</Tag> },
    { title: '操作', key: 'actions', width: 180, render: (_: unknown, row) => <Space size={0}><Button type="link" icon={<EditOutlined />} disabled={!writable} onClick={() => setEditing(row)}>编辑</Button><Button type="link" danger icon={<DeleteOutlined />} disabled={!writable || row.status === 0} onClick={() => remove(row)}>停用</Button></Space> },
  ]
  const showEmpty = !query.loading && records.length === 0
  return <section className="catalog-panel project-commission-panel"><div className="catalog-tabs-row project-commission-tabs-row"><Tabs activeKey="PROJECT" items={commissionTabs} onChange={changeTab} /><Space wrap className="project-commission-list-actions"><Select allowClear value={storeFilter} options={stores.filter(store => store.type === 'STORE').map(store => ({ value: store.id, label: store.name }))} onChange={value => { setStoreFilter(value); setPage(1) }} placeholder="适用门店" style={{ minWidth: 180 }} /><Input.Search aria-label="搜索项目提成方案" placeholder="请输入方案名称搜索" allowClear onSearch={value => { setKeyword(value.trim()); setPage(1) }} /><Button icon={<ReloadOutlined />} aria-label="刷新项目提成" onClick={() => setRevision(value => value + 1)} /><Button className="project-primary-button" type="primary" icon={<PlusOutlined />} disabled={!writable} onClick={() => setCreating(true)}>新增提成方案</Button></Space></div><QueryError error={query.error || storesQuery.error || staffQuery.error || itemsQuery.error || cardsQuery.error} onRetry={() => { query.reload(); storesQuery.reload(); staffQuery.reload(); itemsQuery.reload(); cardsQuery.reload() }} />{showEmpty ? <div className="project-commission-empty"><Empty description="暂无提成方案" /><Button className="project-empty-add-button" type="primary" onClick={() => setCreating(true)} disabled={!writable}>新增提成方案</Button></div> : <><Table<CommissionScheme> rowKey="id" loading={query.loading} columns={columns} dataSource={records} scroll={{ x: 1100 }} pagination={false} locale={{ emptyText: query.loading ? <Spin /> : '暂无提成方案' }} /><div className="catalog-footer"><span>共 {query.data?.total ?? 0} 条</span><Pagination {...paginationOptions} current={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div></>}</section>
}

export default ProjectCommissionWorkspace
