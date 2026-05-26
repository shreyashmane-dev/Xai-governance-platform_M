import { useState } from 'react'
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { Link } from 'react-router-dom'

// 3D Interactive Perspective Card Tilt component
function TiltCard({ children, className }) {
  const x = useMotionValue(200)
  const y = useMotionValue(200)

  // Smooth springs for rotations
  const springX = useSpring(x, { stiffness: 120, damping: 20 })
  const springY = useSpring(y, { stiffness: 120, damping: 20 })

  // Map mouse coordinate relative to card bounds to rotate parameters (-12 to 12 deg)
  const rotateX = useTransform(springY, [0, 400], [12, -12])
  const rotateY = useTransform(springX, [0, 400], [-12, 12])

  function handleMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    // Normalize coordinates within [0, 400]
    const mouseX = ((event.clientX - rect.left) / width) * 400
    const mouseY = ((event.clientY - rect.top) / height) * 400
    x.set(mouseX)
    y.set(mouseY)
  }

  function handleMouseLeave() {
    x.set(200)
    y.set(200)
  }

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`${className} cursor-pointer`}
    >
      <div style={{ transform: 'translateZ(25px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  )
}

const modules = [
  {
    title: 'Model Registry',
    subtitle: 'Upload & Version Control',
    desc: 'Register estimators, track schemas, run integrity checksums, and manage operational lifecycles with robust version logs.',
    badge: 'Registry V1',
    icon: '📦',
    glowColor: 'rgba(167, 139, 250, 0.4)' // Violet glow
  },
  {
    title: 'Dataset Validation',
    subtitle: 'Schema & Profiling',
    desc: 'Verify schema compatibility, profile feature nullities, preview datasets, and align columns seamlessly with models.',
    badge: 'Profiler',
    icon: '📊',
    glowColor: 'rgba(34, 211, 238, 0.4)' // Cyan glow
  },
  {
    title: 'XAI Explainability',
    subtitle: 'SHAP & Local Predict',
    desc: 'Generate global summary plots, beeswarm charts, and local waterfall explanations for individual inference rows.',
    badge: 'SHAP Engine',
    icon: '🔮',
    glowColor: 'rgba(236, 72, 153, 0.4)' // Pink glow
  },
  {
    title: 'Trust & Governance',
    subtitle: 'Drift & Audit Logs',
    desc: 'Audit models for compliance, run drift tests, calculate trust risk scores, and download audit-ready compliance reports.',
    badge: 'Compliance',
    icon: '🛡️',
    glowColor: 'rgba(16, 185, 129, 0.4)' // Emerald glow
  },
]

const stats = [
  { value: '15,000+', label: 'Inferences Evaluated' },
  { value: '99.98%', label: 'Governance Audits Passed' },
  { value: '0.01%', label: 'Drift Monitoring Interval' },
  { value: 'SOC 2', label: 'Security Standard' },
]

export default function LandingPage() {
  const [load3D, setLoad3D] = useState(false)

  return (
    <div 
      className="relative min-h-screen overflow-x-hidden pb-16 pt-6 px-4 sm:px-6 lg:px-8 transition-colors duration-500"
      style={{ background: '#030014' }} // Dark cosmic violet background
    >
      {/* Background slowly floating neon glow orbs */}
      <div 
        className="glow-orb absolute left-[5%] top-[8%] animate-float-1" 
        style={{ 
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%)', 
          width: '500px', 
          height: '500px',
          filter: 'blur(80px)' 
        }} 
      />
      <div 
        className="glow-orb absolute right-[5%] top-[35%] animate-float-2" 
        style={{ 
          background: 'radial-gradient(circle, rgba(219, 39, 119, 0.18) 0%, transparent 70%)', 
          width: '450px', 
          height: '450px',
          filter: 'blur(80px)' 
        }} 
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Navbar */}
        <header 
          className="flex w-full items-center justify-between rounded-2xl border px-6 py-4 backdrop-blur-md" 
          style={{ 
            borderColor: 'rgba(255, 255, 255, 0.08)', 
            background: 'rgba(9, 6, 26, 0.55)',
            boxShadow: '0 8px 32px 0 rgba(124, 58, 237, 0.08)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 font-bold text-white shadow-lg shadow-violet-500/25">
              ✦
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              XAI <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">TrustOps</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/about" className="landing-nav-link text-zinc-300 hover:text-white">About</Link>
            <Link to="/docs" className="landing-nav-link text-zinc-300 hover:text-white hidden sm:inline-block">Documentation</Link>
            <Link to="/auth" className="btn-secondary py-1.5 px-4 rounded-xl border border-white/10 hover:border-violet-500/50 bg-white/5 text-white hover:bg-white/10">
              Get Started
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section className="mt-16 text-center lg:mt-24">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-semibold text-pink-300 shadow-sm shadow-pink-500/5">
              <span>🚀</span> Operationalize Trustworthy ML Workflows
            </div>
            <h2 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Production AI Governance For{' '}
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-md">
                Explainability, Risk &amp; Trust
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg">
              Unify model onboarding, schema compatibility checks, real-time drift alerting, compliance trust metrics, and interactive SHAP reasoning in one secure enterprise workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link 
                to="/auth" 
                className="btn-primary px-8 py-3 rounded-xl text-base font-semibold shadow-lg shadow-violet-500/30"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' }} // Custom Pink-Violet Gradient
              >
                Launch Workspace ✦
              </Link>
              <a href="mailto:sales@example.com" className="btn-secondary px-8 py-3 rounded-xl text-base font-semibold border border-white/10 hover:border-pink-500/50 bg-white/5 hover:bg-white/10 text-white">
                Request Demo
              </a>
            </div>
          </motion.div>
        </section>

        {/* Core Modules 3D Tilting Grid */}
        <section className="mt-20 lg:mt-28">
          <div className="mb-10 text-center">
            <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Core Trust Management Modules
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Move your mouse over the cards to experience the interactive 3D perspective tilt effect.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <TiltCard 
                  className="landing-module-card h-full"
                  style={{ 
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(9, 6, 26, 0.45)',
                    boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(20px)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl" style={{ transform: 'translateZ(10px)' }}>{item.icon}</div>
                    <div className="landing-module-badge" style={{ transform: 'translateZ(15px)', color: '#db2777', background: 'rgba(219,39,119,0.1)' }}>{item.badge}</div>
                  </div>
                  <h4 className="mt-5 text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif', transform: 'translateZ(20px)' }}>
                    {item.title}
                  </h4>
                  <p className="text-xs font-semibold text-purple-400/90 mb-2" style={{ transform: 'translateZ(15px)' }}>{item.subtitle}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-1 flex-grow" style={{ transform: 'translateZ(5px)' }}>
                    {item.desc}
                  </p>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Stats Showcase Drawer */}
        <section className="mt-20 lg:mt-28">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border p-8 backdrop-blur-md" 
            style={{ 
              borderColor: 'rgba(255, 255, 255, 0.06)', 
              background: 'rgba(9, 6, 26, 0.3)',
              boxShadow: '0 4px 30px rgba(0,0,0,0.3)'
            }}
          >
            <div className="stats-badge-grid">
              {stats.map((stat, idx) => (
                <div key={idx} className="stat-pill border-zinc-800/40 bg-zinc-950/30">
                  <div className="stat-pill-num" style={{ background: 'linear-gradient(135deg, #e0a7ff 0%, #ff8da1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {stat.value}
                  </div>
                  <div className="stat-pill-label text-zinc-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* 3D Greeting Robot Model from Spline - Performance Optimized */}
        <section className="mt-20 lg:mt-28">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative w-full rounded-3xl overflow-hidden border border-zinc-800/60 bg-zinc-950/20 backdrop-blur-xl flex flex-col items-center justify-between p-8 shadow-2xl"
            style={{ minHeight: '520px' }}
          >
            <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
              <div>
                <div className="landing-module-badge mb-2" style={{ color: '#ec4899', background: 'rgba(236,72,153,0.1)' }}>✦ 3D Interactive Canvas</div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Interact with our AI Trust Assistant
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Click the button below to load the interactive 3D robot model (keeps site load times ultra fast).
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setLoad3D(true)}
                className="btn-primary py-2.5 px-6 rounded-xl font-semibold shadow-md shadow-violet-500/10 hover:shadow-violet-500/30"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' }}
              >
                Activate 3D Assistant 🤖
              </button>
            </div>

            {/* 3D iframe Viewport container */}
            <div className="relative w-full h-[380px] mt-6 flex items-center justify-center rounded-2xl overflow-hidden border border-zinc-800 bg-black/40">
              {load3D ? (
                <iframe 
                  src="https://my.spline.design/3drobot-903df52f8d83935dbceb37f407dc87a7/" 
                  frameBorder="0" 
                  width="100%" 
                  height="100%" 
                  style={{ minHeight: '380px', border: 'none' }}
                  title="3D Greeting Robot"
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center px-4">
                  <div className="text-4xl animate-bounce">🤖</div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-200">3D Model Standby</div>
                    <div className="text-xs text-zinc-500 max-w-sm">
                      Loads an interactive, cursor-following 3D robot from Spline on-demand to save CPU resources.
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLoad3D(true)}
                    className="mt-2 text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    Click to load canvas
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* Bottom Footer Info */}
        <footer className="mt-24 border-t border-zinc-900 pt-8 text-center text-xs text-zinc-600">
          <p>&copy; {new Date().getFullYear()} XAI TrustOps. All rights reserved. Secure Governance Platform.</p>
        </footer>
      </div>
    </div>
  )
}
