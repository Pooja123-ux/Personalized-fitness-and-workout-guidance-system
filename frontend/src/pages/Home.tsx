import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

        .home-wrapper {
          min-height: 100vh;
          /* CLEAN MESH GRADIENT BACKGROUND */
          background-color: #f8fafc;
          background-image: 
            radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.05) 0px, transparent 50%);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          position: relative;
          overflow: hidden;
        }

        .container {
          width: 100%;
          max-width: 1100px;
          position: relative;
          z-index: 1;
        }

        .header {
          text-align: center;
          margin-bottom: 60px;
        }

        .header h1 {
          font-size: clamp(2.5rem, 5vw, 4rem);
          font-weight: 800;
          color: #1e293b;
          margin: 0;
          letter-spacing: -1.5px;
          line-height: 1.1;
        }

        .header p {
          color: #64748b;
          margin-top: 12px;
          font-size: 1.15rem;
          font-weight: 500;
        }

        /* GRID SYSTEM */
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .card {
          text-decoration: none;
          background: #ffffff;
          border-radius: 30px;
          padding: 35px;
          display: flex;
          flex-direction: row;
          align-items: center;
          text-align: left;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid #f1f5f9;
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.04);
        }

        .card:hover {
          transform: translateY(-8px);
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
        }

        .icon {
          min-width: 75px;
          height: 75px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin-right: 25px;
          color: white;
          transition: transform 0.3s ease;
        }

        .dashboard { background: linear-gradient(135deg, #10b981, #059669); }
        .trainer { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        .reports { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .chat { background: linear-gradient(135deg, #ec4899, #be185d); }

        .card:hover .icon {
          transform: scale(1.1) rotate(-5deg);
        }

        .card h3 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .card p {
          font-size: 0.95rem;
          color: #64748b;
          margin-top: 6px;
          line-height: 1.5;
        }

        /* CTA BUTTON */
        .cta-wrapper {
          margin-top: 60px;
          text-align: center;
        }

        .cta-btn {
          padding: 20px 50px;
          background: #1e293b;
          color: white;
          border: none;
          border-radius: 20px;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 15px 30px rgba(30, 41, 59, 0.2);
        }

        .cta-btn:hover {
          background: #10b981;
          transform: scale(1.05);
          box-shadow: 0 20px 40px rgba(16, 185, 129, 0.3);
        }

        @media (max-width: 800px) {
          .grid { grid-template-columns: 1fr; }
          .card { padding: 25px; }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1>Fitness Guidance</h1>
          <p>Smart health tracking with AI-powered insights.</p>
        </div>

        <div className="grid">
          <Link to="/dashboard" className="card">
            <div className="icon dashboard">📊</div>
            <div>
              <h3>Dashboard</h3>
              <p>Track BMI, calories and activity progress.</p>
            </div>
          </Link>

          <Link to="/trainer" className="card">
            <div className="icon trainer">🏋️</div>
            <div>
              <h3>AI Trainer</h3>
              <p>Improve posture with real-time smart guidance.</p>
            </div>
          </Link>

          <Link to="/reports" className="card">
            <div className="icon reports">📈</div>
            <div>
              <h3>Reports</h3>
              <p>View detailed health analytics and trends.</p>
            </div>
          </Link>

          <Link to="/chat" className="card">
            <div className="icon chat">💬</div>
            <div>
              <h3>Health Assistant</h3>
              <p>Get instant advice and workout plans.</p>
            </div>
          </Link>
        </div>

        <div className="cta-wrapper">
          <button className="cta-btn" onClick={() => navigate('/intake')}>
            Start Assessment →
          </button>
        </div>
      </div>
    </div>
  )
}

export default Home

