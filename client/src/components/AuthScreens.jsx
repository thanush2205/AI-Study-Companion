import { useState } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function call(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  let json
  try { json = JSON.parse(text) } catch { json = {} }
  return { status: response.status, json }
}

export function LoginScreen({ onAuthed }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { status, json } = await call('/api/auth/login', { email, password })
    setBusy(false)
    if (status === 200 && json.token) {
      window.localStorage.setItem('token', json.token)
      window.localStorage.setItem('user', JSON.stringify(json.user ?? {}))
      onAuthed(json.user, json.token)
    } else {
      setError(json.error ?? 'Could not sign in — check your credentials.')
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="brand-mark"><span>SC</span> Study Companion</div>
        <p className="eyebrow">Welcome back</p>
        <h1>Pick up where you <em>left off.</em></h1>
        <p className="lede">Your spaces, projects, and mastery are exactly as you left them.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <span className="section-label">Sign in</span>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></label>
        {error && <p className="auth-error">{error}</p>}
        <button className="primary-action" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'} <span>→</span></button>
        <p className="auth-switch">New here? <a onClick={onAuthed} href="#">Create an account</a></p>
      </form>
    </div>
  )
}

export function RegisterScreen({ onAuthed }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { status, json } = await call('/api/auth/register', { name, email, password })
    setBusy(false)
    if (status === 201 && json.token) {
      window.localStorage.setItem('token', json.token)
      window.localStorage.setItem('user', JSON.stringify(json.user ?? {}))
      onAuthed(json.user, json.token)
    } else {
      setError(json.error ?? 'Could not create the account.')
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="brand-mark"><span>SC</span> Study Companion</div>
        <p className="eyebrow">Start fresh</p>
        <h1>Learn with a <em>compass.</em></h1>
        <p className="lede">Create materials, quiz yourself, and watch mastery grow concept by concept.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <span className="section-label">Create account</span>
        <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>
        {error && <p className="auth-error">{error}</p>}
        <button className="primary-action" disabled={busy || !name || !email || password.length < 8}>{busy ? 'Creating…' : 'Create account'} <span>→</span></button>
        <p className="auth-switch">Already registered? <a onClick={onAuthed} href="#">Sign in</a></p>
      </form>
    </div>
  )
}