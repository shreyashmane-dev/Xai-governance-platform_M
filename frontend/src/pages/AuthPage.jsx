import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isRegister = mode === 'register'

  // Password strength logic
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, text: '', color: 'transparent', width: '0%' }
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 10) score++
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    if (score <= 1) return { score, text: 'Weak password', color: 'var(--rose)', width: '25%' }
    if (score <= 3) return { score, text: 'Good password strength', color: 'var(--amber)', width: '60%' }
    return { score, text: 'Strong secure password', color: 'var(--emerald)', width: '100%' }
  }

  const pwdStrength = getPasswordStrength(password)

  const submitDisabled = 
    loading || 
    !email || 
    !password || 
    (isRegister && (!fullName || !confirmPassword || password !== confirmPassword || !termsAccepted))

  async function submit(e) {
    e.preventDefault()
    if (submitDisabled) return
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, fullName)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Unable to authenticate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="auth-title text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </div>
          <p className="auth-subtitle">
            {isRegister ? 'Join the secure AI governance workspace.' : 'Access your model monitoring & trust console.'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tab-group relative">
          <button 
            type="button" 
            className={`auth-tab z-10 ${mode === 'login' ? 'active text-white' : 'text-zinc-500'}`} 
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Log In
          </button>
          <button 
            type="button" 
            className={`auth-tab z-10 ${mode === 'register' ? 'active text-white' : 'text-zinc-500'}`} 
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            Register
          </button>
        </div>

        {/* Form Container with transitions */}
        <form style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }} onSubmit={submit}>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: '10px', 
                border: '1px solid rgba(244,63,94,0.3)',
                background: 'var(--rose-dim)', 
                padding: '0.65rem 0.9rem',
                fontSize: '0.8rem', 
                color: 'var(--rose)',
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
              }}
            >
              <span>⚠️</span> {error}
            </motion.div>
          )}

          {isRegister && (
            <input
              className="auth-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              required
              autoComplete="name"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            />
          )}

          <input
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            required
            autoComplete="email"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          />

          <div style={{ position: 'relative' }}>
            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              style={{ 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border)',
                paddingRight: '3.5rem'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute', 
                right: '1rem', 
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                fontSize: '0.7rem', 
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
              }}
            >
              {showPassword ? 'HIDE' : 'SHOW'}
            </button>
          </div>

          {/* Password strength feedback */}
          {isRegister && password && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-1">
              <div className="flex justify-between items-center text-[0.7rem] text-zinc-400">
                <span>{pwdStrength.text}</span>
                <span style={{ color: pwdStrength.color }}>•</span>
              </div>
              <div className="auth-password-strength-bar">
                <div 
                  className="auth-password-strength-fill" 
                  style={{ 
                    width: pwdStrength.width, 
                    backgroundColor: pwdStrength.color 
                  }} 
                />
              </div>
            </motion.div>
          )}

          {isRegister && (
            <>
              <input
                className="auth-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="Confirm Password"
                required
                autoComplete="new-password"
                style={{ 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border)',
                  borderColor: password && confirmPassword && password !== confirmPassword ? 'var(--rose)' : 'var(--border)'
                }}
              />
              {password && confirmPassword && password !== confirmPassword && (
                <span className="text-[0.7rem] text-rose-400 px-1">Passwords do not match</span>
              )}
              
              <label 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.65rem',
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.25rem 0.1rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    accentColor: 'var(--violet)',
                    borderRadius: '4px',
                    border: '1px solid var(--border)'
                  }}
                />
                <span>I accept the Terms &amp; Conditions</span>
              </label>
            </>
          )}

          <div className="auth-actions mt-3">
            <button 
              type="submit" 
              disabled={submitDisabled} 
              className="auth-btn-gradient text-white flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', display: 'inline-block' }} />
                  Verifying...
                </>
              ) : isRegister ? (
                'Create Account ✦'
              ) : (
                'Login to Dashboard ✦'
              )}
            </button>

            <div className="auth-divider"><span>OR</span></div>

            <button type="button" className="auth-google hover:border-violet-500/30">
              <svg width="18" height="18" viewBox="0 0 48 48" className="flex-shrink-0">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2c-2 1.5-4.5 2.3-7.3 2.3-5.3 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.7 39.7 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41.4 36.1 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </form>

        {/* Footer switcher link */}
        <div className="auth-footer text-xs">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <button 
                type="button" 
                className="text-violet-400 font-semibold"
                onClick={() => {
                  setMode('login')
                  setError('')
                }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button 
                type="button" 
                className="text-violet-400 font-semibold"
                onClick={() => {
                  setMode('register')
                  setError('')
                }}
              >
                Sign up free
              </button>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
