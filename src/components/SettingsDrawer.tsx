import { useEffect } from 'react'
import { App, Button, Descriptions, Drawer, Form, Input, Space, Typography } from 'antd'
import { useAuth } from '@/context/AuthContext'
import { usePreferences } from '@/context/PreferencesContext'

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [form] = Form.useForm<{ storeName: string }>()
  const { storeName, setStoreName } = usePreferences()
  const { session } = useAuth()
  const { message } = App.useApp()
  useEffect(() => {
    if (open) form.setFieldsValue({ storeName })
  }, [open, form, storeName])

  function save(values: { storeName: string }) {
    setStoreName(values.storeName)
    void message.success('显示设置已保存')
    onClose()
  }

  return (
    <Drawer
      title="设置"
      open={open}
      onClose={onClose}
      size={400}
      className="settings-drawer"
      footer={<Space className="drawer-actions">
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" onClick={() => form.submit()}>保存设置</Button>
      </Space>}
    >
      <Typography.Title level={5}>显示设置</Typography.Title>
      <Form form={form} layout="vertical" onFinish={save} requiredMark={false}>
        <Form.Item
          label="门店显示名称"
          name="storeName"
          extra="仅调整当前浏览器中的名称显示。"
          rules={[{ required: true, whitespace: true, message: '请输入门店名称' }]}
        >
          <Input maxLength={30} showCount autoComplete="organization" />
        </Form.Item>
      </Form>
      <div className="settings-account">
        <Typography.Title level={5}>登录信息</Typography.Title>
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'username', label: '账号', children: session?.userInfo.username },
            { key: 'id', label: '用户编号', children: session?.userInfo.id },
          ]}
        />
      </div>
    </Drawer>
  )
}
