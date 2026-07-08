import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.brand}>
          <div style={styles.logoMark}>VT</div>
          <div>
            <div style={styles.brandName}>Virtual Tech Services</div>
            <div style={styles.brandTag}>Customer Relationship Management</div>
          </div>
        </div>
        <div style={styles.tagline}>
          <h1 style={styles.taglineHead}>Manage your leads.<br />Grow your business.</h1>
          <p style={styles.taglineSub}>Track enquiries, manage your team, and convert leads into loyal customers — all from one place.</p>
        </div>
        <div style={styles.dots}>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{ ...styles.dot, opacity: 0.15 + (i % 4) * 0.1 }} />
          ))}
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Welcome back</h2>
            <p style={styles.cardSub}>Sign in to your CRM account</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBox}>{error}</div>
            )}

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@virtualtech.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={styles.eyeBtn}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 600ms linear infinite' }} />
                  Signing in...
                </span>
              ) : (
                <><LogIn size={16} /> Sign In</>
              )}
            </button>
          </form>

          <div style={styles.hint}>
            <span style={{ color: 'var(--gray-400)', fontSize: 12 }}> </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
  },
  left: {
    flex: 1,
    background: 'linear-gradient(135deg, var(--blue-700) 0%, var(--blue-900) 100%)',
    padding: '48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '100vh'
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 44, height: 44,
    background: 'rgba(255,255,255,.2)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontFamily: 'var(--font-head)',
    fontWeight: 800, fontSize: 16
  },
  brandName: { color: '#fff', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 },
  brandTag:  { color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2 },
  tagline: { color: '#fff', zIndex: 1 },
  taglineHead: { fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 700, lineHeight: 1.25, marginBottom: 16 },
  taglineSub: { fontSize: 15, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, maxWidth: 340 },
  dots: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16, alignSelf: 'flex-end'
  },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#fff' },
  right: {
    width: 440,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 40px',
    background: 'var(--gray-50)'
  },
  card: {
    background: '#fff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--gray-200)',
    boxShadow: 'var(--shadow-lg)',
    padding: '36px 32px',
    width: '100%'
  },
  cardHead: { marginBottom: 28 },
  cardTitle: { fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' },
  cardSub: { fontSize: 14, color: 'var(--gray-400)', marginTop: 4 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  errorBox: {
    background: 'var(--red-50)',
    border: '1px solid #fecaca',
    color: 'var(--red-600)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13
  },
  eyeBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--gray-400)', padding: 4
  },
  hint: { marginTop: 20, textAlign: 'center' }
}
