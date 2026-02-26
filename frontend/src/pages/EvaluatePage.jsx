import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { EmptyState, Loader } from '../components/feedback/States'
import { evaluateService } from '../services'
import { getApiErrorMessage } from '../utils/apiError'

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return '0.00%'
  return `${(Number(value) * 100).toFixed(2)}%`
}

export default function EvaluatePage() {
  const [datasetFile, setDatasetFile] = useState(null)
  const [modelFile, setModelFile] = useState(null)
  const [targetColumn, setTargetColumn] = useState('target')
  const [sensitiveColumn, setSensitiveColumn] = useState('')
  const [modelName, setModelName] = useState('')
  const [datasetName, setDatasetName] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const reportRef = useRef(null)

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await evaluateService.history(20)
        setHistory(response?.data?.data || [])
      } catch {
        setHistory([])
      } finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [])

  const featureImportance = useMemo(
    () => result?.explainability?.featureImportance || [],
    [result]
  )
  const shapSummary = useMemo(
    () => result?.explainability?.shapSummary || [],
    [result]
  )

  async function handleEvaluate(event) {
    event.preventDefault()
    if (!datasetFile || !modelFile) {
      setError('Select both dataset (.csv) and model (.pkl/.pickle).')
      return
    }

    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('dataset', datasetFile)
      formData.append('model', modelFile)
      formData.append('targetColumn', targetColumn || 'target')
      formData.append('sensitiveColumn', sensitiveColumn || '')
      formData.append('modelName', modelName || modelFile.name.replace(/\.(pkl|pickle)$/i, ''))
      formData.append('datasetName', datasetName || datasetFile.name.replace(/\.csv$/i, ''))

      const response = await evaluateService.evaluate(formData)
      setResult(response.data)

      // Drop file objects from frontend memory immediately after successful processing.
      setDatasetFile(null)
      setModelFile(null)

      const historyResponse = await evaluateService.history(20)
      setHistory(historyResponse?.data?.data || [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function exportAsPdf() {
    if (!reportRef.current) return
    const reportHtml = reportRef.current.innerHTML
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Evaluation Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            h2, h3 { margin: 8px 0; }
          </style>
        </head>
        <body>${reportHtml}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">In-Memory Evaluation</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Files are processed in memory only, then discarded. Backend stores only computed results.
        </p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleEvaluate}>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>Dataset (.csv)</label>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setDatasetFile(event.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>Model (.pkl/.pickle)</label>
            <input
              type="file"
              accept=".pkl,.pickle"
              onChange={(event) => setModelFile(event.target.files?.[0] || null)}
            />
          </div>
          <input
            placeholder="Model Name (optional)"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
          />
          <input
            placeholder="Dataset Name (optional)"
            value={datasetName}
            onChange={(event) => setDatasetName(event.target.value)}
          />
          <input
            placeholder="Target column (default: target)"
            value={targetColumn}
            onChange={(event) => setTargetColumn(event.target.value)}
          />
          <input
            placeholder="Sensitive column (optional)"
            value={sensitiveColumn}
            onChange={(event) => setSensitiveColumn(event.target.value)}
          />
          <div className="md:col-span-2 flex gap-2">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Evaluating...' : 'Evaluate In Memory'}
            </button>
            <button className="btn-secondary" type="button" onClick={exportAsPdf} disabled={!result}>
              Export Report as PDF
            </button>
          </div>
        </form>
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>

      {loading && <Loader text="Running backend Python evaluation..." />}

      {result && (
        <div className="space-y-4" ref={reportRef}>
          <div className="card">
            <h3 className="text-lg font-semibold">Evaluation Summary</h3>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>Model: {result.modelName}</div>
              <div>Dataset: {result.datasetName}</div>
              <div>Target: {result.targetColumn}</div>
              <div>Evaluated: {result.evaluatedAt ? new Date(result.evaluatedAt).toLocaleString() : '--'}</div>
              <div>Rows: {result.rowCount}</div>
              <div>Columns: {result.columnCount}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="card">
              <h4 className="mb-2 font-semibold">Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Accuracy: {pct(result.metrics?.accuracy)}</div>
                <div>Precision: {pct(result.metrics?.precision)}</div>
                <div>Recall: {pct(result.metrics?.recall)}</div>
                <div>F1: {pct(result.metrics?.f1)}</div>
              </div>
            </div>
            <div className="card overflow-auto">
              <h4 className="mb-2 font-semibold">Confusion Matrix</h4>
              <table className="min-w-full text-sm">
                <tbody>
                  {(result.confusionMatrix || []).map((row, rowIndex) => (
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

          <div className="card">
            <h4 className="mb-2 font-semibold">Fairness</h4>
            {!result.fairness?.available ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {result.fairness?.reason || 'Fairness metrics unavailable.'}
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <div>Sensitive Column: {result.fairness.sensitiveColumn}</div>
                <div>Demographic Parity Diff: {Number(result.fairness.demographicParityDiff || 0).toFixed(4)}</div>
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="card" style={{ height: 360 }}>
              <h4 className="mb-2 font-semibold">Feature Importance</h4>
              {!featureImportance.length ? (
                <EmptyState title="No feature importance" description="Model does not expose importances/coefs." />
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={featureImportance.slice(0, 12)} margin={{ top: 12, right: 16, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" angle={-35} textAnchor="end" interval={0} height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card" style={{ height: 360 }}>
              <h4 className="mb-2 font-semibold">SHAP Summary</h4>
              {!shapSummary.length ? (
                <EmptyState title="No SHAP summary" description="SHAP unavailable or unsupported for current model." />
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={shapSummary.slice(0, 12)} margin={{ top: 12, right: 16, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" angle={-35} textAnchor="end" interval={0} height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card overflow-auto">
            <h4 className="mb-2 font-semibold">Dataset Preview (Top 10)</h4>
            {(result.preview || []).length === 0 ? (
              <EmptyState title="No preview rows" description="No rows available." />
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                    {Object.keys(result.preview[0]).map((key) => (
                      <th key={key} className="px-2 py-1 text-left">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, rowIndex) => (
                    <tr key={`preview-${rowIndex}`} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                      {Object.values(row).map((value, colIndex) => (
                        <td key={`preview-${rowIndex}-${colIndex}`} className="px-2 py-1">{String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="card overflow-auto">
        <h3 className="mb-2 text-lg font-semibold">Recent Evaluations</h3>
        {loadingHistory ? (
          <Loader text="Loading history..." />
        ) : !history.length ? (
          <EmptyState title="No evaluations yet" description="Run an in-memory evaluation to populate history." />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Model</th>
                <th className="px-2 py-1">Dataset</th>
                <th className="px-2 py-1">Accuracy</th>
                <th className="px-2 py-1">F1</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <td className="px-2 py-1">{row.evaluatedAt ? new Date(row.evaluatedAt).toLocaleString() : '--'}</td>
                  <td className="px-2 py-1">{row.modelName}</td>
                  <td className="px-2 py-1">{row.datasetName}</td>
                  <td className="px-2 py-1">{pct(row.metrics?.accuracy)}</td>
                  <td className="px-2 py-1">{pct(row.metrics?.f1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
