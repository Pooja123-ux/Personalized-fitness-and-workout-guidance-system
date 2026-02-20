import { useEffect, useState } from 'react'
import api from '../api'
import { workoutSteps } from '../content'
import WeeklyMealPlanDisplay from '../components/WeeklyMealPlanDisplay'

function Recommendations() {
  const [rec, setRec] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'workout' | 'diet' | 'weekly'>('workout')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.get('/recommendations').then(r => {
      console.log('Full recommendations response:', r.data);
      console.log('Test output:', r.data.test_output);
      setRec(r.data);
    })
  }, [])

  if (!rec) return <div className="loading">Designing your plan...</div>

  // Dynamic Theme Helpers
  const getMealTheme = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('breakfast')) return { bg: '#FFF4E6', text: '#FF922B', border: '#FFE8CC', icon: '🌅' }
    if (t.includes('lunch')) return { bg: '#EBFBEE', text: '#40C057', border: '#D3F9D8', icon: '🥗' }
    if (t.includes('dinner')) return { bg: '#F3F0FF', text: '#7950F2', border: '#E5DBFF', icon: '🍽️' }
    return { bg: '#E7F5FF', text: '#228BE6', border: '#D0EBFF', icon: '🍎' }
  }

  const getWorkoutLink = (name: string) => 
    `https://workoutguru.fit/exercises/${name.toLowerCase().replace(/\s+/g, '-')}`

  const startTrainer = (index: number, w: any) => {
    const plan = (rec.workouts || []).map((x: any) => ({
      name: x.name || x.title || x.exercise || x,
      repetitions: x.repetitions || x.reps || '',
      gif_url: x.gif_url || x.gifUrl || ''
    }))
    try {
      sessionStorage.setItem('workoutPlan', JSON.stringify(plan))
    } catch {}
    const name = plan[index]?.name || ''
    const reps = plan[index]?.repetitions || ''
    const gif = plan[index]?.gif_url || ''
    window.location.href = `/trainer?name=${encodeURIComponent(name)}&reps=${encodeURIComponent(reps)}&gif=${encodeURIComponent(gif)}&idx=${index}`
  }

  return (
    <div className="app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
        
        body { background: #f8fafc; margin: 0; }
        .app-container { max-width: 500px; margin: 0 auto; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b; }
        
        /* Hero Section */
        .hero { 
          background: linear-gradient(135deg, #4361ee 0%, #7209b7 100%);
          padding: 40px 30px; border-radius: 40px; color: white; margin-bottom: 25px;
          box-shadow: 0 20px 30px -10px rgba(67, 97, 238, 0.3);
          position: relative; overflow: hidden;
        }

        /* Glass Tabs */
        .tab-bar { display: flex; background: #e2e8f0; padding: 6px; border-radius: 20px; margin-bottom: 25px; }
        .tab { 
          flex: 1; border: none; padding: 14px; border-radius: 16px; font-weight: 800;
          cursor: pointer; transition: 0.2s; color: #64748b; font-size: 0.9rem;
        }
        .tab.active { background: white; color: #4361ee; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

        /* Workout Cards */
        .card { background: white; border-radius: 28px; padding: 24px; margin-bottom: 16px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        .guru-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #f1f5f9; color: #4361ee; text-decoration: none;
          padding: 12px; border-radius: 14px; font-weight: 800; font-size: 0.85rem;
          margin-top: 15px; transition: 0.2s; border: 1px solid transparent;
        }
        .guru-btn:hover { background: #eef2ff; border-color: #4361ee; }

        /* Diet Styling */
        .food-card { 
          padding: 20px; border-radius: 22px; margin-bottom: 12px; 
          border: 1px solid transparent; transition: 0.3s;
        }
        .macro-pill { 
          font-size: 0.7rem; font-weight: 800; padding: 4px 10px; 
          border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;
        }

        .water-card {
          background: #dbeafe; padding: 25px; border-radius: 30px;
          display: flex; justify-content: space-between; align-items: center;
          border: 2px solid #bfdbfe; color: #1e40af;
        }
      `}</style>

      <div className="hero">
        <h4 style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', letterSpacing: '1px' }}>FUEL & FLOW</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div>
            <h1 style={{ fontSize: '2.8rem', margin: '5px 0', fontWeight: 800 }}>{rec.daily_calories}</h1>
            <p style={{ margin: '8px 0 0', fontWeight: 600, fontSize: '0.95rem' }}>Daily Calories</p>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: 20 }}>
            <h2 style={{ fontSize: '2.2rem', margin: '0', fontWeight: 800 }}>{rec.daily_protein_g?.toFixed(0)}</h2>
            <p style={{ margin: '8px 0 0', fontWeight: 600, fontSize: '0.95rem' }}>Daily Protein (g)</p>
          </div>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'workout' ? 'active' : ''}`} onClick={() => setActiveTab('workout')}>WORKOUTS</button>
        <button className={`tab ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>NUTRITION</button>
        <button className={`tab ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>WEEKLY PLAN</button>
      </div>

      <div className="content">
        {activeTab === 'workout' && rec.workouts.map((w: any, i: number) => {
          const name = w.name || w.title || w.exercise || w
          const isExpanded = expanded === name
          return (
            <div key={i} className="card" onClick={() => setExpanded(isExpanded ? null : name)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ fontSize: '1.8rem', background: '#eef2ff', width: 60, height: 60, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏋️‍♂️</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{name}</h3>
                  <p style={{ margin: '4px 0 0 0', color: '#4361ee', fontWeight: 700, fontSize: '0.85rem' }}>{w.reps || w.repetitions || 'Default Circuit'}</p>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '1.2rem' }}>{isExpanded ? '−' : '＋'}</div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px dashed #f1f5f9' }}>
                  <p style={{ fontWeight: 800, fontSize: '0.8rem', color: '#94a3b8', marginBottom: 12 }}>EXECUTION STEPS</p>
                  {w.steps?.map((s: string, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 10, lineHeight: 1.5 }}>
                      <span style={{ color: '#4361ee', fontWeight: 900 }}>{idx + 1}</span>
                      <span style={{ color: '#475569', fontSize: '0.95rem' }}>{s}</span>
                    </div>
                  ))}
                  <a href={getWorkoutLink(name)} target="_blank" rel="noreferrer" className="guru-btn" onClick={(e) => e.stopPropagation()}>
                    <span>WATCH ON WORKOUT GURU</span>
                    <span style={{ fontSize: '1.1rem' }}>↗</span>
                  </a>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); startTrainer(i, w) }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#10b981', color: 'white', padding: '10px 14px', borderRadius: 12, border: 'none', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Start AI Trainer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {activeTab === 'diet' && rec.diet.map((meal: any, i: number) => {
          const theme = getMealTheme(meal.meal_type)
          const alternatives = rec.diet_alternatives?.[meal.meal_type] || []
          
          return (
            <div key={i} style={{ marginBottom: 35 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15, paddingLeft: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>{theme.icon}</span>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: theme.text, textTransform: 'uppercase', letterSpacing: '1px' }}>{meal.meal_type}</h2>
              </div>
              
              {/* Main Meal Card */}
              <div style={{ background: theme.bg, padding: '18px', borderRadius: '20px', border: `2px solid ${theme.border}`, marginBottom: 15 }}>
                <h5 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: theme.text }}>{meal.food_name}</h5>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Calories and Quantity */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: theme.text, fontWeight: 700, fontSize: '0.85rem' }}>{meal.calories?.toFixed(0)} <span style={{fontSize: '0.6rem'}}>KCAL</span></div>
                    <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>{meal.serving_g?.toFixed(0)}g</div>
                  </div>
                  
                  {/* Macros */}
                  <div style={{ display: 'flex', gap: 4, fontSize: '0.7rem', fontWeight: 600 }}>
                    <span style={{ color: '#ef4444', flex: 1 }}>P:{meal.protein_g?.toFixed(0)}g</span>
                    <span style={{ color: '#f59e0b', flex: 1 }}>C:{meal.carbs_g?.toFixed(0)}g</span>
                    <span style={{ color: '#ec4899', flex: 1 }}>F:{meal.fat_g?.toFixed(0)}g</span>
                  </div>
                </div>

                {/* Salad Component */}
                {meal.salad_component && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.border}`, color: theme.text, fontSize: '0.85rem', fontWeight: 600 }}>
                    🥗 <strong>Add Salad:</strong> {meal.salad_component}
                  </div>
                )}

                {/* Rice/Curry Portion */}
                {meal.rice_portion && (
                  <div style={{ marginTop: 8, color: theme.text, fontSize: '0.85rem', fontWeight: 600 }}>
                    🍚 <strong>Rice/Curry:</strong> {meal.rice_portion}
                  </div>
                )}

                {/* Pro Tip */}
                {meal.pro_tip && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.border}`, color: '#059669', fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                    {meal.pro_tip}
                  </div>
                )}
              </div>

              {/* Alternatives Grid */}
              {alternatives.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
                    <h6 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Protein Alternatives:</h6>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>High Protein</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {alternatives.slice(0, 5).map((food: any, idx: number) => {
                      // Skip if this is the same as the main meal food
                      if (food.food?.toLowerCase() === meal.food_name?.toLowerCase()) return null;
                      
                      return (
                        <div key={idx} style={{ background: 'white', padding: '14px', borderRadius: '18px', border: `2px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <h5 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 700, color: theme.text, lineHeight: 1.3 }}>{food.food || food.food_name}</h5>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {/* Calories and Quantity */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ color: theme.text, fontWeight: 700, fontSize: '0.75rem' }}>{(food.calories_serving || food.calories)?.toFixed(0)} <span style={{fontSize: '0.6rem'}}>KCAL</span></div>
                              <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.7rem' }}>{(food.serving_g)?.toFixed(0)}g</div>
                            </div>
                            
                            {/* Macros */}
                            <div style={{ display: 'flex', gap: 3, fontSize: '0.65rem', fontWeight: 800 }}>
                              <span style={{ color: '#ef4444', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', flex: 1, textAlign: 'center' }}>P:{(food.protein_g)?.toFixed(1)}g</span>
                              <span style={{ color: '#f59e0b', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', flex: 1, textAlign: 'center' }}>C:{(food.carbs_g)?.toFixed(0)}g</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Alternative Complete Daily Meal Plans */}
        {activeTab === 'diet' && rec.alternative_meal_plans && rec.alternative_meal_plans.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ margin: '20px 0 15px', fontSize: '1.3rem', fontWeight: 800, color: '#4361ee', textTransform: 'uppercase', letterSpacing: '1px' }}>
              🍽️ Alternative Complete Meal Plans
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>Pick any plan that works for you - each includes complete meals with protein targets</p>
            
            {rec.alternative_meal_plans.map((plan: any, planIdx: number) => (
              <div key={planIdx} style={{ background: '#f1f5f9', padding: 20, borderRadius: 25, marginBottom: 25, border: '2px solid #cbd5e1' }}>
                <h3 style={{ margin: '0 0 15px', fontSize: '1.1rem', fontWeight: 800, color: '#4361ee' }}>
                  Option {planIdx + 2}
                </h3>
                
                {plan.plan_meals.map((meal: any, mealIdx: number) => {
                  const theme = getMealTheme(meal.meal_type)
                  return (
                    <div key={mealIdx} style={{ marginBottom: 15, paddingBottom: 15, borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: '1.1rem' }}>{theme.icon}</span>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: theme.text, textTransform: 'uppercase' }}>
                          {meal.meal_type}
                        </h4>
                      </div>
                      
                      <div style={{ background: theme.bg, padding: '12px', borderRadius: '16px', border: `2px solid ${theme.border}`, marginBottom: 10 }}>
                        <h5 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: theme.text }}>{meal.food_name}</h5>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                          <span>{meal.serving_g?.toFixed(0)}g</span>
                          <span>P:{meal.protein_g?.toFixed(1)}g</span>
                        </div>
                      </div>

                      {meal.salad_component && (
                        <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, marginBottom: 6 }}>
                          🥗 {meal.salad_component}
                        </div>
                      )}
                      
                      {meal.rice_portion && (
                        <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, marginBottom: 6 }}>
                          🍚 {meal.rice_portion}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                <div style={{ background: 'white', padding: 12, borderRadius: 14, border: '2px solid #cbd5e1', marginTop: 15 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Calories</p>
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#4361ee' }}>{plan.daily_calories?.toFixed(0)}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Protein</p>
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: plan.protein_met ? '#059669' : '#dc2626' }}>
                        {plan.daily_protein_g?.toFixed(1)}g {plan.protein_met ? '✓' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weekly Meal Plan Tab */}
        {activeTab === 'weekly' && (
          <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <WeeklyMealPlanDisplay />
          </div>
        )}
      </div>

      {/* Protein Summary Card */}
      {activeTab === 'diet' && (
        <div style={{ background: '#fef3c7', padding: 20, borderRadius: 25, border: '2px solid #fcd34d', marginBottom: 20, color: '#92400e' }}>
          <h3 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: '1rem' }}>💪 Daily Protein Target</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}>Recommended</p>
              <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{rec.daily_protein_g?.toFixed(0)}g</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}>Your Plan</p>
              <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>
                {(rec.diet || []).reduce((sum: number, meal: any) => sum + (meal.protein_g || 0), 0).toFixed(0)}g
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 600, opacity: 0.8 }}>Coverage</p>
              <div style={{ 
                fontSize: '1.8rem', 
                fontWeight: 900,
                color: ((rec.diet || []).reduce((sum: number, meal: any) => sum + (meal.protein_g || 0), 0) / rec.daily_protein_g) >= 0.95 ? '#16a34a' : '#dc2626'
              }}>
                {(((rec.diet || []).reduce((sum: number, meal: any) => sum + (meal.protein_g || 0), 0) / rec.daily_protein_g) * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.8rem', opacity: 0.7 }}>
            Breakdown: 
            {(rec.diet || []).map((meal: any) => `${meal.meal_type}: ${meal.protein_g?.toFixed(1)}g`).join(' • ')}
          </div>
        </div>
      )}

      {/* Balanced Diet Tips */}
      {activeTab === 'diet' && (
        <div style={{ background: '#dcfce7', padding: 20, borderRadius: 25, border: '2px solid #86efac', marginBottom: 20, color: '#166534' }}>
          <h3 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: '1rem' }}>🥗 Balanced Meal Guide</h3>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            <div style={{ marginBottom: 10 }}>
              <strong>Include Fresh Salads:</strong>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: 4 }}>Add green salads, vegetable mixes, or sprouted salads to every meal for fiber, vitamins & minerals</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong>Rice & Curry Portions:</strong>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: 4 }}>Follow the quantities shown. Pair rice with dal or curry for balanced carbs + protein</div>
            </div>
            <div>
              <strong>Pro Tip:</strong>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: 4 }}>Start with main dish shown, then add salad side and moderate curry/rice to reach target calories</div>
            </div>
          </div>
        </div>
      )}

      <div className="water-card">
        <div>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Stay Hydrated</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '1rem', fontWeight: 600 }}>Target: {rec.water_l} Liters</p>
        </div>
        <div style={{ fontSize: '3rem' }}>💧</div>
      </div>

      {rec.test_output && (
        <div style={{ marginTop: 30, padding: 15, background: '#f1f5f9', borderRadius: 20, border: '1px solid #cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#475569', maxHeight: 200, overflowY: 'auto' }}>
          <strong>Debug Info:</strong>
          {rec.test_output}
        </div>
      )}
    </div>
  )
}

export default Recommendations
