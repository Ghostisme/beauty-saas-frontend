import { APP_NAME, APP_SUBTITLE } from '@/config/app'

export function AppFooter({ login = false }: { login?: boolean }) {
  return (
    <footer className={login ? 'app-footer login-footer' : 'app-footer'}>
      <p>{APP_NAME} · {APP_SUBTITLE}</p>
      <p>Copyright © {new Date().getFullYear()} {APP_NAME}</p>
    </footer>
  )
}

