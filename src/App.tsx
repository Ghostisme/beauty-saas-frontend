import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Spin, theme } from 'antd'
import type { CSSProperties } from 'react'
import { useAuth } from '@/context/AuthContext'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const HomePage = lazy(() => import('@/pages/HomePage'))
const UserManagementPage = lazy(() => import('@/pages/UserManagementPage'))
const PlatformTenantsPage = lazy(() => import('@/pages/PlatformTenantsPage'))
const OrdersPage = lazy(() => import('@/pages/OrdersPage'))
const AppLayout = lazy(() => import('@/components/AppLayout').then(module => ({ default: module.AppLayout })))

function RequireAuth() {
  const { session } = useAuth()
  return session ? <AppLayout><Outlet /></AppLayout> : <Navigate to="/login" replace />
}

export default function App() {
  const { session } = useAuth()
  const { token } = theme.useToken()
  const variables = {
    '--primary': token.colorPrimary,
    '--primary-bg': token.colorPrimaryBg,
    '--primary-border': token.colorPrimaryBorder,
    '--text': token.colorText,
    '--text-secondary': token.colorTextSecondary,
    '--text-tertiary': token.colorTextTertiary,
    '--border': token.colorBorderSecondary,
    '--surface': token.colorBgContainer,
    '--page-bg': token.colorBgLayout,
    '--radius': `${token.borderRadiusLG}px`,
  } as CSSProperties

  return (
    <div className="app-theme" style={variables}>
      <Suspense fallback={<div className="page-loading"><Spin size="large" aria-label="页面加载中" /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={session?.userInfo.platformAdmin ? <Navigate to="/platform/tenants" replace /> : <HomePage />} />
            <Route path="/platform/tenants" element={<PlatformTenantsPage />} />
            <Route path="/user-management" element={<UserManagementPage />} />
            <Route path="/orders" element={<OrdersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}
