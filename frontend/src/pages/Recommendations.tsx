import React, { useEffect, useState } from 'react'
import api from '../api'
import WeeklyWorkoutPlanDisplay from '../components/WeeklyWorkoutPlanDisplay'
import PersonalizedMealPlanDisplay from '../components/PersonalizedMealPlanDisplay'
import { useProfile } from '../context/ProfileContext'

class MealPlanErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: String(error?.message || 'Failed to load meal recommendations.') }
  }

  componentDidCatch(error: any) {
    console.error('Meal recommendations crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '18px', border: '1px solid #fecaca', borderRadius: 12, background: '#fff1f2', color: '#991b1b' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Meal recommendations failed to load.</div>
          <div style={{ fontSize: '0.9rem', marginBottom: 10 }}>{this.state.message}</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ border: 'none', borderRadius: 8, padding: '8px 12px', background: '#991b1b', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Recommendations() {
  const { profile } = useProfile()
  const [rec, setRec] = useState<any | null>(null)
  const [plannedDaily, setPlannedDaily] = useState<{ calories: number | null; protein: number | null }>({
    calories: null,
    protein: null
  })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'workout' | 'weekly'>('workout')
  const profileWaterLiters = Number((profile as any)?.water_l)
  const recommendationWaterLiters = Number(rec?.water_l)
  const waterTargetMl = Number.isFinite(profileWaterLiters) && profileWaterLiters > 0
    ? Math.round(profileWaterLiters * 1000)
    : Number.isFinite(recommendationWaterLiters) && recommendationWaterLiters > 0
      ? Math.round(recommendationWaterLiters * 1000)
      : 2000
  const hydrationLiters = waterTargetMl / 1000

  useEffect(() => {
    Promise.all([
      api.get('/recommendations'),
      api.get('/meal-plan/weekly-plan')
    ])
      .then(([recResponse, weeklyResponse]) => {
        setRec(recResponse.data)
        setLoadError(null)

        const weeklyMeals = weeklyResponse?.data?.weekly_plan?.meals
        if (!weeklyMeals || typeof weeklyMeals !== 'object') {
          setPlannedDaily({ calories: null, protein: null })
          return
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const todayName = dayNames[new Date().getDay()] || 'Monday'
        const todayMeals = weeklyMeals?.[todayName] || {}
        const mealTypes: Array<'breakfast' | 'lunch' | 'snacks' | 'dinner'> = ['breakfast', 'lunch', 'snacks', 'dinner']

        const allMeals = mealTypes.flatMap((mealType) => {
          const entries = todayMeals?.[mealType]
          return Array.isArray(entries) ? entries : []
        })

        const calories = allMeals.reduce((sum: number, meal: any) => sum + Number(meal?.calories || 0), 0)
        const protein = allMeals.reduce((sum: number, meal: any) => sum + Number(meal?.protein || 0), 0)

        setPlannedDaily({
          calories: Number.isFinite(calories) ? Math.round(calories) : null,
          protein: Number.isFinite(protein) ? Math.round(protein) : null
        })
      })
      .catch((e) => {
        console.error('Failed to load recommendations summary:', e)
        setLoadError('Unable to load recommendations right now. Please refresh.')
      })
  }, [])

  if (loadError) return <div style={{ padding: '48px 24px', textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{loadError}</div>
  if (!rec) return <div style={{ padding: '48px 24px', textAlign: 'center' }}>Building your recommendations...</div>

  const displayCalories = plannedDaily.calories != null ? plannedDaily.calories : (rec.daily_calories != null ? Math.round(rec.daily_calories) : null)
  const displayProtein = plannedDaily.protein != null ? plannedDaily.protein : (rec.daily_protein_g != null ? Math.round(Number(rec.daily_protein_g)) : null)

  return (
    <div className="recommendations-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');

        :root {
          --bg: #f5f7fb;
          --ink: #111827;
          --muted: #475569;
          --card: #ffffff;
          --line: #dbe3ef;
          --teal: #0f766e;
          --teal-soft: #ccfbf1;
          --amber: #b45309;
          --amber-soft: #fef3c7;
        }

        .recommendations-page {
          min-height: 100vh;
          background: #f4f6f8;
          padding: 20px 14px 28px;
          font-family: 'Sora', sans-serif;
          color: var(--ink);
        }

        .recommendations-shell {
          max-width: 1080px;
          margin: 0 auto;
          animation: fade-up 320ms ease-out;
        }

        .recommendations-shell,
        .recommendations-shell * {
          font-family: 'Sora', sans-serif;
          box-sizing: border-box;
        }

        .hero {
          background: #0f172a;
          color: #f8fafc;
          border-radius: 28px;
          border: 1px solid #1f2937;
          padding: 24px 22px;
          box-shadow: 0 24px 34px -28px rgba(15, 23, 42, 0.85);
        }

        .hero-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .hero-stat {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 12px;
          min-height: 88px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .hero-kicker {
          margin: 0;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.86;
          font-weight: 700;
        }

        .hero-value {
          margin: 6px 0 0;
          font-size: 1.45rem;
          font-weight: 800;
          color: #ffffff;
        }

        .tabs {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 8px;
          align-items: stretch;
        }

        .tab-btn {
          border: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 700;
          font-size: 0.86rem;
          letter-spacing: 0.02em;
          cursor: pointer;
          color: #334155;
          background: transparent;
          transition: all 180ms ease;
        }

        .tab-btn.active {
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 10px 20px -14px rgba(15, 23, 42, 0.9);
        }

        .content-wrap {
          margin-top: 14px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 14px;
          display: flex;
          align-items: stretch;
        }

        .content-wrap > * {
          width: 100%;
        }

        .hydration {
          margin-top: 14px;
          background: #ffffff;
          border: 1px solid #dbe3ef;
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          color: #0f172a;
        }

        .hydration-copy {
          flex: 1;
          min-width: 0;
        }

        .hydration-icon {
          min-width: 48px;
          text-align: right;
          font-size: 1.1rem;
          font-weight: 800;
        }

        .hydration-meter {
          min-width: 180px;
          text-align: right;
          display: grid;
          gap: 2px;
        }

        .hydration-meter-label {
          font-size: 0.82rem;
          color: #475569;
          font-weight: 700;
        }

        .hydration-meter-value {
          font-size: 1.05rem;
          color: #0f172a;
          font-weight: 800;
          white-space: nowrap;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 760px) {
          .hero-grid { grid-template-columns: 1fr; }
          .hero-value { font-size: 1.25rem; }
          .hydration { align-items: flex-start; }
          .hydration-icon { text-align: left; }
          .hydration-meter { text-align: left; min-width: 0; }
          .tab-btn { text-align: center; }
        }
      `}</style>

      <div className="recommendations-shell">
        <section className="hero">
          <p className="hero-kicker">Personalized Recommendation Hub</p>
          <h1 style={{ margin: '6px 0 0', fontSize: '1.45rem', lineHeight: 1.2 }}>Plan that adapts to your routine</h1>
          <div className="hero-grid">
            <div className="hero-stat">
              <p className="hero-kicker">Daily Calories</p>
              <p className="hero-value">{displayCalories != null ? displayCalories : '-'} kcal approx</p>
            </div>
            <div className="hero-stat">
              <p className="hero-kicker">Protein Target</p>
              <p className="hero-value">{displayProtein != null ? displayProtein : '-'} g approx</p>
            </div>
            <div className="hero-stat">
              <p className="hero-kicker">Water Target</p>
              <p className="hero-value">{waterTargetMl} ml approx</p>
            </div>
          </div>
        </section>

        <div className="hydration">
          <div className="hydration-copy">
            <div style={{ fontWeight: 800 }}>Hydration Reminder</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
              Stay near {hydrationLiters != null && Number.isFinite(hydrationLiters) ? hydrationLiters.toFixed(1) : '-'} liters today for recovery and focus.
            </div>
          </div>
          <div className="hydration-meter">
            <div className="hydration-meter-label">💧 Water Intake</div>
            <div className="hydration-meter-value">{waterTargetMl} approx ml</div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'workout' ? 'active' : ''}`} onClick={() => setActiveTab('workout')}>
            Workout Recommendations
          </button>
          <button className={`tab-btn ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>
            Weekly Meal Recommendations
          </button>
        </div>

        <div className="content-wrap">
          {activeTab === 'workout' ? (
            <WeeklyWorkoutPlanDisplay />
          ) : (
            <MealPlanErrorBoundary>
              <PersonalizedMealPlanDisplay />
            </MealPlanErrorBoundary>
          )}
        </div>

        {rec.test_output && (
          <div
            style={{
              marginTop: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 12,
              fontSize: '0.72rem',
              color: '#334155',
              whiteSpace: 'pre-wrap'
            }}
          >
            <strong>Debug Info:</strong>
            {rec.test_output}
          </div>
        )}
      </div>
    </div>
  )
}

export default Recommendations

