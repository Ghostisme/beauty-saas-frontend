import { useNavigate } from 'react-router-dom'
import { Button, Result } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { InventoryAlertsContent } from '@/components/home-reminders/InventoryAlertsContent'
import '@/styles/inventory.css'

export default function InventoryAlertsPage() {
  const navigate = useNavigate()
  const { session, can } = useAuth()
  if (!session?.userInfo.platformAdmin && !can('home:read')) return <Result status="403" title="暂无库存预警权限" subTitle="请联系企业管理员分配首页或库存查看权限。" />
  return <section className="inventory-page" aria-labelledby="inventory-title"><div className="inventory-heading"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回首页" onClick={() => navigate('/')} /><h1 id="inventory-title">库存预警</h1></div><div className="inventory-panel"><InventoryAlertsContent /></div></section>
}
