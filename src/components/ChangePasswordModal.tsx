import { Alert, App, Form, Input, Modal } from 'antd'
import { useState } from 'react'
import { request } from '@/lib/request'
import { useAuth } from '@/context/AuthContext'
import { errorMessage, passwordRules } from '@/components/iam/shared'

interface PasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [form] = Form.useForm<PasswordValues>()
  const { message } = App.useApp()
  const { logout } = useAuth()
  const [saving, setSaving] = useState(false)

  function handleClose() {
    if (saving) return
    form.resetFields()
    onClose()
  }

  async function submit(values: PasswordValues) {
    setSaving(true)
    try {
      await request('/iam/password', { method: 'POST', body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }) })
      form.resetFields(); onClose(); logout()
      void message.success('密码已修改，请使用新密码重新登录')
    } catch (cause) { void message.error(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      okText="提交"
      cancelText="取消"
      centered
      confirmLoading={saving}
      okButtonProps={{ 'aria-label': '提交' }}
      cancelButtonProps={{ disabled: saving }}
    >
      <Alert
        className="change-password-notice"
        type="info"
        showIcon
        title="修改成功后，当前账号的所有旧登录将失效，需要重新登录。"
      />
      <Form name="self-password-change" form={form} layout="vertical" requiredMark={false} onFinish={submit} disabled={saving}>
        <Form.Item label="当前密码" name="currentPassword" rules={[{ required: true, message: '请输入当前密码' }]}>
          <Input.Password autoComplete="current-password" maxLength={128} />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={passwordRules}
        >
          <Input.Password autoComplete="new-password" maxLength={72} />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value: string) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                return Promise.reject(new Error('两次输入的新密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" maxLength={72} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
