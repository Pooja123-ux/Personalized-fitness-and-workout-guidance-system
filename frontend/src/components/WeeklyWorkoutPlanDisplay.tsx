import { useEffect, useState } from 'react'
import api from '../api'

interface WeeklyWorkoutPlan {
  day: string
  target_area: string
  exercises: ExerciseWithSets[]
  total_duration: string
  calories_burned: number
}

interface ExerciseWithSets {
  id: string
  name: string
  bodyPart: string
  equipment: string
  gifUrl: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
  sets: number
  reps: string
  rest_time: string
  calories_burned: number
}

interface BackendWorkoutItem {
  name: string
  body_part: string
  equipment: string
  reps: string
  sets: string
  calories_burned: number
  instructions: string[]
}

interface BackendDailyWorkoutPlan {
  day: string
  focus_area: string
  warmup: BackendWorkoutItem[]
  main_exercises: BackendWorkoutItem[]
  cooldown: BackendWorkoutItem[]
  total_duration: number
  estimated_calories: number
}

interface BackendWeeklyWorkoutPlan {
  workouts: Record<string, BackendDailyWorkoutPlan>
}

function WeeklyWorkoutPlanDisplay() {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyWorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>('Monday')
  const [error, setError] = useState<string | null>(null)
  const [workoutCompletedToday, setWorkoutCompletedToday] = useState(false)
  const [workoutSaving, setWorkoutSaving] = useState(false)
  const [planHint, setPlanHint] = useState<string>('')

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const toLocalIsoDate = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const todayIso = toLocalIsoDate(new Date())
  const todayDayName = new Date(`${todayIso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })

  const getAreaAccent = (targetArea: string) => {
    const map: { [key: string]: { icon: string; bg: string; border: string; text: string } } = {
      'Upper Body': { icon: 'UP', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa' },
      'Lower Body': { icon: 'LOW', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', text: '#22d3ee' },
      Core: { icon: 'CORE', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24' },
      'Full Body': { icon: 'FULL', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
      Cardio: { icon: 'HIIT', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171' },
      Flexibility: { icon: 'MOB', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa' },
      'Core & Flexibility': { icon: 'MOB', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa' },
      'Rest Day': { icon: 'REST', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8' },
      Rest: { icon: 'REST', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8' }
    }
    return map[targetArea] || map['Full Body']
  }

  const mapBackendPlan = (plan: BackendWeeklyWorkoutPlan): WeeklyWorkoutPlan[] => {
    const workouts = plan?.workouts || {}
    return dayOrder.map((day) => {
      const d = workouts[day]
      if (!d) {
        return { day, target_area: 'Rest Day', exercises: [], total_duration: '0m', calories_burned: 0 }
      }

      const merged = [...(d.warmup || []), ...(d.main_exercises || []), ...(d.cooldown || [])]
      const exercises: ExerciseWithSets[] = merged.map((ex, idx) => ({
        id: `${day}-${idx}-${String(ex.name || '').toLowerCase().replace(/\s+/g, '-')}`,
        name: ex.name || 'Exercise',
        bodyPart: ex.body_part || 'Full Body',
        equipment: ex.equipment || 'Body Weight',
        gifUrl: '',
        target: ex.body_part || 'General',
        secondaryMuscles: [],
        instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
        sets: Number(ex.sets || 3),
        reps: String(ex.reps || '10-12'),
        rest_time: '60s',
        calories_burned: Number(ex.calories_burned || 0)
      }))

      return {
        day,
        target_area: d.focus_area || 'Workout',
        exercises,
        total_duration: `${Number(d.total_duration || 0)}m`,
        calories_burned: Number(d.estimated_calories || 0)
      }
    })
  }

  const fetchWorkoutPlan = async () => {
    try {
      setLoading(true)
      let response: any
      try {
        response = await api.get('/workout-plan/weekly-workout-plan?force_refresh=true')
      } catch {
        response = await api.get('/workout-plan/public/weekly-workout-plan?force_refresh=true')
      }

      const backendPlan = response?.data?.weekly_workout_plan as BackendWeeklyWorkoutPlan | undefined
      if (!backendPlan?.workouts) throw new Error('Invalid workout plan response')

      const mapped = mapBackendPlan(backendPlan)
      setWeeklyPlan(mapped)
      setSelectedDay((prev) => {
        if (mapped.some((p) => p.day === prev)) return prev
        const todayPlan = mapped.find((p) => p.day === todayDayName)
        return todayPlan?.day || mapped[0]?.day || 'Monday'
      })
      setPlanHint(String(response?.data?.message || 'Personalized from profile, report, and progress'))
      setError(null)
    } catch (err) {
      console.error('Error fetching workout recommendations:', err)
      setError('Could not load personalized workout recommendations right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkoutPlan()
  }, [])

  useEffect(() => {
    const fetchTodayWorkoutAdherence = async () => {
      try {
        const res = await api.get(`/adherence/workout/day/${todayIso}`)
        setWorkoutCompletedToday(Boolean(res?.data?.workout_completed || false))
      } catch {
        setWorkoutCompletedToday(false)
      }
    }
    fetchTodayWorkoutAdherence()
  }, [todayIso])

  const selectedDayPlan = weeklyPlan.find((plan) => plan.day === selectedDay) || weeklyPlan[0] || null

  const markTodayWorkout = async () => {
    if (selectedDay !== todayDayName) return
    if (!selectedDayPlan) return
    const nextCompleted = !workoutCompletedToday
    const calories = Number(selectedDayPlan.calories_burned || 0)
    try {
      setWorkoutSaving(true)
      await api.post('/adherence/workout/day', {
        date: todayIso,
        completed: nextCompleted,
        calories_burned: nextCompleted ? calories : 0
      })
      setWorkoutCompletedToday(nextCompleted)
      window.dispatchEvent(new Event('adherence-updated'))
    } catch (err) {
      console.error('Failed to update workout adherence from weekly plan:', err)
    } finally {
      setWorkoutSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>Loading workout recommendations...</div>

  if (error) {
    return (
      <div style={{ padding: '28px', textAlign: 'center' }}>
        <div style={{ marginBottom: 12, color: '#ef4444' }}>{error}</div>
        <button
          onClick={fetchWorkoutPlan}
          style={{ border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '10px 14px', fontWeight: 700 }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="workout-reco">
      <style>{`
        .workout-reco { font-family: 'Sora', sans-serif; color: #ffffff; }
        .workout-days { display: grid; grid-template-columns: repeat(7, minmax(80px, 1fr)); gap: 8px; margin-bottom: 12px; }
        .workout-day-btn {
          border: 1px solid #475569;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border-radius: 12px;
          padding: 8px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #e2e8f0;
          cursor: pointer;
          transition: all 180ms ease;
        }
        .workout-day-btn.active {
          transform: translateY(-1px);
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-color: #0f172a;
          color: #fff;
          box-shadow: 0 10px 20px -14px rgba(15, 23, 42, 0.95);
        }
        .workout-head {
          border: 1px solid #475569;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .exercise-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .exercise-card {
          border: 1px solid #475569;
          border-radius: 16px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          backdrop-filter: blur(10px);
          padding: 14px;
        }
        .exercise-actions { display: flex; gap: 8px; margin-top: 12px; }
        .btn-link, .btn-ai {
          border: none;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          transition: all 180ms ease;
        }
        .btn-link { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .btn-link:hover { background: rgba(59, 130, 246, 0.25); }
        .btn-ai { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #fff; box-shadow: 0 10px 20px -14px rgba(59, 130, 246, 0.5); }
        .btn-ai:hover { box-shadow: 0 10px 25px -10px rgba(59, 130, 246, 0.6); }
        @media (max-width: 980px) {
          .workout-days { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .exercise-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="workout-days">
        {weeklyPlan.map((plan) => {
          const accent = getAreaAccent(plan.target_area)
          return (
            <button
              key={plan.day}
              className={`workout-day-btn ${selectedDay === plan.day ? 'active' : ''}`}
              onClick={() => setSelectedDay(plan.day)}
              title={`${plan.day} - ${plan.target_area}`}
            >
              <div>{plan.day.slice(0, 3).toUpperCase()}</div>
              <div style={{ opacity: 0.9, fontSize: '0.65rem' }}>{accent.icon}</div>
            </button>
          )
        })}
      </div>

      {selectedDayPlan && (
        <>
          <div className="workout-head">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>SELECTED SESSION</div>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', color: '#ffffff' }}>{selectedDayPlan.day} | {selectedDayPlan.target_area}</h3>
                {planHint && <div style={{ marginTop: 5, fontSize: '0.72rem', color: '#93c5fd', fontWeight: 700 }}>{planHint}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ borderRadius: 10, background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '6px 10px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {selectedDayPlan.exercises.length} exercises
                </div>
                <div style={{ borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 10px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {selectedDayPlan.total_duration}
                </div>
                <div style={{ borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '6px 10px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {selectedDayPlan.calories_burned} kcal
                </div>
                <button
                  type="button"
                  disabled={selectedDay !== todayDayName || workoutSaving}
                  onClick={markTodayWorkout}
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    background: selectedDay === todayDayName ? (workoutCompletedToday ? '#3b82f6' : 'linear-gradient(135deg, #3b82f6, #2563eb)') : 'rgba(148, 163, 184, 0.3)',
                    color: '#fff',
                    padding: '6px 10px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: selectedDay === todayDayName && !workoutSaving ? 'pointer' : 'not-allowed',
                    opacity: workoutSaving ? 0.75 : 1
                  }}
                  title={selectedDay === todayDayName ? '' : `You can mark only ${todayDayName}`}
                >
                  {workoutSaving
                    ? 'Saving...'
                    : selectedDay === todayDayName
                      ? (workoutCompletedToday ? 'Mark Today Not Finished' : 'Mark Today Finished')
                      : `Only ${todayDayName}`}
                </button>
              </div>
            </div>
          </div>

          {selectedDayPlan.target_area === 'Rest Day' || selectedDayPlan.target_area === 'Rest' ? (
            <div style={{ border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 16, background: 'rgba(148, 163, 184, 0.1)', padding: 20, textAlign: 'center', color: '#e2e8f0' }}>
              <h4 style={{ margin: 0 }}>Rest and Recovery</h4>
              <p style={{ margin: '8px 0 0', fontSize: '0.92rem' }}>Use this day for walking, stretching, hydration, and sleep quality.</p>
            </div>
          ) : (
            <div className="exercise-grid">
              {selectedDayPlan.exercises.map((exercise, index) => {
                const accent = getAreaAccent(selectedDayPlan.target_area)
                return (
                  <article key={`${exercise.id}-${index}`} className="exercise-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#60a5fa' }}>{index + 1}. {exercise.name}</h4>
                      <span
                        style={{
                          background: accent.bg,
                          color: accent.text,
                          border: `1px solid ${accent.border}`,
                          borderRadius: 8,
                          padding: '3px 7px',
                          fontSize: '0.65rem',
                          fontWeight: 800
                        }}
                      >
                        {exercise.target}
                      </span>
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{exercise.reps} reps</span>
                      <span style={{ borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{exercise.sets} sets</span>
                      <span style={{ borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>Rest {exercise.rest_time}</span>
                      <span style={{ borderRadius: 8, background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{exercise.equipment || 'Bodyweight'}</span>
                    </div>

                    {exercise.instructions?.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: 10 }}>
                        {exercise.instructions.slice(0, 3).map((step, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>
                            {idx + 1}. {step}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="exercise-actions">
                      <a
                        href={`https://workoutguru.fit/exercises/${exercise.name.toLowerCase().replace(/\s+/g, '-')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-link"
                      >
                        View guide
                      </a>
                      <button
                        className="btn-ai"
                        onClick={() => {
                          const workoutPlan = selectedDayPlan.exercises.map((ex) => ({
                            name: ex.name,
                            target: ex.target,
                            gifUrl: ex.gifUrl,
                            gif_url: ex.gifUrl,
                            instructions: ex.instructions,
                            sets: ex.sets,
                            reps: ex.reps,
                            repetitions: `${ex.sets}x${ex.reps}`,
                            calories_burned: ex.calories_burned
                          }))
                          sessionStorage.setItem('workoutPlan', JSON.stringify(workoutPlan))
                          window.location.href = `/trainer?name=${encodeURIComponent(exercise.name)}&reps=${encodeURIComponent(
                            `${exercise.sets}x${exercise.reps}`
                          )}&gif=${encodeURIComponent(exercise.gifUrl)}&idx=${index}`
                        }}
                      >
                        Start AI trainer
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default WeeklyWorkoutPlanDisplay
