import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .home-wrapper {
          min-height: 100vh;
          background: linear-gradient(to bottom, #0f172a, #1e293b);
          font-family: 'Poppins', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 80px 40px;
          position: relative;
          z-index: 1;
        }

        .hero {
          text-align: center;
          margin-bottom: 80px;
        }

        .hero h1 {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 24px;
          letter-spacing: -2px;
          line-height: 1.1;
        }

        .hero .highlight {
          background: linear-gradient(135deg, #10b981, #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero p {
          font-size: 1.25rem;
          color: #94a3b8;
          max-width: 700px;
          margin: 0 auto 40px;
          line-height: 1.8;
          font-weight: 300;
        }

        .cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 18px 40px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 40px rgba(16, 185, 129, 0.3);
        }

        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 50px rgba(16, 185, 129, 0.4);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
          margin-bottom: 60px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          text-decoration: none;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1));
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .feature-card:hover::before {
          opacity: 1;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          border-color: rgba(16, 185, 129, 0.3);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .feature-icon {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin-bottom: 24px;
          position: relative;
          z-index: 1;
        }

        .feature-card:nth-child(2) .feature-icon {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
        }

        .feature-card:nth-child(3) .feature-icon {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        .feature-card:nth-child(4) .feature-icon {
          background: linear-gradient(135deg, #ec4899, #be185d);
        }

        .feature-card:nth-child(5) .feature-icon {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }

        .feature-card:nth-child(6) .feature-icon {
          background: linear-gradient(135deg, #14b8a6, #0d9488);
        }

        .feature-card h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }

        .feature-card p {
          font-size: 1rem;
          color: #94a3b8;
          line-height: 1.7;
          position: relative;
          z-index: 1;
        }

        .stats {
          display: flex;
          justify-content: center;
          gap: 60px;
          flex-wrap: wrap;
          padding: 60px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .stat {
          text-align: center;
        }

        .stat-number {
          font-size: 3rem;
          font-weight: 800;
          background: linear-gradient(135deg, #10b981, #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 0.95rem;
          color: #64748b;
          font-weight: 500;
        }

        .benefits {
          margin-top: 80px;
          text-align: center;
        }

        .benefits h2 {
          font-size: 2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 40px;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
        }

        .benefit-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 32px 24px;
          transition: all 0.3s ease;
        }

        .benefit-item:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(16, 185, 129, 0.3);
          transform: translateY(-4px);
        }

        .benefit-icon {
          font-size: 2.5rem;
          margin-bottom: 16px;
        }

        .benefit-item h4 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 8px;
        }

        .benefit-item p {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .container { padding: 60px 24px; }
          .hero h1 { font-size: 2.5rem; }
          .hero p { font-size: 1.1rem; }
          .features-grid { grid-template-columns: 1fr; gap: 20px; }
          .feature-card { padding: 32px; }
          .stats { gap: 40px; }
          .stat-number { font-size: 2.5rem; }
        }
      `}</style>

      <div className="container">
        <div className="hero">
          <h1>
            Your <span className="highlight">AI-Powered</span><br />Fitness Companion
          </h1>
          <p>
            Transform your health journey with personalized workout plans, real-time coaching, 
            and intelligent progress tracking. Achieve your fitness goals faster with data-driven insights.
          </p>
          <button className="cta-primary" onClick={() => navigate('/intake')}>
            Get Started
            <span>→</span>
          </button>
        </div>

        <div className="features-grid">
          <Link to="/dashboard" className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Smart Dashboard</h3>
            <p>Track your BMI, calories, water intake, and workout streaks with beautiful visualizations and real-time updates.</p>
          </Link>

          <Link to="/trainer" className="feature-card">
            <div className="feature-icon">🏋️</div>
            <h3>AI Trainer</h3>
            <p>Get real-time posture correction and form analysis powered by computer vision technology.</p>
          </Link>

          <Link to="/reports" className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Health Analytics</h3>
            <p>Upload medical reports and receive personalized health insights with detailed trend analysis.</p>
          </Link>

          <Link to="/chat" className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI Assistant</h3>
            <p>24/7 fitness guidance, custom meal plans, and instant answers to all your health questions.</p>
          </Link>

          <Link to="/myplan" className="feature-card">
            <div className="feature-icon">📋</div>
            <h3>My Plan</h3>
            <p>View your personalized workout routines, yoga sessions, and daily fitness schedule tailored to your goals.</p>
          </Link>

          <Link to="/nutrition" className="feature-card">
            <div className="feature-icon">🥗</div>
            <h3>Nutrition</h3>
            <p>Calculate your daily calorie needs and get customized meal recommendations based on your profile.</p>
          </Link>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-number">Smart</div>
            <div className="stat-label">Workout Plans</div>
          </div>
          <div className="stat">
            <div className="stat-number">Track</div>
            <div className="stat-label">Your Progress</div>
          </div>
          <div className="stat">
            <div className="stat-number">Achieve</div>
            <div className="stat-label">Your Goals</div>
          </div>
        </div>

        <div className="benefits">
          <h2>Why Choose Our Platform?</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">🍎</div>
              <h4>Nutrition Plans</h4>
              <p>Custom meal plans based on your dietary preferences and health conditions</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">📊</div>
              <h4>Progress Reports</h4>
              <p>Detailed analytics on weight, BMI, calories, and workout consistency</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🔔</div>
              <h4>Smart Reminders</h4>
              <p>Stay on track with water, meal, and workout notifications</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
