import { useState } from 'react'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Spin, Switch } from 'antd'
import { smsRequest, useSmsQuery } from '@/api/sms'
import { errorMessage, QueryError } from '@/components/iam/shared'
import type { ReminderConfig, SmsSettings, SmsTemplate } from '@/types/sms'

function configSummary(template: SmsTemplate) {
  if (!template.config) return '暂未设置'
  if (template.configKind === 'APPOINTMENT') return `提前 ${template.config.leadMinutes} 分钟提醒`
  return template.config.advanceDays === 0 ? '生日当天发送' : `提前 ${template.config.advanceDays} 天发送`
}

function ReminderForm({ template, saving, onSave, onClose }: { template: SmsTemplate; saving: boolean; onSave: (config: ReminderConfig) => void; onClose: () => void }) {
  const appointment = template.configKind === 'APPOINTMENT'
  const initial: ReminderConfig = appointment ? { leadMinutes: 1, ...template.config } : { advanceDays: 1, sendTime: '09:00', visitNote: '', benefitNote: '生日权益', ...template.config }
  const [form] = Form.useForm<ReminderConfig>()
  const [customBenefit, setCustomBenefit] = useState(template.config?.customBenefitEnabled ?? !!template.config)
  function submit() {
    const values = { ...initial, ...form.getFieldsValue(true) }
    onSave(appointment ? { leadMinutes: values.leadMinutes } : { ...values, customBenefitEnabled: customBenefit })
  }
  return <Form form={form} layout="vertical" initialValues={initial} onFinish={submit} disabled={saving} className="sms-reminder-form">
    <div className={appointment ? 'sms-reminder-content' : 'sms-reminder-content sms-birthday-content'}>
      <div className="sms-reminder-time-row">
        <span className="sms-reminder-label">发送时间</span>
        <div className="sms-reminder-time-control">
          <div className="sms-reminder-offset"><span>提前</span>
            <Form.Item name={appointment ? 'leadMinutes' : 'advanceDays'} rules={[
              { required: true, message: appointment ? '请输入分钟数' : '请输入天数' },
              { type: 'integer', min: appointment ? 1 : 0, max: appointment ? 4320 : 30, message: appointment ? '请输入 1–4320 之间的整数' : '请输入 0–30 之间的整数' },
            ]}>
              <InputNumber aria-label={appointment ? '提前提醒（分钟）' : '提前天数'} min={appointment ? 1 : 0} max={appointment ? 4320 : 30} precision={0} controls={false} />
            </Form.Item>
            <span>{appointment ? '分钟发送' : '天发送'}</span>
          </div>
          {!appointment && <span className="sms-reminder-time-tip">设置为0表示当天发送</span>}
        </div>
      </div>
      {!appointment && <div className="sms-custom-benefit">
        <div className="sms-benefit-toggle-row">
          <span className="sms-reminder-label">自定义到店福利</span>
          <span className="sms-benefit-default">{customBenefit ? '开启后使用下方自定义内容' : '默认为：到店可享受生日权益'}</span>
          <Switch aria-label="自定义到店福利" checked={customBenefit} onChange={setCustomBenefit} disabled={saving} />
        </div>
        {customBenefit && <div className="sms-benefit-fields">
          <Form.Item name="visitNote" label="到店时间说明" rules={[{ required: true, whitespace: true, message: '请输入到店时间说明' }, { max: 100 }]}>
            <Input placeholder="例如：生日当月" maxLength={100} />
          </Form.Item>
          <Form.Item name="benefitNote" label="生日权益" rules={[{ required: true, whitespace: true, message: '请输入生日权益' }, { max: 100 }]}>
            <Input placeholder="例如：专属护理体验" maxLength={100} />
          </Form.Item>
        </div>}
      </div>}
    </div>
    <div className="sms-dialog-actions sms-reminder-actions"><Button onClick={onClose} disabled={saving}>取消</Button><Button htmlType="submit" type="primary" loading={saving}>确定</Button></div>
  </Form>
}

export function SmsSettingsPanel({ tenantId, writable }: { tenantId?: number; writable: boolean }) {
  const query = useSmsQuery<SmsSettings>('/sms/settings', tenantId)
  const { message } = App.useApp()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState('')
  const [selection, setSelection] = useState<{ template: SmsTemplate; enable: boolean }>()
  async function save(template: SmsTemplate, enabled: boolean, config?: ReminderConfig) {
    if (busy) return
    setBusy(template.code); setError('')
    try {
      const saved = await smsRequest<SmsTemplate>(`/sms/settings/${template.code}`, tenantId, { method: 'PUT', body: JSON.stringify({ enabled, config, version: template.version }) })
      query.update(previous => ({ groups: previous.groups.map(group => ({ ...group, templates: group.templates.map(item => item.code === saved.code ? saved : item) })) }))
      setSelection(undefined)
      void message.success('短信设置已保存（通道未接入，暂不发送）')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(undefined) }
  }
  function toggle(template: SmsTemplate, enabled: boolean) {
    if (enabled && template.configKind !== 'NONE' && !template.config) { setError(''); setSelection({ template, enable: true }); return }
    void save(template, enabled, template.config)
  }
  function reload() { setSelection(undefined); setError(''); query.reload() }
  return <div className="sms-settings">
    <QueryError error={query.error} onRetry={query.reload} />
    {query.loading && <div className="sms-state"><Spin aria-label="加载短信设置" /></div>}
    {!writable && <Alert showIcon type="info" title="当前为只读模式，无法更改短信设置。" />}
    {error && !selection && <Alert type="error" showIcon title="保存失败" description={error} action={<Button disabled={!!busy} onClick={reload}>重新加载</Button>} />}
    {query.data?.groups.map(group => <section className="sms-settings-card" key={group.key} aria-labelledby={`sms-group-${group.key}`}>
      <h2 id={`sms-group-${group.key}`}>{group.title}</h2>
      <div>{group.templates.map(template => <div className="sms-template-row" key={template.code}>
        <span className="sms-template-label">{template.name}</span>
        <div className="sms-template-copy">{template.content}</div>
        <div className="sms-template-controls">
          {template.configKind !== 'NONE' && <div className="sms-template-rule"><Button type="link" size="small" disabled={!writable || !!busy} aria-label={`设置${template.name}`} onClick={() => { setError(''); setSelection({ template, enable: template.enabled }) }}>设置</Button><span>{configSummary(template)}</span></div>}
          <Switch aria-label={template.name} checked={template.enabled} loading={busy === template.code} disabled={!writable || (!!busy && busy !== template.code)} onChange={value => toggle(template, value)} />
        </div>
      </div>)}</div>
    </section>)}
    <Modal open={!!selection} centered title={selection?.template.configKind === 'BIRTHDAY' ? '生日短信提醒设置' : '预约提醒设置'} width={selection?.template.configKind === 'BIRTHDAY' ? 900 : 520} footer={null} onCancel={() => { if (!busy) { setSelection(undefined); setError('') } }} closable={!busy} keyboard={!busy} destroyOnHidden className="sms-dialog sms-reminder-dialog">
      {selection && <>
        {error && <Alert type="error" showIcon title="保存失败" description={error} action={<Button disabled={!!busy} onClick={reload}>重新加载</Button>} />}
        <ReminderForm key={`${selection.template.code}:${selection.template.version}`} template={selection.template} saving={!!busy} onSave={config => void save(selection.template, selection.enable, config)} onClose={() => { setSelection(undefined); setError('') }} />
      </>}
    </Modal>
  </div>
}
