export default function AuthLayout({ children }) {
  return (
    <div className="auth-screen">
      {/* Background glowing orbs for auth pages */}
      <div className="glow-orb glow-orb-violet -left-[10%] -top-[10%]" />
      <div className="glow-orb glow-orb-cyan -right-[10%] -bottom-[10%]" />

      <div className="auth-shell">
        {/* Terminal/Dashboard visual mockup panel — desktop only */}
        <section className="auth-hero flex flex-col justify-between">
          <div>
            <div className="auth-hero-badge">✦ Enterprise AI Governance</div>
            <h1 className="auth-hero-title">
              Trustworthy AI,<br />
              <span>Delivered.</span>
            </h1>
            <p className="auth-hero-subtitle">
              Unify model registry operations, dataset schema matching, SHAP explainability, and compliance auditing in one secure workspace.
            </p>
          </div>

          <div className="my-6">
            <div className="auth-graphic-terminal">
              <div className="auth-terminal-header">
                <span className="auth-terminal-dot auth-terminal-dot-red" />
                <span className="auth-terminal-dot auth-terminal-dot-yellow" />
                <span className="auth-terminal-dot auth-terminal-dot-green" />
                <span className="auth-terminal-title">trustops-monitor --daemon</span>
              </div>
              <div className="flex-1 space-y-2 overflow-hidden">
                <p className="auth-terminal-comment"># Initializing TrustOps real-time ML audit daemon...</p>
                <p className="auth-terminal-code">$ trustops check --model=churn_predictor:v2.1</p>
                <p className="auth-terminal-success">✓ Model loaded successfully. Architecture: XGBClassifier</p>
                <p className="auth-terminal-success">✓ Schema aligned. Features verified: 18/18 inputs match.</p>
                <p className="auth-terminal-code">$ trustops audit --dataset=validation_may_2026</p>
                <p className="auth-terminal-success">✓ Fairness check passed: Demographic Parity Ratio = 0.94 (&gt; 0.80)</p>
                <p className="auth-terminal-warning">⚠ Data drift warning: feature "account_age" drift (PSI = 0.14)</p>
                <p className="auth-terminal-code">$ trustops shap --explain --row=42</p>
                <p className="auth-terminal-success">✓ SHAP values computed. Base: 0.21, Pred: 0.68. Primary driver: total_spend (+0.35)</p>
                <p className="auth-terminal-success">✓ Compliance report generated: audit_report_8ae095.pdf</p>
              </div>
            </div>
          </div>

          <div className="auth-hero-note">
            Built for ML engineers, compliance managers, and risk leaders.
          </div>
        </section>

        {/* Auth card */}
        <section className="auth-card">
          <div className="floating-note">✦ Secure Workspace</div>
          {children}
        </section>
      </div>
    </div>
  )
}
