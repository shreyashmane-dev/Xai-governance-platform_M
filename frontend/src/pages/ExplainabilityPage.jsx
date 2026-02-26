import { useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Loader, EmptyState } from '../components/feedback/States'
import { analyticsService } from '../services'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function ExplainabilityPage() {
  const { state, actions } = useAppState()
  const [loading, setLoading] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)
  const [rowIndex, setRowIndex] = useState(0)
  const [localExplanation, setLocalExplanation] = useState(null)

  const globalImportance = useMemo(() => state.shapValues?.global_importance || [], [state.shapValues])
  const shapWarning = state.shapValues?.warning
  const sampleSize = state.shapValues?.sample_size ?? 0
  const explanationConfidence = Math.min(100, Math.max(18, 20 + sampleSize * 0.25))
  const topDrivers = useMemo(() => globalImportance.slice(0, 4), [globalImportance])

  async function runShap() {
    if (!state.activeModel || !state.dataset) return
    setLoading(true)
    try {
      const res = await analyticsService.shap(state.activeModel.id, state.dataset.id)
      actions.patch({ shapValues: res.data.data })
      actions.addNotification({ type: 'success', title: 'SHAP completed', message: `Sample size ${res.data.data.sample_size}` })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'SHAP failed', message: getApiErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  async function runLocalExplanation() {
    if (!state.activeModel || !state.dataset) return
    setLocalLoading(true)
    try {
      const safeIndex = Number.isFinite(rowIndex) ? Math.max(0, Math.floor(rowIndex)) : 0
      const res = await analyticsService.shapLocal(state.activeModel.id, state.dataset.id, safeIndex)
      setLocalExplanation(res.data.data)
      actions.addNotification({ type: 'success', title: 'Local explanation ready', message: `Row ${safeIndex}` })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Local explanation failed', message: getApiErrorMessage(err) })
      setLocalExplanation(null)
    } finally {
      setLocalLoading(false)
    }
  }

  if (!state.activeModel || !state.dataset) {
    return <EmptyState title="Model or dataset missing" description="Use Models page to upload and select both assets." />
  }

  return (
    <div data-tour="explainability" className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">SHAP Explainability Engine</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Global and local feature impact generated from the selected model and dataset.
          </p>
        </div>
        <button className="btn-primary" disabled={loading} onClick={runShap}>
          {loading ? 'Computing...' : 'Run SHAP'}
        </button>
      </div>

      {!state.shapValues ? (
        <EmptyState title="No SHAP results" description="Run SHAP analysis to visualize feature impact." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <div className="card space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold">Global Feature Importance</h4>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Ranked impact scores derived from {sampleSize} rows. Top features contribute most to model decisions.
                </p>
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Sample size {sampleSize || 'n/a'}
              </span>
            </div>

            {globalImportance.length ? (
              <div className="h-[340px]">
                <ResponsiveContainer>
                  <BarChart data={globalImportance.slice(0, 15)} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="feature" type="category" width={170} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[8, 8, 8, 8]} fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                No global importance scores yet. Try re-running SHAP with a dataset that matches the model feature schema.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>Explanation confidence</span>
                  <span>{explanationConfidence.toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${explanationConfidence}%`, background: 'var(--primary)' }} />
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Confidence grows with feature coverage and sample size.
                </p>
              </div>

              <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold">Top drivers</h5>
                  <span className="text-[11px] uppercase tracking-wider text-primary-600">{state.shapValues.method || 'unknown'}</span>
                </div>
                <ul className="space-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {topDrivers.length ? (
                    topDrivers.map((driver) => (
                      <li key={driver.feature} className="flex items-center justify-between">
                        <span>{driver.feature}</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {driver.value.toFixed(3)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs">No drivers to display yet.</li>
                  )}
                </ul>
              </div>
            </div>

            {shapWarning && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-medium text-rose-700">{shapWarning}</div>}
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Local Prediction Explanation</h4>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Explain a single row to understand feature-level push and pull.
                </p>
              </div>
              <span className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {state.shapValues.method || 'unknown'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={0}
                value={rowIndex}
                onChange={(event) => setRowIndex(Number(event.target.value || 0))}
                className="w-28"
              />
              <button className="btn-secondary" onClick={runLocalExplanation} disabled={localLoading}>
                {localLoading ? 'Computing...' : 'Run Local Explanation'}
              </button>
            </div>

            {!localExplanation ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Pick a row index and run local explanation to inspect per-feature contributions.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                  Row: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{localExplanation.row_index}</span> | Prediction:{' '}
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{JSON.stringify(localExplanation.prediction)}</span>
                  {localExplanation.probabilities && (
                    <span className="ml-2 text-xs">Probabilities: {JSON.stringify(localExplanation.probabilities)}</span>
                  )}
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer>
                    <BarChart data={(localExplanation.contributions || []).slice(0, 12)} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="feature" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="contribution" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {loading && <Loader text="Calculating SHAP values..." />}
          </div>
        </div>
      )}
    </div>
  )
}
