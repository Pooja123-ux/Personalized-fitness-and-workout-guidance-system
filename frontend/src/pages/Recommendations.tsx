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
  const [weeklyCalories, setWeeklyCalories] = useState<number | null>(null)
  const [healthAlerts, setHealthAlerts] = useState<any[]>([])
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
    if (!profile) {
      setLoadError('Profile not found. Please complete your profile first.')
      return
    }
    Promise.all([
      api.get('/recommendations'),
      api.get('/meal-plan/weekly-plan'),
      api.get('/workout-plan/weekly-workout-plan'),
      api.get('/reports')
    ])
      .then(([recResponse, weeklyResponse, workoutResponse, reportsResponse]) => {
        setRec(recResponse.data)
        setLoadError(null)

        const weeklyMeals = weeklyResponse?.data?.weekly_plan?.meals
        if (!weeklyMeals || typeof weeklyMeals !== 'object') {
          setPlannedDaily({ calories: null, protein: null })
        } else {
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
        }

        const weeklyCaloriesBurned = workoutResponse?.data?.weekly_workout_plan?.weekly_calories
        setWeeklyCalories(weeklyCaloriesBurned != null ? Math.round(weeklyCaloriesBurned) : null)

        const reports = Array.isArray(reportsResponse.data) ? reportsResponse.data : []
        const alerts: any[] = []
        reports.forEach((report: any) => {
          if (report.summary) {
            try {
              const data = JSON.parse(report.summary)
              const conditions = Array.isArray(data.conditions) ? data.conditions : []
              const labs = data.labs || {}
              const foodsToAvoid = Array.isArray(data.foods_to_avoid) ? data.foods_to_avoid : []
              
              conditions.forEach((condition: string) => {
                const conditionLower = condition.toLowerCase()
                if (conditionLower.includes('diabetes') || conditionLower.includes('hypertension') || conditionLower.includes('anemia')) {
                  alerts.push({ condition, labs, foodsToAvoid })
                }
              })
            } catch {}
          }
        })
        setHealthAlerts(alerts)
      })
      .catch((e) => {
        console.error('Failed to load recommendations summary:', e)
        const errorMsg = e?.response?.data?.detail || e?.message || 'Unknown error'
        setLoadError(`Unable to load recommendations: ${errorMsg}`)
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
          --bg: #0f172a;
          --ink: #ffffff;
          --muted: #94a3b8;
          --card: rgba(255, 255, 255, 0.05);
          --line: rgba(255, 255, 255, 0.1);
          --teal: #10b981;
          --teal-soft: rgba(16, 185, 129, 0.1);
          --amber: #f59e0b;
          --amber-soft: rgba(245, 158, 11, 0.1);
        }

        .recommendations-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          padding: 20px 14px 28px;
          font-family: 'Sora', sans-serif;
          color: var(--ink);
          position: relative;
          overflow-x: hidden;
          width: 100%;
        }

        .recommendations-page::before {
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

        .recommendations-shell {
          max-width: 1080px;
          margin: 0 auto;
          animation: fade-up 320ms ease-out;
          position: relative;
          z-index: 1;
          width: 100%;
          overflow-x: hidden;
        }

        .recommendations-shell,
        .recommendations-shell * {
          font-family: 'Sora', sans-serif;
          box-sizing: border-box;
        }

        .hero {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          color: #ffffff;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 24px 22px;
          box-shadow: 0 24px 34px -28px rgba(0, 0, 0, 0.3);
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

        .hero-stat:nth-child(1) {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .hero-stat:nth-child(1) .hero-value {
          color: #fbbf24;
        }

        .hero-stat:nth-child(2) {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .hero-stat:nth-child(2) .hero-value {
          color: #f87171;
        }

        .hero-stat:nth-child(3) {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%);
          border-color: rgba(6, 182, 212, 0.3);
        }

        .hero-stat:nth-child(3) .hero-value {
          color: #22d3ee;
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
          word-break: break-word;
        }

        .tabs {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
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
          color: #e2e8f0;
          background: transparent;
          transition: all 180ms ease;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #ffffff;
          box-shadow: 0 10px 20px -14px rgba(16, 185, 129, 0.5);
        }

        .content-wrap {
          margin-top: 14px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
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
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(6, 182, 212, 0.3);
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          color: #ffffff;
          overflow: hidden;
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
          color: #94a3b8;
          font-weight: 700;
        }

        .hydration-meter-value {
          font-size: 1.05rem;
          color: #22d3ee;
          font-weight: 800;
          white-space: nowrap;
        }

        .calorie-burn-summary {
          margin-top: 14px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          overflow: hidden;
        }

        .burn-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .burn-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .burn-title {
          font-weight: 800;
          font-size: 0.95rem;
          color: #ffffff;
        }

        .burn-subtitle {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 2px;
        }

        .burn-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #f87171;
          text-align: right;
        }

        .burn-daily {
          font-size: 0.8rem;
          color: #94a3b8;
          text-align: right;
          margin-top: 2px;
        }

        .health-alert-banner {
          margin-bottom: 20px;
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(185, 28, 28, 0.1) 100%);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(239, 68, 68, 0.5);
          border-radius: 16px;
          padding: 18px 20px;
          box-shadow: 0 8px 16px -8px rgba(220, 38, 38, 0.4);
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .alert-icon {
          font-size: 1.8rem;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }

        .alert-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 800;
          color: #fecaca;
        }

        .alert-card {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 12px;
          border-left: 4px solid #ef4444;
        }

        .alert-card:last-child {
          margin-bottom: 0;
        }

        .alert-condition {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .condition-badge {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .lab-value {
          background: rgba(239, 68, 68, 0.2);
          color: #fecaca;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 700;
        }

        .lab-value.critical {
          background: rgba(220, 38, 38, 0.3);
          border: 1px solid #ef4444;
          animation: blink 1.5s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .alert-foods {
          margin-top: 10px;
        }

        .foods-label {
          font-size: 0.9rem;
          font-weight: 700;
          color: #fca5a5;
          margin-bottom: 8px;
        }

        .foods-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .food-tag {
          background: rgba(239, 68, 68, 0.2);
          color: #fecaca;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 760px) {
          .recommendations-page { padding: 16px 10px 24px; }
          .hero { padding: 18px 16px; border-radius: 20px; }
          .hero-grid { grid-template-columns: 1fr; gap: 10px; }
          .hero-value { font-size: 1.2rem; }
          .hero-stat { min-height: 75px; padding: 10px; }
          .hydration { flex-direction: column; align-items: flex-start; padding: 12px 14px; }
          .hydration-meter { text-align: left; min-width: 0; width: 100%; }
          .tab-btn { text-align: center; font-size: 0.8rem; padding: 10px 12px; }
          .calorie-burn-summary { flex-direction: column; align-items: flex-start; padding: 14px 16px; }
          .burn-value { font-size: 1.4rem; text-align: left; }
          .burn-daily { text-align: left; }
          .burn-header { width: 100%; }
          .content-wrap { padding: 12px; border-radius: 18px; }
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

        {weeklyCalories != null && (
          <div className="calorie-burn-summary">
            <div className="burn-header">
              <span className="burn-icon">🔥</span>
              <div>
                <div className="burn-title">Weekly Calorie Burn</div>
                <div className="burn-subtitle">Estimated from your workout plan</div>
              </div>
            </div>
            <div className="burn-value">{weeklyCalories.toLocaleString()} kcal</div>
            <div className="burn-daily">~{Math.round(weeklyCalories / 7)} kcal/day</div>
          </div>
        )}

        <div style={{ marginTop: 14, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.1) 100%)', backdropFilter: 'blur(10px)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: '1.8rem' }}>💪</span>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>Best Exercises for Muscle Growth</div>
          </div>
          <div style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.6 }}>
            Compound exercises like squats, deadlifts, bench press, pull-ups, rows, and overhead press are the most effective for building overall muscle mass.
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

