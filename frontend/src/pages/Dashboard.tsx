﻿import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import api from '../api';
import DailyFoodPieChart from '../components/DailyFoodPieChart';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ScriptableContext } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

/* ===================== TYPES ===================== */

type Progress = {
  month: string;
  weight_kg: number;
  notes?: string;
};

type Profile = {
  name: string;
  bmi: number;
  bmi_category: string;
  weight_kg: number;
  height_cm: number;
  lifestyle_level: string;
};

export default function Dashboard() {
  const { profile, progress, rec, loading, refetch } = useProfile();
  const [newWeight, setNewWeight] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');
  const [quote, setQuote] = useState<string>('');
  const [macroData, setMacroData] = useState<any>(null);
  const [macroLoading, setMacroLoading] = useState(true);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [adherenceSummary, setAdherenceSummary] = useState<any>(null);
  const [todayFoods, setTodayFoods] = useState<Array<{ name: string; calories: number; meal_type?: string; protein?: number; carbs?: number; fats?: number; item_count?: number }>>([]);
  const [todayFoodsLoading, setTodayFoodsLoading] = useState(true);
  const [todayFoodsError, setTodayFoodsError] = useState<string | null>(null);
  const [weeklyPlanMeals, setWeeklyPlanMeals] = useState<any>(null);
  const [selectedPieDay, setSelectedPieDay] = useState<string>(
    (() => {
      try {
        const stored = localStorage.getItem('personalized_selected_day_v1');
        if (stored) return stored;
      } catch {
        // ignore
      }
      return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    })()
  );

  const parseMealPlanStorage = (raw: string | null) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.reduce((acc: any, dayPlan: any) => {
        const day = String(dayPlan?.day || '');
        if (day) acc[day] = dayPlan?.meals || {};
        return acc;
      }, {});
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!profile) return;

    const heightMeters = profile.height_cm / 100;
    const idealBMI = 22;
    const idealWeightKg = Number((idealBMI * heightMeters * heightMeters).toFixed(1));
    const deltaKg = profile.weight_kg - idealWeightKg;
    const deltaAbs = Math.abs(deltaKg);
    const goalLine = deltaAbs <= 0.5
      ? "You are in your goal range. Keep your routine consistent."
      : deltaKg > 0
        ? `${deltaAbs.toFixed(1)} kg to lose to reach your goal. Stay consistent with meals and training.`
        : `${deltaAbs.toFixed(1)} kg to gain to reach your goal. Prioritize strength and recovery.`;

    const genericQuotes = [
      "The only bad workout is the one that didn't happen.",
      "Progress is built one day at a time. Be a little stronger than yesterday.",
      "Your body can stand almost anything. It's your mind that you have to convince.",
      "Motivation is what gets you started. Habit is what keeps you going.",
      "Your health is an investment, not an expense.",
      "Small steps every day lead to big results."
    ];
    
    const rQuote = genericQuotes[Math.floor(Math.random() * genericQuotes.length)];
    setQuote(JSON.stringify({ personal: goalLine, daily: rQuote }));
  }, [profile]);

  const refreshMacroData = async () => {
    try {
      const response = await api.get('/nutrition/summary');
      setMacroData(response.data);
      setMacroError(null);
    } catch (error) {
      try {
        // fallback path for public/demo mode
        const fallback = await api.get('/public-nutrition/summary');
        setMacroData(fallback.data);
        setMacroError(null);
      } catch (fallbackError) {
        console.error('Error fetching macro data:', fallbackError);
        setMacroData(null);
        setMacroError('Macro data not available yet. Log profile/recommendations first.');
      }
    } finally {
      setMacroLoading(false);
    }
  };

  // Fetch macro data (real user nutrition summary)
  useEffect(() => {
    refreshMacroData();
  }, []);

  useEffect(() => {
    const fetchWeeklyPlanFoods = async () => {
      // Fast path: render cached weekly meals immediately to avoid blank/loading while navigating.
      try {
        const cachedMeals = parseMealPlanStorage(localStorage.getItem('personalized_meal_plan_v1'));
        if (cachedMeals) {
          setWeeklyPlanMeals(cachedMeals);
          setTodayFoodsError(null);
          setTodayFoodsLoading(false);
        }
      } catch {
        // ignore cache errors
      }

      try {
        const response = await api.get('/meal-plan/weekly-plan');
        const weeklyPlan = response.data?.weekly_plan;
        setWeeklyPlanMeals(weeklyPlan?.meals || null);
        setTodayFoodsError(null);
        try {
          const planArray = Object.entries(weeklyPlan?.meals || {}).map(([day, meals]: [string, any]) => ({
            day,
            meals
          }));
          localStorage.setItem('personalized_meal_plan_v1', JSON.stringify(planArray));
        } catch {
          // ignore storage errors
        }
      } catch (error) {
        try {
          const fallback = await api.get('/public-meal-plan/weekly-plan');
          const weeklyPlan = fallback.data?.weekly_plan;
          setWeeklyPlanMeals(weeklyPlan?.meals || null);
          setTodayFoodsError(null);
          try {
            const planArray = Object.entries(weeklyPlan?.meals || {}).map(([day, meals]: [string, any]) => ({
              day,
              meals
            }));
            localStorage.setItem('personalized_meal_plan_v1', JSON.stringify(planArray));
          } catch {
            // ignore storage errors
          }
        } catch (fallbackError) {
          setWeeklyPlanMeals(null);
          setTodayFoods([]);
          setTodayFoodsError("Weekly plan meals unavailable.");
        }
      } finally {
        setTodayFoodsLoading(false);
      }
    };
    fetchWeeklyPlanFoods();
  }, []);

  useEffect(() => {
    if (!weeklyPlanMeals) {
      setTodayFoods([]);
      return;
    }
    const dayPlan = weeklyPlanMeals?.[selectedPieDay];
    const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    const labels: Record<string, string> = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      snacks: 'Snacks',
      dinner: 'Dinner'
    };
    const items = mealTypes.map((mealType) => {
      const meals = dayPlan?.[mealType] || [];
      const totalCalories = meals.reduce((sum: number, m: any) => sum + Number(m?.calories || 0), 0);
      const totalProtein = meals.reduce((sum: number, m: any) => sum + Number(m?.protein || 0), 0);
      const totalCarbs = meals.reduce((sum: number, m: any) => sum + Number(m?.carbs || 0), 0);
      const totalFats = meals.reduce((sum: number, m: any) => sum + Number(m?.fats || 0), 0);
      const foods = meals.map((m: any) => String(m?.name || '').trim()).filter(Boolean);
      return {
        name: labels[mealType],
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fats: totalFats,
        foods,
        meal_type: mealType,
        item_count: meals.length
      };
    }).filter((x) => x.calories > 0);
    setTodayFoods(items);
  }, [weeklyPlanMeals, selectedPieDay]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'personalized_selected_day_v1' && e.newValue) {
        setSelectedPieDay(e.newValue);
      }
      if (e.key === 'personalized_meal_plan_v1' && e.newValue) {
        const mealsMap = parseMealPlanStorage(e.newValue);
        if (mealsMap) setWeeklyPlanMeals(mealsMap);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const fetchAdherence = async () => {
      try {
        const response = await api.get('/adherence/summary');
        setAdherenceSummary(response.data || null);
      } catch (error) {
        setAdherenceSummary(null);
      }
    };
    fetchAdherence();

    const interval = window.setInterval(fetchAdherence, 15000);
    const onFocus = () => {
      fetchAdherence();
      refreshMacroData();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAdherence();
        refreshMacroData();
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'adherence:last_updated') {
        fetchAdherence();
        refreshMacroData();
      }
    };
    const onAdherenceUpdated = () => {
      fetchAdherence();
      refreshMacroData();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('adherence-updated', onAdherenceUpdated);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('adherence-updated', onAdherenceUpdated);
    };
  }, []);

  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight) return;

    const month = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
    try {
      await api.post('/progress', { month, weight_kg: Number(newWeight), notes: note });
      refetch();
      setNewWeight('');
      setNote('');
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  if (loading) return <div className="loader-container"><div className="spinner"></div></div>;
  if (!profile) return <div className="error-state">Profile not found. <Link to="/intake">Set it up here</Link></div>;

  /* ===================== CALCULATIONS ===================== */

  const workoutMinutes = profile!.lifestyle_level === "active" ? 30 : 45;
  const labels = progress.map(p => p.month);
  const heightMeters = profile!.height_cm / 100;
  const bmiData: number[] = progress.map(p =>
    Number((p.weight_kg / (heightMeters * heightMeters)).toFixed(1))
  );

  const chartData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Weight (kg)',
        data: progress.map(p => p.weight_kg),
        borderColor: '#0ea5e9',
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(14, 165, 233, 0.15)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(14, 165, 233, 0.30)');
          gradient.addColorStop(1, 'rgba(14, 165, 233, 0.02)');
          return gradient;
        },
        borderWidth: 5,
        tension: 0.35,
        yAxisID: 'y',
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#0284c7',
        pointBorderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#0284c7',
      },
      {
        label: 'BMI Score',
        data: bmiData,
        borderColor: '#f97316',
        borderDash: [7, 5],
        borderWidth: 3,
        tension: 0.3,
        yAxisID: 'y1',
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#f97316',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          font: {
            family: "'Sora'",
            size: 12,
            weight: 700
          },
          color: '#334155',
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18
        }
      },
      tooltip: {
        backgroundColor: 'rgba(2, 6, 23, 0.92)',
        titleColor: '#e2e8f0',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(148, 163, 184, 0.4)',
        borderWidth: 1,
        displayColors: true,
        padding: 10
      }
    },
    scales: {
      y: {
        position: 'left',
        grid: { color: 'rgba(148, 163, 184, 0.22)' },
        ticks: { color: '#475569', font: { family: "'Sora'", size: 11, weight: 600 } },
        title: { display: true, text: 'Weight (kg)', color: '#0369a1', font: { family: "'Sora'", size: 11, weight: 700 } }
      },
      y1: {
        position: 'right',
        grid: { display: false },
        ticks: { color: '#7c2d12', font: { family: "'Sora'", size: 11, weight: 600 } },
        title: { display: true, text: 'BMI', color: '#c2410c', font: { family: "'Sora'", size: 11, weight: 700 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#475569', font: { family: "'Sora'", size: 11, weight: 600 } }
      }
    }
  };

  const todayAdherence = adherenceSummary?.today || null;
  const latestFoodAdherence = adherenceSummary?.latest_food_logged || adherenceSummary?.latest_logged || null;
  const latestWaterAdherence = adherenceSummary?.latest_water_logged || adherenceSummary?.latest_logged || null;
  const hasTodayFoodLog = Number(todayAdherence?.consumed_total_calories || 0) > 0;
  const hasTodayWaterLog = Number(todayAdherence?.water_ml || 0) > 0;
  const displayFoodPoint = hasTodayFoodLog ? todayAdherence : latestFoodAdherence;
  const displayWaterPoint = hasTodayWaterLog ? todayAdherence : latestWaterAdherence;
  const foodStreakDays = Number(adherenceSummary?.active_food_streak_days ?? adherenceSummary?.food_streak_days ?? 0);
  const waterStreakDays = Number(adherenceSummary?.active_water_streak_days ?? adherenceSummary?.water_streak_days ?? 0);
  const adherence7 = Array.isArray(adherenceSummary?.last_7_days) ? adherenceSummary.last_7_days : [];
  const consistencyScore = Math.max(0, Math.min(100, Math.round(((foodStreakDays + waterStreakDays) / 14) * 100)));
  const plannedDayCalories = todayFoods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const plannedDayProtein = todayFoods.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const displayCaloriesGoal = plannedDayCalories > 0
    ? Math.round(plannedDayCalories)
    : (rec?.daily_calories ? Math.round(rec.daily_calories) : null);
  const displayProteinGoal = plannedDayProtein > 0
    ? Math.round(plannedDayProtein)
    : (rec?.daily_protein_g ? Math.round(Number(rec.daily_protein_g)) : null);

  return (
    <div className="dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      
      <header className="dash-header">
        <div>
          <h1>Welcome back, {profile!.name}!</h1>
          <p>Tracking your Weight and BMI trends over time.</p>
        </div>
        <div className="bmi-badge">
          <span className="bmi-val">{profile!.bmi.toFixed(1)}</span>
          <span className="bmi-cat">{profile!.bmi_category}</span>
        </div>
      </header>

      {quote && (
        <div className="quote-container">
          <div className="quote-card standout">
            <div className="quote-content">
              <div className="quote-main">
                <span className="quote-icon-large">✨</span>
                <div className="quote-text-group">
                  <h2 className="personal-goal">{JSON.parse(quote).personal}</h2>
                  <p className="daily-quote">"{JSON.parse(quote).daily}"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {[
          { icon: 'H2O', label: 'Water Goal', val: rec?.water_l ? `${rec.water_l}L` : '—' },
          { icon: 'KCAL', label: 'Est. Burn', val: `${Math.round(profile.weight_kg * 5.5)} kcal` },
          { icon: 'MIN', label: 'Workout', val: `${workoutMinutes}m` },
          { icon: 'KG', label: 'Weight', val: `${profile.weight_kg}kg` },
          { icon: 'GOAL', label: 'Calories Goal', val: displayCaloriesGoal != null ? `${displayCaloriesGoal} kcal` : '—' },
          { icon: 'PRO', label: 'Protein Goal', val: displayProteinGoal != null ? `${displayProteinGoal} g` : '—' },
          { icon: 'EAT', label: hasTodayFoodLog ? 'Ate Today' : 'Latest Intake', val: displayFoodPoint ? `${Math.round(displayFoodPoint.consumed_total_calories || 0)} kcal` : '—' },
          { icon: 'FS', label: 'Food Streak', val: `${foodStreakDays} day${foodStreakDays === 1 ? '' : 's'}` },
          { icon: 'WS', label: 'Water Streak', val: `${waterStreakDays} day${waterStreakDays === 1 ? '' : 's'}` }
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-info">
              <h4>{s.label}</h4>
              <p>{s.val}</p>
              {s.sub && <small style={{ color: s.subColor, fontWeight: 800 }}>{s.sub}</small>}
            </div>
          </div>
        ))}
      </div>

      <div className="main-content">
        <div className="left-stack">
          <section className="chart-section card">
            <div className="card-header">
              <h3>Health Progression</h3>
              <span className="badge">Dual Metric View</span>
            </div>
            <div className="chart-container">
              {progress.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="empty-chart">No data points yet</div>
              )}
            </div>
          </section>

          <section className="update-section card">
            <h3>Log Daily Stats</h3>
            <form onSubmit={handleWeightSubmit}>
              <div className="input-group">
                <label>Weight (kg)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={newWeight} 
                  onChange={e => setNewWeight(e.target.value === '' ? '' : Number(e.target.value))} 
                  required 
                />
              </div>
              <div className="input-group">
                <label>Notes</label>
                <textarea 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder="How's your energy?"
                  rows={4}
                />
              </div>
              <button type="submit" className="btn-primary">Sync Progress</button>
            </form>
          </section>

          {Array.isArray(macroData?.alerts) && macroData.alerts.length > 0 && (
            <section className="card alerts-card">
              <div className="card-header">
                <h3>Smart Alerts</h3>
                <span className="badge">Today</span>
              </div>
              <div className="alerts-list">
                {macroData.alerts.map((a: any, idx: number) => (
                  <div key={`${a.type || 'alert'}-${idx}`} className={`alert-item ${a.severity || 'medium'}`}>
                    <div className="alert-title">{String(a.type || 'alert').replace(/_/g, ' ')}</div>
                    <div className="alert-msg">{a.message}</div>
                    {Array.isArray(a.suggestions) && a.suggestions.length > 0 && (
                      <ul className="alert-suggestions">
                        {a.suggestions.slice(0, 3).map((tip: string, tipIdx: number) => (
                          <li key={`${idx}-${tipIdx}`}>{tip}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="right-stack">
          <section className="macro-section card">
            <div className="card-header">
              <h3>{selectedPieDay} Food Plan</h3>
              <span className="badge">
                {todayFoods.length > 0 ? `${todayFoods.length} foods` : 'Weekly Plan'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedPieDay(day)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: selectedPieDay === day ? '1px solid #0f766e' : '1px solid #d1d5db',
                    background: selectedPieDay === day ? '#ccfbf1' : '#fff',
                    color: selectedPieDay === day ? '#115e59' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            {todayFoodsError ? (
              <div className="empty-chart">{todayFoodsError}</div>
            ) : (
              <DailyFoodPieChart foods={todayFoods} loading={todayFoodsLoading} />
            )}
          </section>

          <section className="card consistency-card">
            <div className="card-header">
              <h3>Consistency Score</h3>
              <span className="badge">Food + Water</span>
            </div>
            <div className="compliance-score">{consistencyScore}%</div>
            <div className="compliance-bar">
              <div className="compliance-fill" style={{ width: `${Math.min(100, Math.max(0, consistencyScore))}%` }} />
            </div>
            <p className="compliance-text">
              Based on your active food streak and water streak for the last 7 days.
            </p>
          </section>

          <section className="card adherence-card">
            <div className="card-header">
              <h3>Food & Water Streaks</h3>
              <span className="badge">Last 7 Days</span>
            </div>
            <div className="adherence-today">
              <div><strong>{hasTodayFoodLog ? 'Today Food' : 'Latest Food'}:</strong> {displayFoodPoint ? `${displayFoodPoint.food_progress_percent}%` : '—'}</div>
              <div><strong>{hasTodayWaterLog ? 'Today Water' : 'Latest Water'}:</strong> {displayWaterPoint ? `${displayWaterPoint.water_progress_percent}%` : '—'}</div>
            </div>
            <div className="adherence-bars">
              {adherence7.length > 0 ? adherence7.map((d: any) => (
                <div key={d.date} className="adherence-row">
                  <div className="adherence-day">{new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="adherence-track">
                    <div className="adherence-fill food" style={{ width: `${Math.max(0, Math.min(100, Number(d.food_progress_percent || 0)))}%` }} />
                  </div>
                  <div className="adherence-track">
                    <div className="adherence-fill water" style={{ width: `${Math.max(0, Math.min(100, Number(d.water_progress_percent || 0)))}%` }} />
                  </div>
                </div>
              )) : (
                <div className="empty-chart">No food/water logs yet</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const cssStyles = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');

:root {
  --brand: #0b6e4f;
  --brand-dark: #07543c;
  --ink: #0f172a;
  --muted: #475569;
  --surface: #ffffff;
  --line: #d7e2ec;
  --bg: #eef4f8;
  --accent: #ff8a00;
}

.dashboard-wrapper {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 34px 22px 40px;
  font-family: 'Sora', sans-serif;
  background: white;
  min-height: 100vh;
  box-sizing: border-box;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
  gap: 12px;
}

.dash-header h1 {
  font-size: clamp(1.8rem, 3.8vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 0;
  color: var(--ink);
}

.dash-header p {
  color: var(--muted);
  font-weight: 500;
  margin: 8px 0 0;
}

.bmi-badge {
  background: #ffffff;
  padding: 14px 24px;
  border-radius: 18px;
  border: 1px solid #cde6de;
  box-shadow: 0 16px 28px -24px rgba(2, 6, 23, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bmi-val { font-size: 1.85rem; font-weight: 800; color: var(--brand); line-height: 1; }
.bmi-cat { font-size: 0.72rem; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-top: 4px; }

.quote-card.standout {
  background: #0a707e;
  border-radius: 26px;
  padding: 28px;
  color: #f8fafc;
  margin-bottom: 24px;
  border: 1px solid #1f2937;
  box-shadow: 0 22px 34px -28px rgba(15, 23, 42, 0.9);
  animation: riseIn 360ms ease;
}

.quote-main { display: flex; align-items: flex-start; gap: 12px; }
.quote-icon-large { font-size: 1.4rem; margin-top: 4px; }
.quote-text-group { min-width: 0; }
.personal-goal { font-size: clamp(1.1rem, 2.1vw, 1.65rem); font-weight: 800; margin: 0 0 8px; line-height: 1.3; }
.daily-quote { margin: 0; font-size: 0.98rem; opacity: 0.92; font-style: italic; font-weight: 500; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(205px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.stat-card {
  position: relative;
  background: #ffffff;
  border-radius: 18px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--line);
  box-shadow: 0 16px 26px -24px rgba(15, 23, 42, 0.8);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: #b7d4c9;
  box-shadow: 0 20px 30px -24px rgba(15, 23, 42, 0.95);
}

.stat-icon {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #0f766e;
  background: #ecfeff;
  min-width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1px solid #bae6fd;
}

.stat-info h4 { margin: 0; font-size: 0.72rem; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
.stat-info p { margin: 3px 0 0; font-size: 1.15rem; font-weight: 800; color: var(--ink); }

.main-content {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 18px;
}

.left-stack,
.right-stack {
  display: grid;
  gap: 18px;
}

.alerts-card { margin-top: 0; }
.alerts-list { display: grid; gap: 10px; }

.alert-item {
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.alert-item.high { border-color: #fecaca; background: #fff1f2; }
.alert-item.medium { border-color: #fde68a; background: #fffbeb; }
.alert-title {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #334155;
  margin-bottom: 4px;
}
.alert-msg { font-size: 0.9rem; color: #475569; font-weight: 600; }
.alert-suggestions {
  margin: 8px 0 0;
  padding-left: 16px;
  color: #334155;
  font-size: 0.8rem;
  line-height: 1.4;
}

.consistency-card .card-header { margin-bottom: 14px; }

.compliance-score {
  font-size: 2rem;
  font-weight: 800;
  color: var(--brand);
  margin-bottom: 10px;
}

.compliance-bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
  margin-bottom: 10px;
}

.compliance-fill {
  height: 100%;
  background: #0f766e;
}

.compliance-text {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.45;
  margin: 0;
}

.adherence-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.adherence-today {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #334155;
  font-size: 0.85rem;
  font-weight: 600;
}

.adherence-bars { display: grid; gap: 8px; }

.adherence-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.adherence-day {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 700;
}

.adherence-track {
  height: 10px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.adherence-fill { height: 100%; border-radius: 999px; }
.adherence-fill.food { background: #10b981; }
.adherence-fill.water { background: #3b82f6; }

.empty-chart {
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-weight: 700;
  font-size: 0.9rem;
}

.macro-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 20px;
}

.macro-section .card-header {
  width: 100%;
  margin-bottom: 12px;
}

.card {
  background: var(--surface);
  border-radius: 20px;
  padding: 22px;
  border: 1px solid var(--line);
  box-shadow: 0 24px 34px -30px rgba(15, 23, 42, 0.9);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-header h3 {
  font-weight: 800;
  margin: 0;
  font-size: 1.06rem;
  letter-spacing: -0.02em;
}

.badge {
  background: #dcfce7;
  color: #166534;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chart-section {
  background: #ffffff;
}

.chart-container {
  height: 430px;
  margin-top: 12px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 10px 10px 2px;
}

.input-group { margin-bottom: 14px; }
.input-group label { font-size: 0.82rem; font-weight: 700; margin-bottom: 7px; display: block; color: var(--ink); }
.input-group input,
.input-group textarea {
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid #d8e1ea;
  font-family: inherit;
  font-size: 0.95rem;
  background: #f8fafc;
  box-sizing: border-box;
}

.input-group input:focus,
.input-group textarea:focus {
  outline: none;
  border-color: #94a3b8;
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.2);
}

.btn-primary {
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  border: none;
  background: #0f766e;
  color: white;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 14px 24px -16px rgba(2, 132, 199, 0.75);
  transition: transform 140ms ease, filter 140ms ease;
}

.btn-primary:hover { transform: translateY(-1px); filter: brightness(1.03); }

.loader-container { height: 100vh; display: flex; align-items: center; justify-content: center; }
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #dbeafe;
  border-top: 4px solid var(--brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes riseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 1160px) {
  .main-content { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .dashboard-wrapper { padding: 22px 12px 24px; }
  .dash-header { flex-direction: column; align-items: flex-start; }
  .card { padding: 16px; border-radius: 16px; }
  .quote-card.standout { border-radius: 18px; padding: 18px; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat-card { padding: 12px; border-radius: 14px; gap: 8px; }
  .stat-icon { min-width: 44px; height: 44px; border-radius: 10px; font-size: 0.62rem; }
  .stat-info p { font-size: 0.95rem; }
  .chart-container { height: 280px; }
  .adherence-today { flex-direction: column; }
}
`;
