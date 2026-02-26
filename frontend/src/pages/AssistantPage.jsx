import { useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chatService } from '../services'
import { Loader, ErrorState } from '../components/feedback/States'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function AssistantPage() {
  const { state, actions } = useAppState()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const context = useMemo(
    () => ({
      metrics: state.metrics || {},
      shapSummary: state.shapValues || {},
      biasSummary: state.governanceReport?.bias_findings || {},
      driftSummary: state.driftReport || {},
      trustScore: state.trustScore,
    }),
    [state.metrics, state.shapValues, state.governanceReport, state.driftReport, state.trustScore]
  )

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
    const next = [...state.chatHistory, { role: 'user', content: message }]
    actions.patch({ chatHistory: next })
    setLoading(true)
    setError('')
    try {
      const payload = { session_id: 'default', message, context }
      const res = await chatService.send(payload)
      actions.patch({ chatHistory: [...next, { role: 'assistant', content: res.data.data.message }] })
      setMessage('')
    } catch (event) {
      const detail = getApiErrorMessage(event)
      setError(detail)
      actions.addNotification({ type: 'error', title: 'Assistant error', message: detail })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-tour="assistant" className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">AI Assistant</h3>
        <div className="h-[420px] space-y-2 overflow-auto rounded border p-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
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
            placeholder="Ask about trust score, SHAP, bias, or drift..."
            onKeyDown={(event) => {
              if (event.key === 'Enter') send()
            }}
          />
          <button className="btn-primary" onClick={send} disabled={loading}>
            Send
          </button>
        </div>
        {loading && <div className="mt-2"><Loader text="Assistant is thinking..." /></div>}
      </div>

      <div className="card">
        <h4 className="font-semibold">Context Panel</h4>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          These values are attached to each request for grounded answers.
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
        <pre className="mt-3 overflow-auto rounded p-3 text-xs" style={{ background: 'var(--bg-muted)' }}>
          {JSON.stringify(context, null, 2)}
        </pre>
      </div>
    </div>
  )
}
