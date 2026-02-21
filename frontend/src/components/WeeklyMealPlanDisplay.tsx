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

const getMealTheme = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('breakfast')) return { bg: '#FFF4E6', text: '#FF922B', border: '#FFE8CC', icon: '🌅' };
  if (t.includes('lunch')) return { bg: '#EBFBEE', text: '#40C057', border: '#D3F9D8', icon: '🥗' };
  if (t.includes('snacks')) return { bg: '#FFF0F6', text: '#D6336C', border: '#FFDEEB', icon: '🍿' };
  if (t.includes('dinner')) return { bg: '#F3F0FF', text: '#7950F2', border: '#E5DBFF', icon: '🍽️' };
  return { bg: '#E7F5FF', text: '#228BE6', border: '#D0EBFF', icon: '🍎' };
};

const WeeklyMealPlanDisplay: React.FC = () => {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [loading, setLoading] = useState(false);

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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <div>⌛ Syncing Weekly Plan...</div>
      </div>
    );
  }

  if (error || !weeklyPlan) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>
        <button 
          onClick={fetchWeeklyMealPlan} 
          style={{ padding: '10px 20px', backgroundColor: '#4361ee', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700 }}
        >
          Retry
        </button>
      </div>
    );
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentDayPlan = weeklyPlan.meals[selectedDay as keyof typeof weeklyPlan.meals];

  return (
    <div className="weekly-container">
      <style>{`
        .weekly-container { font-family: 'Plus Jakarta Sans', sans-serif; max-width: 500px; margin: 0 auto; }
        
        .summary-banner {
          background: #f8fafc;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 25px;
          border: 1px solid #e2e8f0;
        }

        .day-scroller {
          display: flex;
          overflow-x: auto;
          gap: 10px;
          padding-bottom: 10px;
          margin-bottom: 25px;
          scrollbar-width: none;
        }
        .day-scroller::-webkit-scrollbar { display: none; }

        .day-pill {
          padding: 10px 18px;
          border-radius: 14px;
          background: white;
          border: 1px solid #e2e8f0;
          color: #64748b;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
          transition: 0.2s;
          font-size: 0.85rem;
        }
        .day-pill.active {
          background: #4361ee;
          color: white;
          border-color: #4361ee;
          box-shadow: 0 4px 12px rgba(67, 97, 238, 0.2);
        }

        .day-card {
          background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%);
          border-radius: 30px;
          padding: 24px;
          color: white;
          margin-bottom: 25px;
          box-shadow: 0 10px 20px -5px rgba(67, 97, 238, 0.3);
        }

        .meal-group { margin-bottom: 30px; }
        .meal-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          padding-left: 8px;
        }
      `}</style>

      {/* Week Summary Header */}
      <div className="summary-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Schedule</span>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{weeklyPlan.week_start} — {weeklyPlan.week_end}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>User Weight</span>
            <div style={{ fontWeight: 800, color: '#4361ee', fontSize: '0.95rem' }}>{weeklyPlan.based_on_weight}kg</div>
          </div>
        </div>
      </div>

      {/* Day Navigation */}
      <div className="day-scroller">
        {days.map(day => (
          <button 
            key={day} 
            className={`day-pill ${selectedDay === day ? 'active' : ''}`}
            onClick={() => setSelectedDay(day)}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Daily Macro Dashboard */}
      <div className="day-card">
        <div style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.9 }}>{selectedDay} Overview</div>
        <div style={{ fontSize: '2.4rem', fontWeight: 800, margin: '8px 0' }}>{currentDayPlan.total_calories} <span style={{ fontSize: '1rem', fontWeight: 600 }}>kcal</span></div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '18px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 800, marginBottom: '4px' }}>PROTEIN</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{currentDayPlan.total_protein.toFixed(0)}g</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 800, marginBottom: '4px' }}>CARBS</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{currentDayPlan.total_carbs.toFixed(0)}g</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 800, marginBottom: '4px' }}>FATS</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{currentDayPlan.total_fats.toFixed(0)}g</div>
          </div>
        </div>
      </div>

      {/* Meal Breakdown */}
      {(['breakfast', 'lunch', 'snacks', 'dinner'] as const).map((mealType) => {
        const mealItems = currentDayPlan[mealType] as MealItem[];
        const theme = getMealTheme(mealType);
        const labels = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner' };

        return (
          <div key={mealType} className="meal-group">
            <div className="meal-header">
              <span style={{ fontSize: '1.3rem' }}>{theme.icon}</span>
              <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.85rem', color: '#64748b', letterSpacing: '1px' }}>
                {labels[mealType]}
              </span>
            </div>

            {mealItems.map((item, idx) => (
              <div key={idx} style={{ 
                background: theme.bg, 
                padding: '20px', 
                borderRadius: '22px', 
                border: `2px solid ${theme.border}`,
                marginBottom: '14px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontWeight: 800, color: theme.text, fontSize: '1.05rem', marginBottom: '10px' }}>{item.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.text }}>{item.calories} KCAL</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '6px' }}>P: {item.protein}g</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '6px' }}>C: {item.carbs}g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default WeeklyMealPlanDisplay;