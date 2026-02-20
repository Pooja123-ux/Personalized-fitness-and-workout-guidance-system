import React, { useState, useEffect } from 'react';
import api from '../api';

interface MealItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  preparation_time: number;
  difficulty: string;
}

interface DailyMealPlan {
  day: string;
  breakfast: MealItem[];
  lunch: MealItem[];
  snacks: MealItem[];
  dinner: MealItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
}

interface WeeklyMealPlan {
  week_start: string;
  week_end: string;
  meals: {
    Monday: DailyMealPlan;
    Tuesday: DailyMealPlan;
    Wednesday: DailyMealPlan;
    Thursday: DailyMealPlan;
    Friday: DailyMealPlan;
    Saturday: DailyMealPlan;
    Sunday: DailyMealPlan;
  };
  weekly_calories: number;
  weekly_protein: number;
  weekly_carbs: number;
  weekly_fats: number;
  based_on_weight: number;
  last_updated: string;
}

interface NutritionTip {
  icon: string;
  title: string;
  description: string;
  category: 'preparation' | 'nutrition' | 'timing' | 'storage';
}

const WeeklyMealPlanDisplay: React.FC = () => {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [showTips, setShowTips] = useState(true)
  const [activeCategory, setActiveCategory] = useState<'all' | 'preparation' | 'nutrition' | 'timing' | 'storage'>('all')
  const [helpfulTips, setHelpfulTips] = useState<Set<number>>(new Set())
  const [filteredTips, setFilteredTips] = useState<NutritionTip[]>([])
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [nutritionTips, setNutritionTips] = useState<NutritionTip[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Get category icon and label
  function getCategoryIcon(category: string): string {
    const icons = {
      preparation: '👨‍🍳',
      nutrition: '🌿',
      timing: '⏰',
      storage: '🧊'
    }
    return icons[category as keyof typeof icons] || '💡'
  }

  function getCategoryLabel(category: string): string {
    const labels = {
      preparation: 'Preparation',
      nutrition: 'Nutrition',
      timing: 'Timing',
      storage: 'Storage'
    }
    return labels[category as keyof typeof labels] || 'Tips'
  }

  function getActiveCategory(category: string): string {
    return activeCategory === category ? category : ''
  }

  // Mark tip as helpful
  function markTipHelpful(tipIndex: number) {
    setHelpfulTips(prev => new Set(prev).add(tipIndex))
  }

  // Share tip
  function shareTip(tip: NutritionTip) {
    if (navigator.share) {
      navigator.share({
        title: tip.title,
        text: tip.description,
        url: window.location.href
      }).catch(err => console.log('Share failed:', err))
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${tip.title}: ${tip.description}`)
      setFeedback('Tip copied to clipboard!')
    }
  }

  // Generate shopping list
  function generateShoppingList() {
    if (!weeklyPlan) return

    const allItems: string[] = []
    Object.values(weeklyPlan.meals).forEach(dayPlan => {
      ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(mealType => {
        const items = dayPlan[mealType as keyof typeof dayPlan] as MealItem[]
        items.forEach(item => {
          allItems.push(item.name)
        })
      })
    })

    // Remove duplicates
    const uniqueItems = [...new Set(allItems)]

    // Create shopping list text
    const shoppingList = uniqueItems.map((item, index) => `${index + 1}. ${item}`).join('\n')

    // Download as text file
    const blob = new Blob([shoppingList], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shopping-list.txt'
    a.click()
    URL.revokeObjectURL(url)

    setFeedback('🛒 Shopping list generated!')
  }

  // Filter tips by category
  useEffect(() => {
    if (activeCategory === 'all') {
      setFilteredTips(nutritionTips)
    } else {
      setFilteredTips(nutritionTips.filter(tip => tip.category === activeCategory))
    }
  }, [activeCategory, nutritionTips])

  const getNutritionTips = (): NutritionTip[] => {
    // TO DO: implement getNutritionTips function
    return []
  }

  useEffect(() => {
    fetchWeeklyMealPlan();
  }, []);

  const fetchWeeklyMealPlan = async () => {
    try {
      setLoading(true);
      const response = await api.get('/public-meal-plan/weekly-plan');
      setWeeklyPlan(response.data.weekly_plan);
      setError(null);
    } catch (err) {
      setError('Failed to fetch weekly meal plan');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMealPlan = async () => {
    try {
      const response = await api.post('/public-meal-plan/trigger-update', 
        null, 
        { params: { reason: 'Manual refresh requested' } }
      );
      setWeeklyPlan(response.data.weekly_plan);
    } catch (err) {
      console.error('Error refreshing meal plan:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading weekly meal plan...</div>
      </div>
    );
  }

  if (error || !weeklyPlan) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>
        <button onClick={fetchWeeklyMealPlan} style={{ padding: '10px 20px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '5px' }}>
          Retry
        </button>
      </div>
    );
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentDayPlan = weeklyPlan.meals[selectedDay as keyof typeof weeklyPlan.meals];

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        .meal-plan-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .week-info {
          background: #f8fafc;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
        }
        .day-selector {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }
        .day-button {
          padding: 10px 20px;
          border: 2px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .day-button:hover {
          background: #f1f5f9;
        }
        .day-button.active {
          background: #6366f1;
          color: white;
          border-color: #6366f1;
        }
        .meal-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .meal-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #1e293b;
        }
        .meal-item {
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .meal-name {
          font-weight: 500;
          color: #334155;
        }
        .meal-stats {
          display: flex;
          gap: 15px;
          font-size: 14px;
          color: #64748b;
        }
        .calories {
          font-weight: bold;
          color: #ef4444;
        }
        .protein {
          color: #3b82f6;
        }
        .carbs {
          color: #10b981;
        }
        .fats {
          color: #f59e0b;
        }
        .daily-summary {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          text-align: center;
        }
        .refresh-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          margin: 10px;
        }
        .refresh-button:hover {
          background: #059669;
        }
      `}</style>

      <div className="meal-plan-container">
        <div className="header">
          <h1>🍽️ Weekly Meal Plan</h1>
          <p>Personalized nutrition plan for your fitness journey</p>
        </div>

        <div className="week-info">
          <h3>Week: {weeklyPlan.week_start} to {weeklyPlan.week_end}</h3>
          <p>Based on weight: {weeklyPlan.based_on_weight}kg | Last updated: {new Date(weeklyPlan.last_updated).toLocaleDateString()}</p>
          <div style={{ marginTop: '10px' }}>
            <strong>Weekly Totals:</strong> {weeklyPlan.weekly_calories} cal | 
            Protein: {weeklyPlan.weekly_protein.toFixed(1)}g | 
            Carbs: {weeklyPlan.weekly_carbs.toFixed(1)}g | 
            Fats: {weeklyPlan.weekly_fats.toFixed(1)}g
          </div>
        </div>

        <div className="day-selector">
          {days.map(day => (
            <button
              key={day}
              className={`day-button ${selectedDay === day ? 'active' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="content-grid">
          <div className="main-content">
            <div className="daily-summary">
              <h2 style={{ margin: '0 0 15px 0', color: 'white' }}>{selectedDay}</h2>
              <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
                {currentDayPlan.total_calories} calories
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: 'blue' }}>
                    {currentDayPlan.total_protein.toFixed(1)}g
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Protein</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>{currentDayPlan.total_carbs.toFixed(1)}g</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Carbs</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>{currentDayPlan.total_fats.toFixed(1)}g</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Fats</div>
                </div>
              </div>
              <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  📊 Daily Macros: {((currentDayPlan.total_protein * 4) + (currentDayPlan.total_carbs * 4) + (currentDayPlan.total_fats * 9)).toFixed(0)} kcal
                </div>
              </div>
            </div>

            {(['breakfast', 'lunch', 'snacks', 'dinner'] as const).map((mealType) => {
              const mealIcons = {
                breakfast: '🌅',
                lunch: '🥗',
                snacks: '🍿',
                dinner: '🍽️'
              };
              
              const mealTitles = {
                breakfast: 'Breakfast',
                lunch: 'Lunch', 
                snacks: 'Snacks',
                dinner: 'Dinner'
              };

              const mealItems = currentDayPlan[mealType] as MealItem[];

              return (
                <div key={mealType} className="meal-section">
                  <div className="meal-title">
                    <span>{mealIcons[mealType]}</span>
                    {mealTitles[mealType]}
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 'normal', 
                      color: 'rgba(255,255,255,0.7)',
                      marginLeft: '8px',
                      background: 'rgba(255,255,255,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {mealItems.length} items
                    </div>
                  </div>
                  {mealItems.map((item: MealItem, index: number) => (
                    <div key={index} className="meal-item">
                      <div className="meal-info">
                        <div className="meal-name">{item.name}</div>
                        <div className="meal-meta">
                          <div className="prep-time">
                            ⏱️ {item.preparation_time}min
                          </div>
                          <div className="difficulty">
                            {item.difficulty === 'easy' ? '🟢 Easy' : 
                             item.difficulty === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                          </div>
                        </div>
                      </div>
                      <div className="meal-stats">
                        <div className="stat-item calories">
                          <span>{item.calories}</span>
                          <span>cal</span>
                        </div>
                        <div className="stat-item protein">
                          <span>{item.protein}g</span>
                        </div>
                        <div className="stat-item carbs">
                          <span>{item.carbs}g</span>
                        </div>
                        <div className="stat-item fats">
                          <span>{item.fats}g</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="tips-section">
            <div className="tips-header">
              <h3 className="tips-title">💡 Professional Nutrition Tips</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  className={`toggle-tips ${showTips ? 'active' : ''}`}
                  onClick={() => setShowTips(!showTips)}
                >
                  {showTips ? '📖 Hide Tips' : '💡 Show Tips'}
                </button>
                <div className="tip-categories">
                  {['preparation', 'nutrition', 'timing', 'storage'].map((category) => (
                    <button
                      key={category}
                      className={`category-btn ${getActiveCategory(category)}`}
                      onClick={() => setActiveCategory(category as 'all' | 'preparation' | 'nutrition' | 'timing' | 'storage')}
                    >
                      {getCategoryIcon(category)} {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {showTips && (
              <div className="tips-grid">
                {filteredTips.map((tip, index) => (
                  <div key={index} className={`tip-card ${getActiveCategory(tip.category)}`} style={{
                    animation: `slideIn 0.3s ease-out ${index * 0.1}s both`,
                    animationFillMode: 'both'
                  }}>
                    <div className="tip-header">
                      <div className="tip-icon">{tip.icon}</div>
                      <div className="tip-category">{getCategoryLabel(tip.category)}</div>
                    </div>
                    <div className="tip-title">{tip.title}</div>
                    <div className="tip-description">{tip.description}</div>
                    <div className="tip-actions">
                      <button className="tip-action-btn" onClick={() => markTipHelpful(index)}>
                        👍 Helpful
                      </button>
                      <button className="tip-action-btn" onClick={() => shareTip(tip)}>
                        📤 Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="action-buttons">
          <button className="action-button primary" onClick={refreshMealPlan}>
            🔄 Refresh Meal Plan
          </button>
          <button className="action-button secondary" onClick={fetchWeeklyMealPlan}>
            📊 Reload Data
          </button>
          <button className="action-button tertiary" onClick={generateShoppingList}>
            🛒 Shopping List
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyMealPlanDisplay;
