import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { datasetService, driftService } from '../services'
import { useAppState } from '../context/AppStateContext'
import { EmptyState, Loader } from '../components/feedback/States'
import { getApiErrorMessage } from '../utils/apiError'

export default function DriftPage() {
  const { state, actions } = useAppState()
  const [datasets, setDatasets] = useState([])
  const [loadingDatasets, setLoadingDatasets] = useState(true)
  const [loading, setLoading] = useState(false)
  const [baselineId, setBaselineId] = useState('')
  const [currentId, setCurrentId] = useState('')
  const report = state.driftReport
  const topFeatureBars = useMemo(
    () => (report?.features || []).filter((f) => typeof f.psi === 'number').slice(0, 20),
    [report?.features]
  )

  useEffect(() => {
    datasetService
      .list()
      .then((res) => {
        const rows = res.data.data || []
        setDatasets(rows)
        setBaselineId(rows[0]?.id || '')
        setCurrentId(rows[1]?.id || rows[0]?.id || '')
      })
      .finally(() => setLoadingDatasets(false))
  }, [])

  async function run() {
    if (!baselineId || !currentId || baselineId === currentId) {
      actions.addNotification({
        type: 'warning',
        title: 'Choose two different datasets',
        message: 'Baseline and current dataset must be different.',
      })
      return
    }
    setLoading(true)
    try {
      const res = await driftService.run(baselineId, currentId)
      actions.patch({ driftReport: res.data.data })
      actions.addNotification({ type: 'warning', title: 'Drift analysis completed', message: `Alerts: ${res.data.data.alert_count}` })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Drift analysis failed', message: getApiErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  if (loadingDatasets) return <Loader text="Loading datasets..." />
  if (datasets.length < 2) return <EmptyState title="Need two datasets" description="Upload baseline and current datasets from Models page." />

  return (
    <div data-tour="drift" className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Drift Monitor</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Compare baseline/current distributions, surface PSI and divergence shifts, and monitor stability score.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="min-w-[180px]" value={baselineId} onChange={(event) => setBaselineId(event.target.value)}>
            {datasets.map((dataset) => (
              <option key={`baseline-${dataset.id}`} value={dataset.id}>
                Baseline: {dataset.name}
              </option>
            ))}
          </select>
          <select className="min-w-[180px]" value={currentId} onChange={(event) => setCurrentId(event.target.value)}>
            {datasets.map((dataset) => (
              <option key={`current-${dataset.id}`} value={dataset.id}>
                Current: {dataset.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Drift'}
          </button>
        </div>
      </div>

      {!report ? (
        <EmptyState title="No drift report" description="Run analysis to populate feature-level drift and advanced stability indicators." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="card h-[360px]">
            <h4 className="mb-2 font-semibold">Feature Drift (PSI)</h4>
            <ResponsiveContainer>
              <BarChart data={topFeatureBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="psi" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card space-y-3">
            <div>
              <h4 className="font-semibold">Alert Feed</h4>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Alert Count: {report.alert_count}
              </div>
            </div>
            {report.advanced && (
              <div className="rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
                <div>Severity: <span className="font-semibold uppercase">{report.advanced.severity}</span></div>
                <div>Shift Score: {report.advanced.distribution_shift_score}</div>
                <div>Stability Score: {report.advanced.stability_score}</div>
                <div>Avg PSI: {report.advanced.avg_psi}</div>
                <div>Avg JSD: {report.advanced.avg_js_divergence}</div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              {report.alerts.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No drift alerts above threshold.</p>}
              {report.alerts.map((alert) => (
                <div key={alert.feature} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                  {alert.feature}: {alert.psi != null ? `PSI ${alert.psi}` : `JSD ${alert.js_divergence}`}
                </div>
              ))}
            </div>
          </div>

          {report.advanced && (
            <div className="card h-[240px] xl:col-span-2">
              <h4 className="mb-2 font-semibold">Drift Stability Overview</h4>
              <ResponsiveContainer>
                <BarChart
                  data={[
                    { metric: 'Stability', value: report.advanced.stability_score },
                    { metric: 'Shift', value: report.advanced.distribution_shift_score },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
