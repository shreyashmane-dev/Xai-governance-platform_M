import { useEffect, useMemo, useState } from 'react'
import { Loader, ErrorState, EmptyState } from '../components/feedback/States'
import { analyticsService, datasetService, modelService } from '../services'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function ModelsPage() {
  const { state, actions } = useAppState()
  const [datasets, setDatasets] = useState([])
  const [preview, setPreview] = useState([])
  const [datasetMeta, setDatasetMeta] = useState(null)
  const [datasetSchema, setDatasetSchema] = useState([])
  const [targetColumn, setTargetColumn] = useState('target')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [owner, setOwner] = useState('')
  const [department, setDepartment] = useState('')
  const [intendedUse, setIntendedUse] = useState('')
  const [riskCategory, setRiskCategory] = useState('medium')
  const [compatibility, setCompatibility] = useState(null)

  async function runAutoScan(modelId, datasetId) {
    if (!modelId || !datasetId) return
    try {
      const res = await analyticsService.metrics(modelId, datasetId)
      actions.patch({ metrics: res?.data?.data || null })
      actions.addNotification({
        type: 'success',
        title: 'Backend scan complete',
        message: 'Python backend scanned uploaded model+dataset and returned metrics.',
      })
    } catch (err) {
      actions.addNotification({
        type: 'error',
        title: 'Backend scan failed',
        message: getApiErrorMessage(err),
      })
    }
  }

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [modelsRes, datasetsRes] = await Promise.all([
        modelService.list(),
        datasetService.list(),
      ])
      const models = modelsRes.data.data || []
      const rows = datasetsRes.data.data || []
      actions.patch({
        models,
        activeModel: state.activeModel || models[0] || null,
        dataset: state.dataset || rows[0] || null,
      })
      setDatasets(rows)
    } catch (event) {
      setError(getApiErrorMessage(event))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    async function loadPreview() {
      if (!state.dataset?.id) {
        setPreview([])
        setDatasetMeta(null)
        setDatasetSchema([])
        return
      }
      try {
        const previewRes = await datasetService.preview(state.dataset.id, 10)
        setPreview(previewRes.data.data.preview || [])
        setDatasetMeta(previewRes.data.data || null)
        const schemaRes = await datasetService.schema(state.dataset.id)
        setDatasetSchema(schemaRes.data.data.columns || [])
      } catch {
        setPreview([])
        setDatasetMeta(null)
        setDatasetSchema([])
      }
    }
    loadPreview()
  }, [state.dataset?.id])

  useEffect(() => {
    async function loadCompatibility() {
      if (!state.activeModel?.id || !state.dataset?.id) {
        setCompatibility(null)
        return
      }
      try {
        const res = await modelService.compatibility(state.activeModel.id, state.dataset.id)
        setCompatibility(res?.data?.data || null)
      } catch {
        setCompatibility(null)
      }
    }
    loadCompatibility()
  }, [state.activeModel?.id, state.dataset?.id])

  async function uploadModel(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const form = new FormData()
    const resolvedName = file.name.replace(/\.pkl$/i, '')
    form.append('name', resolvedName)
    form.append('modelName', resolvedName)
    form.append('description', intendedUse || '')
    form.append('version', '')
    form.append('target_column', targetColumn || 'target')
    form.append('model_owner', owner)
    form.append('department', department)
    form.append('intended_use', intendedUse)
    form.append('risk_category', riskCategory)
    form.append('file', file)
    try {
      setUploadProgress(5)
      const uploadRes = await modelService.upload(form, (progressEvent) => {
        if (!progressEvent.total) return
        setUploadProgress(Math.min(99, Math.round((progressEvent.loaded * 100) / progressEvent.total)))
      })
      setUploadProgress(100)
      const newModelId = uploadRes?.data?.data?.id
      actions.addNotification({ type: 'success', title: 'Model uploaded', message: file.name })
      if (newModelId) {
        try {
          const summaryRes = await modelService.resultSummary(newModelId)
          const summary = summaryRes?.data?.data || {}
          if (summary.accuracy != null) {
            actions.patch({
              metrics: {
                accuracy: summary.accuracy,
                precision: summary.precision,
                recall: summary.recall,
                f1: summary.f1Score,
              },
            })
          }
        } catch {
          // Optional summary fetch; ignore if no metrics exist yet.
        }
      }
      await refresh()
      await runAutoScan(newModelId, state.dataset?.id)
      setTimeout(() => setUploadProgress(0), 800)
    } catch (err) {
      setUploadProgress(0)
      actions.addNotification({ type: 'error', title: 'Model upload failed', message: getApiErrorMessage(err) })
    } finally {
      event.target.value = ''
    }
  }

  async function uploadDataset(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('name', file.name.replace('.csv', ''))
    form.append('version', `v${Date.now()}`)
    form.append('file', file)
    try {
      const res = await datasetService.upload(form)
      const newDatasetId = res?.data?.data?.id
      setPreview(res?.data?.data?.preview || [])
      setDatasetMeta(null)
      actions.addNotification({ type: 'success', title: 'Dataset uploaded', message: file.name })
      await refresh()
      await runAutoScan(state.activeModel?.id, newDatasetId)
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Dataset upload failed', message: getApiErrorMessage(err) })
    } finally {
      event.target.value = ''
    }
  }

  const searchTerm = (state.searchQuery || '').trim().toLowerCase()
  const filteredModels = useMemo(() => {
    if (!searchTerm) return state.models
    return state.models.filter((model) => {
      const name = (model.name || '').toLowerCase()
      const dep = (model.metadata?.department || '').toLowerCase()
      const ownerName = (model.metadata?.model_owner || '').toLowerCase()
      return name.includes(searchTerm) || dep.includes(searchTerm) || ownerName.includes(searchTerm)
    })
  }, [searchTerm, state.models])

  function handleModelSelect(id) {
    const selected = state.models.find((model) => model.id === id) || null
    actions.patch({ activeModel: selected })
  }

  async function runMetrics(targetModel = state.activeModel) {
    if (!targetModel || !state.dataset) return
    setRunning(true)
    try {
      const res = await analyticsService.metrics(targetModel.id, state.dataset.id)
      actions.patch({ activeModel: targetModel, metrics: res.data.data })
      actions.addNotification({ type: 'success', title: 'Metrics computed', message: `Model: ${targetModel.name}` })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Metrics failed', message: getApiErrorMessage(err) })
    } finally {
      setRunning(false)
    }
  }

  async function deleteModel(targetModel = state.activeModel) {
    if (!targetModel) return
    const ok = window.confirm(`Delete model "${targetModel.name}" and all linked analytics?`)
    if (!ok) return
    try {
      await modelService.remove(targetModel.id)
      actions.addNotification({ type: 'success', title: 'Model deleted', message: targetModel.name })
      await refresh()
      actions.patch({ metrics: null, shapValues: null, governanceReport: null, trustScore: null })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Model delete failed', message: getApiErrorMessage(err) })
    }
  }

  async function deleteDataset() {
    if (!state.dataset) return
    const ok = window.confirm(`Delete dataset "${state.dataset.name}" and all linked analytics?`)
    if (!ok) return
    try {
      await datasetService.remove(state.dataset.id)
      actions.addNotification({ type: 'success', title: 'Dataset deleted', message: state.dataset.name })
      await refresh()
      actions.patch({ metrics: null, shapValues: null, governanceReport: null, driftReport: null, trustScore: null })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Dataset delete failed', message: getApiErrorMessage(err) })
    }
  }

  if (loading) return <Loader text="Loading models and datasets..." />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <div data-tour="upload-model" className="card space-y-3">
          <h3 className="text-lg font-semibold">Model Upload Module</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Upload sklearn-compatible `.pkl` models with versioned metadata.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Storage Mode: Local server storage only.</p>

          <div className="grid gap-2 md:grid-cols-2">
            <input className="w-full" placeholder="Model Owner" value={owner} onChange={(event) => setOwner(event.target.value)} />
            <input className="w-full" placeholder="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
            <input className="w-full md:col-span-2" placeholder="Intended Use" value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)} />
            <select className="w-full" value={riskCategory} onChange={(event) => setRiskCategory(event.target.value)}>
              <option value="low">Risk Category: Low</option>
              <option value="medium">Risk Category: Medium</option>
              <option value="high">Risk Category: High</option>
            </select>
          </div>

          <input
            className="w-full"
            placeholder="Target column (default: target)"
            value={targetColumn}
            onChange={(event) => setTargetColumn(event.target.value)}
          />
          <label className="btn-primary inline-block cursor-pointer">
            Upload Model
            <input type="file" accept=".pkl" className="hidden" onChange={uploadModel} />
          </label>

          {uploadProgress > 0 && (
            <div>
              <div className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>Upload Progress {uploadProgress}%</div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%`, background: 'var(--primary)' }} />
              </div>
            </div>
          )}

          {!filteredModels.length && <EmptyState title="No models match" description="Clear your search to view the full registry." />}
          {filteredModels.length > 0 && (
            <div className="space-y-2">
              <select className="w-full" value={state.activeModel?.id || ''} onChange={(event) => handleModelSelect(event.target.value)}>
                {filteredModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.model_type})
                  </option>
                ))}
              </select>
              <button className="btn-secondary w-full" onClick={() => deleteModel()}>
                Delete Selected Model
              </button>
            </div>
          )}
        </div>

        <div data-tour="upload-dataset" className="card space-y-3">
          <h3 className="text-lg font-semibold">Dataset Upload Module</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Upload CSV, validate schema, and preview top rows.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Storage Mode: Local server storage only.</p>

          <label className="btn-primary inline-block cursor-pointer">
            Upload Dataset
            <input type="file" accept=".csv" className="hidden" onChange={uploadDataset} />
          </label>

          {!datasets.length ? (
            <EmptyState title="No datasets uploaded" description="Upload a dataset to run metrics and drift checks." />
          ) : (
            <div className="space-y-2">
              <select
                className="w-full"
                value={state.dataset?.id || ''}
                onChange={(event) => actions.patch({ dataset: datasets.find((dataset) => dataset.id === event.target.value) || null })}
              >
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name} ({dataset.row_count} rows)
                  </option>
                ))}
              </select>
              <button className="btn-secondary w-full" onClick={deleteDataset}>
                Delete Selected Dataset
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-auto">
        <h4 className="mb-2 font-semibold">Model Registry</h4>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
              <th>Model Name</th>
              <th>Version</th>
              <th>Status</th>
              <th>Risk Level</th>
              <th>Last Audit Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!filteredModels.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  No models uploaded yet. Use Model Upload Module above.
                </td>
              </tr>
            )}
            {filteredModels.map((model) => (
              <tr
                key={model.id}
                className={`border-b ${state.activeModel?.id === model.id ? 'bg-primary-50' : ''}`}
                style={{ borderColor: 'var(--border-muted)' }}
              >
                <td>{model.name}</td>
                <td>{model.version}</td>
                <td>
                  <span className={`status-badge ${(model.status || 'active') === 'active' ? 'status-ok' : 'status-warn'}`}>
                    {(model.status || 'active').toUpperCase()}
                  </span>
                </td>
                <td>{(model.metadata?.risk_category || 'medium').toUpperCase()}</td>
                <td>{model.created_at ? new Date(model.created_at).toLocaleDateString() : '--'}</td>
                <td className="space-x-2">
                  <button className="btn-secondary" onClick={() => actions.patch({ activeModel: model })}>
                    View
                  </button>
                  <button className="btn-secondary" onClick={() => deleteModel(model)}>
                    Delete
                  </button>
                  <button className="btn-secondary" onClick={() => runMetrics(model)} disabled={!state.dataset || running}>
                    Audit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold">Metrics Engine</h4>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Accuracy, Precision, Recall, F1, AUC, Confusion Matrix
          </p>
        </div>
        <button className="btn-primary" disabled={!state.activeModel || !state.dataset || running} onClick={() => runMetrics()}>
          {running ? 'Running...' : 'Run Metrics'}
        </button>
      </div>

      {compatibility && (
        <div className="card">
          <h4 className="mb-2 font-semibold">Model-Dataset Compatibility</h4>
          <div className="text-sm">
            Status:{' '}
            <span className={compatibility.compatible ? 'text-emerald-700' : 'text-rose-700'}>
              {compatibility.compatible ? 'Compatible' : 'Mismatch'}
            </span>{' '}
            | Strict Mode: {compatibility.strict_mode ? 'ON' : 'OFF'}
          </div>
          {!compatibility.compatible && (
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Missing Features: {(compatibility.missing_features || []).slice(0, 15).join(', ') || 'none'}
            </div>
          )}
        </div>
      )}

      {state.metrics && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card">
            <h4 className="mb-2 font-semibold">Metrics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Accuracy: {(state.metrics.accuracy * 100).toFixed(2)}%</div>
              <div>Precision: {(state.metrics.precision * 100).toFixed(2)}%</div>
              <div>Recall: {(state.metrics.recall * 100).toFixed(2)}%</div>
              <div>F1: {(state.metrics.f1 * 100).toFixed(2)}%</div>
              <div>AUC: {state.metrics.auc == null ? 'n/a' : Number(state.metrics.auc).toFixed(4)}</div>
            </div>
          </div>
          <div className="card overflow-auto">
            <h4 className="mb-2 font-semibold">Confusion Matrix</h4>
            <table className="min-w-full text-sm">
              <tbody>
                {state.metrics.confusion_matrix?.map((row, rowIndex) => (
                  <tr key={`cm-${rowIndex}`} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                    {row.map((value, colIndex) => (
                      <td key={`cm-${rowIndex}-${colIndex}`} className="px-3 py-2 text-center">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="card overflow-auto">
          <h4 className="mb-2 font-semibold">Dataset Preview (Top 10 Rows)</h4>
          {datasetMeta && (
            <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {datasetMeta.name} | Rows: {datasetMeta.row_count} | Columns: {datasetMeta.column_count}
              {datasetMeta.from_cache ? ' | Preview Source: cached (re-upload dataset for full file access)' : ''}
            </div>
          )}
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                {Object.keys(preview[0]).map((key) => (
                  <th className="px-2 py-1 text-left" key={key}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, index) => (
                <tr key={index} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  {Object.values(row).map((value, valueIndex) => (
                    <td key={valueIndex} className="px-2 py-1">
                      {String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datasetSchema.length > 0 && (
        <div className="card overflow-auto">
          <h4 className="mb-2 font-semibold">Dataset Schema</h4>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                <th className="px-2 py-1">Column</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Dtype</th>
                <th className="px-2 py-1">Missing</th>
                <th className="px-2 py-1">Missing Ratio</th>
                <th className="px-2 py-1">Unique</th>
              </tr>
            </thead>
            <tbody>
              {datasetSchema.map((column) => (
                <tr key={column.name} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <td className="px-2 py-1">{column.name}</td>
                  <td className="px-2 py-1">{column.type}</td>
                  <td className="px-2 py-1">{column.dtype}</td>
                  <td className="px-2 py-1">{column.missing_count}</td>
                  <td className="px-2 py-1">{(Number(column.missing_ratio || 0) * 100).toFixed(2)}%</td>
                  <td className="px-2 py-1">{column.unique_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
