import { useContext, useEffect, useState } from 'react'
import { Alert, App, Button, Tag } from 'antd'
import { IamScopeContext, useIamRequest } from '@/context/IamScopeContext'
import { useAuth } from '@/context/AuthContext'
import { deleteRecord } from '@/api/iam'
import type { Department, ResourceKind } from '@/types/iam'
import type { IamOptions } from '@/types/iam'
import type { Rule } from 'antd/es/form'

export interface IamPanelProps { options: IamOptions; revision: number; onChanged: () => void }
export const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : '操作失败，请重试'
export const passwordRules: Rule[] = [
  { required: true, message: '请输入密码' },
  { min: 8, message: '密码至少 8 位' },
  { validator: (_, value: string) => !value || new TextEncoder().encode(value).length <= 72 ? Promise.resolve() : Promise.reject(new Error('密码的 UTF-8 编码不能超过 72 字节')) },
]

export function useIamQuery<T>(path: string, revision = 0, enabled = true) {
  const { session } = useAuth()
  const tenantId = useContext(IamScopeContext)
  const request = useIamRequest()
  const key = `${session?.token ?? ''}:${tenantId ?? ''}:${path}`
  const [result, setResult] = useState<{ key: string; data: T }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!enabled) { setLoading(false); setError(''); return }
    const controller = new AbortController()
    setLoading(true); setError('')
    void request<T>(path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setResult({ key, data: result })
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '加载失败')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, key, revision, retry, request, enabled])
  return { data: result?.key === key ? result.data : undefined, loading, error, reload: () => setRetry(value => value + 1) }
}
export function QueryError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return error ? <Alert type="error" showIcon title="加载失败" description={error} action={<Button aria-label="重试" onClick={onRetry}>重试</Button>} className="iam-query-error" /> : null
}
export function StatusTag({ status }: { status: number }) { return <Tag color={status === 1 ? 'success' : 'default'}>{status === 1 ? '正常' : '停用'}</Tag> }
export const statusOptions = [{ label: '正常', value: 1 }, { label: '停用', value: 0 }]
export function useDeleteRecord(onChanged: () => void) {
  const { modal, message } = App.useApp()
  const request = useIamRequest()
  return (kind: ResourceKind, id: number, name: string) => {
    modal.confirm({ title: `确认删除“${name}”？`, content: kind === 'users' ? '账号将停用，登录立即失效，角色和部门关联会一并解除；账号名仍保留不可重用。' : '有关联数据时会阻止删除，请先解除关联。', okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', async onOk() {
      try { await deleteRecord(kind, id, request); void message.success('已删除'); onChanged() }
      catch (cause) { void message.error(cause instanceof Error ? cause.message : '删除失败'); throw cause }
    } })
  }
}
export function departmentTree(items: Department[]): Department[] {
  const ids = new Set(items.map(item => item.id))
  const nodes = new Map(items.map(item => [item.id, { ...item, children: [] as Department[] }]))
  const roots: Department[] = []
  for (const item of items) {
    const node = nodes.get(item.id)!
    if (item.parentId && ids.has(item.parentId) && item.parentId !== item.id) nodes.get(item.parentId)!.children.push(node)
    else roots.push(node)
  }
  const prune = (node: Department): Department => ({ ...node, children: node.children?.length ? node.children.map(prune) : undefined })
  return roots.map(prune)
}
export function departmentOptions(items: Department[]) { return items.map(item => ({ value: item.id, label: `${item.name} (${item.code})`, disabled: item.status !== 1 })) }
export const paginationOptions = { showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (total: number) => `共 ${total} 条` }
