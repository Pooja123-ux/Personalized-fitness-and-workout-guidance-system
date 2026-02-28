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

        /* NAVBAR */
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
          gap: 8px;
          align-items: center;
        }

        .nav-link {
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffffff !important;
          padding: 10px 18px;
          border-radius: 12px;
          transition: 0.2s;
        }

        .nav-link.active {
          background: rgba(16, 185, 129, 0.15);
        }

        /* RIGHT SIDE ACTIONS */
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .nav-link:hover {
  color: #c93c26 !important;   /* Yellow */
  background: rgba(251, 191, 36, 0.1);
}

        .nav-icon-btn {
          background: none;
          border: none;
          color: #ffffff;
          font-size: 1.3rem;
          padding: 8px 12px;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
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

        .avatar-trigger {
          width: 45px;
          height: 45px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          cursor: pointer;
          border: 3px solid rgba(16, 185, 129, 0.3);
        }

        .dropdown {
          position: absolute;
          top: 60px;
          right: 0;
          width: 220px;
          background: #0f172a;
          border-radius: 16px;
          padding: 12px;
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

        {/* RIGHT SIDE */}
        <div className="nav-actions">
          <button
            className="nav-icon-btn"
            onClick={() => { setShowAlerts(!showAlerts); setShowReminders(false); }}
          >
            🔔
            <span className="badge-count">4</span>
          </button>

          <button
            className="nav-icon-btn"
            onClick={() => { setShowReminders(!showReminders); setShowAlerts(false); }}
          >
            📋
            <span className="badge-count">3</span>
          </button>

          <div className="profile-section">
            <div
              className="avatar-trigger"
              onClick={() => setOpen(!open)}
              style={{ background: getBmiColor(profile?.bmi_category) }}
            >
              {profile?.name?.charAt(0).toUpperCase() || '👤'}
            </div>
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