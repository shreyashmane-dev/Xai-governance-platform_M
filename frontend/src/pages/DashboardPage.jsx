import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart, Legend
} from 'recharts'
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

const GRADIENT_COLORS = {
  Accuracy: ['#7c5cfc', '#a78bfa'],
  Precision: ['#22d3ee', '#67e8f9'],
  Recall: ['#10b981', '#34d399'],
  F1: ['#f59e0b', '#fcd34d'],
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '0.65rem 1rem',
      boxShadow: 'var(--shadow-elevated)', fontSize: '0.82rem',
      color: 'var(--text-primary)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ color: 'var(--violet-light)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '1rem', fontWeight: 700 }}>
        {payload[0].value}%
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, colorClass, sub }) {
  return (
    <div className={`kpi-card kpi-${colorClass}`} style={{ position: 'relative' }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value`}>{value}</div>
      {sub && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{sub}</div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { state, actions } = useAppState()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    async function run() {
      setLoading(true)
      try {
        const [modelsRes, datasetsRes, statusRes, analyticsSummaryRes, resourcesRes] = await Promise.all([
          modelService.list(),
          datasetService.list(),
          systemService.status(),
          analyticsService.summary(),
          systemService.resources()
        ])
        const models = modelsRes.data.data || []
        const datasets = datasetsRes.data.data || []
        const payload = analyticsSummaryRes.data.data || {}
        const resData = resourcesRes.data.data || {}

        actions.patch({
          models,
          activeModel: models[0] || null,
          dataset: datasets[0] || null,
          metrics: payload.metrics || null,
          shapValues: payload.shapSummary || null,
          governanceReport: payload.biasSummary
            ? { bias_findings: payload.biasSummary, trust_score: payload.trustScore }
            : null,
          driftReport: payload.driftSummary || null,
          trustScore: payload.trustScore ?? null,
          systemResources: resData
        })
        setSummary(statusRes.data.data)

        if (models[0]) {
          const historyRes = await analyticsService.history(models[0]._id || models[0].id)
          setHistory(historyRes.data.data || [])
        }
      } catch (e) {
        setError(getApiErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [actions])

  const chartData = useMemo(() => metricBars(state.metrics), [state.metrics])
  const totalModels = summary?.models ?? state.models.length
  const activeModels = useMemo(
    () => state.models.filter((m) => (m.status || 'active').toLowerCase() === 'active').length || totalModels,
    [state.models, totalModels]
  )
  const flaggedModels = useMemo(
    () => state.models.filter((m) => (m.status || '').toLowerCase() === 'flagged' || (m.metadata?.risk_category || '') === 'high').length,
    [state.models]
  )
  const complianceScore = Number(state.governanceReport?.fairness_score || 0).toFixed(1)
  const riskScore = Math.max(0, 100 - Number(state.trustScore || 0))

  if (loading) return <Loader text="Loading dashboard…" />
  if (error) return <ErrorState message={error} />
  if (!state.models.length || !state.dataset) {
    return <EmptyState title="No assets yet" description="Upload at least one model and one dataset to begin." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
          Governance Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
          Real-time AI model health, compliance, and risk overview
        </p>
      </div>

      {/* KPI grid */}
      <div data-tour="dashboard-kpis" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <KpiCard label="Total Models" value={totalModels} icon="◈" colorClass="violet" />
        <KpiCard label="Active Models" value={activeModels} icon="◎" colorClass="emerald" />
        <KpiCard label="Flagged" value={flaggedModels} icon="⚑" colorClass="rose" />
        <KpiCard label="Compliance" value={`${complianceScore}%`} icon="⊟" colorClass="cyan" />
        <div className="kpi-card kpi-amber" style={{ position: 'relative' }}>
          <div className="kpi-icon">⚠</div>
          <div className="kpi-label">Risk Score</div>
          <div className="kpi-value">{riskScore.toFixed(1)}%</div>
          <div style={{ marginTop: '0.6rem' }}>
            <div className="progress-track">
              <div
                className="progress-fill progress-amber"
                style={{ width: `${Math.min(100, riskScore)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chart + summary row */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0,2fr) minmax(200px,1fr)' }}>

        {/* Bar chart card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div className="section-title">Model Performance</div>
              <div className="section-subtitle">{state.activeModel?.name || 'Active model'}</div>
            </div>
            <span className="badge badge-violet">Live</span>
          </div>

          {!state.metrics ? (
            <EmptyState title="No metrics" description="Run model metrics from the Models page." />
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} barCategoryGap="30%">
                  <defs>
                    {chartData.map((d) => (
                      <linearGradient key={d.metric} id={`g-${d.metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GRADIENT_COLORS[d.metric]?.[0] || '#7c5cfc'} stopOpacity={1} />
                        <stop offset="100%" stopColor={GRADIENT_COLORS[d.metric]?.[1] || '#a78bfa'} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="metric"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.06)' }} />
                  <Bar
                    dataKey="value"
                    radius={[8, 8, 0, 0]}
                    fill="url(#g-Accuracy)"
                  // per-bar fill is handled by recharts Cell if needed
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Column: System Resources & Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Resource Monitor */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="section-title" style={{ fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💻</span> Local Resources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ResourceBar label="CPU" percent={state.systemResources?.cpu_percent || 0} color="var(--violet)" />
              <ResourceBar label="RAM" percent={state.systemResources?.memory?.percent || 0} color="var(--cyan)" />
              <ResourceBar label="Disk" percent={state.systemResources?.disk?.percent || 0} color="var(--emerald)" />
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="section-title">System Summary</div>

            {[
              { label: 'Datasets', value: summary?.datasets ?? 0, color: 'var(--cyan)' },
              { label: 'Drift Alerts', value: summary?.drift_alert_count ?? 0, color: 'var(--amber)' },
              { label: 'Trust Score', value: state.trustScore ?? '--', color: 'var(--violet-light)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.75rem', borderRadius: '10px',
                background: 'var(--bg-muted)', border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.95rem', color }}>{value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 'auto',
              padding: '0.7rem 0.75rem',
              borderRadius: '10px',
              background: summary?.ok ? 'var(--emerald-dim)' : 'var(--rose-dim)',
              border: `1px solid ${summary?.ok ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: summary?.ok ? 'var(--emerald)' : 'var(--rose)',
                boxShadow: summary?.ok ? '0 0 8px var(--emerald)' : '0 0 8px var(--rose)',
              }} />
              <span style={{
                fontSize: '0.8rem', fontWeight: 600,
                color: summary?.ok ? 'var(--emerald)' : 'var(--rose)',
              }}>
                {summary?.ok ? 'Local Backend Active' : 'Backend Degraded'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* History Trend Row */}
      <div className="card">
        <div className="section-title">Performance Evolution</div>
        <div className="section-subtitle">Metrics trend over multiple evaluations</div>
        <div style={{ width: '100%', height: 300, marginTop: '1rem' }}>
          <ResponsiveContainer>
            <LineChart data={history.map(h => ({
              name: new Date(h.created_at).toLocaleDateString(),
              accuracy: (h.metrics?.accuracy || 0) * 100,
              precision: (h.metrics?.precision || 0) * 100,
              recall: (h.metrics?.recall || 0) * 100,
              f1: (h.metrics?.f1 || 0) * 100
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="accuracy" stroke="#7c5cfc" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="precision" stroke="#22d3ee" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="recall" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="f1" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function ResourceBar({ label, percent, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{percent}%</span>
      </div>
      <div className="progress-track" style={{ height: '4px' }}>
        <div
          className="progress-fill"
          style={{ width: `${percent}%`, background: color, height: '100%' }}
        />
      </div>
    </div>
  )
}
