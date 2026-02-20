import { useState, useEffect } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import api, { setToken } from '../api'
import { useProfile } from '../context/ProfileContext'
import { useNavigate, Link } from 'react-router-dom'
import type { AxiosError } from 'axios'

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { refetch } = useProfile()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setToken(token)
      refetch()
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
      })

      const token = res.data.access_token
      localStorage.setItem('token', token)
      setToken(token)
      refetch()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrapper}>
      {/* --- ELEGANT FLOATING HEADER --- */}
      <header style={styles.topHeader}>
        <div style={styles.headerContainer}>
          <div style={styles.logoTitleGroup}>
            <div style={styles.logoIconContainer}>
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#00B894" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            
            <h1 style={styles.brandTitle}>
              PERSONALIZED <span style={styles.brandHighlight}>FITNESS</span> 
              <span style={styles.brandDivider}>|</span> 
              <span style={styles.brandSubText}>WORKOUT GUIDANCE SYSTEM</span>
            </h1>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Welcome Back</h2>
            <p style={styles.cardSubtitle}>Sign in to continue your progress.</p>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <form onSubmit={submit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                type="email"
                
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
              type="submit"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={styles.footer}>
            <span>Don't have an account?</span>{' '}
            <Link to="/signup" style={styles.link}>
              Create Account
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

// --- REFINED ELEGANT STYLES ---
const styles: Record<string, CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#F8FAFC', 
    fontFamily: '"Inter", -apple-system, sans-serif',
  },
  topHeader: {
    height: '60px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'fixed',
    top: '16px', 
    left: '24px',
    right: '24px',
    borderRadius: '20px', 
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 184, 148, 0.08)',
  },
  logoTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  brandTitle: {
    fontSize: '13px', 
    fontWeight: 500,
    color: '#64748B',
    margin: 0,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  brandHighlight: {
    color: '#0F172A',
    fontWeight: 700,
  },
  brandDivider: {
    margin: '0 8px',
    color: '#CBD5E1',
    fontWeight: 300,
  },
  brandSubText: {
    fontWeight: 400,
    color: '#94A3B8',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '120px 20px 40px',
  },
  card: {
    width: '100%',
    maxWidth: '350px',
    background: '#ffffff',
    padding: '40px 32px',
    borderRadius: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
    border: '1px solid #F1F5F9',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  cardTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em',
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
  },
  errorBox: {
    background: '#FFF1F2',
    color: '#E11D48',
    padding: '12px',
    borderRadius: '12px',
    fontSize: '13px',
    marginBottom: '20px',
    border: '1px solid #FFE4E6',
    textAlign: 'center',
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginLeft: '4px',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    fontSize: '15px',
    outline: 'none',
    backgroundColor: '#F8FAFC',
    transition: 'all 0.2s ease',
  },
  button: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#0F172A', 
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.15)',
  },
  footer: {
    marginTop: '32px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#64748B',
  },
  link: {
    color: '#00B894',
    fontWeight: 700,
    textDecoration: 'none',
    borderBottom: '1.5px solid rgba(0, 184, 148, 0.2)',
  },
}

export default SignIn
