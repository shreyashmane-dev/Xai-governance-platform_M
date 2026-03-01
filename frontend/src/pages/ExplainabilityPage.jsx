import { useEffect, useState } from 'react'
import { EmptyState, Loader } from '../components/feedback/States'
import { analyticsService, datasetService, modelService, reportService } from '../services'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

function ImageBlock({ title, image, mime = 'image/png' }) {
  return (
    <div className="space-y-2">
      <h5 className="font-semibold">{title}</h5>
      {image ? (
        <img
          src={`data:${mime};base64,${image}`}
          alt={title}
          className="w-full rounded border"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      ) : (
        <EmptyState title="Plot unavailable" description="Run SHAP analysis to generate this plot." />
      )}
    </div>
  )
}

export default function ExplainabilityPage() {
  const { state, actions } = useAppState()
  const [models, setModels] = useState([])
  const [datasets, setDatasets] = useState([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [rowIndex, setRowIndex] = useState(0)
  const [selectorLoading, setSelectorLoading] = useState(true)
  const [selectorError, setSelectorError] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSelectors() {
      setSelectorLoading(true)
      setSelectorError('')
      try {
        const [modelsRes, datasetsRes] = await Promise.all([modelService.list(), datasetService.list()])
        const modelRows = modelsRes?.data?.data || []
        const datasetRows = datasetsRes?.data?.data || []
        setModels(modelRows)
        setDatasets(datasetRows)

        const modelId = (state.activeModel || modelRows[0] || {}).id || ''
        const datasetId = (state.dataset || datasetRows[0] || {}).id || ''
        setSelectedModelId(modelId)
        setSelectedDatasetId(datasetId)
        actions.patch({
          activeModel: modelRows.find((m) => m.id === modelId) || state.activeModel || null,
          dataset: datasetRows.find((d) => d.id === datasetId) || state.dataset || null,
        })
      } catch (err) {
        setSelectorError(getApiErrorMessage(err))
      } finally {
        setSelectorLoading(false)
      }
    }
    loadSelectors()
  }, [])

  function syncSelection(modelId, datasetId) {
    const model = models.find((row) => row.id === modelId) || null
    const dataset = datasets.find((row) => row.id === datasetId) || null
    actions.patch({ activeModel: model, dataset })
  }

  async function runShap(targetRowIndex = 0) {
    if (!selectedModelId || !selectedDatasetId) return
    setLoading(true)
    setError('')
    try {
      const res = await analyticsService.shap(selectedModelId, selectedDatasetId, targetRowIndex)
      actions.patch({ shapValues: res?.data?.data || null })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function downloadReport() {
    if (!selectedModelId || !selectedDatasetId) return
    setDownloadLoading(true)
    setError('')
    try {
      const res = await reportService.download(selectedModelId, selectedDatasetId)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = `model_report_${selectedModelId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setDownloadLoading(false)
    }
  }

  if (selectorLoading) return <Loader text="Loading model and dataset selectors..." />
  if (selectorError) return <EmptyState title="Failed to load selectors" description={selectorError} />
  if (!models.length || !datasets.length) return <EmptyState title="Missing assets" description="Upload model and dataset first." />

  const shapData = state.shapValues || {}
  const globalData = shapData.global || {}
  const localData = shapData.local || {}
  const globalImageMime = globalData.image_mime || 'image/png'
  const localImageMime = localData.image_mime || 'image/png'

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">SHAP Analysis</h3>
          <button className="btn-secondary" disabled={downloadLoading} onClick={downloadReport}>
            {downloadLoading ? 'Downloading...' : 'Download Report'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Model Selector</label>
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
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Dataset Selector</label>
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

          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={loading} onClick={() => runShap(rowIndex)}>
              {loading ? 'Running...' : 'Run SHAP Analysis'}
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>

      {!state.shapValues ? (
        <EmptyState title="No SHAP results yet" description="Run SHAP analysis first." />
      ) : (
        <>
          <div className="card space-y-4">
            <h4 className="text-lg font-semibold">Global SHAP</h4>
            <div className="grid gap-4 xl:grid-cols-2">
              <ImageBlock title="Summary Plot" image={globalData.summary_plot} mime={globalImageMime} />
              <ImageBlock title="Feature Importance Bar Chart" image={globalData.bar_plot} mime={globalImageMime} />
              <ImageBlock title="Beeswarm Plot" image={globalData.beeswarm_plot} mime={globalImageMime} />
              <ImageBlock title="Dependence Plot" image={globalData.dependence_plot} mime={globalImageMime} />
            </div>
          </div>

          <div className="card space-y-4">
            <h4 className="text-lg font-semibold">Local SHAP</h4>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Row Selector</label>
                <input
                  type="number"
                  min={0}
                  value={rowIndex}
                  onChange={(event) => setRowIndex(Number(event.target.value || 0))}
                  className="w-36"
                />
              </div>
              <button className="btn-primary" disabled={loading} onClick={() => runShap(rowIndex)}>
                {loading ? 'Explaining...' : 'Explain Prediction'}
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ImageBlock title="Waterfall Plot" image={localData.waterfall_plot} mime={localImageMime} />
              <ImageBlock title="Force Plot" image={localData.force_plot} mime={localImageMime} />
            </div>

            <div className="overflow-auto rounded border p-3" style={{ borderColor: 'var(--border-muted)' }}>
              <h5 className="mb-2 font-semibold">Feature Contribution Table</h5>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                    <th className="text-left">Feature</th>
                    <th className="text-left">Value</th>
                    <th className="text-left">SHAP Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {(localData.contributions || []).map((row, idx) => (
                    <tr key={`${row.feature}-${idx}`} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                      <td>{row.feature}</td>
                      <td>{String(row.value)}</td>
                      <td>{Number(row.shap_impact || 0).toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div><b>Prediction:</b> {localData.prediction == null ? 'N/A' : String(localData.prediction)}</div>
              <div><b>Base Value:</b> {localData.base_value == null ? 'N/A' : String(localData.base_value)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
