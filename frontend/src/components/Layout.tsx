import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api, { setToken } from '../api'

type Profile = {
  name?: string
  bmi_category?: string
  motive?: string
}

type NavAlert = {
  severity: 'high' | 'medium' | 'low'
  message: string
}

type NavReminder = {
  type: 'workout' | 'food' | 'water'
  message: string
  status?: 'pending' | 'warning'
}

type Props = {
  children: React.ReactNode
}

function Layout({ children }: Props) {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [alertItems, setAlertItems] = useState<NavAlert[]>([])
  const [reminderItems, setReminderItems] = useState<NavReminder[]>([])

  const navigate = useNavigate()
  const location = useLocation()
  const profileRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/signin')
      return
    }

    setToken(token)

    api.get('/profile')
      .then(res => setProfile(res.data))
      .catch(err => {
        if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/signin')
        }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    const loadDashboardSignals = () => {
      try {
        const rawAlerts = localStorage.getItem('dashboard_alerts_v1')
        const rawReminders = localStorage.getItem('dashboard_reminders_v1')
        const parsedAlerts = rawAlerts ? JSON.parse(rawAlerts) : []
        const parsedReminders = rawReminders ? JSON.parse(rawReminders) : []

        if (Array.isArray(parsedAlerts)) {
          setAlertItems(parsedAlerts.filter((x: any) => x && typeof x.message === 'string'))
        } else {
          setAlertItems([])
        }

        if (Array.isArray(parsedReminders)) {
          setReminderItems(parsedReminders.filter((x: any) => x && typeof x.message === 'string'))
        } else {
          setReminderItems([])
        }
      } catch {
        setAlertItems([])
        setReminderItems([])
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dashboard_alerts_v1' || e.key === 'dashboard_reminders_v1') {
        loadDashboardSignals()
      }
    }

    const onSignalsUpdated = () => loadDashboardSignals()

    loadDashboardSignals()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', loadDashboardSignals)
    window.addEventListener('dashboard-signals-updated', onSignalsUpdated as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', loadDashboardSignals)
      window.removeEventListener('dashboard-signals-updated', onSignalsUpdated as EventListener)
    }
  }, [])

  useEffect(() => {
    setShowAlerts(false)
    setShowReminders(false)
  }, [location.pathname])

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const node = profileRef.current
      if (!node) return
      if (!node.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDocClick)
    return () => window.removeEventListener('mousedown', onDocClick)
  }, [])

  const signOut = () => {
    localStorage.removeItem('token')
    navigate('/signin')
  }

  const getBmiColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'underweight': return '#3b82f6'
      case 'healthy': return '#10b981'
      case 'overweight': return '#f59e0b'
      case 'obese': return '#ef4444'
      default: return '#6366f1'
    }
  }

  const navItems = [
    { path: '/home', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/recommendations', label: 'My Plan' },
    { path: '/trainer', label: 'AI Trainer' },
    { path: '/reports', label: 'Reports' },
    { path: '/chat', label: 'Assistant' },
    { path: '/images', label: 'Nutrition Analyzer' },
  ]

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Preparing your workspace...</p>
      </div>
    )
  }

  return (
    <div className="layout">
      <style>{`
        :root {
          --primary: #14b8a6;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
          background: #1e293b;
          min-height: 100vh;
          color: #ffffff !important;
        }

        .layout {
          min-height: 100vh;
          background: #1e293b;
          color: #ffffff !important;
        }

        .navbar {
          height: 80px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 60px;
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .logo-box {
          width: 35px;
          height: 35px;
          background: linear-gradient(135deg, var(--primary), #059669);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
        }

        .logo-text {
          font-weight: 800;
          font-size: 1.25rem;
          color: #ffffff !important;
        }

        .nav-links {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .nav-link {
          text-decoration: none;
          font-size: 0.98rem;
          font-weight: 700;
          color: #ffffff !important;
          padding: 10px 16px;
          border-radius: 12px;
          transition: 0.2s;
        }

        .nav-link.active {
          background: rgba(16, 185, 129, 0.15);
        }

        .nav-link:hover {
          color: #c93c26 !important;
          background: rgba(251, 191, 36, 0.1);
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
        }

        .nav-icon-btn {
          background: none;
          border: none;
          color: #ffffff;
          font-size: 1.3rem;
          padding: 8px 10px;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
        }

        .nav-icon-btn.active {
          background: rgba(16, 185, 129, 0.18);
        }

        .badge-count {
          position: absolute;
          top: 2px;
          right: 4px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
        }

        .nav-panel {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: min(420px, 85vw);
          max-height: 360px;
          overflow-y: auto;
          background: linear-gradient(160deg, #0b1220 0%, #111827 100%);
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 14px;
          box-shadow: 0 18px 30px rgba(2, 6, 23, 0.5);
          padding: 12px;
          z-index: 1200;
        }

        .nav-panel h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 800;
          color: #f8fafc;
        }

        .nav-panel-count {
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 700;
          margin-top: 2px;
        }

        .nav-panel-list {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        .nav-panel-item {
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          padding: 10px;
          font-size: 0.84rem;
          line-height: 1.35;
          color: #e2e8f0;
          font-weight: 600;
        }

        .nav-panel-item.alert-high { border-color: rgba(239, 68, 68, 0.5); background: rgba(239, 68, 68, 0.12); }
        .nav-panel-item.alert-medium { border-color: rgba(245, 158, 11, 0.5); background: rgba(245, 158, 11, 0.12); }
        .nav-panel-item.alert-low { border-color: rgba(56, 189, 248, 0.45); background: rgba(56, 189, 248, 0.1); }
        .nav-panel-item.rem-workout { border-color: rgba(249, 115, 22, 0.45); background: rgba(249, 115, 22, 0.1); }
        .nav-panel-item.rem-food { border-color: rgba(16, 185, 129, 0.45); background: rgba(16, 185, 129, 0.1); }
        .nav-panel-item.rem-water { border-color: rgba(59, 130, 246, 0.45); background: rgba(59, 130, 246, 0.1); }

        .avatar-trigger {
          width: 42px;
          height: 42px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          border: 3px solid rgba(16, 185, 129, 0.3);
        }

        .profile-section {
          position: relative;
        }

        .profile-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 190px;
          background: linear-gradient(160deg, #0b1220 0%, #111827 100%);
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 12px;
          box-shadow: 0 18px 30px rgba(2, 6, 23, 0.5);
          padding: 8px;
          z-index: 1200;
          display: grid;
          gap: 6px;
        }

        .profile-dropdown-item {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          padding: 10px 12px;
          border-radius: 10px;
          text-align: left;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
        }

        .profile-dropdown-item:hover {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.4);
        }

        .profile-dropdown-item.signout {
          color: #fecaca;
          border-color: rgba(239, 68, 68, 0.35);
        }

        .profile-dropdown-item.signout:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .content {
          padding: 40px 20px;
        }

        .loading-screen {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          background: #0f172a;
          color: #10b981;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(16, 185, 129, 0.2);
          border-top: 4px solid var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <header className="navbar">
        <Link to="/home" className="logo-container">
          <div className="logo-box">F</div>
          <span className="logo-text">Fitness</span>
        </Link>

        <nav className="nav-links">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <button
            className={`nav-icon-btn ${showAlerts ? 'active' : ''}`}
            onClick={() => {
              setShowAlerts((prev) => !prev)
              setShowReminders(false)
            }}
            title="Alerts"
            aria-label="Alerts"
          >
            🔔
            <span className="badge-count">{alertItems.length}</span>
          </button>

          <button
            className={`nav-icon-btn ${showReminders ? 'active' : ''}`}
            onClick={() => {
              setShowReminders((prev) => !prev)
              setShowAlerts(false)
            }}
            title="Reminders"
            aria-label="Reminders"
          >
         ⏰
            <span className="badge-count">{reminderItems.length}</span>
          </button>

          {showAlerts && (
            <div className="nav-panel" role="dialog" aria-label="Smart Alerts">
              <h4>🔔 Smart Alerts</h4>
              <div className="nav-panel-count">{alertItems.length}</div>
              <div className="nav-panel-list">
                {alertItems.length > 0 ? alertItems.map((item, idx) => (
                  <div key={`al-${idx}`} className={`nav-panel-item alert-${item.severity}`}>
                    {item.message}
                  </div>
                )) : <div className="nav-panel-item">No alerts right now.</div>}
              </div>
            </div>
          )}

          {showReminders && (
            <div className="nav-panel" role="dialog" aria-label="Daily Reminders">
              <h4>⏰ Daily Reminders</h4>
              <div className="nav-panel-count">{reminderItems.length}</div>
              <div className="nav-panel-list">
                {reminderItems.length > 0 ? reminderItems.map((item, idx) => {
                  const icon = item.type === 'workout' ? '🏃' : item.type === 'food' ? '🍽️' : '💧'
                  return (
                    <div key={`rm-${idx}`} className={`nav-panel-item rem-${item.type}`}>
                      {icon} {item.message}
                    </div>
                  )
                }) : <div className="nav-panel-item">No reminders right now.</div>}
              </div>
            </div>
          )}

          <div className="profile-section" ref={profileRef}>
            <div
              className="avatar-trigger"
              onClick={() => {
                setOpen(!open)
                setShowAlerts(false)
                setShowReminders(false)
              }}
              style={{ background: getBmiColor(profile?.bmi_category) }}
            >
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {open && (
              <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={() => {
                    setOpen(false)
                    navigate('/intake')
                  }}
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  className="profile-dropdown-item signout"
                  onClick={() => {
                    setOpen(false)
                    signOut()
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content">
        {children}
      </main>
    </div>
  )
}

export default Layout
