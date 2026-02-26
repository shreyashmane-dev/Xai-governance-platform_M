import { useEffect, useMemo, useState } from 'react'
import { reportService } from '../services'
import { EmptyState, Loader } from '../components/feedback/States'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

function formatTimestamp(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString()
}

export default function ReportsPage() {
  const { state, actions } = useAppState()
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const res = await reportService.list()
      const rows = res.data.data || []
      setReports(rows)
      setSelectedReport((prev) => rows.find((row) => row.id === prev?.id) || rows[0] || null)
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Load reports failed', message: getApiErrorMessage(err) })
      setReports([])
      setSelectedReport(null)
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])

  async function generate() {
    if (!state.activeModel || !state.dataset) return
    try {
      await reportService.generate(state.activeModel.id, state.dataset.id)
      await refresh()
      actions.addNotification({ type: 'success', title: 'Report generated', message: 'Snapshot is now available in Reports Center.' })
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Report failed', message: getApiErrorMessage(err) })
    }
  }

  const searchTerm = (state.searchQuery || '').trim().toLowerCase()
  const visibleReports = useMemo(() => {
    if (!searchTerm) return reports
    return reports.filter((row) => {
      const id = String(row.id || '').toLowerCase()
      const checksum = String(row.checksum || '').toLowerCase()
      const modelId = String(row.model_id || '').toLowerCase()
      const datasetId = String(row.dataset_id || '').toLowerCase()
      return id.includes(searchTerm) || checksum.includes(searchTerm) || modelId.includes(searchTerm) || datasetId.includes(searchTerm)
    })
  }, [reports, searchTerm])

  if (loading) return <Loader text="Loading reports..." />

  return (
    <div data-tour="reports" className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Reports Center</h3>
        <button className="btn-primary" onClick={generate} disabled={!state.activeModel || !state.dataset}>
          Generate Report
        </button>
      </div>

      {!visibleReports.length ? (
        <EmptyState title="No reports yet" description="Run analysis and generate your governance report." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="card overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                  <th>ID</th>
                  <th>Trust Score</th>
                  <th>Generated At</th>
                  <th>Checksum</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((report) => (
                  <tr
                    key={report.id}
                    className={`cursor-pointer border-b ${selectedReport?.id === report.id ? 'bg-primary-50' : ''}`}
                    style={{ borderColor: 'var(--border-muted)' }}
                    onClick={() => setSelectedReport(report)}
                  >
                    <td>{report.id}</td>
                    <td>{report.trust_score ?? '--'}</td>
                    <td>{formatTimestamp(report.generated_at)}</td>
                    <td className="font-mono text-xs">{(report.checksum || '').slice(0, 14)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            {!selectedReport ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Select a report to inspect detailed snapshot.
              </p>
            ) : (
              <>
                <h4 className="font-semibold">Report Snapshot Detail</h4>
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div>Report ID: {selectedReport.id}</div>
                  <div>Trust Score: {selectedReport.trust_score ?? '--'}</div>
                  <div>Generated: {formatTimestamp(selectedReport.generated_at)}</div>
                  <div>Checksum: {(selectedReport.checksum || '').slice(0, 20)}...</div>
                </div>
                <pre className="mt-3 max-h-[380px] overflow-auto rounded p-3 text-xs" style={{ background: 'var(--bg-muted)' }}>
                  {JSON.stringify(selectedReport.snapshot || {}, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
