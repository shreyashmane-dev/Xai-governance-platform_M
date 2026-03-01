import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { datasetService, governanceService, modelService } from '../services'
import { EmptyState, Loader } from '../components/feedback/States'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function GovernancePage() {
  const { state, actions } = useAppState()
  const [models, setModels] = useState([])
  const [datasets, setDatasets] = useState([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectorLoading, setSelectorLoading] = useState(true)
  const [selectorError, setSelectorError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sensitiveColumn, setSensitiveColumn] = useState('')
  const [runError, setRunError] = useState('')

  useEffect(() => {
    async function loadAssets() {
      setSelectorLoading(true)
      setSelectorError('')
      try {
        const [modelsRes, datasetsRes] = await Promise.all([modelService.list(), datasetService.list()])
        const modelRows = modelsRes?.data?.data || []
        const datasetRows = datasetsRes?.data?.data || []
        setModels(modelRows)
        setDatasets(datasetRows)

        const defaultModel = state.activeModel || modelRows[0] || null
        const defaultDataset = state.dataset || datasetRows[0] || null
        setSelectedModelId(defaultModel?.id || '')
        setSelectedDatasetId(defaultDataset?.id || '')
        actions.patch({ activeModel: defaultModel, dataset: defaultDataset })
      } catch (err) {
        setSelectorError(getApiErrorMessage(err))
      } finally {
        setSelectorLoading(false)
      }
    }
    loadAssets()
  }, [])

  function syncSelection(modelId, datasetId) {
    const model = models.find((row) => row.id === modelId) || null
    const dataset = datasets.find((row) => row.id === datasetId) || null
    actions.patch({ activeModel: model, dataset })
  }

  async function run() {
    if (!selectedModelId || !selectedDatasetId) return
    setLoading(true)
    setRunError('')
    try {
      const res = await governanceService.run(selectedModelId, selectedDatasetId, sensitiveColumn)
      actions.patch({
        governanceReport: res.data.data,
        trustScore: res.data.data.trust_score,
      })
      actions.addNotification({
        type: 'success',
        title: 'Governance completed',
        message: `Trust score: ${res?.data?.data?.trust_score}`,
      })
    } catch (err) {
      const message = getApiErrorMessage(err)
      setRunError(message)
      actions.addNotification({ type: 'error', title: 'Governance failed', message })
    } finally {
      setLoading(false)
    }
  }

  const activeModel = useMemo(
    () => models.find((row) => row.id === selectedModelId) || state.activeModel || null,
    [models, selectedModelId, state.activeModel]
  )
  const activeDataset = useMemo(
    () => datasets.find((row) => row.id === selectedDatasetId) || state.dataset || null,
    [datasets, selectedDatasetId, state.dataset]
  )
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

  if (selectorLoading) return <Loader text="Loading models and datasets..." />
  if (selectorError) return <EmptyState title="Selector load failed" description={selectorError} />
  if (!models.length || !datasets.length) {
    return <EmptyState title="Missing assets" description="Upload model and dataset first." />
  }

  return (
    <div data-tour="governance" className="space-y-4">
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">Governance & Bias Panel</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Select Model</label>
            <select
              value={selectedModelId}
              onChange={(event) => {
                const next = event.target.value
                setSelectedModelId(next)
                syncSelection(next, selectedDatasetId)
              }}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Select Dataset</label>
            <select
              value={selectedDatasetId}
              onChange={(event) => {
                const next = event.target.value
                setSelectedDatasetId(next)
                syncSelection(selectedModelId, next)
              }}
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Sensitive column (optional)</label>
            <input
              placeholder="e.g. gender, segment"
              value={sensitiveColumn}
              onChange={(event) => setSensitiveColumn(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Model: {activeModel?.name} | Dataset: {activeDataset?.name}
          </div>
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Running...' : 'Run Governance Scan'}
          </button>
        </div>
        {runError && <div className="text-sm text-rose-600">{runError}</div>}
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
                      <td>{(Number(row.positive_prediction_rate || 0) * 100).toFixed(2)}%</td>
                      <td>{row.true_positive_rate == null ? 'n/a' : `${(Number(row.true_positive_rate) * 100).toFixed(2)}%`}</td>
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
