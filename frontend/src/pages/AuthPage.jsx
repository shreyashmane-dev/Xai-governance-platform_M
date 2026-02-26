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

  const isRegister = mode === 'register'
  const submitDisabled =
    loading || !email || !password || (isRegister && (!fullName || !confirmPassword || password !== confirmPassword || !termsAccepted))

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
      <div className="auth-card-content space-y-6">
        <div>
          <div className="auth-title">Welcome Back</div>
          <p className="auth-subtitle">Securely access your AI trust controls.</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${mode === 'login' ? 'bg-primary-600 text-white border-transparent' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${mode === 'register' ? 'bg-primary-600 text-white border-transparent' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          {error && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
          {isRegister && (
            <input
              className="auth-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              required
            />
          )}
          <input className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <div className="relative">
            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-3 text-xs font-semibold text-slate-500"
            >
              {showPassword ? 'Hide' : 'Show'}
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
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="h-4 w-4 rounded border border-slate-300" />
                I accept the Terms & Conditions
              </label>
            </>
          )}

          <div className="auth-actions">
            <button type="submit" disabled={submitDisabled} className="auth-btn-gradient">
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Login to Dashboard'}
            </button>
            <div className="auth-divider">
              <span>OR</span>
            </div>
          <button type="button" className="auth-google">
            <span>Continue with Google</span>
          </button>
          </div>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')} className="font-semibold text-indigo-600 hover:underline">
                Log in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={() => setMode('register')} className="font-semibold text-indigo-600 hover:underline">
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
