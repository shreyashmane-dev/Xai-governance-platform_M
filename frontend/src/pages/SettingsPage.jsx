import { useState } from 'react'
import { systemService } from '../services'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function SettingsPage() {
  const { actions } = useAppState()
  const [driftThreshold, setDriftThreshold] = useState(localStorage.getItem('driftThreshold') || '0.2')
  const [retentionDays, setRetentionDays] = useState(localStorage.getItem('retentionDays') || '180')
  const [loading, setLoading] = useState(false)

  async function testConnection() {
    setLoading(true)
    try {
      await systemService.status()
      actions.addNotification({ type: 'success', title: 'System connection healthy' })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'System connection failed', message: getApiErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  function save() {
    localStorage.setItem('driftThreshold', driftThreshold)
    localStorage.setItem('retentionDays', retentionDays)
    actions.addNotification({ type: 'success', title: 'Settings saved' })
  }

  async function resetAllData() {
    const ok = window.confirm('Delete ALL models, datasets, reports, analytics, drift, governance and assistant history for this tenant?')
    if (!ok) return
    try {
      await systemService.reset()
      actions.reset()
      actions.addNotification({ type: 'warning', title: 'Tenant data deleted', message: 'All platform records were removed.' })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Delete failed', message: getApiErrorMessage(err) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-lg font-semibold">Settings</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Manage alert thresholds, retention defaults, and runtime environment checks.
        </p>
      </div>

      <div className="card grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1" style={{ color: 'var(--text-muted)' }}>Default drift threshold (PSI)</div>
          <input className="w-full" value={driftThreshold} onChange={(event) => setDriftThreshold(event.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-1" style={{ color: 'var(--text-muted)' }}>Report retention (days)</div>
          <input className="w-full" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button className="btn-primary w-fit" onClick={save}>
            Save
          </button>
          <button className="btn-secondary w-fit" onClick={testConnection} disabled={loading}>
            {loading ? 'Testing...' : 'Test API'}
          </button>
        </div>
      </div>

      <div className="card border-rose-300 bg-rose-50">
        <h4 className="font-semibold text-rose-700">Danger Zone</h4>
        <p className="mt-1 text-sm text-rose-700">Delete all tenant records from database and uploaded files.</p>
        <button className="btn-secondary mt-3 border-rose-300 text-rose-700 hover:bg-rose-100" onClick={resetAllData}>
          Delete All Data
        </button>
      </div>
    </div>
  )
}
