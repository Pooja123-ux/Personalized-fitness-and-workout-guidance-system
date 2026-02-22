import React, { useEffect, useState } from 'react'
import api from '../api'

function MealPlan() {
  const [mealPlan, setMealPlan] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [userMotive, setUserMotive] = useState<string>('')

  useEffect(() => {
    loadMealPlan()
  }, [])

  async function loadMealPlan() {
    try {
      const response = await api.get('/recommendations')
      if (response.data) {
        setMealPlan(response.data)
        setUserMotive(response.data.motive || 'Remain Fit & Healthy')
      }
    } catch (err) {
      console.error('Failed to load meal plan:', err)
    } finally {
      setLoading(false)
    }
  }

  const getMealIcon = (mealType: string) => {
    const icons: Record<string, string> = {
      breakfast: '🌅',
      lunch: '🥗',
      snacks: '🍎',
      dinner: '🍽️'
    }
    return icons[mealType] || '🍴'
  }

  const renderAlternatives = (alternatives: any[]) => {
    return (
      <div className="alternatives-list">
        {alternatives.map((alt, idx) => (
          <div key={idx} className="alternative-card">
            <div className="alt-header">
              <span className="alt-food">{alt.food}</span>
              <span className="alt-score">⭐ {alt.health_score || 0}</span>
            </div>
            <div className="alt-nutrients">
              <div className="nutrient">
                <span className="label">Calories</span>
                <span className="value">{alt.calories_serving?.toFixed(1) || 0} kcal</span>
              </div>
              <div className="nutrient">
                <span className="label">Protein</span>
                <span className="value">{alt.protein_g?.toFixed(1) || 0}g</span>
              </div>
              <div className="nutrient">
                <span className="label">Carbs</span>
                <span className="value">{alt.carbs_g?.toFixed(1) || 0}g</span>
              </div>
              <div className="nutrient">
                <span className="label">Fat</span>
                <span className="value">{alt.fat_g?.toFixed(1) || 0}g</span>
              </div>
              <div className="nutrient">
                <span className="label">Serving</span>
                <span className="value">{alt.serving_g?.toFixed(0) || 0}g</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="meal-plan-wrapper">
      <div className="meal-plan-container">
        <div className="plan-header">
          <h2>🎯 Your Personalized Meal Plan</h2>
          <p>Based on your profile & health goals: {userMotive}</p>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your personalized meal plan...</p>
          </div>
        ) : mealPlan.diet ? (
          <div className="meals-container">
            {mealPlan.diet.map((mealItem: any, idx: number) => {
              const alternatives = mealPlan.diet_alternatives?.[mealItem.meal_type] || []
              
              return (
                <div key={idx} className="meal-section">
                  <div className="meal-header">
                    <span className="meal-icon">{getMealIcon(mealItem.meal_type)}</span>
                    <h3>{mealItem.meal_type.charAt(0).toUpperCase() + mealItem.meal_type.slice(1)}</h3>
                    <span className="meal-target">Target: {mealItem.meal_target_calories} kcal</span>
                  </div>

                  {/* Primary recommendation */}
                  <div className="primary-meal">
                    <div className="main-food">
                      <h4>{mealItem.food_name}</h4>
                      <div className="main-nutrients">
                        <div className="nutrient-box">
                          <span className="value">{mealItem.calories_serving?.toFixed(0) || mealItem.calories}</span>
                          <span className="label">kcal</span>
                        </div>
                        <div className="nutrient-box">
                          <span className="value">{mealItem.protein_g?.toFixed(1)}</span>
                          <span className="label">Pro</span>
                        </div>
                        <div className="nutrient-box">
                          <span className="value">{mealItem.carbs_g?.toFixed(1)}</span>
                          <span className="label">Carb</span>
                        </div>
                        <div className="nutrient-box">
                          <span className="value">{mealItem.fat_g?.toFixed(1)}</span>
                          <span className="label">Fat</span>
                        </div>
                        <div className="nutrient-box">
                          <span className="value">{mealItem.serving_g?.toFixed(0)}</span>
                          <span className="label">g</span>
                        </div>
                      </div>
                      {mealItem.is_user_choice && <span className="user-choice-badge">👤 Your Choice</span>}
                    </div>
                  </div>

                  {/* Alternatives */}
                  {alternatives.length > 1 && (
                    <div className="alternatives-section">
                      <h5>🔄 Healthier Alternatives</h5>
                      {renderAlternatives(alternatives.slice(1))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="no-data">No meal plan available</p>
        )}

        {mealPlan.daily_calories && (
          <div className="daily-summary">
            <h4>Daily Summary</h4>
            <div className="summary-cards">
              <div className="summary-card">
                <span className="label">Daily Calories</span>
                <span className="value">{Math.round(Number(mealPlan.daily_calories || 0))}</span>
              </div>
              <div className="summary-card">
                <span className="label">BMI</span>
                <span className="value">{mealPlan.bmi} ({mealPlan.bmi_category})</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
        .meal-plan-wrapper { min-height: 100vh; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .meal-plan-container { max-width: 1000px; margin: 0 auto; }
        .plan-header { text-align: center; margin-bottom: 30px; }
        .plan-header h2 { font-size: 28px; font-weight: 800; color: #1e293b; margin: 0; }
        .plan-header p { font-size: 14px; color: #64748b; margin: 8px 0 0 0; }
        .loading-state { text-align: center; padding: 60px 20px; }
        .spinner { width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top: 4px solid #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
        .meals-container { display: flex; flex-direction: column; gap: 24px; }
        .meal-section { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .meal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .meal-icon { font-size: 24px; }
        .meal-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; flex: 1; }
        .meal-target { font-size: 11px; background: #eff6ff; color: #3b82f6; padding: 4px 8px; border-radius: 4px; font-weight: 600; }
        .primary-meal { background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%); padding: 16px; border-radius: 12px; margin-bottom: 16px; }
        .main-food h4 { margin: 0 0 12px 0; font-size: 16px; color: #1e293b; font-weight: 700; }
        .main-nutrients { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .nutrient-box { background: #fff; padding: 8px; border-radius: 8px; text-align: center; }
        .nutrient-box .value { display: block; font-size: 14px; font-weight: 700; color: #1e293b; }
        .nutrient-box .label { display: block; font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
        .user-choice-badge { display: inline-block; margin-top: 8px; background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .alternatives-section { margin-top: 16px; }
        .alternatives-section h5 { margin: 0 0 12px 0; font-size: 13px; color: #1e293b; font-weight: 700; }
        .alternatives-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .alternative-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; transition: 0.3s; }
        .alternative-card:hover { border-color: #10b981; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15); }
        .alt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .alt-food { font-size: 12px; font-weight: 700; color: #1e293b; }
        .alt-score { font-size: 11px; background: #dcfce7; padding: 2px 6px; border-radius: 3px; color: #166534; font-weight: 600; }
        .alt-nutrients { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 10px; }
        .nutrient { display: flex; justify-content: space-between; }
        .nutrient .label { color: #64748b; font-weight: 600; }
        .nutrient .value { color: #1e293b; font-weight: 700; }
        .daily-summary { margin-top: 30px; background: #fff; padding: 20px; border-radius: 12px; }
        .daily-summary h4 { margin: 0 0 16px 0; font-size: 14px; color: #1e293b; font-weight: 700; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 10px; text-align: center; }
        .summary-card .label { display: block; font-size: 11px; opacity: 0.9; font-weight: 600; text-transform: uppercase; }
        .summary-card .value { display: block; font-size: 20px; font-weight: 800; margin-top: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .no-data { text-align: center; color: #94a3b8; padding: 40px; }
      `}</style>
    </div>
  )
}

export default MealPlan
