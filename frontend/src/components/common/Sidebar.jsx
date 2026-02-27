import { NavLink } from 'react-router-dom'

const NAV_SECTIONS = [
  {
    label: 'Core',
    links: [
      { label: 'Dashboard', path: '/dashboard', icon: 'DB' },
      { label: 'In-Memory Eval', path: '/models', icon: 'EV' },
      { label: 'Explainability', path: '/explainability', icon: 'EX' },
    ],
  },
  {
    label: 'Governance',
    links: [
      { label: 'Governance', path: '/governance', icon: 'GV' },
      { label: 'Drift Monitor', path: '/drift', icon: 'DR' },
      { label: 'Audit Logs', path: '/audit-logs', icon: 'AL' },
      { label: 'Reports', path: '/reports', icon: 'RP' },
    ],
  },
  {
    label: 'Tools',
    links: [
      { label: 'AI Assistant', path: '/assistant', icon: 'AI' },
      { label: 'Functions', path: '/functions', icon: 'Fn' },
      { label: 'Models Legacy', path: '/models-legacy', icon: 'LG' },
      { label: 'Settings', path: '/settings', icon: 'ST' },
      { label: 'About', path: '/about', icon: 'AB' },
    ],
  },
]

function SidebarContent({ onRestartTour, status, onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">XO</div>
        <div>
          <div>XAI TrustOps</div>
          <div style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: '-2px', fontFamily: 'Inter, sans-serif' }}>
            AI Governance
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.links.map(({ label, path, icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={onNavigate}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <span style={{ fontSize: '0.85rem', width: '18px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                {label}
              </NavLink>
            ))}
          </div>
        ))}

        <div style={{ marginTop: '0.75rem', padding: '0 0 0.25rem' }}>
          <button id="btn-restart-tour" className="sidebar-link" style={{ width: '100%' }} onClick={onRestartTour}>
            <span style={{ fontSize: '0.85rem', width: '18px', textAlign: 'center', flexShrink: 0 }}>RT</span>
            Restart Tour
          </button>
        </div>
      </nav>

      <div className="sidebar-status-pill">
        <span>v1.0.0</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: status?.ok ? 'var(--emerald)' : 'var(--rose)',
              boxShadow: status?.ok ? '0 0 6px var(--emerald)' : '0 0 6px var(--rose)',
              flexShrink: 0,
            }}
          />
          <span>{status?.uptimeSeconds != null ? `${Math.floor(status.uptimeSeconds / 60)}m` : 'n/a'}</span>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ onRestartTour, status, mobileOpen = false, onClose }) {
  return (
    <>
      <aside
        data-tour="sidebar"
        className="sidebar-root"
        style={{ display: 'none' }}
        ref={(el) => {
          if (el) el.style.display = 'flex'
        }}
      >
        <SidebarContent onRestartTour={onRestartTour} status={status} />
      </aside>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          pointerEvents: mobileOpen ? 'auto' : 'none',
        }}
        className="lg:hidden"
      >
        <button
          aria-label="Close navigation"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-overlay)',
            opacity: mobileOpen ? 1 : 0,
            transition: 'opacity 0.2s ease',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={onClose}
        />
        <aside
          style={{
            position: 'relative',
            height: '100%',
            width: '240px',
            transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}
          className="sidebar-root"
        >
          <SidebarContent onRestartTour={onRestartTour} status={status} onNavigate={onClose} />
        </aside>
      </div>
    </>
  )
}
