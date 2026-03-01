import { useEffect, useState } from 'react'
import { systemService } from '../services'

function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (value <= 0) return '0 Bytes'
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(2)} ${units[index]}`
}

function ResourceCard({ title, value, subtitle, percent }) {
  const safe = Number(percent || 0)
  return (
    <div className="card space-y-3">
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{title}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="progress-track">
        <div className="progress-fill progress-violet" style={{ width: `${Math.max(0, Math.min(100, safe))}%` }} />
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>
    </div>
  )
}

export default function SystemPage() {
  const [loading, setLoading] = useState(true)
  const [resources, setResources] = useState(null)
  const [storage, setStorage] = useState([])
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  async function fetchData() {
    setLoading(true)
    setError('')
    setWarning('')

    const [resourcesRes, storageRes] = await Promise.allSettled([
      systemService.resources(),
      systemService.storage(),
    ])

    if (resourcesRes.status === 'fulfilled') {
      const data = resourcesRes.value?.data?.data || {}
      setResources(data)
      if (data.warning) setWarning(String(data.warning))
    } else {
      setResources(null)
      setError('Failed to load system resources')
    }

    if (storageRes.status === 'fulfilled') {
      setStorage(storageRes.value?.data?.data || [])
    } else {
      setStorage([])
      setError((prev) => prev || 'Failed to load storage data')
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleDelete(collection) {
    const ok = window.confirm(`Delete collection "${collection}"? This cannot be undone.`)
    if (!ok) return

    try {
      setLoading(true)
      const res = await systemService.deleteStorage(collection)
      if (!res?.data?.success) {
        throw new Error(res?.data?.detail || 'Delete failed')
      }
      await fetchData()
    } catch (err) {
      setError(String(err?.message || 'Failed to delete collection'))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">System Monitor</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Resource usage and local storage status.</p>
        </div>
        <button className="btn-primary" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="card text-sm text-rose-600">{error}</div>}
      {warning && <div className="card text-sm" style={{ color: 'var(--amber)' }}>{warning}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <ResourceCard
          title="CPU Usage"
          value={`${Number(resources?.cpu_percent || 0).toFixed(1)}%`}
          percent={resources?.cpu_percent || 0}
          subtitle="Real-time processor load"
        />
        <ResourceCard
          title="Memory"
          value={`${Number(resources?.memory?.percent || 0).toFixed(1)}%`}
          percent={resources?.memory?.percent || 0}
          subtitle={`${formatBytes(resources?.memory?.used)} / ${formatBytes(resources?.memory?.total)}`}
        />
        <ResourceCard
          title="Disk"
          value={`${Number(resources?.disk?.percent || 0).toFixed(1)}%`}
          percent={resources?.disk?.percent || 0}
          subtitle={`${formatBytes(resources?.disk?.used)} / ${formatBytes(resources?.disk?.total)}`}
        />
      </div>

      <div className="card overflow-auto">
        <h4 className="mb-2 font-semibold">Local Storage</h4>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
              <th className="text-left">Collection</th>
              <th className="text-left">Size</th>
              <th className="text-left">Last Modified</th>
              <th className="text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {!storage.length ? (
              <tr>
                <td colSpan={4} className="py-4" style={{ color: 'var(--text-muted)' }}>No local data files found.</td>
              </tr>
            ) : (
              storage.map((item) => (
                <tr key={item.collection} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <td>{item.collection}</td>
                  <td>{formatBytes(item.size_bytes)}</td>
                  <td>{item.last_modified ? new Date(item.last_modified).toLocaleString() : 'N/A'}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => handleDelete(item.collection)} disabled={loading}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
