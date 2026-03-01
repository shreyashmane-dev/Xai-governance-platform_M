import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAppState } from '../../context/AppStateContext'
import SearchBar from './SearchBar'

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function Topbar({ status, onMenuClick }) {
  const { user, logout } = useAuth()
  const { state, actions } = useAppState()
  const [theme, setTheme] = useState(localStorage.getItem('xai_theme') || 'dark')
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('xai_theme', theme)
  }, [theme])

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'GU'

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <button
          className="btn-ghost"
          style={{ padding: '0.4rem', display: 'none' }}
          id="mobile-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation"
          ref={(el) => {
            if (!el) return
            const mq = window.matchMedia('(max-width: 1023px)')
            el.style.display = mq.matches ? 'flex' : 'none'
            const fn = (event) => {
              el.style.display = event.matches ? 'flex' : 'none'
            }
            mq.addEventListener('change', fn)
          }}
        >
          <MenuIcon />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ color: 'var(--violet-light)' }}>*</span>
          <span className="hidden sm:block">AI Governance Workspace</span>
        </div>
      </div>

      <div
        className="topbar-search"
        style={{ flex: 1, maxWidth: 320, display: 'none' }}
        ref={(el) => {
          if (!el) return
          const mq = window.matchMedia('(min-width: 640px)')
          el.style.display = mq.matches ? 'block' : 'none'
          mq.addEventListener('change', (event) => {
            el.style.display = event.matches ? 'block' : 'none'
          })
        }}
      >
        <SearchBar value={state.searchQuery || ''} onChange={(next) => actions.patch({ searchQuery: next })} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <div
          className="topbar-chip"
          style={{ display: 'none' }}
          ref={(el) => {
            if (!el) return
            const mq = window.matchMedia('(min-width: 768px)')
            el.style.display = mq.matches ? 'flex' : 'none'
            mq.addEventListener('change', (event) => {
              el.style.display = event.matches ? 'flex' : 'none'
            })
          }}
        >
          <span className={`dot ${status?.ok ? 'dot-green' : 'dot-red'}`} />
          {status?.ok ? 'Healthy' : 'Degraded'}
        </div>

        <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <button className="theme-toggle" style={{ position: 'relative' }} aria-label="Notifications">
          <BellIcon />
          {state.notifications?.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                background: 'var(--violet)',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 700,
                borderRadius: '999px',
                padding: '1px 4px',
                boxShadow: 'var(--glow-violet)',
              }}
            >
              {state.notifications.length}
            </span>
          )}
        </button>

        <div style={{ position: 'relative' }}>
          <button className="topbar-avatar" onClick={() => setShowUserMenu((v) => !v)} aria-label="User menu">
            {initials}
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '200px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-elevated)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{user?.displayName || 'User'}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.15rem', fontSize: '0.75rem' }}>{user?.email || 'guest@example.com'}</div>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false)
                  logout()
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--rose)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'var(--rose-dim)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'none'
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
