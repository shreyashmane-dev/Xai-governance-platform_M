import { Link } from 'react-router-dom'

const docs = [
  ['Installation Guide', 'installation', 'INSTALLATION_GUIDE.md'],
  ['User Manual', 'user-manual', 'USER_MANUAL.md'],
  ['Admin Manual', 'admin-manual', 'ADMIN_MANUAL.md'],
  ['API Documentation', 'api', 'API_DOCUMENTATION.md'],
  ['Architecture Overview', 'architecture', 'ARCHITECTURE_OVERVIEW.md'],
  ['Troubleshooting', 'troubleshooting', 'TROUBLESHOOTING.md'],
  ['Deployment Guide', 'deployment', 'DEPLOYMENT_GUIDE.md'],
  ['Feature Breakdown', 'features', 'FEATURE_BREAKDOWN.md'],
  ['Limitations', 'limitations', 'LIMITATIONS.md'],
  ['Future Scope', 'future', 'FUTURE_SCOPE.md'],
  ['Demo Script', 'demo', 'DEMO_SCRIPT.md'],
]

const pillars = [
  ['Model Governance', 'Versioned registry, model lineage, and ownership workflows.'],
  ['Explainability', 'Global + local SHAP with fallbacks for strict environments.'],
  ['Fairness & Risk', 'Bias diagnostics, subgroup monitoring, and trust scoring.'],
  ['Drift Monitoring', 'PSI/JSD drift signals with stability scoring.'],
]

function ShieldIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
      <path d="M9.5 12.5l2 2 3-3" />
    </svg>
  )
}

function GraphIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
    </svg>
  )
}

function AuditIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 7h8" />
      <path d="M9 11h8" />
      <path d="M9 15h5" />
      <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M16 11a3 3 0 1 0-6 0" />
      <path d="M4 20a6 6 0 0 1 16 0" />
      <path d="M9 7a3 3 0 1 0-6 0" />
      <path d="M1 20a5 5 0 0 1 6-4" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 3h8l4 4v14H8z" />
      <path d="M16 3v5h5" />
      <path d="M10 12h8" />
      <path d="M10 16h8" />
    </svg>
  )
}

function Illustration() {
  return (
    <svg width="100%" height="180" viewBox="0 0 520 180" fill="none">
      <rect x="0" y="0" width="520" height="180" rx="18" fill="url(#bg)" />
      <circle cx="110" cy="90" r="46" fill="rgba(30, 58, 138, 0.2)" />
      <circle cx="210" cy="70" r="34" fill="rgba(14, 165, 233, 0.25)" />
      <circle cx="310" cy="100" r="50" fill="rgba(16, 185, 129, 0.2)" />
      <rect x="360" y="50" width="120" height="80" rx="12" fill="rgba(255,255,255,0.7)" />
      <rect x="380" y="70" width="80" height="8" rx="4" fill="rgba(30, 58, 138, 0.5)" />
      <rect x="380" y="88" width="60" height="8" rx="4" fill="rgba(14, 165, 233, 0.5)" />
      <rect x="380" y="106" width="70" height="8" rx="4" fill="rgba(16, 185, 129, 0.5)" />
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="520" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(226,232,240,0.9)" />
          <stop offset="1" stopColor="rgba(191,219,254,0.7)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div className="card grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary-600">AI Governance Platform</div>
          <h1 className="text-3xl font-bold">About XAI TrustOps</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            XAI TrustOps is an enterprise AI governance suite that unifies model onboarding, explainability, bias monitoring, drift defense, and audit-grade
            reporting. It is designed for ML engineering, risk, and compliance teams who need full operational visibility and trust controls at scale.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-muted)' }}>SOC-ready audit trails</div>
            <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-muted)' }}>Governance scorecards</div>
            <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-muted)' }}>Explainability QA</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className="btn-primary">Open Dashboard</Link>
            <Link to="/docs" className="btn-secondary">Documentation Center</Link>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
            <Illustration />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="font-semibold">Trust Signals</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Unified score from metrics, fairness, drift, and stability.</div>
            </div>
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="font-semibold">Operational Readiness</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Audit logs, compliance snapshots, and policy alignment.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Platform Mission</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Deliver accountable and reliable AI operations by combining model risk controls, transparent explainability, continuous monitoring,
            and governance-ready evidence in one workflow.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>Model registry with versioned metadata and fingerprinting.</li>
            <li>Dataset validation with schema, quality, and distribution checks.</li>
            <li>Explainability with global and local SHAP plus fallback safeguards.</li>
            <li>Governance scoring with fairness, drift, and trust index integration.</li>
          </ul>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">How To Use</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>Upload model and dataset in `Models` page.</li>
            <li>Run metrics and verify confusion matrix and AUC.</li>
            <li>Run explainability to inspect global and local drivers.</li>
            <li>Run governance with optional sensitive feature selection.</li>
            <li>Run drift against baseline and current datasets.</li>
            <li>Generate governance report and review audit logs.</li>
          </ol>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pillars.map(([title, description]) => (
          <div key={title} className="card space-y-2">
            <div className="flex items-center gap-2 text-primary-600">
              {title === 'Model Governance' && <ShieldIcon />}
              {title === 'Explainability' && <GraphIcon />}
              {title === 'Fairness & Risk' && <AuditIcon />}
              {title === 'Drift Monitoring' && <PeopleIcon />}
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Security & Compliance Focus</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Governance workflows are designed to satisfy internal AI control requirements with evidence artifacts and audit traceability.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="font-semibold">Audit Logging</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Immutable records for model, dataset, drift, and governance actions.</div>
            </div>
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="font-semibold">Risk Scoring</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Weighted trust score combining quality, fairness, drift, and stability.</div>
            </div>
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="font-semibold">Explainability QA</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Global + local reasoning stored per model/dataset.</div>
            </div>
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="font-semibold">Drift Alerts</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>PSI/JSD alerts with stability indicators and severity.</div>
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Operating Teams</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Built for cross-functional AI operations with clear ownership and accountability.
          </p>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>ML Engineering: model health and release control.</li>
            <li>Risk & Compliance: governance reporting and audit trails.</li>
            <li>Product Owners: documented intended use and risk category.</li>
            <li>Data Teams: dataset validation and drift response.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Documentation</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Open the documents below to view full installation, API, architecture, and operational guides.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map(([label, key, file]) => (
            <Link
              key={file}
              to={`/docs/${key}`}
              className="rounded-xl border px-3 py-2 text-sm transition hover:-translate-y-0.5"
              style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-primary-600"><DocIcon /></span>
                <span className="font-semibold">{label}</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {file}
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" to="/docs">
            Open Documentation Center
          </Link>
        </div>
      </div>
    </div>
  )
}
