import { Alert, App, Form, Input, Modal } from 'antd'

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

  function handleClose() {
    form.resetFields()
    onClose()
  }

  function submit(values: PasswordValues) {
    void values
    void message.info('修改密码接口尚未接入，当前仅完成表单校验')
    handleClose()
  }

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      okText="提交"
      cancelText="取消"
      destroyOnHidden
    >
      <Alert
        className="change-password-notice"
        type="info"
        showIcon
        title="后端密码修改接口尚未接入，提交后不会改变登录密码。"
      />
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item label="当前密码" name="currentPassword" rules={[{ required: true, message: '请输入当前密码' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '新密码至少 6 位' }]}
        >
          <Input.Password autoComplete="new-password" />
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
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
