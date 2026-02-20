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

const WeeklyMealPlanDisplay: React.FC = () => {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');

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

        <div className="daily-summary">
          <h2>{selectedDay}</h2>
          <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0' }}>
            {currentDayPlan.total_calories} calories
          </div>
          <div>
            Protein: {currentDayPlan.total_protein.toFixed(1)}g | 
            Carbs: {currentDayPlan.total_carbs.toFixed(1)}g | 
            Fats: {currentDayPlan.total_fats.toFixed(1)}g
          </div>
        </div>

        <div className="meal-section">
          <div className="meal-title">🌅 Breakfast</div>
          {currentDayPlan.breakfast.map((item, index) => (
            <div key={index} className="meal-item">
              <div className="meal-name">{item.name}</div>
              <div className="meal-stats">
                <span className="calories">{item.calories} cal</span>
                <span className="protein">P:{item.protein}g</span>
                <span className="carbs">C:{item.carbs}g</span>
                <span className="fats">F:{item.fats}g</span>
              </div>
            </div>
          ))}
        </div>

        <div className="meal-section">
          <div className="meal-title">🥗 Lunch</div>
          {currentDayPlan.lunch.map((item, index) => (
            <div key={index} className="meal-item">
              <div className="meal-name">{item.name}</div>
              <div className="meal-stats">
                <span className="calories">{item.calories} cal</span>
                <span className="protein">P:{item.protein}g</span>
                <span className="carbs">C:{item.carbs}g</span>
                <span className="fats">F:{item.fats}g</span>
              </div>
            </div>
          ))}
        </div>

        <div className="meal-section">
          <div className="meal-title">🍿 Snacks</div>
          {currentDayPlan.snacks.map((item, index) => (
            <div key={index} className="meal-item">
              <div className="meal-name">{item.name}</div>
              <div className="meal-stats">
                <span className="calories">{item.calories} cal</span>
                <span className="protein">P:{item.protein}g</span>
                <span className="carbs">C:{item.carbs}g</span>
                <span className="fats">F:{item.fats}g</span>
              </div>
            </div>
          ))}
        </div>

        <div className="meal-section">
          <div className="meal-title">🍽️ Dinner</div>
          {currentDayPlan.dinner.map((item, index) => (
            <div key={index} className="meal-item">
              <div className="meal-name">{item.name}</div>
              <div className="meal-stats">
                <span className="calories">{item.calories} cal</span>
                <span className="protein">P:{item.protein}g</span>
                <span className="carbs">C:{item.carbs}g</span>
                <span className="fats">F:{item.fats}g</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button className="refresh-button" onClick={refreshMealPlan}>
            🔄 Refresh Meal Plan
          </button>
          <button className="refresh-button" onClick={fetchWeeklyMealPlan}>
            📊 Reload Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyMealPlanDisplay;
