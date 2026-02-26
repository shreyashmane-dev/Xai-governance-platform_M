import { NavLink } from 'react-router-dom'

const links = [
  ['Dashboard', '/dashboard'],
  ['Models', '/models'],
  ['Explainability', '/explainability'],
  ['Governance', '/governance'],
  ['Drift Monitor', '/drift'],
  ['Reports', '/reports'],
  ['Audit Logs', '/audit-logs'],
  ['AI Assistant', '/assistant'],
  ['Settings', '/settings'],
  ['About Us', '/about'],
]

function SidebarContent({ onRestartTour, status, onNavigate }) {
  return (
    <>
      <div className="mb-6 text-xl font-bold text-primary-600">XAI TrustOps</div>
      <nav className="space-y-1">
        {links.map(([label, path]) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `block rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-primary-600 text-white shadow-sm' : ''}`
            }
            style={({ isActive }) => (!isActive ? { color: 'var(--text-muted)' } : undefined)}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <button id="btn-restart-tour" className="btn-secondary mt-4 w-full" onClick={onRestartTour}>
        Restart Tour
      </button>
      <div
        className="mt-8 rounded-xl border p-3 text-xs"
        style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
      >
        <div>v1.0.0</div>
        <div>Uptime: {status?.uptimeSeconds != null ? `${Math.floor(status.uptimeSeconds / 60)}m` : 'n/a'}</div>
      </div>
    </>
  )
}

export default function Sidebar({ onRestartTour, status, mobileOpen = false, onClose }) {
  return (
    <>
      <aside data-tour="sidebar" className="hidden w-72 border-r p-5 lg:block" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface)' }}>
        <SidebarContent onRestartTour={onRestartTour} status={status} />
      </aside>

      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          aria-label="Close navigation"
          className={`absolute inset-0 bg-slate-950/45 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <aside
          className={`relative h-full w-72 border-r p-5 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface)' }}
        >
          <SidebarContent onRestartTour={onRestartTour} status={status} onNavigate={onClose} />
        </aside>
      </div>
    </>
  )
}
