import type { CSSProperties } from 'react'
import { Alert, Button, Grid, Modal, Spin, Table, theme } from 'antd'
import type { TableColumnsType, TablePaginationConfig } from 'antd'
import { GoalEmpty } from '@/components/GoalEmpty'
import { usePreferences } from '@/context/PreferencesContext'

export interface ReminderDialogProps<T> {
  open: boolean
  onClose: () => void
  records?: T[]
  loading?: boolean
  error?: string
  onRetry?: () => void
  pagination?: TablePaginationConfig | false
}

interface ReminderListModalProps<T> extends ReminderDialogProps<T> {
  title: string
  columns: TableColumnsType<T>
  width?: number
  tableWidth: number
}

export function ReminderListModal<T extends { id: string | number }>({
  open, onClose, records = [], loading = false, error, onRetry, pagination = false,
  title, columns, width = 940, tableWidth,
}: ReminderListModalProps<T>) {
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const { displayMode } = usePreferences()
  const pad = screens.md && (displayMode ?? (screens.lg ? 'pc' : 'pad')) === 'pad'
  const empty = records.length === 0
  const showRows = !loading && !error && !empty
  const style = {
    maxWidth: 'calc(100vw - 32px)',
    '--reminder-border': token.colorBorderSecondary,
    '--reminder-muted': token.colorTextTertiary,
    '--reminder-header-bg': token.colorFillAlter,
  } as CSSProperties

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      centered
      destroyOnHidden
      footer={null}
      width={pad ? Math.min(width, 992) : width}
      style={style}
      closable={{ 'aria-label': '关闭' }}
      classNames={{
        root: 'home-reminder-modal',
        container: 'home-reminder-container',
        header: 'home-reminder-header',
        title: 'home-reminder-title',
        body: 'home-reminder-body',
        close: 'home-reminder-close',
      }}
    >
      <div role="region" aria-label={`${title}列表`} aria-busy={loading}>
        <Table<T>
          className={`home-reminder-table${showRows ? '' : ' home-reminder-table-empty'}`}
          columns={columns}
          dataSource={showRows ? records : []}
          rowKey="id"
          pagination={showRows ? pagination : false}
          scroll={{ x: tableWidth }}
          tableLayout="fixed"
          size="middle"
          locale={{ emptyText: null }}
        />
        {loading ? (
          <div className="home-reminder-state" role="status" aria-label={`${title}加载中`}>
            <Spin size="large" />
            <span>正在加载，请稍候</span>
          </div>
        ) : error ? (
          <div className="home-reminder-state">
            <Alert type="error" showIcon title="加载失败" description={error}
              action={onRetry ? <Button onClick={onRetry}>重试</Button> : undefined} />
          </div>
        ) : empty ? (
          // Keep the empty illustration centered in the visible dialog, outside the scrolling table.
          <div className="home-reminder-state" role="status" aria-label={`${title}暂无相关数据`}>
            <GoalEmpty />
            <span>暂无相关数据</span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
