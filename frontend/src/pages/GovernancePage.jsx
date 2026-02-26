import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { governanceService } from '../services'
import { EmptyState } from '../components/feedback/States'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function GovernancePage() {
  const { state, actions } = useAppState()
  const [loading, setLoading] = useState(false)
  const [sensitiveColumn, setSensitiveColumn] = useState('')

  async function run() {
    if (!state.activeModel || !state.dataset) return
    setLoading(true)
    try {
      const res = await governanceService.run(state.activeModel.id, state.dataset.id, sensitiveColumn)
      actions.patch({
        governanceReport: res.data.data,
        trustScore: res.data.data.trust_score,
      })
      actions.addNotification({ type: 'success', title: 'Governance completed', message: `Trust score: ${res.data.data.trust_score}` })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Governance failed', message: getApiErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  if (!state.activeModel || !state.dataset) return <EmptyState title="Missing assets" description="Upload model and dataset first." />

  const report = state.governanceReport
  const scoreData = useMemo(
    () =>
      report
        ? [
            { name: 'Trust', value: Number(report.trust_score || 0) },
            { name: 'Fairness', value: Number(report.fairness_score || 0) },
            { name: 'Quality', value: Number(report.quality_score || 0) },
          ]
        : [],
    [report]
  )

  return (
    <div data-tour="governance" className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Governance & Bias Panel</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Run fairness metrics, explainability checks, subgroup analysis, and compliance risk logic.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[220px]"
            placeholder="Sensitive column (optional)"
            value={sensitiveColumn}
            onChange={(event) => setSensitiveColumn(event.target.value)}
          />
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Running...' : 'Run Governance Scan'}
          </button>
        </div>
      </div>

      {!report ? (
        <EmptyState title="No governance report" description="Run analysis to calculate trust score and risk class." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card"><div style={{ color: 'var(--text-muted)' }}>Trust Score</div><div className="text-3xl font-bold">{report.trust_score}</div></div>
            <div className="card"><div style={{ color: 'var(--text-muted)' }}>Risk</div><div className="text-3xl font-bold uppercase">{report.risk_classification}</div></div>
            <div className="card"><div style={{ color: 'var(--text-muted)' }}>Fairness Score</div><div className="text-3xl font-bold">{report.fairness_score}</div></div>
            <div className="card"><div style={{ color: 'var(--text-muted)' }}>Quality Score</div><div className="text-3xl font-bold">{report.quality_score}</div></div>
          </div>

          <div className="card overflow-auto">
            <h4 className="mb-2 font-semibold">Subgroup Analysis</h4>
            {!report.subgroup_analysis?.length ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Provide a sensitive column to compute subgroup fairness.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                    <th className="text-left">Group</th>
                    <th className="text-left">Positive Rate</th>
                    <th className="text-left">TPR</th>
                  </tr>
                </thead>
                <tbody>
                  {report.subgroup_analysis.map((row) => (
                    <tr key={row.group} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                      <td>{row.group}</td>
                      <td>{(row.positive_prediction_rate * 100).toFixed(2)}%</td>
                      <td>{row.true_positive_rate == null ? 'n/a' : `${(row.true_positive_rate * 100).toFixed(2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="card h-[300px]">
              <h4 className="mb-2 font-semibold">Governance Scores</h4>
              <ResponsiveContainer>
                <BarChart data={scoreData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h4 className="font-semibold">Detailed Reasoning</h4>
              <div className="mt-3 space-y-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div><span className="font-semibold">Trust Formula:</span> {report.detailed_reasoning?.trust_formula || 'Not available'}</div>
                <div><span className="font-semibold">Quality:</span> {report.detailed_reasoning?.quality_component?.reason || 'N/A'}</div>
                <div><span className="font-semibold">Fairness:</span> {report.detailed_reasoning?.fairness_component?.reason || 'N/A'}</div>
                <div><span className="font-semibold">Drift:</span> {report.detailed_reasoning?.drift_component?.reason || 'N/A'}</div>
              </div>
              <h5 className="mt-4 font-semibold">Recommendations</h5>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: 'var(--text-muted)' }}>
                {(report.recommendations || []).map((recommendation, index) => (
                  <li key={index}>{recommendation}</li>
                ))}
              </ul>
              <button className="btn-primary mt-4 w-full" onClick={() => window.location.assign('/reports')}>
                Open Reports Center
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
