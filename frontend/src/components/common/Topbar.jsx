import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Menu } from './icons'
import { useAuth } from '../../context/AuthContext'
import { useAppState } from '../../context/AppStateContext'

export default function Topbar({ status, onMenuClick }) {
  const { user, logout } = useAuth()
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(localStorage.getItem('xai_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('xai_theme', theme)
  }, [theme])

  function onSearchKeyDown(event) {
    if (event.key !== 'Enter') return
    navigate('/models')
  }

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur lg:px-6"
      style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-primary)' }}
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu />
        </button>
        <div className="hidden text-sm font-semibold text-primary-600 sm:block">AI Governance Workspace</div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <input
          className="hidden w-60 rounded-lg border px-3 py-2 text-sm md:block"
          style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
          placeholder="Search models, departments, reports"
          value={state.searchQuery || ''}
          onChange={(event) => actions.patch({ searchQuery: event.target.value })}
          onKeyDown={onSearchKeyDown}
        />

        <button className="btn-secondary px-3 py-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        <div className="hidden items-center gap-2 text-xs md:flex" style={{ color: 'var(--text-muted)' }}>
          <span className={`h-2 w-2 rounded-full ${status?.ok ? 'bg-success-500' : 'bg-rose-500'}`} />
          {status?.ok ? 'System Healthy' : 'System Degraded'}
        </div>

        <button className="relative rounded-lg p-2 transition hover:bg-slate-100" style={{ color: 'var(--text-primary)' }}>
          <Bell />
          {state.notifications.length > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary-600 px-1 text-[10px] text-white">
              {state.notifications.length}
            </span>
          )}
        </button>

        <div
          className="hidden rounded-full border px-3 py-1 text-sm lg:block"
          style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
        >
          {user?.email || 'Guest'}
        </div>
        <button onClick={logout} className="btn-secondary px-3 py-2">
          Logout
        </button>
      </div>
    </header>
  )
}
