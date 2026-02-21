import { useState, useEffect } from 'react'
import api from '../api'

interface WeeklyWorkoutPlan {
  day: string;
  target_area: string;
  exercises: Array<{
    id: string;
    name: string;
    bodyPart: string;
    equipment: string;
    gifUrl: string;
    target: string;
    secondaryMuscles: string[];
    instructions: string[];
  }>;
  total_duration: string;
  calories_burned: number;
}

interface ExerciseWithSets {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
  sets: number;
  reps: string;
  rest_time: string;
}

function WeeklyWorkoutPlanDisplay() {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyWorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [exercisesData, setExercisesData] = useState<any[]>([])

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const targetAreas = ['Upper Body', 'Lower Body', 'Core', 'Full Body', 'Cardio', 'Flexibility', 'Rest Day']

  useEffect(() => {
    fetchWeeklyWorkoutPlan()
    fetchExercisesData()
  }, [])

  const fetchExercisesData = async () => {
    try {
      // Load exercises from local JSON file
      const response = await fetch('/exercises.json')
      const data = await response.json()
      setExercisesData(data)
      console.log(`Loaded ${data.length} exercises from dataset`)
      console.log('Sample exercise:', data[0])
      
      // Generate plan after data is loaded
      const generatedPlan = generateWeeklyWorkoutPlanFromDataset(data)
      console.log('Generated plan:', generatedPlan)
      setWeeklyPlan(generatedPlan)
      setSelectedDay(generatedPlan[0]?.day || 'Monday')
    } catch (error) {
      console.error('Error fetching exercises data:', error)
    }
  }

  const fetchWeeklyWorkoutPlan = async () => {
    try {
      setLoading(true)
      // Plan will be generated after exercises data is loaded
    } catch (error) {
      console.error('Error fetching weekly workout plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateWeeklyWorkoutPlanFromDataset = (exercisesData: any[]): WeeklyWorkoutPlan[] => {
    // Map body parts to target areas
    const bodyPartToTargetArea: { [key: string]: string } = {
      'waist': 'Core',
      'upper legs': 'Lower Body',
      'lower legs': 'Lower Body',
      'back': 'Upper Body',
      'chest': 'Upper Body',
      'upper arms': 'Upper Body',
      'lower arms': 'Upper Body',
      'cardio': 'Cardio'
    }

    // Generate reps/sets based on target area
    const getRepsAndSets = (targetArea: string) => {
      const repsSets: { [key: string]: { reps: string; sets: number; rest: string } } = {
        'Upper Body': { reps: '10-12', sets: 4, rest: '60s' },
        'Lower Body': { reps: '12-15', sets: 4, rest: '90s' },
        'Core': { reps: '15-20', sets: 3, rest: '45s' },
        'Full Body': { reps: '8-12', sets: 4, rest: '90s' },
        'Cardio': { reps: '30-45 seconds', sets: 4, rest: '30s' },
        'Flexibility': { reps: '30 seconds hold', sets: 3, rest: '15s' }
      }
      return repsSets[targetArea] || { reps: '10-12', sets: 3, rest: '60s' }
    }

    // Group exercises by body part
    const exercisesByBodyPart = exercisesData.reduce((acc, exercise) => {
      const bodyPart = exercise.bodyPart
      if (!acc[bodyPart]) {
        acc[bodyPart] = []
      }
      acc[bodyPart].push(exercise)
      return acc
    }, {} as { [key: string]: any[] })

    // Generate weekly plan with balanced target areas
    const weeklySchedule = [
      { day: 'Monday', target_area: 'Upper Body' },
      { day: 'Tuesday', target_area: 'Lower Body' },
      { day: 'Wednesday', target_area: 'Core' },
      { day: 'Thursday', target_area: 'Cardio' },
      { day: 'Friday', target_area: 'Full Body' },
      { day: 'Saturday', target_area: 'Flexibility' },
      { day: 'Sunday', target_area: 'Rest Day' }
    ]

    return weeklySchedule.map(schedule => {
      const targetArea = schedule.target_area
      let exercises: ExerciseWithSets[] = []

      if (targetArea === 'Rest Day') {
        exercises = []
      } else if (targetArea === 'Full Body') {
        // For Full Body, mix exercises from all body parts
        const allBodyParts = Object.keys(bodyPartToTargetArea)
        allBodyParts.forEach(bodyPart => {
          if (exercisesByBodyPart[bodyPart]) {
            exercises = exercises.concat(exercisesByBodyPart[bodyPart].slice(0, 1)) // Take 1 exercise per body part
          }
        })
        // Remove duplicates and limit to 6 exercises
        exercises = exercises.filter((exercise, index, self) => 
          index === self.findIndex(e => e.id === exercise.id)
        ).slice(0, 6)
      } else if (targetArea === 'Flexibility') {
        // For Flexibility, find stretching exercises
        const flexibilityKeywords = ['stretch', 'yoga', 'mobility', 'flex']
        exercises = exercisesData.filter(exercise => 
          flexibilityKeywords.some(keyword => 
            exercise.name.toLowerCase().includes(keyword) || 
            exercise.target.toLowerCase().includes(keyword)
          )
        ).slice(0, 6)
      } else {
        // Find relevant body parts for this target area
        const relevantBodyParts = Object.keys(bodyPartToTargetArea).filter(
          bodyPart => bodyPartToTargetArea[bodyPart] === targetArea
        )

        // Get exercises from relevant body parts
        relevantBodyParts.forEach(bodyPart => {
          if (exercisesByBodyPart[bodyPart]) {
            exercises = exercises.concat(exercisesByBodyPart[bodyPart].slice(0, 3)) // Take 3 exercises per body part
          }
        })

        // Remove duplicates and limit to reasonable number
        exercises = exercises.filter((exercise, index, self) => 
          index === self.findIndex(e => e.id === exercise.id)
        ).slice(0, 6) // Limit to 6 exercises per day
      }

      // Add reps and sets to exercises
      const repsSets = getRepsAndSets(targetArea)
      exercises = exercises.map(exercise => ({
        ...exercise,
        sets: repsSets.sets,
        reps: repsSets.reps,
        rest_time: repsSets.rest
      }))

      return {
        day: schedule.day,
        target_area: schedule.target_area,
        exercises,
        total_duration: calculateRealisticDuration(targetArea, exercises.length),
        calories_burned: targetArea === 'Rest Day' ? 0 : Math.floor(parseInt(calculateRealisticDuration(targetArea, exercises.length)) * 8)
      }
    })
  }

  const calculateRealisticDuration = (targetArea: string, exerciseCount: number): string => {
    // Base duration in minutes for each target area
    const baseDurations: { [key: string]: number } = {
      'Upper Body': 35,
      'Lower Body': 40,
      'Core': 35,
      'Full Body': 35,
      'Cardio': 30,
      'Flexibility': 30,
      'Rest Day': 0  // Rest Day is 0 minutes
    }
    
    // Add variation based on exercise count
    const baseDuration = baseDurations[targetArea] || 30
    const variation = Math.floor(Math.random() * 10) - 5 // ±5 minutes variation
    const totalMinutes = targetArea === 'Rest Day' ? 0 : Math.max(20, Math.min(45, baseDuration + variation))
    
    return `${totalMinutes}m`
  }

  const getTargetAreaIcon = (targetArea: string) => {
    const icons: { [key: string]: string } = {
      'Upper Body': '💪',
      'Lower Body': '🦵',
      'Core': '🎯',
      'Full Body': '🏋️',
      'Cardio': '🏃',
      'Flexibility': '🧘',
      'Rest Day': '😴'
    }
    return icons[targetArea] || '🏋️'
  }

  const getDifficultyColor = (target: string) => {
    const colors: { [key: string]: string } = {
      'abs': '#10b981',
      'hip flexors': '#10b981',
      'obliques': '#10b981',
      'quadriceps': '#10b981',
      'hamstrings': '#10b981',
      'glutes': '#10b981',
      'lats': '#10b981',
      'biceps': '#10b981',
      'triceps': '#10b981',
      'shoulders': '#10b981',
      'forearms': '#10b981',
      'pectorals': '#10b981',
      'cardiovascular system': '#f59e0b',
      'calves': '#10b981',
      'ankle stabilizers': '#10b981',
      'rhomboids': '#10b981',
      'spine': '#10b981',
      'adductors': '#10b981',
      'core': '#10b981'
    }
    return colors[target] || '#6b7280'
  }

  const getMuscleGroupColor = (muscle: string) => {
    const colors: { [key: string]: string } = {
      'Chest': '#ef4444',
      'Back': '#3b82f6',
      'Shoulders': '#8b5cf6',
      'Biceps': '#ec4899',
      'Triceps': '#f59e0b',
      'Quads': '#10b981',
      'Glutes': '#f97316',
      'Hamstrings': '#06b6d4',
      'Calves': '#84cc16',
      'Abs': '#dc2626',
      'Obliques': '#7c3aed',
      'Lower Abs': '#a855f7',
      'Core': '#9333ea',
      'Hips': '#ea580c',
      'Legs': '#059669',
      'Arms': '#0891b2',
      'Full Body': '#6366f1',
      'Ankle': '#0c4a6e',
      'Hip Flexors': '#fbbf24'
    }
    return colors[muscle] || '#6b7280'
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#64748b' }}>Loading weekly workout plan...</div>
      </div>
    )
  }

  const selectedDayPlan = weeklyPlan.find(plan => plan.day === selectedDay)

  return (
    <div style={{ padding: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <style>{`
        .weekly-workout-container {
          max-width: 100%;
          margin: 0 auto;
        }
        
        .day-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 25px;
          overflow-x: auto;
          padding: 5px;
        }
        
        .day-btn {
          flex: 1;
          min-width: 100px;
          padding: 12px 8px;
          border: none;
          border-radius: 12px;
          background: #f1f5f9;
          color: #64748b;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        
        .day-btn.active {
          background: #4361ee;
          color: white;
          box-shadow: 0 4px 12px rgba(67, 97, 238, 0.3);
        }
        
        .day-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .workout-summary {
          background: linear-gradient(135deg, #4361ee 0%, #7209b7 100%);
          color: white;
          padding: 25px;
          border-radius: 20px;
          margin-bottom: 25px;
          box-shadow: 0 10px 25px rgba(67, 97, 238, 0.2);
        }
        
        .exercise-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 15px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          transition: all 0.3s;
        }
        
        .exercise-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        
        .muscle-group-tag {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
          color: white;
          margin: 2px;
        }
        
        .equipment-tag {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
          margin: 2px;
        }
        
        .difficulty-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 700;
          color: white;
          text-transform: uppercase;
        }
      `}</style>

      <div className="weekly-workout-container">
        <h2 style={{ margin: '0 0 20px', fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>
          
        </h2>

        <div className="day-selector">
          {weeklyPlan.map((plan) => (
            <button
              key={plan.day}
              className={`day-btn ${selectedDay === plan.day ? 'active' : ''}`}
              onClick={() => setSelectedDay(plan.day)}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
                {getTargetAreaIcon(plan.target_area)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {plan.day.slice(0, 3)}
              </div>
              <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                {plan.target_area === 'Rest Day' ? 'Rest' : plan.target_area.split(' ')[0]}
              </div>
            </button>
          ))}
        </div>

        {selectedDayPlan && (
          <>
            <div className="workout-summary">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px', fontSize: '1.3rem', fontWeight: 800 }}>
                    {selectedDayPlan.day} - {selectedDayPlan.target_area}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                    {selectedDayPlan.exercises.length} exercises • {selectedDayPlan.total_duration}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>
                    {selectedDayPlan.calories_burned}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>calories</div>
                </div>
              </div>
            </div>

            {selectedDayPlan.target_area === 'Rest Day' ? (
              <div style={{ 
                background: '#f0fdf4', 
                padding: '30px', 
                borderRadius: '20px', 
                textAlign: 'center',
                border: '2px solid #86efac',
                color: '#166534'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>😴</div>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800 }}>Rest & Recovery Day</h3>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
                  Your body needs time to recover and build muscle. Focus on light stretching, hydration, and nutrition today.
                </p>
              </div>
            ) : (
              <div>
                {selectedDayPlan.exercises.map((exercise: any, index: number) => (
                  <div key={index} className="exercise-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                          {index + 1}. {exercise.name}
                        </h4>
                        <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.4 }}>
                          {exercise.target}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                          <span style={{ 
                            background: '#e0e7ff', 
                            color: '#3730a3', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}>
                            {exercise.reps}
                          </span>
                          <span style={{ 
                            background: '#fef3c7', 
                            color: '#92400e', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}>
                            {exercise.sets} sets
                          </span>
                          <span style={{ 
                            background: '#e0f2fe', 
                            color: '#0c4a6e', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}>
                            Rest: {exercise.rest_time}
                          </span>
                          <span style={{ 
                            background: '#fef3c7', 
                            color: '#92400e', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}>
                            {exercise.equipment}
                          </span>
                          <span style={{ 
                            background: '#fef3c7', 
                            color: '#92400e', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}>
                            {exercise.bodyPart}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="difficulty-badge" style={{ 
                          background: getDifficultyColor(exercise.target), 
                          color: 'white' 
                        }}>
                          {exercise.target}
                        </div>
                      </div>
                    </div>

                    {exercise.instructions && exercise.instructions.length > 0 && (
                      <div style={{ 
                        marginTop: '20px', 
                        paddingTop: '20px', 
                        borderTop: '2px dashed #f1f5f9' 
                      }}>
                        <p style={{ fontWeight: 800, fontSize: '0.8rem', color: '#94a3b8', marginBottom: 12 }}>
                          EXECUTION STEPS
                        </p>
                        {exercise.instructions.map((step: string, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 10, lineHeight: 1.5 }}>
                            <span style={{ color: '#4361ee', fontWeight: 900 }}>{idx + 1}</span>
                            <span style={{ color: '#475569', fontSize: '0.95rem' }}>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                      <a
                        href={`https://workoutguru.fit/exercises/${exercise.name.toLowerCase().replace(/\s+/g, '-')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="guru-btn"
                        style={{ textDecoration: 'none' }}
                      >
                        <span>WATCH ON WORKOUT GURU</span>
                        <span style={{ fontSize: '1.1rem' }}>↗</span>
                      </a>
                      <button
                        onClick={() => {
                          // Store workout plan for AI trainer
                          const workoutPlan = selectedDayPlan.exercises.map((ex: any) => ({
                            name: ex.name,
                            target: ex.target,
                            gifUrl: ex.gifUrl,
                            instructions: ex.instructions
                          }))
                          sessionStorage.setItem('workoutPlan', JSON.stringify(workoutPlan))
                          window.location.href = `/trainer?name=${encodeURIComponent(exercise.name)}&target=${encodeURIComponent(exercise.target)}&gif=${encodeURIComponent(exercise.gifUrl)}&idx=${index}`
                        }}
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 8, 
                          background: '#10b981', 
                          color: 'white', 
                          padding: '10px 14px', 
                          borderRadius: 12, 
                          border: 'none', 
                          fontWeight: 800, 
                          cursor: 'pointer' 
                        }}
                      >
                        Start AI Trainer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default WeeklyWorkoutPlanDisplay
