import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Loader, ErrorState, EmptyState } from '../components/feedback/States'
import { analyticsService, datasetService, modelService, systemService } from '../services'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

function metricBars(metrics) {
  if (!metrics) return []
  return [
    { metric: 'Accuracy', value: Number(((metrics.accuracy || 0) * 100).toFixed(2)) },
    { metric: 'Precision', value: Number(((metrics.precision || 0) * 100).toFixed(2)) },
    { metric: 'Recall', value: Number(((metrics.recall || 0) * 100).toFixed(2)) },
    { metric: 'F1', value: Number(((metrics.f1 || 0) * 100).toFixed(2)) },
  ]
}

export default function DashboardPage() {
  const { state, actions } = useAppState()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    async function run() {
      setLoading(true)
      try {
        const [modelsRes, datasetsRes, statusRes, analyticsSummaryRes] = await Promise.all([
          modelService.list(),
          datasetService.list(),
          systemService.status(),
          analyticsService.summary(),
        ])

        const models = modelsRes.data.data || []
        const datasets = datasetsRes.data.data || []
        const payload = analyticsSummaryRes.data.data || {}
        actions.patch({
          models,
          activeModel: models[0] || null,
          dataset: datasets[0] || null,
          metrics: payload.metrics || null,
          shapValues: payload.shapSummary || null,
          governanceReport: payload.biasSummary ? { bias_findings: payload.biasSummary, trust_score: payload.trustScore } : null,
          driftReport: payload.driftSummary || null,
          trustScore: payload.trustScore ?? null,
        })
        setSummary(statusRes.data.data)
      } catch (event) {
        setError(getApiErrorMessage(event))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [actions])

  const chartData = useMemo(() => metricBars(state.metrics), [state.metrics])
  const totalModels = summary?.models ?? state.models.length
  const activeModels = useMemo(
    () => state.models.filter((model) => (model.status || 'active').toLowerCase() === 'active').length || totalModels,
    [state.models, totalModels]
  )
  const flaggedModels = useMemo(
    () => state.models.filter((model) => (model.status || '').toLowerCase() === 'flagged' || (model.metadata?.risk_category || '') === 'high').length,
    [state.models]
  )
  const complianceScore = Number(state.governanceReport?.fairness_score || 0).toFixed(1)
  const riskScore = Math.max(0, 100 - Number(state.trustScore || 0))

  if (loading) return <Loader text="Loading dashboard..." />
  if (error) return <ErrorState message={error} />
  if (!state.models.length || !state.dataset) {
    return <EmptyState title="No assets yet" description="Upload at least one model and one dataset to begin analysis." />
  }

  return (
    <div className="space-y-6">
      <div data-tour="dashboard-kpis" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="card"><div style={{ color: 'var(--text-muted)' }}>Total AI Models</div><div className="text-2xl font-bold text-primary-700">{totalModels}</div></div>
        <div className="card"><div style={{ color: 'var(--text-muted)' }}>Active Models</div><div className="text-2xl font-bold text-emerald-600">{activeModels}</div></div>
        <div className="card"><div style={{ color: 'var(--text-muted)' }}>Flagged Models</div><div className="text-2xl font-bold text-rose-600">{flaggedModels}</div></div>
        <div className="card"><div style={{ color: 'var(--text-muted)' }}>Compliance Score</div><div className="text-2xl font-bold text-primary-700">{complianceScore}%</div></div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }}>Risk Score</div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{riskScore.toFixed(1)}%</div>
          <div className="mt-3 h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.min(100, riskScore)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Model Performance Snapshot</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{state.activeModel?.name || 'Active model not set'}</span>
          </div>
          {!state.metrics ? (
            <EmptyState title="No metrics available" description="Run model metrics from Models page." />
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold">System Summary</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Datasets</span><span className="font-semibold">{summary?.datasets ?? 0}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Drift Alerts</span><span className="font-semibold">{summary?.drift_alert_count ?? 0}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Trust Score</span><span className="font-semibold">{state.trustScore ?? '--'}</span></div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>System Health</span>
              <span className={`font-semibold ${summary?.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{summary?.ok ? 'Healthy' : 'Check'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
