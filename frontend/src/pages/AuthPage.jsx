import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const isRegister    = mode === 'register'
  const submitDisabled = loading || !email || !password || (isRegister && (!fullName || !confirmPassword || password !== confirmPassword || !termsAccepted))

  async function submit(e) {
    e.preventDefault()
    if (submitDisabled) return
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, fullName)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Unable to authenticate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>

        {/* Header */}
        <div>
          <div className="auth-title">{isRegister ? 'Create Account' : 'Welcome Back'}</div>
          <p className="auth-subtitle">
            {isRegister ? 'Join the AI governance platform.' : 'Securely access your AI trust controls.'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tab-group">
          <button className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>
            Log In
          </button>
          <button className={`auth-tab${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        {/* Form */}
        <form style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onSubmit={submit}>
          {error && (
            <div style={{
              borderRadius: '8px', border: '1px solid rgba(244,63,94,0.4)',
              background: 'var(--rose-dim)', padding: '0.6rem 0.85rem',
              fontSize: '0.8rem', color: 'var(--rose)',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          {isRegister && (
            <input
              className="auth-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              required
              autoComplete="name"
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
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute', right: '0.85rem', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {showPassword ? 'HIDE' : 'SHOW'}
            </button>
          </div>

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
              />
              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                fontSize: '0.8rem', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--violet)' }}
                />
                I accept the Terms &amp; Conditions
              </label>
            </>
          )}

          <div className="auth-actions">
            <button type="submit" disabled={submitDisabled} className="auth-btn-gradient">
              {loading ? '⏳ Please wait…' : isRegister ? 'Create Account' : 'Login to Dashboard'}
            </button>

            <div className="auth-divider"><span>OR</span></div>

            <button type="button" className="auth-google">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2c-2 1.5-4.5 2.3-7.3 2.3-5.3 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.7 39.7 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41.4 36.1 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          {isRegister ? (
            <>Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')}>Log in</button>
            </>
          ) : (
            <>Don't have an account?{' '}
              <button type="button" onClick={() => setMode('register')}>Sign up free</button>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
