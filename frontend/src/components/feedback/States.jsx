export function Loader({ text = 'Loading…' }) {
  return (
    <div className="state-container">
      <div className="spinner" />
      <span style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{text}</span>
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong.' }) {
  return (
    <div className="state-container">
      <div className="state-icon">⚠</div>
      <div style={{ color: 'var(--rose)', fontWeight: 600, fontSize: '0.9rem' }}>Error</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '340px' }}>{message}</div>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', description = '' }) {
  return (
    <div className="state-container">
      <div className="state-icon" style={{ opacity: 0.5 }}>◈</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{title}</div>
      {description && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '320px', lineHeight: 1.55 }}>
          {description}
        </div>
      )}
    </div>
  )
}
