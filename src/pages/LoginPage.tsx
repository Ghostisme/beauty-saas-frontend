import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, App, Button, Form, Input, Segmented, Tabs, Typography } from 'antd'
import { ChromeOutlined } from '@ant-design/icons'
import { APP_NAME, APP_SUBTITLE } from '@/config/app'
import { AppFooter } from '@/components/AppFooter'
import { useAuth } from '@/context/AuthContext'
import type { LoginCredentials } from '@/types/auth'

export default function LoginPage() {
  const { session, login } = useAuth()
  const { modal } = App.useApp()
  const [activeTab, setActiveTab] = useState('password')
  const [loginType, setLoginType] = useState<'PLATFORM' | 'TENANT'>('PLATFORM')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to={session.userInfo.platformAdmin ? '/platform/tenants' : '/'} replace />

  async function submit(values: LoginCredentials) {
    setError(null)
    setLoading(true)
    try {
      await login({ loginType, ...(loginType === 'TENANT' ? { tenantCode: values.tenantCode?.trim().toLowerCase() } : {}), username: values.username.trim(), password: values.password })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading">
          <h1 id="login-title">{APP_NAME}</h1>
          <p>{APP_SUBTITLE}</p>
        </div>
        <div className="login-form-content">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => { setActiveTab(key); setError(null) }}
            items={[
              { key: 'password', label: '密码登录' },
              { key: 'sms', label: '短信登录' },
            ]}
          />
          {activeTab === 'password' ? (
            <Form<LoginCredentials>
              key={loginType}
              name="password-login"
              onFinish={submit}
              requiredMark={false}
              size="large"
              onValuesChange={() => setError(null)}
            >
              <Segmented<'PLATFORM' | 'TENANT'> block aria-label="登录身份" value={loginType} options={[{ label: '平台登录', value: 'PLATFORM' }, { label: '企业登录', value: 'TENANT' }]} onChange={value => { setLoginType(value); setError(null) }} />
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 20 }}>{loginType === 'PLATFORM' ? '平台超级管理员登录，无需填写企业编码' : '使用平台分配的企业编码和本企业账号登录'}</Typography.Paragraph>
              {loginType === 'TENANT' && <Form.Item name="tenantCode" rules={[{ required: true, whitespace: true, message: '请输入企业编码' }, { pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]{2,39}$/, message: '请输入平台分配的企业编码' }]}>
                <Input prefix={<span className="input-prefix">企业</span>} placeholder="请输入企业编码" aria-label="企业编码" autoComplete="organization" autoCapitalize="none" maxLength={40} />
              </Form.Item>}
              <Form.Item name="username" rules={[{ required: true, whitespace: true, message: '请输入账号' }]}>
                <Input
                  prefix={<span className="input-prefix">账号</span>}
                  placeholder={loginType === 'PLATFORM' ? '请输入平台账号' : '请输入本企业账号'}
                  aria-label="账号"
                  autoComplete="username"
                  maxLength={100}
                  autoCapitalize="none"
                />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password
                  prefix={<span className="input-prefix">密码</span>}
                  placeholder="请输入密码"
                  aria-label="密码"
                  autoComplete="current-password"
                  maxLength={128}
                />
              </Form.Item>
              <div className="forgot-password">
                <Button
                  type="link"
                  size="small"
                  onClick={() => modal.info({
                    title: '找回密码',
                    content: loginType === 'PLATFORM' ? '请联系平台运维人员处理超级管理员账号。' : '请联系企业管理员核实账号并重置密码；企业管理员请联系平台。',
                    okText: '知道了',
                  })}
                >忘记密码</Button>
              </div>
              {error && <Alert className="login-error" type="error" title={error} showIcon role="alert" />}
              <Button type="primary" htmlType="submit" aria-label="登录" loading={loading} block className="login-submit">
                登录
              </Button>
            </Form>
          ) : (
            <div className="sms-panel" role="tabpanel" aria-label="短信登录">
              <Alert type="info" showIcon title="短信登录暂未开通" description="请使用账号密码登录。" />
              <Button block size="large" onClick={() => setActiveTab('password')}>使用密码登录</Button>
            </div>
          )}
          <div className="browser-tip">
            <ChromeOutlined aria-hidden />
            <span>推荐使用 Chrome 或 Edge 浏览器</span>
          </div>
        </div>
      </section>
      <AppFooter login />
    </main>
  )
}
