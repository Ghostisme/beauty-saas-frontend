import { Button, Drawer } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { InventoryAlertsContent } from './InventoryAlertsContent'

export function InventoryAlertsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      aria-label="库存预警"
      placement="right"
      size="80%"
      title={
        <div className="inventory-drawer-title">
          <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回首页" onClick={onClose} />
          <span>库存预警</span>
        </div>
      }
      classNames={{ root: 'inventory-alerts-drawer', body: 'inventory-drawer-body' }}
    >
      <InventoryAlertsContent />
    </Drawer>
  )
}
