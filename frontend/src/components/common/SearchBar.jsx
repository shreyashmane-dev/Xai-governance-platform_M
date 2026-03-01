import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchService } from '../../services'

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function Section({ title, items, renderItem, emptyText }) {
  return (
    <div style={{ padding: '0.4rem 0.6rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        {title}
      </div>
      {!items.length ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.15rem 0' }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  )
}

export default function SearchBar({ value, onChange }) {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState({ models: [], datasets: [], audit_logs: [], reports: [] })

  const query = (value || '').trim()
  const hasMinimumChars = query.length >= 2
  const hasAnyResult = useMemo(
    () =>
      (results.models?.length || 0) +
      (results.datasets?.length || 0) +
      (results.audit_logs?.length || 0) +
      (results.reports?.length || 0) > 0,
    [results]
  )

  useEffect(() => {
    function onClickOutside(event) {
      if (!rootRef.current || rootRef.current.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!hasMinimumChars) {
      setLoading(false)
      setError('')
      setResults({ models: [], datasets: [], audit_logs: [], reports: [] })
      return
    }

    const timeout = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await searchService.search(query)
        setResults(res?.data?.data || { models: [], datasets: [], audit_logs: [], reports: [] })
      } catch {
        setError('Search failed')
        setResults({ models: [], datasets: [], audit_logs: [], reports: [] })
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [query, hasMinimumChars])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
        <SearchIcon />
      </span>
      <input
        style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.82rem' }}
        placeholder="Search models, datasets, reports..."
        value={value || ''}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 'min(700px, 92vw)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-elevated)', zIndex: 120, maxHeight: '460px', overflow: 'auto' }}>
          {!hasMinimumChars ? (
            <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Type at least 2 letters.</div>
          ) : loading ? (
            <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Searching...</div>
          ) : error ? (
            <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: 'var(--rose)' }}>{error}</div>
          ) : !hasAnyResult ? (
            <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No results found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
              <Section
                title="Models"
                items={results.models || []}
                emptyText="No model matches"
                renderItem={(item) => (
                  <button
                    key={`model-${item.id}`}
                    className="btn-ghost"
                    style={{ justifyContent: 'flex-start', width: '100%', padding: '0.38rem 0.45rem' }}
                    onClick={() => {
                      setOpen(false)
                      navigate('/models-legacy')
                    }}
                  >
                    {item.name}
                  </button>
                )}
              />
              <Section
                title="Datasets"
                items={results.datasets || []}
                emptyText="No dataset matches"
                renderItem={(item) => (
                  <button
                    key={`dataset-${item.id}`}
                    className="btn-ghost"
                    style={{ justifyContent: 'flex-start', width: '100%', padding: '0.38rem 0.45rem' }}
                    onClick={() => {
                      setOpen(false)
                      navigate('/models-legacy')
                    }}
                  >
                    {item.name}
                  </button>
                )}
              />
              <Section
                title="Reports"
                items={results.reports || []}
                emptyText="No report matches"
                renderItem={(item) => (
                  <button
                    key={`report-${item.id}`}
                    className="btn-ghost"
                    style={{ justifyContent: 'flex-start', width: '100%', padding: '0.38rem 0.45rem' }}
                    onClick={() => {
                      setOpen(false)
                      navigate('/reports')
                    }}
                  >
                    {item.model_id} / {item.dataset_id}
                  </button>
                )}
              />
              <Section
                title="Audit Logs"
                items={results.audit_logs || []}
                emptyText="No audit matches"
                renderItem={(item, idx) => (
                  <button
                    key={`audit-${idx}-${item.timestamp}`}
                    className="btn-ghost"
                    style={{ justifyContent: 'flex-start', width: '100%', padding: '0.38rem 0.45rem' }}
                    onClick={() => {
                      setOpen(false)
                      navigate('/audit-logs')
                    }}
                  >
                    {item.action || 'Action'} {item.timestamp ? `(${item.timestamp})` : ''}
                  </button>
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
