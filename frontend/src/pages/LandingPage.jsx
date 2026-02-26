import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const modules = [
  'Model registry with upload and version control',
  'Dataset validation with preview and schema profile',
  'Metrics, SHAP explainability, and local prediction reasoning',
  'Governance trust scoring, drift detection, and audit logs',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen p-6 lg:p-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 backdrop-blur" style={{ borderColor: 'var(--border-muted)', background: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)' }}>
        <h1 className="text-xl font-bold text-primary-600 lg:text-2xl">XAI TrustOps</h1>
        <div className="flex items-center gap-2">
          <Link to="/about" className="btn-secondary">About Us</Link>
          <Link to="/auth" className="btn-primary">Get Started</Link>
        </div>
      </header>

      <section className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-bold leading-tight lg:text-4xl">Production AI Governance For Explainability, Risk, And Trust</h2>
          <p className="mt-4 text-base" style={{ color: 'var(--text-muted)' }}>
            Upload models and datasets, compute quality metrics, run SHAP explanations, detect drift, monitor fairness, and generate audit-ready governance reports.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/auth" className="btn-primary">Start Workspace</Link>
            <a className="btn-secondary" href="mailto:sales@example.com">Book Demo</a>
          </div>
        </motion.div>

        <div className="card">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Core Modules</div>
          <ul className="mt-3 space-y-2 text-sm">
            {modules.map((item) => (
              <li key={item} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
