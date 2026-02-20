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
    { path: '/images', label: 'Nutrition' },
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
          --primary: #6366f1;
          --primary-soft: rgba(99, 102, 241, 0.1);
          --bg: #f8fafc;
          --text-dark: #1e293b;
          --text-light: #64748b;
          --border: #f1f5f9;
        }

        body { 
          margin: 0; 
          background-color: var(--bg);
        }

        .layout {
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        /* NAVBAR */
        .navbar {
          height: 80px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
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
          background: var(--primary);
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
          color: var(--text-dark);
          letter-spacing: -0.5px;
        }

        .nav-links {
          display: flex;
          gap: 8px;
          align-items: center;
          background: #f1f5f9;
          padding: 6px;
          border-radius: 16px;
        }

        .nav-link {
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-light);
          padding: 10px 18px;
          border-radius: 12px;
          transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-link:hover {
          color: var(--text-dark);
        }

        .nav-link.active {
          color: var(--primary);
          background: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
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
          border: 4px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .avatar-trigger:hover {
          transform: scale(1.05);
        }

        .dropdown {
          position: absolute;
          top: 60px;
          right: 0;
          width: 240px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.12);
          padding: 12px;
          border: 1px solid var(--border);
          animation: slideUp 0.3s ease;
        }

        .user-info {
          padding: 15px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 10px;
        }

        .user-info .name {
          display: block;
          font-weight: 800;
          color: var(--text-dark);
          font-size: 0.95rem;
        }

        .user-info .motive {
          display: block;
          font-size: 0.75rem;
          color: var(--text-light);
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
          background: var(--primary-soft);
          color: var(--primary);
          margin-bottom: 8px;
        }

        .item-update:hover {
          background: var(--primary);
          color: white;
        }

        .item-logout {
          background: #fff1f2;
          color: #e11d48;
        }

        .item-logout:hover {
          background: #e11d48;
          color: white;
        }

        /* CONTENT */
        .content {
          padding: 40px 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* LOADING */
        .loading-screen {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          background: white;
          color: var(--primary);
          font-weight: 700;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--primary-soft);
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

        @media (max-width: 1024px) {
          .navbar { padding: 0 20px; }
          .nav-links { display: none; } /* Add a mobile menu toggle if needed */
        }
      `}</style>

      {/* NAVBAR */}
      <header className="navbar">
        <Link to="/home" className="logo-container">
         
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

        <div className="profile-section">
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
    </div>
  )
}

export default Layout