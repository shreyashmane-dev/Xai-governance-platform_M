export default function AuthLayout({ children }) {
  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-badge">Enterprise AI Governance</div>
          <h1 className="auth-hero-title">Trustworthy AI, Delivered.</h1>
          <p className="auth-hero-subtitle">
            Unify model onboarding, explainability, fairness, drift monitoring, and audit-ready reporting in one secure workspace.
          </p>
          <ul className="auth-hero-list">
            <li>Model registry with version control</li>
            <li>Dataset validation and schema profiling</li>
            <li>SHAP explainability with local insights</li>
            <li>Governance scoring with risk alerts</li>
          </ul>
          <div className="auth-hero-note">Built for ML teams, compliance, and risk leaders.</div>
        </section>
        <section className="auth-card">
          <div className="floating-note">Secure Workspace</div>
          {children}
        </section>
      </div>
    </div>
  )
}
