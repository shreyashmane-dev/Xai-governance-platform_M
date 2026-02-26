import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader, EmptyState, ErrorState } from '../components/feedback/States'

const DOC_MAP = {
  'installation': { label: 'Installation Guide', file: 'INSTALLATION_GUIDE.md' },
  'user-manual': { label: 'User Manual', file: 'USER_MANUAL.md' },
  'admin-manual': { label: 'Admin Manual', file: 'ADMIN_MANUAL.md' },
  'api': { label: 'API Documentation', file: 'API_DOCUMENTATION.md' },
  'architecture': { label: 'Architecture Overview', file: 'ARCHITECTURE_OVERVIEW.md' },
  'troubleshooting': { label: 'Troubleshooting', file: 'TROUBLESHOOTING.md' },
  'features': { label: 'Feature Breakdown', file: 'FEATURE_BREAKDOWN.md' },
  'deployment': { label: 'Deployment Guide', file: 'DEPLOYMENT_GUIDE.md' },
  'limitations': { label: 'Limitations', file: 'LIMITATIONS.md' },
  'future': { label: 'Future Scope', file: 'FUTURE_SCOPE.md' },
  'demo': { label: 'Demo Script', file: 'DEMO_SCRIPT.md' },
  'about': { label: 'About Us', file: 'ABOUT_US.md' },
}

export default function DocsPage() {
  const { docId } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [content, setContent] = useState('')

  const docEntry = useMemo(() => (docId ? DOC_MAP[docId] : null), [docId])

  useEffect(() => {
    if (!docEntry) {
      setContent('')
      setError('')
      return
    }
    setLoading(true)
    setError('')
    fetch(`/docs/${docEntry.file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Doc not found: ${docEntry.file}`)
        return res.text()
      })
      .then((text) => {
        setContent(text)
      })
      .catch((err) => {
        setError(err.message || 'Unable to load documentation.')
      })
      .finally(() => setLoading(false))
  }, [docEntry])

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Documentation Center</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Browse the platform docs. Each entry is rendered live from the `/docs` folder.
          </p>
        </div>
        <Link to="/about" className="btn-secondary">
          Back To About
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="card space-y-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Documents</div>
          <div className="space-y-1">
            {Object.entries(DOC_MAP).map(([key, entry]) => (
              <Link
                key={key}
                to={`/docs/${key}`}
                className={`block rounded-lg px-3 py-2 text-sm ${docId === key ? 'bg-primary-600 text-white' : ''}`}
                style={!docId || docId !== key ? { color: 'var(--text-muted)' } : undefined}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          {!docEntry && <EmptyState title="Choose a document" description="Select a document from the left to view full content." />}
          {loading && <Loader text="Loading documentation..." />}
          {error && <ErrorState message={error} />}
          {!loading && !error && docEntry && (
            <div className="doc-content">
              <div className="doc-title">{docEntry.label}</div>
              <pre className="doc-pre">{content}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
