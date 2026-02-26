import { useEffect, useMemo, useState } from 'react'
import { systemService } from '../services'
import { EmptyState, Loader } from '../components/feedback/States'
import { getApiErrorMessage } from '../utils/apiError'

function formatTimestamp(value) {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString()
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')

  async function load() {
    setError('')
    try {
      const res = await systemService.auditLog(300, action, entityType)
      setRows(res.data.data || [])
    } catch (err) {
      setError(getApiErrorMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredRows = useMemo(() => {
    const actionFilter = action.trim().toLowerCase()
    const entityFilter = entityType.trim().toLowerCase()
    return rows.filter((row) => {
      const actionValue = String(row.action || '').toLowerCase()
      const resourceValue = String(row.resource_type || '').toLowerCase()
      const actionMatch = !actionFilter || actionValue.includes(actionFilter)
      const entityMatch = !entityFilter || resourceValue.includes(entityFilter)
      return actionMatch && entityMatch
    })
  }, [rows, action, entityType])

  if (loading) return <Loader text="Loading audit logs..." />

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Audit Logs</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Immutable activity stream for model, dataset, governance, drift, report, and assistant operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Filter action (e.g. compute_metrics)"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          />
          <input
            placeholder="Filter entity type"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
          />
          <button className="btn-primary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="card text-sm text-rose-700">{error}</div>}

      {!filteredRows.length ? (
        <EmptyState title="No audit logs" description="Run model, dataset, drift, governance, report, and assistant actions to populate entries." />
      ) : (
        <div className="card overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Resource ID</th>
                <th>User</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <td>{formatTimestamp(row.created_at)}</td>
                  <td>{row.action || '--'}</td>
                  <td>{row.resource_type || '--'}</td>
                  <td className="font-mono">{row.resource_id || '--'}</td>
                  <td>{row.user_id || '--'}</td>
                  <td className="font-mono">{JSON.stringify(row.metadata || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
