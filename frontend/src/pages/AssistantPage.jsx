import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chatService, datasetService, modelService, reportService } from '../services'
import { Loader, ErrorState, EmptyState } from '../components/feedback/States'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function AssistantPage() {
  const { state, actions } = useAppState()
  const [models, setModels] = useState([])
  const [datasets, setDatasets] = useState([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSelectors() {
      setInitLoading(true)
      setError('')
      try {
        const [modelsRes, datasetsRes] = await Promise.all([modelService.list(), datasetService.list()])
        const modelRows = modelsRes?.data?.data || []
        const datasetRows = datasetsRes?.data?.data || []
        setModels(modelRows)
        setDatasets(datasetRows)

        const defaultModel = state.activeModel || modelRows[0] || null
        const defaultDataset = state.dataset || datasetRows[0] || null
        const modelId = defaultModel?.id || ''
        const datasetId = defaultDataset?.id || ''
        setSelectedModelId(modelId)
        setSelectedDatasetId(datasetId)
        actions.patch({ activeModel: defaultModel, dataset: defaultDataset })

        if (modelId && datasetId) {
          await loadHistory(modelId, datasetId)
        }
      } catch (err) {
        setError(getApiErrorMessage(err))
      } finally {
        setInitLoading(false)
      }
    }
    loadSelectors()
  }, [])

  async function loadHistory(modelId, datasetId) {
    if (!modelId || !datasetId) return
    setLoadingHistory(true)
    try {
      const res = await chatService.assistantHistory(modelId, datasetId, 30)
      const rows = res?.data?.data || []
      const history = []
      rows
        .slice()
        .reverse()
        .forEach((row) => {
          history.push({ role: 'user', content: row.request })
          history.push({ role: 'assistant', content: row.response })
        })
      actions.patch({ chatHistory: history })
    } catch {
      actions.patch({ chatHistory: [] })
    } finally {
      setLoadingHistory(false)
    }
  }

  function syncSelection(modelId, datasetId) {
    const model = models.find((row) => row.id === modelId) || null
    const dataset = datasets.find((row) => row.id === datasetId) || null
    actions.patch({ activeModel: model, dataset })
  }

  const trustChart = useMemo(
    () => [
      { name: 'Trust', value: Number(state.trustScore || 0) },
      { name: 'Risk', value: Number(100 - (state.trustScore || 0)) },
    ],
    [state.trustScore]
  )

  const shapTop = useMemo(() => (state.shapValues?.global_importance || []).slice(0, 8), [state.shapValues])

  async function send() {
    if (!message.trim()) return
    if (!selectedModelId || !selectedDatasetId) {
      setError('Select both model and dataset before chatting.')
      return
    }
    const next = [...state.chatHistory, { role: 'user', content: message }]
    actions.patch({ chatHistory: next })
    setLoading(true)
    setError('')
    try {
      const payload = {
        model_id: selectedModelId,
        dataset_id: selectedDatasetId,
        message: message.trim(),
      }
      const res = await chatService.assistantChat(payload)
      const reply = res?.data?.data?.message || ''
      actions.patch({ chatHistory: [...next, { role: 'assistant', content: reply }] })
      setMessage('')
    } catch (err) {
      const detail = getApiErrorMessage(err)
      setError(detail)
      actions.addNotification({ type: 'error', title: 'Assistant error', message: detail })
    } finally {
      setLoading(false)
    }
  }

  async function downloadFullReport() {
    if (!selectedModelId || !selectedDatasetId) return
    setDownloadLoading(true)
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
      const detail = getApiErrorMessage(err)
      setError(detail)
      actions.addNotification({ type: 'error', title: 'Report download failed', message: detail })
    } finally {
      setDownloadLoading(false)
    }
  }

  if (initLoading) return <Loader text="Loading assistant context..." />
  if (error && !models.length && !datasets.length) return <ErrorState message={error} />
  if (!models.length || !datasets.length) {
    return <EmptyState title="No models or datasets" description="Upload/select model and dataset first." />
  }

  return (
    <div data-tour="assistant" className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">AI Assistant</h3>
          <button className="btn-secondary" disabled={downloadLoading} onClick={downloadFullReport}>
            {downloadLoading ? 'Downloading...' : 'Download Full Report'}
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>Model</label>
            <select
              value={selectedModelId}
              onChange={async (event) => {
                const next = event.target.value
                setSelectedModelId(next)
                syncSelection(next, selectedDatasetId)
                await loadHistory(next, selectedDatasetId)
              }}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>Dataset</label>
            <select
              value={selectedDatasetId}
              onChange={async (event) => {
                const next = event.target.value
                setSelectedDatasetId(next)
                syncSelection(selectedModelId, next)
                await loadHistory(selectedModelId, next)
              }}
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 h-[420px] space-y-2 overflow-auto rounded border p-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
          {loadingHistory && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading chat history...</div>}
          {state.chatHistory.map((item, index) => (
            <div
              key={index}
              className="rounded p-2 text-sm"
              style={
                item.role === 'user'
                  ? { background: 'rgba(79, 70, 229, 0.16)', color: 'var(--text-primary)' }
                  : { background: 'var(--bg-surface)', color: 'var(--text-primary)' }
              }
            >
              <b>{item.role}:</b> {item.content}
            </div>
          ))}
        </div>

        {error && <div className="mt-2"><ErrorState message={error} /></div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[220px] flex-1"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask: best model, top feature, dataset balance, SHAP interpretation..."
            onKeyDown={(event) => {
              if (event.key === 'Enter') send()
            }}
          />
          <button className="btn-primary" onClick={send} disabled={loading}>
            Send
          </button>
        </div>
        {loading && <div className="mt-2"><Loader text="Assistant is analyzing..." /></div>}
      </div>

      <div className="card">
        <h4 className="font-semibold">Context Panel</h4>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Real-time metrics and SHAP context from selected model and dataset.
        </p>
        <div className="mt-3 h-[180px]">
          <h5 className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Trust Breakdown</h5>
          <ResponsiveContainer>
            <BarChart data={trustChart}>
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 h-[220px]">
          <h5 className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Top SHAP Drivers</h5>
          <ResponsiveContainer>
            <BarChart data={shapTop} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="feature" type="category" width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
