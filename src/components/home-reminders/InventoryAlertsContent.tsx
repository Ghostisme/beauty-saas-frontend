import { useState } from 'react'
import { Input, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import { GoalEmpty } from '@/components/GoalEmpty'
import '@/styles/inventory.css'

export interface InventoryRow {
  id: string
  warehouse: string
  category: string
  product: string
  unit: string
  quantity: number
  minimum: number
  warning: number
}

const columns: ColumnsType<InventoryRow> = [
  { title: '#', key: 'index', width: 70, render: (_, __, index) => index + 1 },
  { title: '所属仓库', dataIndex: 'warehouse', key: 'warehouse', width: 220 },
  { title: '产品类别', dataIndex: 'category', key: 'category', width: 190 },
  { title: '产品信息', dataIndex: 'product', key: 'product', width: 280 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 130 },
  { title: '库存数量', dataIndex: 'quantity', key: 'quantity', width: 180, sorter: (left, right) => left.quantity - right.quantity },
  { title: '库存下限', dataIndex: 'minimum', key: 'minimum', width: 180 },
  { title: '预警值', dataIndex: 'warning', key: 'warning', width: 180 },
  { title: '操作', key: 'actions', width: 130 },
]

const emptyRows: InventoryRow[] = []

export function InventoryAlertsContent() {
  const [warehouse, setWarehouse] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [rows] = useState<InventoryRow[]>(emptyRows)

  return (
    <div className="inventory-content">
      <div className="inventory-filters">
        <div className="inventory-filter-field"><span>仓库</span><Select aria-label="仓库" value={warehouse} onChange={setWarehouse} placeholder="请选择门店/仓库" allowClear options={[]} /></div>
        <div className="inventory-filter-field"><span>品类</span><Select aria-label="品类" value={category} onChange={setCategory} placeholder="请选择分类" allowClear options={[]} /></div>
        <Input.Search aria-label="搜索产品" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="输入产品名称/编号" allowClear enterButton={<SearchOutlined />} />
      </div>
      <div className="inventory-table-area">
        <Table<InventoryRow>
          aria-label="库存预警列表"
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1480 }}
          locale={{ emptyText: null }}
        />
        <div className="inventory-table-state" role="status" aria-label="库存预警列表暂无相关数据">
          <GoalEmpty />
          <span>暂无相关数据</span>
        </div>
        <div className="inventory-table-footer">
          <span>共搜索到{rows.length}条记录</span>
          <button type="button" disabled aria-label="上一页">‹</button>
          <span className="inventory-page-number">{rows.length ? 1 : 0}</span>
          <button type="button" disabled aria-label="下一页">›</button>
        </div>
      </div>
    </div>
  )
}
