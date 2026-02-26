import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, CartesianGrid } from 'recharts'
import { fraudService } from '../services/fraudService'
import { Loader, ErrorState, EmptyState } from '../components/feedback/States'
import { useAppState } from '../context/AppStateContext'
import { getApiErrorMessage } from '../utils/apiError'

export default function FraudPage() {
  const { actions } = useAppState()
  const [txs, setTxs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Simulation form state
  const [formData, setFormData] = useState({
    amount: 120.50,
    merchant_name: 'Amazon Web Services',
    merchant_category: 'Technology',
    currency: 'USD'
  })

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [txRes, statsRes] = await Promise.all([
        fraudService.getTransactions(),
        fraudService.getStats()
      ])
      setTxs(txRes.data)
      setStats(statsRes.data.summary)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSimulate() {
    setSubmitting(true)
    try {
      await fraudService.submitTransaction(formData)
      actions.addNotification({ type: 'success', title: 'Transaction Processed', message: 'ML scoring completed in real-time.' })
      await loadData()
    } catch (err) {
      actions.addNotification({ type: 'error', title: 'Simulation Failed', message: getApiErrorMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader text="Analyzing global fraud patterns..." />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Fraud Intelligence Dashboard</h2>
        <div className="flex gap-2">
           <div className="glass-chip">Multi-user Iso: Active</div>
           <div className="glass-chip text-green-500">ML Engine: Online</div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Transactions', value: stats?.total_count || 0, color: 'var(--violet)' },
          { label: 'Flagged (High Risk)', value: stats?.flagged_count || 0, color: 'var(--rose)' },
          { label: 'System Blocks', value: stats?.blocked_count || 0, color: 'var(--amber)' },
          { label: 'Prevention Rate', value: `${stats?.fraud_prevention_rate || 100}%`, color: 'var(--emerald)' },
        ].map((item, i) => (
          <div key={i} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Simulation Panel */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold">Real-Time Simulation</h3>
          <p className="text-sm text-muted">Submit a real transaction to trigger the isolation-forest & anomaly detection pipeline.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Merchant Name</label>
              <input 
                className="w-full mt-1" 
                value={formData.merchant_name} 
                onChange={e => setFormData({...formData, merchant_name: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-xs font-medium">Amount ({formData.currency})</label>
              <input 
                type="number" 
                className="w-full mt-1" 
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} 
              />
            </div>
            <button 
              className="btn-primary w-full" 
              onClick={handleSimulate}
              disabled={submitting}
            >
              {submitting ? 'ML Engine Thinking...' : 'Submit Real Transaction'}
            </button>
          </div>
        </div>

        {/* Risk Trend Chart */}
        <div className="card col-span-2">
          <h3 className="text-lg font-semibold mb-4">Fraud Risk Score Trend</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={txs.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  itemStyle={{ color: 'var(--violet)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="fraud_score" 
                  stroke="var(--violet)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'var(--violet)' }}
                  activeDot={{ r: 6, fill: 'var(--violet-light)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <h3 className="text-lg font-semibold mb-4 px-2">Live Transaction Monitoring</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Risk Score</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-muted)' }}>
              {txs.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center"><EmptyState title="No transactions yet" description="Submit a simulation to see the fraud engine in action." /></td></tr>
              ) : txs.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium">{tx.merchant_name}</td>
                  <td className="px-4 py-3 text-muted">{tx.merchant_category}</td>
                  <td className="px-4 py-3 font-bold">{tx.amount} {tx.currency}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-200">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${tx.fraud_score}%`, 
                            background: tx.fraud_score > 70 ? 'var(--rose)' : tx.fraud_score > 30 ? 'var(--amber)' : 'var(--emerald)' 
                          }} 
                        />
                      </div>
                      <span className="text-xs font-bold">{tx.fraud_score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${
                      tx.status === 'approved' ? 'status-ok' : tx.status === 'blocked' ? 'status-error' : 'status-warn'
                    }`}>
                      {tx.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
