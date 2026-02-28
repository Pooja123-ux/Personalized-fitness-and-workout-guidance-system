import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api, { setToken } from '../api'

type Profile = {
  name?: string
  bmi_category?: string
  motive?: string
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

  const navigate = useNavigate()
  const location = useLocation()

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

  const signOut = () => {
    localStorage.removeItem('token')
    navigate('/signin')
  }

  const getBmiColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'underweight': return '#3b82f6' // Blue
      case 'healthy': return '#10b981'    // Green
      case 'overweight': return '#f59e0b'  // Orange
      case 'obese': return '#ef4444'       // Red
      default: return '#6366f1'            // Indigo (Default)
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

  if (loading)
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Preparing your workspace...</p>
      </div>
    )

  return (
    <div className="layout">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        :root {
          --primary: #14b8a6;
          --primary-soft: rgba(20, 184, 166, 0.1);
          --bg: #0f172a;
          --text-dark: #0f172a;
          --text-light: #475569;
          --border: #ccfbf1;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body { 
          margin: 0; 
          padding: 0;
          background: #1e293b;
          min-height: 100vh;
          color: #ffffff !important;
        }

        body * {
          color: inherit;
        }

        .layout {
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #1e293b;
          position: relative;
          color: #ffffff !important;
        }

        .layout * {
          color: inherit;
        }

        .layout::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(99, 102, 241, 0.08) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        /* NAVBAR */
        .navbar {
          height: 80px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(16, 185, 129, 0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 60px;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
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
          letter-spacing: -0.5px;
        }

        .nav-links {
          display: flex;
          gap: 8px;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          padding: 6px;
          border-radius: 16px;
        }

        .nav-link {
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffffff !important;
          padding: 10px 18px;
          border-radius: 12px;
          transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-link:hover {
          color: #fbbf24 !important;
          background: rgba(251, 191, 36, 0.1);
        }

        .nav-link.active {
          color: #ffffff !important;
          background: rgba(16, 185, 129, 0.15);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .nav-icon-btn {
          background: none;
          border: none;
          color: #ffffff;
          font-size: 1.3rem;
          padding: 8px 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: 0.2s;
          position: relative;
          margin-left: 4px;
        }

        .nav-icon-btn:hover {
          background: rgba(251, 191, 36, 0.1);
        }

        .nav-icon-btn .badge-count {
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
          border: 2px solid #0f172a;
        }

        /* PROFILE */
        .profile-section {
          position: relative;
        }

        .avatar-trigger {
          width: 45px;
          height: 45px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          transition: 0.3s;
          border: 3px solid rgba(16, 185, 129, 0.3);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .avatar-trigger:hover {
          transform: scale(1.05);
        }

        .dropdown {
          position: absolute;
          top: 60px;
          right: 0;
          width: 240px;
          background: rgba(15, 23, 42, 0.98);
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          padding: 12px;
          border: 1px solid rgba(16, 185, 129, 0.2);
          animation: slideUp 0.3s ease;
        }

        .user-info {
          padding: 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 10px;
        }

        .user-info .name {
          display: block;
          font-weight: 800;
          color: #ffffff;
          font-size: 0.95rem;
        }

        .user-info .motive {
          display: block;
          font-size: 0.75rem;
          color: #cbd5e1;
          margin-top: 4px;
        }

        .dropdown-item {
          width: 100%;
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 0.9rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          transition: 0.2s;
          box-sizing: border-box;
        }

        .item-update {
          background: rgba(16, 185, 129, 0.15);
          color: var(--primary);
          margin-bottom: 8px;
        }

        .item-update:hover {
          background: var(--primary);
          color: white;
        }

        .item-logout {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .item-logout:hover {
          background: #ef4444;
          color: white;
        }

        /* CONTENT */
        .content {
          padding: 40px 20px;
          max-width: 100%;
          margin: 0;
          min-height: calc(100vh - 80px);
          position: relative;
          z-index: 1;
        }

        /* LOADING */
        .loading-screen {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          background: linear-gradient(to bottom, #0f172a, #1e293b);
          color: #10b981;
          font-weight: 700;
        }

        .loading-screen p {
          color: #10b981;
          margin-top: 10px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(16, 185, 129, 0.2);
          border-top: 4px solid var(--primary);
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* FLOATING ICONS */
        .floating-panel {
          position: absolute;
          top: 90px;
          right: 60px;
          width: 380px;
          max-height: 500px;
          background: rgba(15, 23, 42, 0.98);
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 20px;
          overflow-y: auto;
          animation: slideDown 0.3s ease;
          z-index: 999;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .panel-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: #ffffff;
        }

        .close-btn {
          background: none;
          border: none;
          color: #cbd5e1;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: 0.2s;
        }

        .close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .alert-item, .reminder-item {
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          margin-bottom: 12px;
          border-left: 3px solid #ef4444;
          color: #ffffff;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .reminder-item {
          border-left-color: #10b981;
        }

        .item-icon {
          margin-right: 8px;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
          .navbar { padding: 0 20px; }
          .nav-links { display: none; }
          .floating-panel { right: 20px; width: 300px; }
        }
      `}</style>

      {/* NAVBAR */}
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

        <button className="nav-icon-btn" onClick={() => { setShowAlerts(!showAlerts); setShowReminders(false); }}>
          🔔
          <span className="badge-count">4</span>
        </button>
        <button className="nav-icon-btn" onClick={() => { setShowReminders(!showReminders); setShowAlerts(false); }}>
          📋
          <span className="badge-count">3</span>
        </button>

        <div className="profile-section" style={{ marginLeft: '12px' }}>
          <div
            className="avatar-trigger"
            onClick={() => setOpen(!open)}
            style={{ background: getBmiColor(profile?.bmi_category) }}
          >
            {profile?.name?.charAt(0).toUpperCase() || '👤'}
          </div>

          {open && (
            <div className="dropdown">
              <div className="user-info">
                <span className="name">{profile?.name || 'User'}</span>
                <span className="motive">{profile?.motive || 'Fitness Journey'}</span>
              </div>
              <Link to="/intake" className="dropdown-item item-update" onClick={() => setOpen(false)}>
                 Update Profile
              </Link>
              <button onClick={signOut} className="dropdown-item item-logout">
                 Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="content">
        {children}
      </main>

      {/* ALERTS PANEL */}
      {showAlerts && (
        <div className="floating-panel">
          <div className="panel-header">
            <div className="panel-title">⚠️ Alerts</div>
            <button className="close-btn" onClick={() => setShowAlerts(false)}>×</button>
          </div>
          <div className="alert-item">
            <span className="item-icon">🩺</span>
            Report flag: diabetes needs active monitoring.
          </div>
          <div className="alert-item">
            <span className="item-icon">💉</span>
            Report flag: hypertension needs active monitoring.
          </div>
          <div className="alert-item">
            <span className="item-icon">🩸</span>
            Report flag: anemia needs active monitoring.
          </div>
          <div className="alert-item">
            <span className="item-icon">📊</span>
            Latest report lab bp is 170/105.
          </div>
        </div>
      )}

      {/* REMINDERS PANEL */}
      {showReminders && (
        <div className="floating-panel">
          <div className="panel-header">
            <div className="panel-title">📋 Daily Reminders</div>
            <button className="close-btn" onClick={() => setShowReminders(false)}>×</button>
          </div>
          <div className="reminder-item">
            <span className="item-icon">🏋️</span>
            Complete your workout session today
          </div>
          <div className="reminder-item">
            <span className="item-icon">🍽️</span>
            Complete your meals today (0/10 done)
          </div>
          <div className="reminder-item">
            <span className="item-icon">💧</span>
            Start tracking your water intake today
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout