import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Result, Tabs } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { downloadSmsReport, useSmsQuery } from '@/api/sms'
import { useAuth } from '@/context/AuthContext'
import { EnterpriseSelector } from '@/components/iam/PlatformDataPanel'
import { errorMessage, QueryError, useIamQuery } from '@/components/iam/shared'
import { SmsSettingsPanel } from '@/components/sms/SmsSettingsPanel'
import { initialSmsFilters, SmsRecordsPanel } from '@/components/sms/SmsRecordsPanel'
import { SmsBillingPanel } from '@/components/sms/SmsBillingPanel'
import type { SmsStatus, SmsTab } from '@/types/sms'
import type { Enterprise } from '@/types/platform'
import '@/styles/iam.css'
import '@/styles/platform.css'
import '@/styles/sms.css'

const tabs = [{ key: 'settings', label: '短信设置', permission: 'sms-settings:read' }, { key: 'records', label: '短信发送记录', permission: 'sms-records:read' }, { key: 'billing', label: '短信余额充值', permission: 'sms-billing:read' }]
function currentQuery(change: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search); change(params); return params
}

function SmsWorkspace({ tenantId, platform }: { tenantId?: number; platform: boolean }) {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const availableTabs = tabs.filter(item => platform || can(item.permission))
  const tab = (availableTabs.find(item => item.key === params.get('tab'))?.key ?? availableTabs[0]?.key) as SmsTab
  const status = useSmsQuery<SmsStatus>('/sms/status', tenantId)
  const enterprise = useIamQuery<Enterprise>(`/platform/tenants/${tenantId}`, 0, platform && tenantId !== undefined)
  const [filters, setFilters] = useState(initialSmsFilters)
  const [downloading, setDownloading] = useState(false)
  const download = useRef<AbortController | null>(null)
  const { message } = App.useApp()
  useEffect(() => () => { download.current?.abort() }, [tab])
  const writable = !platform || enterprise.data?.status === 1
  async function exportReport() {
    if (download.current) return
    const controller = new AbortController(); download.current = controller; setDownloading(true)
    try { await downloadSmsReport(filters, tenantId, controller.signal) }
    catch (cause) { if (!controller.signal.aborted) void message.error(errorMessage(cause)) }
    finally { if (download.current === controller) { download.current = null; setDownloading(false) } }
  }
  return <section className="sms-page" aria-labelledby="sms-title">
    <h1 className="visually-hidden" id="sms-title">短信</h1>
    <div className="sms-tabs-bar"><Tabs activeKey={tab} items={availableTabs} onChange={next => setParams(currentQuery(current => current.set('tab', next)))} />
      {tab === 'records' && (platform || can('sms-records:write')) && <Button type="primary" aria-label="下载报表" icon={<DownloadOutlined aria-hidden />} loading={downloading} onClick={() => void exportReport()}>下载报表</Button>}
    </div>
    <QueryError error={status.error || enterprise.error} onRetry={() => { status.reload(); enterprise.reload() }} />
    {status.data && <Alert type="info" showIcon className="sms-provider-notice" title={status.data.message} />}
    {enterprise.data?.status === 0 && <Alert type="warning" showIcon title="该企业已停用，短信数据可查看；修改设置或创建充值单前请先启用企业。" />}
    {tab === 'settings' && (platform && tenantId === undefined ? <div className="sms-scope-prompt"><Result status="info" title="请选择要管理短信设置的企业" subTitle="通知开关和提醒规则按企业独立保存。平台可在发送记录、余额充值中查看汇总数据。" /></div> : <SmsSettingsPanel tenantId={tenantId} writable={writable && (platform || can('sms-settings:write'))} />)}
    {tab === 'records' && <SmsRecordsPanel filters={filters} onFilters={setFilters} tenantId={tenantId} platform={platform} />}
    {tab === 'billing' && <SmsBillingPanel tenantId={tenantId} platform={platform} writable={writable && (platform || can('sms-billing:write'))} />}
  </section>
}

export default function SmsPage() {
  const { session, can } = useAuth()
  const [params, setParams] = useSearchParams()
  const platform = session?.userInfo.platformAdmin ?? false
  const raw = platform ? params.get('tenantId') : null
  const tenantId = raw === null ? undefined : Number(raw)
  if (!platform && !tabs.some(item => can(item.permission))) return <Result status="403" title="暂无短信模块权限" subTitle="请联系企业管理员分配短信相关权限。" />
  if (tenantId !== undefined && (!Number.isSafeInteger(tenantId) || tenantId <= 0)) return <Result status="404" title="企业参数不正确" />
  return <div className="sms-workspace">
    {platform && <EnterpriseSelector value={tenantId} onChange={id => setParams(currentQuery(next => { if (id === undefined) next.delete('tenantId'); else next.set('tenantId', String(id)) }))} />}
    <SmsWorkspace key={`${session?.token}:${tenantId ?? 'all'}`} tenantId={tenantId} platform={platform} />
  </div>
}
