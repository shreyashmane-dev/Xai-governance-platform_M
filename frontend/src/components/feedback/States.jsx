export function Loader({ text = 'Loading...' }) {
  return (
    <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
      {text}
    </div>
  )
}

export function EmptyState({ title, description }) {
  return (
    <div className="card text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </div>
  )
}

export function ErrorState({ message }) {
  return (
    <div className="card border-rose-300 bg-rose-50 text-rose-700">
      <div className="mb-1 text-sm font-semibold">Request failed</div>
      <div className="whitespace-pre-wrap text-sm">{message}</div>
    </div>
  )
}
