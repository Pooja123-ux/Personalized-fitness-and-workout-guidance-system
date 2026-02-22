import { useState, useEffect } from 'react'

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
}

function WeeklyWorkoutPlanDisplay() {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyWorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>('Monday')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExercisesData()
  }, [])

  const fetchExercisesData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/exercises.json')
      const data = await response.json()
      const generatedPlan = generateWeeklyWorkoutPlanFromDataset(data)
      setWeeklyPlan(generatedPlan)
      setSelectedDay(generatedPlan[0]?.day || 'Monday')
      setError(null)
    } catch (err) {
      console.error('Error fetching exercises data:', err)
      setError('Could not load workout recommendations right now.')
    } finally {
      setLoading(false)
    }
  }

  const generateWeeklyWorkoutPlanFromDataset = (dataset: any[]): WeeklyWorkoutPlan[] => {
    const bodyPartToTargetArea: { [key: string]: string } = {
      waist: 'Core',
      'upper legs': 'Lower Body',
      'lower legs': 'Lower Body',
      back: 'Upper Body',
      chest: 'Upper Body',
      'upper arms': 'Upper Body',
      'lower arms': 'Upper Body',
      cardio: 'Cardio'
    }

    const getRepsAndSets = (targetArea: string) => {
      const repsSets: { [key: string]: { reps: string; sets: number; rest: string } } = {
        'Upper Body': { reps: '10-12', sets: 4, rest: '60s' },
        'Lower Body': { reps: '12-15', sets: 4, rest: '90s' },
        Core: { reps: '15-20', sets: 3, rest: '45s' },
        'Full Body': { reps: '8-12', sets: 4, rest: '90s' },
        Cardio: { reps: '30-45 sec', sets: 4, rest: '30s' },
        Flexibility: { reps: '30 sec hold', sets: 3, rest: '15s' }
      }
      return repsSets[targetArea] || { reps: '10-12', sets: 3, rest: '60s' }
    }

    const exercisesByBodyPart = dataset.reduce((acc, exercise) => {
      const bodyPart = exercise.bodyPart
      if (!acc[bodyPart]) acc[bodyPart] = []
      acc[bodyPart].push(exercise)
      return acc
    }, {} as { [key: string]: any[] })

    const weeklySchedule = [
      { day: 'Monday', target_area: 'Upper Body' },
      { day: 'Tuesday', target_area: 'Lower Body' },
      { day: 'Wednesday', target_area: 'Core' },
      { day: 'Thursday', target_area: 'Cardio' },
      { day: 'Friday', target_area: 'Full Body' },
      { day: 'Saturday', target_area: 'Flexibility' },
      { day: 'Sunday', target_area: 'Rest Day' }
    ]

    return weeklySchedule.map((schedule) => {
      const targetArea = schedule.target_area
      let exercises: ExerciseWithSets[] = []

      if (targetArea === 'Rest Day') {
        exercises = []
      } else if (targetArea === 'Full Body') {
        Object.keys(bodyPartToTargetArea).forEach((bodyPart) => {
          if (exercisesByBodyPart[bodyPart]) exercises = exercises.concat(exercisesByBodyPart[bodyPart].slice(0, 1))
        })
        exercises = exercises.filter((exercise, index, self) => index === self.findIndex((e) => e.id === exercise.id)).slice(0, 6)
      } else if (targetArea === 'Flexibility') {
        const flexibilityKeywords = ['stretch', 'yoga', 'mobility', 'flex']
        exercises = dataset
          .filter((exercise) =>
            flexibilityKeywords.some(
              (keyword) => exercise.name.toLowerCase().includes(keyword) || exercise.target.toLowerCase().includes(keyword)
            )
          )
          .slice(0, 6)
      } else {
        const relevantBodyParts = Object.keys(bodyPartToTargetArea).filter((bodyPart) => bodyPartToTargetArea[bodyPart] === targetArea)
        relevantBodyParts.forEach((bodyPart) => {
          if (exercisesByBodyPart[bodyPart]) exercises = exercises.concat(exercisesByBodyPart[bodyPart].slice(0, 3))
        })
        exercises = exercises.filter((exercise, index, self) => index === self.findIndex((e) => e.id === exercise.id)).slice(0, 6)
      }

      const repsSets = getRepsAndSets(targetArea)
      exercises = exercises.map((exercise) => ({ ...exercise, sets: repsSets.sets, reps: repsSets.reps, rest_time: repsSets.rest }))

      const totalDuration = calculateRealisticDuration(targetArea)
      return {
        day: schedule.day,
        target_area: targetArea,
        exercises,
        total_duration: totalDuration,
        calories_burned: targetArea === 'Rest Day' ? 0 : Math.floor(parseInt(totalDuration, 10) * 8)
      }
    })
  }

  const calculateRealisticDuration = (targetArea: string): string => {
    const baseDurations: { [key: string]: number } = {
      'Upper Body': 35,
      'Lower Body': 40,
      Core: 35,
      'Full Body': 35,
      Cardio: 30,
      Flexibility: 30,
      'Rest Day': 0
    }
    const baseDuration = baseDurations[targetArea] || 30
    const variation = Math.floor(Math.random() * 10) - 5
    const totalMinutes = targetArea === 'Rest Day' ? 0 : Math.max(20, Math.min(45, baseDuration + variation))
    return `${totalMinutes}m`
  }

  const getAreaAccent = (targetArea: string) => {
    const map: { [key: string]: { icon: string; bg: string; border: string; text: string } } = {
      'Upper Body': { icon: 'UP', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
      'Lower Body': { icon: 'LOW', bg: '#ecfeff', border: '#99f6e4', text: '#115e59' },
      Core: { icon: 'CORE', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
      'Full Body': { icon: 'FULL', bg: '#ecfccb', border: '#bef264', text: '#3f6212' },
      Cardio: { icon: 'HIIT', bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
      Flexibility: { icon: 'MOB', bg: '#f0fdf4', border: '#86efac', text: '#166534' },
      'Rest Day': { icon: 'REST', bg: '#f8fafc', border: '#cbd5e1', text: '#334155' }
    }
    return map[targetArea] || map['Full Body']
  }

  const selectedDayPlan = weeklyPlan.find((plan) => plan.day === selectedDay)

  if (loading) return <div style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>Loading workout recommendations...</div>

  if (error) {
    return (
      <div style={{ padding: '28px', textAlign: 'center' }}>
        <div style={{ marginBottom: 12, color: '#b91c1c' }}>{error}</div>
        <button
          onClick={fetchExercisesData}
          style={{ border: 'none', borderRadius: 10, background: '#0f766e', color: 'white', padding: '10px 14px', fontWeight: 700 }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="workout-reco">
      <style>{`
        .workout-reco { font-family: 'Sora', sans-serif; }
        .workout-days { display: grid; grid-template-columns: repeat(7, minmax(80px, 1fr)); gap: 8px; margin-bottom: 12px; }
        .workout-day-btn {
          border: 1px solid #dbe3ef;
          background: #f8fafc;
          border-radius: 12px;
          padding: 8px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          transition: all 160ms ease;
        }
        .workout-day-btn.active {
          transform: translateY(-1px);
          background: #0f766e;
          border-color: #0f766e;
          color: #fff;
          box-shadow: 0 12px 22px -18px #0f766e;
        }
        .workout-head {
          border: 1px solid #dbe3ef;
          background: linear-gradient(120deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .exercise-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .exercise-card {
          border: 1px solid #dbe3ef;
          border-radius: 16px;
          background: #fff;
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
        }
        .btn-link { background: #ecfeff; color: #155e75; border: 1px solid #a5f3fc; }
        .btn-ai { background: #0f766e; color: #fff; }
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
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>SELECTED SESSION</div>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem' }}>{selectedDayPlan.day} • {selectedDayPlan.target_area}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ borderRadius: 10, background: '#ecfeff', color: '#155e75', padding: '6px 10px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {selectedDayPlan.exercises.length} exercises
                </div>
                <div style={{ borderRadius: 10, background: '#fffbeb', color: '#92400e', padding: '6px 10px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {selectedDayPlan.total_duration}
                </div>
                <div style={{ borderRadius: 10, background: '#eef2ff', color: '#3730a3', padding: '6px 10px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {selectedDayPlan.calories_burned} kcal
                </div>
              </div>
            </div>
          </div>

          {selectedDayPlan.target_area === 'Rest Day' ? (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 16, background: '#f8fafc', padding: 20, textAlign: 'center', color: '#334155' }}>
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
                      <h4 style={{ margin: 0, fontSize: '0.98rem' }}>{index + 1}. {exercise.name}</h4>
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
                      <span style={{ borderRadius: 8, background: '#f1f5f9', color: '#334155', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{exercise.reps} reps</span>
                      <span style={{ borderRadius: 8, background: '#f1f5f9', color: '#334155', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{exercise.sets} sets</span>
                      <span style={{ borderRadius: 8, background: '#f1f5f9', color: '#334155', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>Rest {exercise.rest_time}</span>
                      <span style={{ borderRadius: 8, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{exercise.equipment || 'Bodyweight'}</span>
                    </div>

                    {exercise.instructions?.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px dashed #dbe3ef', paddingTop: 10 }}>
                        {exercise.instructions.slice(0, 3).map((step, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 6 }}>
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
                            instructions: ex.instructions
                          }))
                          sessionStorage.setItem('workoutPlan', JSON.stringify(workoutPlan))
                          window.location.href = `/trainer?name=${encodeURIComponent(exercise.name)}&target=${encodeURIComponent(
                            exercise.target
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
