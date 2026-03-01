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
  const CACHE_PREFIX = 'dashboard_cache_v1:';
  const readCache = (key: string, ttlMs: number) => {
    try {
      const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts) return null;
      if (Date.now() - Number(parsed.ts) > ttlMs) return null;
      return parsed.data;
    } catch {
      return null;
    }
  };
  const writeCache = (key: string, data: any) => {
    try {
      sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // ignore
    }
  };

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
  const [todayWorkoutCalories, setTodayWorkoutCalories] = useState<number>(0);
  const [reportAlerts, setReportAlerts] = useState<Array<{ severity: 'high' | 'medium' | 'low'; message: string }>>([]);
  const [workoutBackfillDone, setWorkoutBackfillDone] = useState(false);
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

  const getRecentDates = (count: number): string[] => {
    const toLocalIso = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const out: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(toLocalIso(d));
    }
    return out;
  };

  const toLocalIsoDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const sumWorkoutCaloriesForDay = (dayPlan: any): number => {
    if (!dayPlan || typeof dayPlan !== 'object') return 0;
    const estimated = Number(dayPlan?.estimated_calories || 0);
    if (estimated > 0) return estimated;
    const blocks = ['warmup', 'main_exercises', 'cooldown'];
    return blocks.reduce((total, key) => {
      const arr = Array.isArray(dayPlan?.[key]) ? dayPlan[key] : [];
      return total + arr.reduce((sum: number, ex: any) => sum + Number(ex?.calories_burned || 0), 0);
    }, 0);
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

  const refreshMacroData = async (force = false) => {
    if (!force) {
      const cached = readCache('nutrition_summary', 45000);
      if (cached) {
        setMacroData(cached);
        setMacroError(null);
        setMacroLoading(false);
        return;
      }
    }
    try {
      const response = await api.get('/nutrition/summary');
      setMacroData(response.data);
      writeCache('nutrition_summary', response.data);
      setMacroError(null);
    } catch (error) {
      try {
        // fallback path for public/demo mode
        const fallback = await api.get('/public-nutrition/summary');
        setMacroData(fallback.data);
        writeCache('nutrition_summary', fallback.data);
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

  const refreshAdherence = async (force = false) => {
    if (!force) {
      const cached = readCache('adherence_summary', 20000);
      if (cached) {
        setAdherenceSummary(cached);
        return;
      }
    }
    try {
      const response = await api.get('/adherence/summary');
      setAdherenceSummary(response.data || null);
      writeCache('adherence_summary', response.data || null);
    } catch {
      setAdherenceSummary(null);
    }
  };

  const safeWeekdayShort = (value: any): string => {
    try {
      const s = String(value || '').trim();
      if (!s) return '—';
      const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } catch {
      return '—';
    }
  };

  useEffect(() => {
    refreshAdherence(true);

    const interval = window.setInterval(() => {
      void refreshAdherence(true);
    }, 60000);
    const onFocus = () => {
      void refreshAdherence(true);
      void refreshMacroData();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAdherence(true);
        void refreshMacroData();
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'adherence:last_updated') {
        void refreshAdherence(true);
        void refreshMacroData();
      }
    };
    const onAdherenceUpdated = () => {
      void refreshAdherence(true);
      void refreshMacroData();
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

  useEffect(() => {
    const fetchTodayWorkoutCalories = async () => {
      const cached = readCache('today_workout_calories', 60000);
      if (cached != null) {
        setTodayWorkoutCalories(Number(cached || 0));
        return;
      }
      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      try {
        const response = await api.get('/workout-plan/weekly-workout-plan');
        const plan = response.data?.weekly_workout_plan;
        const todayPlan = plan?.workouts?.[dayName];
        const cals = Number(sumWorkoutCaloriesForDay(todayPlan) || 0);
        setTodayWorkoutCalories(cals);
        writeCache('today_workout_calories', cals);
      } catch {
        try {
          const fallback = await api.get('/workout-plan/public/weekly-workout-plan');
          const plan = fallback.data?.weekly_workout_plan;
          const todayPlan = plan?.workouts?.[dayName];
          const cals = Number(sumWorkoutCaloriesForDay(todayPlan) || 0);
          setTodayWorkoutCalories(cals);
          writeCache('today_workout_calories', cals);
        } catch {
          setTodayWorkoutCalories(0);
        }
      }
    };
    fetchTodayWorkoutCalories();
  }, []);

  useEffect(() => {
    const fetchReportAlerts = async () => {
      const cached = readCache('report_alerts', 5 * 60 * 1000);
      if (cached) {
        setReportAlerts(cached);
        return;
      }
      try {
        const response = await api.get('/reports');
        const reports = Array.isArray(response.data) ? response.data : [];
        const latest = reports[0];
        if (!latest?.summary) {
          setReportAlerts([]);
          return;
        }
        const parsed = JSON.parse(latest.summary);
        const conditions = Array.isArray(parsed?.conditions) ? parsed.conditions : [];
        const labs = parsed?.labs && typeof parsed.labs === 'object' ? parsed.labs : {};
        const alerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }> = [];
        for (const c of conditions.slice(0, 3)) {
          alerts.push({ severity: 'high', message: `Report flag: ${String(c)} needs active monitoring.` });
        }
        for (const [lab, value] of Object.entries(labs).slice(0, 3)) {
          alerts.push({ severity: 'medium', message: `Latest report lab ${String(lab)} is ${String(value)}.` });
        }
        setReportAlerts(alerts);
        writeCache('report_alerts', alerts);
      } catch {
        setReportAlerts([]);
      }
    };
    const run = () => { void fetchReportAlerts(); };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run);
    } else {
      globalThis.setTimeout(run, 0);
    }
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

  const safeName = String(profile?.name || 'User');
  const safeBmi = Number(profile?.bmi || 0);
  const safeBmiCategory = String(profile?.bmi_category || 'unknown');
  const safeWeight = Number(profile?.weight_kg || 0);
  const safeHeightCm = Number(profile?.height_cm || 0);
  const safeLifestyle = String(profile?.lifestyle_level || 'sedentary');
  const workoutMinutes = safeLifestyle === "active" ? 30 : 45;
  const progressList: Progress[] = Array.isArray(progress)
    ? progress
      .map((p: any) => ({
        month: String(p?.month || ''),
        weight_kg: Number(p?.weight_kg || 0),
        notes: typeof p?.notes === 'string' ? p.notes : undefined
      }))
      .filter((p) => p.month && Number.isFinite(p.weight_kg) && p.weight_kg > 0)
    : [];
  const labels = progressList.map(p => p.month);
  const heightMeters = Math.max(0.1, safeHeightCm / 100);
  const bmiData: number[] = progressList.map(p =>
    Number((p.weight_kg / (heightMeters * heightMeters)).toFixed(1))
  );

  const chartData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Weight (kg)',
        data: progressList.map(p => p.weight_kg),
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
          color: '#e2e8f0',
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
        ticks: { color: '#94a3b8', font: { family: "'Sora'", size: 11, weight: 600 } },
        title: { display: true, text: 'Weight (kg)', color: '#0ea5e9', font: { family: "'Sora'", size: 11, weight: 700 } }
      },
      y1: {
        position: 'right',
        grid: { display: false },
        ticks: { color: '#fb923c', font: { family: "'Sora'", size: 11, weight: 600 } },
        title: { display: true, text: 'BMI', color: '#f97316', font: { family: "'Sora'", size: 11, weight: 700 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: "'Sora'", size: 11, weight: 600 } }
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
  const plannedDayCalories = todayFoods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const plannedDayProtein = todayFoods.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const displayCaloriesGoal = plannedDayCalories > 0
    ? Math.round(plannedDayCalories)
    : (rec?.daily_calories ? Math.round(rec.daily_calories) : null);
  const recAny = rec as any;
  const displayProteinGoal = plannedDayProtein > 0
    ? Math.round(plannedDayProtein)
    : (recAny?.daily_protein_g ? Math.round(Number(recAny.daily_protein_g)) : null);

  const recentDates = adherence7.length > 0
    ? adherence7.map((d: any) => String(d.date))
    : getRecentDates(7);
  const todayIso = toLocalIsoDate(new Date());
  const todayLabel = new Date(`${todayIso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const workoutCompletedToday = Boolean(todayAdherence?.workout_completed || false);
  const currentWorkoutBurned = Number(todayAdherence?.workout_calories_burned || 0);

  const workout7 = recentDates.map((dateKey: string) => {
    const hit = adherence7.find((d: any) => String(d.date) === dateKey);
    const isToday = dateKey === todayIso;
    return {
      date: dateKey,
      completed: Boolean(isToday ? (workoutCompletedToday || hit?.workout_completed) : hit?.workout_completed || false)
    };
  });
  const workoutStreakDays = Number(adherenceSummary?.active_workout_streak_days ?? adherenceSummary?.workout_streak_days ?? 0);
  const consistencyScore = Math.max(0, Math.min(100, Math.round(((foodStreakDays + waterStreakDays + workoutStreakDays) / 21) * 100)));

  const getDayPlannedProteinByDate = (isoDate: string): number => {
    if (!weeklyPlanMeals) return 0;
    const dayName = new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    const dayPlan = weeklyPlanMeals?.[dayName];
    if (!dayPlan) return 0;
    const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    return mealTypes.reduce((sum, mealType) => {
      const items = dayPlan?.[mealType] || [];
      return sum + items.reduce((acc: number, item: any) => acc + Number(item?.protein || 0), 0);
    }, 0);
  };

  const protein7 = recentDates.map((d: string) => getDayPlannedProteinByDate(d));
  const fallbackCalories = Number(todayAdherence?.consumed_total_calories || latestFoodAdherence?.consumed_total_calories || 0);
  const fallbackWaterPct = Number(todayAdherence?.water_progress_percent || latestWaterAdherence?.water_progress_percent || 0);
  const fallbackProtein = Number(macroData?.consumed?.protein || displayProteinGoal || 0);
  const calories7 = adherence7.length > 0
    ? adherence7.map((d: any) => Number(d.consumed_total_calories || 0))
    : recentDates.map(() => fallbackCalories);
  const water7 = adherence7.length > 0
    ? adherence7.map((d: any) => Number(d.water_progress_percent || 0))
    : recentDates.map(() => fallbackWaterPct);
  const protein7Safe = protein7.some((x: number) => x > 0) ? protein7 : recentDates.map(() => fallbackProtein);
  const workoutCalories7 = adherence7.length > 0
    ? adherence7.map((d: any) => Number(d.workout_calories_burned || 0))
    : recentDates.map(() => Number(todayWorkoutCalories || currentWorkoutBurned || 0));
  const workout7Pct = workout7.map((x: { completed: boolean }) => (x.completed ? 100 : 0));

  const trendDirection = (values: number[]) => {
    if (!values.length) return 'flat';
    const first = Number(values[0] || 0);
    const last = Number(values[values.length - 1] || 0);
    if (Math.abs(last - first) < 0.01) return 'flat';
    return last > first ? 'up' : 'down';
  };

  const trendDeltaText = (values: number[], suffix = '') => {
    if (!values.length) return 'No data';
    const first = Number(values[0] || 0);
    const last = Number(values[values.length - 1] || 0);
    const delta = last - first;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${Math.round(delta)}${suffix}`;
  };

  const trendAverageText = (values: number[], suffix = '', unit = '') => {
    if (!values.length) return 'No data';
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    const avg = total / values.length;
    return `${Math.round(avg)}${suffix}${unit}`;
  };

  const profileAny = profile as any;
  const motiveRaw = String(profileAny?.motive || '').toLowerCase();
  const bmiCategoryRaw = String(profileAny?.bmi_category || profile.bmi_category || '').toLowerCase();
  const activeGoalFatLoss = motiveRaw.includes('loss') || motiveRaw.includes('fat') || bmiCategoryRaw.includes('overweight') || bmiCategoryRaw.includes('obese');
  const activeGoalMuscleGain = motiveRaw.includes('muscle') || motiveRaw.includes('gain') || motiveRaw.includes('bulk') || bmiCategoryRaw.includes('underweight');

  const baseWeight = progressList.length > 0 ? Number(progressList[0].weight_kg || profile.weight_kg) : Number(profile.weight_kg);
  const currentWeight = Number(profile.weight_kg || 0);
  const historicalWeights = progressList
    .map((p: any) => Number(p?.weight_kg || 0))
    .filter((w: number) => Number.isFinite(w) && w > 0);
  const highestHistoricalWeight = historicalWeights.length ? Math.max(...historicalWeights, currentWeight) : currentWeight;
  const lowestHistoricalWeight = historicalWeights.length ? Math.min(...historicalWeights, currentWeight) : currentWeight;
  const idealWeightKg = Number((22 * heightMeters * heightMeters).toFixed(1));
  const fatLossRemainingKg = Math.max(0, currentWeight - idealWeightKg);
  const muscleTargetWeight = Number((baseWeight + 3).toFixed(1));
  const muscleGainRemainingKg = Math.max(0, muscleTargetWeight - currentWeight);
  const weightRateKgPerWeek = (() => {
    if (progressList.length < 2) return activeGoalFatLoss ? 0.5 : 0.25;
    const first = Number(progressList[0].weight_kg || 0);
    const last = Number(progressList[progressList.length - 1].weight_kg || 0);
    const periods = Math.max(1, progressList.length - 1); // month-ish points
    const observedMonthly = Math.abs((last - first) / periods);
    const observedWeekly = observedMonthly / 4;
    const defaultWeekly = activeGoalFatLoss ? 0.5 : 0.25;
    return Math.max(0.2, Math.min(1.0, observedWeekly || defaultWeekly));
  })();
  const fatLossEtaWeeks = fatLossRemainingKg > 0 ? Math.min(104, Math.ceil(fatLossRemainingKg / weightRateKgPerWeek)) : 0;
  const muscleEtaWeeks = muscleGainRemainingKg > 0 ? Math.min(104, Math.ceil(muscleGainRemainingKg / 0.25)) : 0;
  const staminaWeeklyCompleted = workout7.filter((x: { completed: boolean }) => x.completed).length;

  const weightTrendValues = progressList.length >= 2
    ? [Number(progressList[0].weight_kg || currentWeight), Number(progressList[progressList.length - 1].weight_kg || currentWeight)]
    : [currentWeight, currentWeight];

  const goalWidgets = (() => {
    const etaLabel = (weeks: number) => {
      if (weeks <= 0) return 'Completed';
      if (weeks >= 52) return '12+ months';
      if (weeks >= 8) return `${Math.ceil(weeks / 4)} month(s)`;
      return `${weeks} week(s)`;
    };
    const buildMonthlyProjection = (startWeight: number, targetWeight: number, etaWeeks: number) => {
      const etaMonths = etaWeeks <= 0 ? 0 : Math.max(1, Math.min(12, Math.ceil(etaWeeks / 4)));
      const totalSteps = Math.max(1, etaMonths);
      const deltaPerStep = (targetWeight - startWeight) / totalSteps;
      const points: Array<{ label: string; weight: number }> = [];
      const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
      const now = new Date();

      points.push({ label: monthFmt.format(now), weight: Number(startWeight.toFixed(1)) });
      for (let i = 1; i <= etaMonths; i += 1) {
        const projected = startWeight + deltaPerStep * i;
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        points.push({ label: monthFmt.format(d), weight: Number(projected.toFixed(1)) });
      }
      if (points.length === 1) {
        const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        points.push({ label: monthFmt.format(d), weight: Number(targetWeight.toFixed(1)) });
      }
      return points;
    };
    const fatLossStartWeight = Math.max(currentWeight, baseWeight, highestHistoricalWeight);
    const fatLossTotalGap = Math.max(0.1, fatLossStartWeight - idealWeightKg);
    const fatLossProgressPct = Math.max(0, Math.min(100, ((fatLossTotalGap - fatLossRemainingKg) / fatLossTotalGap) * 100));
    const muscleGainStartWeight = Math.min(currentWeight, baseWeight, lowestHistoricalWeight);
    const muscleGainTotalGap = Math.max(0.1, muscleTargetWeight - muscleGainStartWeight);
    const muscleGainProgressPct = Math.max(0, Math.min(100, ((muscleGainTotalGap - muscleGainRemainingKg) / muscleGainTotalGap) * 100));
    if (activeGoalFatLoss && !activeGoalMuscleGain) {
      return [
        {
          key: 'fat-loss',
          title: 'Fat Loss',
          targetText: `Target ${idealWeightKg.toFixed(1)} kg | Current ${currentWeight.toFixed(1)} kg`,
          remainingText: `Remaining ${fatLossRemainingKg.toFixed(1)} kg`,
          etaText: etaLabel(fatLossEtaWeeks),
          progressPct: fatLossProgressPct,
          monthlyProjection: buildMonthlyProjection(currentWeight, idealWeightKg, fatLossEtaWeeks)
        }
      ];
    }
    if (activeGoalMuscleGain && !activeGoalFatLoss) {
      return [
        {
          key: 'muscle-gain',
          title: 'Muscle Gain',
          targetText: `Target ${muscleTargetWeight.toFixed(1)} kg | Current ${currentWeight.toFixed(1)} kg`,
          remainingText: `Remaining ${muscleGainRemainingKg.toFixed(1)} kg`,
          etaText: etaLabel(muscleEtaWeeks),
          progressPct: muscleGainProgressPct,
          monthlyProjection: buildMonthlyProjection(currentWeight, muscleTargetWeight, muscleEtaWeeks)
        }
      ];
    }
    return [
      {
        key: 'fat-loss',
        title: 'Fat Loss',
        targetText: `Target ${idealWeightKg.toFixed(1)} kg | Current ${currentWeight.toFixed(1)} kg`,
        remainingText: `Remaining ${fatLossRemainingKg.toFixed(1)} kg`,
        etaText: etaLabel(fatLossEtaWeeks),
        progressPct: fatLossProgressPct,
        monthlyProjection: buildMonthlyProjection(currentWeight, idealWeightKg, fatLossEtaWeeks)
      }
    ];
  })();

  const smartAlerts = (() => {
    const alerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }> = [];
    alerts.push(...reportAlerts);

    const lowProteinTarget = displayProteinGoal ? Math.max(1, displayProteinGoal * 0.7) : 35;
    let lowProteinRun = 0;
    for (let i = protein7Safe.length - 1; i >= 0; i -= 1) {
      if (Number(protein7Safe[i] || 0) < lowProteinTarget) {
        lowProteinRun += 1;
      } else {
        break;
      }
    }
    if (lowProteinRun >= 3) {
      alerts.push({ severity: 'medium', message: 'Protein is low for the last 3 days. Add one high-protein meal today.' });
    }

    if (progressList.length >= 2) {
      const w1 = Number(progressList[progressList.length - 1].weight_kg || 0);
      const w2 = Number(progressList[progressList.length - 2].weight_kg || 0);
      if (Math.abs(w1 - w2) <= 0.3) {
        alerts.push({ severity: 'low', message: 'Weight has plateaued recently. Adjust calories or training intensity this week.' });
      }
    }

    if (staminaWeeklyCompleted <= 1) {
      alerts.push({ severity: 'high', message: 'Workout consistency is low this week. Complete at least 3 sessions to recover momentum.' });
    }

    const dedup = new Set<string>();
    return alerts.filter((a) => {
      const key = `${a.severity}:${a.message}`;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    }).slice(0, 8);
  })();

  const dailyReminders = (() => {
    const reminders: Array<{ type: 'workout' | 'food' | 'water'; message: string; status: 'pending' | 'warning' }> = [];

    if (!workoutCompletedToday) {
      reminders.push({ type: 'workout', message: 'Complete your workout session today', status: 'pending' });
    }

    const completedItems = Number(todayAdherence?.completed_items_count || 0);
    const totalItems = Number(todayAdherence?.total_items_count || 0);
    const plannedMealsCount = todayFoods.reduce((sum, item) => sum + Number(item.item_count || 0), 0);
    
    // Show food reminder if there are planned meals and not all are completed
    if (plannedMealsCount > 0 && completedItems < plannedMealsCount) {
      reminders.push({ type: 'food', message: `Complete your meals today (${completedItems}/${plannedMealsCount} done)`, status: 'warning' });
    } else if (totalItems > 0 && completedItems < totalItems) {
      reminders.push({ type: 'food', message: `Complete remaining meals (${completedItems}/${totalItems} done)`, status: 'warning' });
    }

    const todayWaterPct = Number(todayAdherence?.water_progress_percent || 0);
    const todayWaterMl = Number(todayAdherence?.water_ml || 0);
    
    if (todayWaterMl > 0 && todayWaterPct < 100) {
      reminders.push({ type: 'water', message: `Drink more water (${todayWaterPct}% of target)`, status: 'warning' });
    } else if (todayWaterMl === 0) {
      reminders.push({ type: 'water', message: 'Start tracking your water intake today', status: 'pending' });
    }

    return reminders;
  })();

  useEffect(() => {
    try {
      const alertPayload = smartAlerts.map((a) => ({ severity: a.severity, message: a.message }));
      const reminderPayload = dailyReminders.map((r) => ({ type: r.type, message: r.message, status: r.status }));
      localStorage.setItem('dashboard_alerts_v1', JSON.stringify(alertPayload));
      localStorage.setItem('dashboard_reminders_v1', JSON.stringify(reminderPayload));
      window.dispatchEvent(new Event('dashboard-signals-updated'));
    } catch {
      // ignore storage sync errors
    }
  }, [smartAlerts, dailyReminders]);

  const highlightAlertMessage = (message: string) => {
    const keywordTerms = [
      'Protein', 'Water', 'Workout', 'Weight', 'consistency', 'streak',
      'goal', 'calories', 'report', 'lab', 'high', 'low', 'missed', 'plateaued'
    ];
    const diseaseTerms = [
      'diabetes', 'hypertension', 'obesity', 'anemia', 'thyroid',
      'cholesterol', 'asthma', 'pcos', 'pcod', 'heart disease',
      'kidney disease', 'fatty liver', 'insulin resistance'
    ];

    const reportDisease = /Report flag:\s*(.+?)\s+needs/i.exec(message)?.[1]?.trim();
    const allTerms = [...keywordTerms, ...diseaseTerms, ...(reportDisease ? [reportDisease] : [])];
    const escapedTerms = allTerms
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);
    const valuePattern = '\\b\\d+(?:\\.\\d+)?(?:\\/\\d+(?:\\.\\d+)?)?\\s*(?:mg\\/dL|mmol\\/L|kcal|kg|g|ml|L|%|day|days|session|sessions)?\\b';
    const pattern = new RegExp(`(${escapedTerms.join('|')}|${valuePattern})`, 'gi');
    const parts = message.split(pattern);

    const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9\\s/.-]/g, '').trim();
    const keywordSet = new Set(keywordTerms.map((v) => normalize(v)));
    const diseaseSet = new Set([...diseaseTerms, ...(reportDisease ? [reportDisease] : [])].map((v) => normalize(v)));

    return parts.map((part, index) => {
      const norm = normalize(part);
      const isValue = /^\\d/.test(part.trim());
      if (isValue) {
        return <span key={`val-${index}`} className="alert-value">{part}</span>;
      }
      if (diseaseSet.has(norm)) {
        return <span key={`dis-${index}`} className="alert-disease">{part}</span>;
      }
      if (keywordSet.has(norm)) {
        return <span key={`kw-${index}`} className="alert-keyword">{part}</span>;
      }
      return <React.Fragment key={`txt-${index}`}>{part}</React.Fragment>;
    });
  };

  const parsedQuote = (() => {
    try {
      return quote ? JSON.parse(quote) : null;
    } catch {
      return null;
    }
  })();

  const toggleTodayWorkoutFinished = async () => {
    const nextCompleted = !workoutCompletedToday;
    try {
      let caloriesToSave = Number(todayWorkoutCalories || 0);
      if (nextCompleted && caloriesToSave <= 0) {
        const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        try {
          const d = await api.get(`/workout-plan/daily-workout/${encodeURIComponent(dayName)}`);
          caloriesToSave = Number(sumWorkoutCaloriesForDay(d.data?.daily_workout) || 0);
          if (caloriesToSave <= 0) {
            const w = await api.get('/workout-plan/weekly-workout-plan');
            caloriesToSave = Number(sumWorkoutCaloriesForDay(w.data?.weekly_workout_plan?.workouts?.[dayName]) || 0);
          }
        } catch {
          caloriesToSave = Number(todayWorkoutCalories || 0);
        }
      }
      await api.post('/adherence/workout/day', {
        date: todayIso,
        completed: nextCompleted,
        calories_burned: nextCompleted ? caloriesToSave : 0
      });
      await refreshAdherence(true);
      window.dispatchEvent(new Event('adherence-updated'));
    } catch (error) {
      console.error('Failed to update workout completion:', error);
    }
  };

  useEffect(() => {
    const backfillWorkoutCalories = async () => {
      if (workoutBackfillDone) return;
      if (!workoutCompletedToday) return;
      if (Number(currentWorkoutBurned || 0) > 0) return;
      if (Number(todayWorkoutCalories || 0) <= 0) return;
      try {
        await api.post('/adherence/workout/day', {
          date: todayIso,
          completed: true,
          calories_burned: Number(todayWorkoutCalories || 0)
        });
        await refreshAdherence(true);
      } catch {
        // ignore backfill failure
      } finally {
        setWorkoutBackfillDone(true);
      }
    };
    backfillWorkoutCalories();
  }, [workoutBackfillDone, workoutCompletedToday, currentWorkoutBurned, todayWorkoutCalories, todayIso]);

  return (
    <div className="dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      
      <header className="dash-header">
        <div>
          <h1>Welcome back, {safeName}!</h1>
          <p>Tracking your Weight and BMI trends over time.</p>
        </div>
        <div className="bmi-badge">
          <span className="bmi-val">{safeBmi.toFixed(1)}</span>
          <span className="bmi-cat">{safeBmiCategory}</span>
        </div>
      </header>

      {parsedQuote && (
        <div className="quote-container">
          <div className="quote-card standout">
            <div className="quote-content">
              <div className="quote-main">
                <span className="quote-icon-large">✨</span>
                <div className="quote-text-group">
                  <h2 className="personal-goal">{String(parsedQuote?.personal || '')}</h2>
                  <p className="daily-quote">"{String(parsedQuote?.daily || '')}"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {[
          { icon: '⚖️', label: 'Current Weight', val: `${safeWeight} kg`, theme: 'weight' },
          { icon: '🎯', label: 'Calorie Target (approx)', val: displayCaloriesGoal != null ? `${displayCaloriesGoal} kcal` : '—', theme: 'goal' },
          { icon: '🍽️', label: hasTodayFoodLog ? 'Consumed Today' : 'Last Meal', val: displayFoodPoint ? `${Math.round(displayFoodPoint.consumed_total_calories || 0)} kcal` : '—', theme: 'eat' },
          { icon: '🥩', label: 'Protein Target (approx)', val: displayProteinGoal != null ? `${displayProteinGoal}g` : '—', theme: 'protein' },
          { icon: '💧', label: 'Water Target (approx)', val: rec?.water_l ? `${rec.water_l}L` : '—', theme: 'water' },
          { icon: '⏱️', label: 'Workout Duration (approx)', val: `30 - 45 min`, theme: 'time' },
          { icon: '🔥', label: `Calories Burned today`, val: `${Math.round(currentWorkoutBurned || (workoutCompletedToday ? todayWorkoutCalories : 0))} kcal`, theme: 'burn' },
          { icon: '👟', label: 'Steps Target', val: '7K-10K', theme: 'steps' },
          { icon: '😴', label: 'Sleep Target', val: '7-8 hrs', theme: 'sleep' }
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.theme}`}>
            <div className="stat-content">
              <span className="stat-icon-large" aria-hidden="true">{s.icon}</span>
              <div className="stat-details">
                <h4>{s.label}</h4>
                <p>{s.val}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="main-content">
        <div className="top-row">
          <section className="macro-section card">
            <div className="card-header">
              <h3>🍽️ {selectedPieDay} Food Plan</h3>
              <span className="badge">
                {todayFoods.length > 0 ? `${todayFoods.length} meals` : 'Weekly Plan'}
              </span>
            </div>
            <div className="day-selector">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedPieDay(day)}
                  className={`day-btn ${selectedPieDay === day ? 'active' : ''}`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            {todayFoodsError ? (
              <div className="empty-chart">{todayFoodsError}</div>
            ) : (
              <div className="food-plan-content">
                <div className="food-plan-left">
                  <div className="total-calories-badge">
                    <div className="calories-number">{todayFoods.reduce((sum, item) => sum + Number(item.calories || 0), 0)}</div>
                    <div className="calories-label">KCAL</div>
                  </div>
                  <DailyFoodPieChart foods={todayFoods} loading={todayFoodsLoading} />
                </div>
                <div className="meal-breakdown">
                  {todayFoods.map((food, idx) => {
                    const totalCal = todayFoods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
                    const percentage = totalCal > 0 ? Math.round((food.calories / totalCal) * 100) : 0;
                    const mealIcons: Record<string, string> = {
                      'Breakfast': '🍳',
                      'Lunch': '🍛',
                      'Snacks': '🍪',
                      'Dinner': '🍲'
                    };
                    return (
                      <div key={idx} className="meal-card">
                        <div className="meal-header">
                          <span className="meal-icon">{mealIcons[food.name] || '🍽️'}</span>
                          <span className="meal-name">{food.name}</span>
                          <span className="meal-percentage">{percentage}%</span>
                        </div>
                        <div className="meal-stats">
                          <span className="meal-cal">{food.calories} kcal</span>
                          <span className="meal-macro">P:{food.protein?.toFixed(1) || 0}</span>
                          <span className="meal-macro">C:{food.carbs?.toFixed(1) || 0}</span>
                          <span className="meal-macro">F:{food.fats?.toFixed(1) || 0}</span>
                          <span className="meal-items">• {food.item_count || 0} items</span>
                        </div>
                        {food.foods && food.foods.length > 0 && (
                          <div className="meal-foods">
                            <span className="foods-label">Foods:</span> {food.foods.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="chart-row">
          <section className="chart-section card">
            <div className="card-header">
              <h3>Health Progression</h3>
              <span className="badge">Dual Metric View</span>
            </div>
            <div className="chart-with-stats">
              <div className="chart-container">
                {progressList.length > 0 ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="empty-chart">No data points yet</div>
                )}
              </div>
              <div className="log-stats-sidebar">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '12px', textAlign: 'center' }}>📊 Log Daily Stats</h4>
                <form onSubmit={handleWeightSubmit} style={{ width: '100%' }}>
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
                      rows={2}
                    />
                  </div>
                  <button type="submit" className="btn-primary">Sync Progress</button>
                </form>
              </div>
            </div>
          </section>
        </div>

        <div className="middle-row">
          <section className="card consistency-card">
            <div className="card-header">
              <h3>Consistency Score</h3>
              <span className="badge">Combined</span>
            </div>
            <div className="compliance-score">{consistencyScore}%</div>
            <div className="compliance-bar">
              <div className="compliance-fill" style={{ width: `${Math.min(100, Math.max(0, consistencyScore))}%` }} />
            </div>
            <p className="compliance-text">
              Based on your active food, water, and workout streaks.
            </p>
          </section>

          <section className="card trend-card">
            <div className="card-header">
              <h3>Weekly Trends</h3>
              <span className="badge">7 Days</span>
            </div>
            <div className="trend-grid">
              {[
                { label: 'Weight', values: weightTrendValues, suffix: ' kg', meta: 'progress', display: 'delta' },
                { label: 'Calories', values: calories7, suffix: ' kcal', meta: 'avg/day consumed', display: 'average' },
                { label: 'Water', values: water7, suffix: '%', meta: 'avg/day target', display: 'average' },
                { label: 'Workout Burn', values: workoutCalories7, suffix: ' kcal', meta: 'avg/day burned', display: 'average' }
              ].map((item) => {
                const dir = trendDirection(item.values);
                const maxVal = Math.max(...item.values, 1);
                const valueText = item.display === 'average'
                  ? trendAverageText(item.values, item.suffix, '/day')
                  : trendDeltaText(item.values, item.suffix);
                return (
                  <article key={item.label} className="trend-item">
                    <div className="trend-top">
                      <div className="trend-label">{item.label}</div>
                      <div className={`trend-dir ${dir}`}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'}</div>
                    </div>
                    <div className="trend-value">{valueText}</div>
                    <div className="trend-meta">{item.meta}</div>
                    <div className="trend-sparkline">
                      {item.values.map((val, idx) => {
                        const height = Math.max(4, (val / maxVal) * 100);
                        return (
                          <div key={idx} className="sparkline-bar" style={{ height: `${height}%` }} />
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <div className="goal-row">
          <section className="card goal-progress-card">
            <div className="card-header">
              <h3>Goal Progress</h3>
              <span className="badge">Active</span>
            </div>
            <div className="goal-grid">
              {goalWidgets.map((goal) => (
                <article key={goal.key} className="goal-item active">
                  <div className="goal-head">
                    <h4>{goal.title}</h4>
                    <span className="goal-badge">Active</span>
                  </div>
                  <div className="goal-line">{goal.targetText}</div>
                  <div className="goal-line">{goal.remainingText}</div>
                  <div className="goal-progress-rail">
                    <div className="goal-progress-fill" style={{ width: `${goal.progressPct.toFixed(0)}%` }} />
                  </div>
                  <div className="goal-progress-meta">{goal.progressPct.toFixed(0)}% complete</div>
                  <div className="goal-eta">ETA: {goal.etaText}</div>
                  <div className="goal-chart-pane featured">
                    <div className="goal-monthly-title">Weight Projection by Month</div>
                    <div className="goal-mini-chart featured">
                      <Line
                        data={{
                          labels: goal.monthlyProjection.map((point: { label: string; weight: number }) => point.label),
                          datasets: [
                            {
                              label: 'Projected Weight',
                              data: goal.monthlyProjection.map((point: { label: string; weight: number }) => point.weight),
                              borderColor: '#22c55e',
                              backgroundColor: 'rgba(34, 197, 94, 0.25)',
                              borderWidth: 3,
                              pointRadius: 4,
                              pointHoverRadius: 6,
                              pointBackgroundColor: '#ffffff',
                              pointBorderColor: '#22c55e',
                              pointBorderWidth: 2,
                              tension: 0.35,
                              fill: true
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => `${Number(ctx.raw || 0).toFixed(1)} kg`
                              }
                            }
                          },
                          scales: {
                            x: {
                              grid: { color: 'rgba(148, 163, 184, 0.12)' },
                              ticks: { color: '#fbbf24', font: { size: 11, weight: 700 } }
                            },
                            y: {
                              grid: { color: 'rgba(148, 163, 184, 0.12)' },
                              ticks: {
                                color: '#6ee7b7',
                                font: { size: 11, weight: 700 },
                                callback: (val) => `${val} kg`
                              }
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="goal-projection-strip">
                      {goal.monthlyProjection.map((point: { label: string; weight: number }, idx: number) => (
                        <div key={`${goal.key}-pt-${idx}`} className="goal-projection-pill">
                          <span className="projection-month">{point.label}</span>
                          <span className="projection-weight">{point.weight.toFixed(1)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="bottom-row">
          <section className="card adherence-card">
            <div className="card-header">
              <h3>All Streaks</h3>
              <span className="badge">Last 7 Days</span>
            </div>
            <div className="adherence-summary">
              <div className="adherence-stat">
                <span className="adherence-stat-icon">🍎</span>
                <span className="adherence-stat-label">Food:</span>
                <span className="adherence-stat-value">{foodStreakDays} days</span>
              </div>
              <div className="adherence-stat">
                <span className="adherence-stat-icon">💧</span>
                <span className="adherence-stat-label">Water:</span>
                <span className="adherence-stat-value">{waterStreakDays} days</span>
              </div>
              <div className="adherence-stat">
                <span className="adherence-stat-icon">🏃</span>
                <span className="adherence-stat-label">Workout:</span>
                <span className="adherence-stat-value">{workoutStreakDays} days</span>
              </div>
            </div>
            <div className="adherence-bars">
              {recentDates.map((dateKey: string) => {
                const workoutDay = workout7.find((d: { date: string }) => d.date === dateKey);
                const adherenceDay = adherence7.find((d: any) => String(d.date) === dateKey);
                return (
                  <div key={`all-${dateKey}`} className="adherence-row">
                    <div className="adherence-day">{safeWeekdayShort(dateKey)}</div>
                    <div className="adherence-track">
                      <div className="adherence-fill food" style={{ width: `${Math.max(0, Math.min(100, Number(adherenceDay?.food_progress_percent || 0)))}%` }} />
                    </div>
                    <div className="adherence-track">
                      <div className="adherence-fill water" style={{ width: `${Math.max(0, Math.min(100, Number(adherenceDay?.water_progress_percent || 0)))}%` }} />
                    </div>
                    <div className="adherence-track workout">
                      <div className="adherence-fill workout" style={{ width: workoutDay?.completed ? '100%' : '0%' }} />
                    </div>
                  </div>
                );
              })}
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
  --brand: #10b981;
  --brand-dark: #059669;
  --ink: #ffffff;
  --muted: #94a3b8;
  --surface: rgba(255, 255, 255, 0.05);
  --line: rgba(255, 255, 255, 0.1);
  --bg: #0f172a;
  --accent: #6366f1;
}

.dashboard-wrapper {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 34px 22px 40px;
  font-family: 'Sora', sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow-x: hidden;
}

.dashboard-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(99, 102, 241, 0.08) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.dashboard-wrapper > * {
  position: relative;
  z-index: 1;
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
  background: linear-gradient(135deg, #10b981, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.dash-header p {
  color: var(--muted);
  font-weight: 500;
  margin: 8px 0 0;
}

.bmi-badge {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  padding: 14px 24px;
  border-radius: 18px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 16px 28px -12px rgba(16, 185, 129, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bmi-val { font-size: 1.85rem; font-weight: 800; color: var(--brand); line-height: 1; }
.bmi-cat { font-size: 0.72rem; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-top: 4px; }

.quote-card.standout {
  background: rgba(16, 185, 129, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 26px;
  padding: 28px;
  color: #f8fafc;
  margin-bottom: 24px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 22px 34px -28px rgba(16, 185, 129, 0.4);
  animation: riseIn 360ms ease;
}

.quote-main { display: flex; align-items: flex-start; gap: 12px; }
.quote-icon-large { font-size: 1.4rem; margin-top: 4px; }
.quote-text-group { min-width: 0; }
.personal-goal { font-size: clamp(1.1rem, 2.1vw, 1.65rem); font-weight: 800; margin: 0 0 8px; line-height: 1.3; }
.daily-quote { margin: 0; font-size: 0.98rem; opacity: 0.92; font-style: italic; font-weight: 500; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.alerts-banner {
  background: rgba(245, 158, 11, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 20px;
  padding: 16px 20px;
  margin-bottom: 24px;
}

.alerts-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.alerts-icon {
  font-size: 1.3rem;
}

.alerts-header h3 {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink);
  margin: 0;
  flex: 1;
}

.alerts-count {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
}

.alerts-scroll {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.alert-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px 16px;
  flex-shrink: 0;
}

.alert-chip.high {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.1);
}

.alert-chip.medium {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.1);
}

.alert-chip-text {
  font-size: 0.85rem;
  color: var(--ink);
  font-weight: 600;
}

.alert-keyword {
  background: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.5);
  border-radius: 6px;
  padding: 0 4px;
  font-weight: 800;
}

.alert-disease {
  background: rgba(239, 68, 68, 0.3);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 6px;
  padding: 0 4px;
  font-weight: 800;
}

.alert-value {
  background: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 6px;
  padding: 0 4px;
  font-weight: 800;
}

.reminders-banner {
  background: rgba(99, 102, 241, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 20px;
  padding: 16px 20px;
  margin-bottom: 24px;
}

.reminders-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.reminders-icon {
  font-size: 1.3rem;
}

.reminders-header h3 {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink);
  margin: 0;
  flex: 1;
}

.reminders-count {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
}

.reminders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.reminder-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.reminder-card.workout {
  border-color: rgba(249, 115, 22, 0.5);
  background: rgba(249, 115, 22, 0.1);
}

.reminder-card.food {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.1);
}

.reminder-card.water {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.1);
}

.reminder-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.reminder-text {
  font-size: 0.85rem;
  color: var(--ink);
  font-weight: 600;
  line-height: 1.4;
}

.streaks-combined-card {
  margin-bottom: 24px;
}

.adherence-summary {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.adherence-stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.adherence-stat-icon {
  font-size: 1.2rem;
}

.adherence-stat-label {
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 600;
}

.adherence-stat-value {
  font-size: 0.85rem;
  color: var(--brand);
  font-weight: 800;
}

.stat-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  box-shadow: 0 16px 26px -24px rgba(0, 0, 0, 0.3);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 20px 30px -12px rgba(16, 185, 129, 0.3);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.stat-icon-large {
  font-size: 2rem;
  line-height: 1;
  flex-shrink: 0;
}

.stat-details {
  min-width: 0;
  flex: 1;
}

.stat-details h4 {
  margin: 0;
  font-size: 0.7rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.stat-details p {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.2;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.top-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  order: 4;
}

.chart-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  order: 1;
}

.food-plan-content {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 24px;
  align-items: start;
}

.food-plan-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.middle-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  order: 2;
}

.goal-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  order: 3;
}

.bottom-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  width: 100%;
  max-width: 100%;
  order: 5;
}

.alerts-card { margin-top: 0; }
.alerts-list { display: grid; gap: 10px; }

.consistency-card .card-header { margin-bottom: 14px; text-align: center; }
.consistency-card {
  background: linear-gradient(165deg, rgba(34, 197, 94, 0.14), rgba(14, 116, 144, 0.12));
  border-color: rgba(45, 212, 191, 0.32);
  box-shadow: 0 24px 34px -30px rgba(20, 184, 166, 0.38);
}
.consistency-card .card-header h3 {
  color: #ccfbf1;
}
.consistency-card .badge {
  background: rgba(45, 212, 191, 0.22);
  color: #5eead4;
}

.compliance-score {
  font-size: 2rem;
  font-weight: 800;
  color: #5eead4;
  margin-bottom: 10px;
  text-align: center;
  text-shadow: 0 0 22px rgba(45, 212, 191, 0.35);
}

.compliance-bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
  margin-bottom: 10px;
}

.compliance-fill {
  height: 100%;
  background: linear-gradient(90deg, #2dd4bf, #22c55e);
}

.compliance-text {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.45;
  margin: 0;
  text-align: center;
}

.adherence-summary {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.adherence-stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.adherence-stat-icon {
  font-size: 1.2rem;
}

.adherence-stat-label {
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 600;
}

.adherence-stat-value {
  font-size: 0.85rem;
  color: var(--brand);
  font-weight: 800;
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
  color: var(--ink);
  font-size: 0.85rem;
  font-weight: 600;
}

.adherence-bars { display: grid; gap: 8px; }

.adherence-row {
  display: grid;
  grid-template-columns: 40px repeat(3, 1fr);
  gap: 8px;
  align-items: center;
}

.adherence-day {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 700;
}

.adherence-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.adherence-fill { height: 100%; border-radius: 999px; }
.adherence-fill.food { background: #10b981; }
.adherence-fill.water { background: #3b82f6; }
.adherence-fill.workout { background: #f97316; }
.adherence-track.workout { background: rgba(249, 115, 22, 0.2); }
.workout-day-status {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 700;
  text-align: right;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.trend-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.trend-card {
  background: linear-gradient(160deg, rgba(59, 130, 246, 0.14), rgba(79, 70, 229, 0.14));
  border-color: rgba(129, 140, 248, 0.35);
  box-shadow: 0 24px 34px -30px rgba(79, 70, 229, 0.45);
}
.trend-card .card-header h3 {
  color: #dbeafe;
}
.trend-card .badge {
  background: rgba(129, 140, 248, 0.22);
  color: #c7d2fe;
}
.trend-item:nth-child(1) { border-color: rgba(34, 197, 94, 0.36); background: rgba(34, 197, 94, 0.1); }
.trend-item:nth-child(2) { border-color: rgba(249, 115, 22, 0.38); background: rgba(249, 115, 22, 0.1); }
.trend-item:nth-child(3) { border-color: rgba(59, 130, 246, 0.38); background: rgba(59, 130, 246, 0.1); }
.trend-item:nth-child(4) { border-color: rgba(168, 85, 247, 0.38); background: rgba(168, 85, 247, 0.1); }
.trend-item:nth-child(1) .sparkline-bar { background: linear-gradient(180deg, #22c55e, #16a34a); }
.trend-item:nth-child(2) .sparkline-bar { background: linear-gradient(180deg, #fb923c, #f97316); }
.trend-item:nth-child(3) .sparkline-bar { background: linear-gradient(180deg, #60a5fa, #3b82f6); }
.trend-item:nth-child(4) .sparkline-bar { background: linear-gradient(180deg, #c084fc, #a855f7); }
.trend-item .sparkline-bar:hover {
  filter: brightness(1.12);
  transform: scaleY(1.12);
}
.trend-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.trend-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
}
.trend-dir { font-weight: 900; font-size: 0.8rem; }
.trend-dir.up { color: #10b981; }
.trend-dir.down { color: #ef4444; }
.trend-dir.flat { color: #64748b; }
.trend-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ink);
}
.trend-meta {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 600;
}

.trend-sparkline {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
  margin-top: 10px;
}

.sparkline-bar {
  flex: 1;
  background: linear-gradient(180deg, var(--brand), var(--brand-dark));
  border-radius: 2px;
  min-height: 4px;
  transition: all 0.3s ease;
}

.sparkline-bar:hover {
  background: linear-gradient(180deg, var(--accent), #4f46e5);
  transform: scaleY(1.1);
}

.goal-grid {
  display: grid;
  gap: 10px;
}
.goal-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  text-align: left;
  overflow: hidden;
}
.goal-item.active {
  border-color: rgba(74, 222, 128, 0.48);
  background: linear-gradient(165deg, rgba(34, 197, 94, 0.18), rgba(20, 83, 45, 0.16));
}
.goal-progress-card {
  background: linear-gradient(160deg, rgba(16, 185, 129, 0.16), rgba(5, 150, 105, 0.12));
  border-color: rgba(52, 211, 153, 0.36);
  box-shadow: 0 24px 36px -30px rgba(16, 185, 129, 0.5);
}
.goal-progress-card .card-header h3 {
  color: #d1fae5;
}
.goal-progress-card .badge {
  background: rgba(52, 211, 153, 0.22);
  color: #a7f3d0;
}
.goal-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 6px;
  gap: 8px;
}
.goal-head h4 {
  margin: 0;
  font-size: 0.92rem;
  color: var(--ink);
  font-weight: 800;
}
.goal-badge {
  font-size: 0.62rem;
  text-transform: uppercase;
  background: rgba(74, 222, 128, 0.2);
  color: #bbf7d0;
  border-radius: 999px;
  padding: 4px 9px;
  font-weight: 800;
}
.goal-line {
  font-size: 0.82rem;
  color: var(--muted);
  margin-top: 4px;
  font-weight: 600;
}
.goal-progress-rail {
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.24);
  margin-top: 10px;
  overflow: hidden;
}
.goal-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #f97316, #facc15);
  transition: width 0.35s ease;
}
.goal-progress-meta {
  margin-top: 6px;
  font-size: 0.74rem;
  color: var(--muted);
  font-weight: 700;
}
.goal-eta {
  margin-top: 6px;
  font-size: 0.8rem;
  color: #86efac;
  font-weight: 800;
}
.goal-monthly-title {
  margin-top: 0;
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.goal-chart-pane {
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.06);
  padding: 10px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  margin-top: 10px;
}
.goal-chart-pane.featured {
  background: linear-gradient(160deg, rgba(4, 47, 46, 0.8), rgba(20, 83, 45, 0.78), rgba(15, 23, 42, 0.88));
  border-color: rgba(110, 231, 183, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 14px 24px -20px rgba(16, 185, 129, 0.55);
}
.goal-mini-chart {
  position: relative;
  width: 100%;
  height: 140px;
  margin-top: 6px;
}
.goal-mini-chart.featured {
  height: 220px;
}
.goal-mini-chart canvas {
  max-width: 100% !important;
}
.goal-projection-strip {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.goal-projection-pill {
  flex: 0 0 auto;
  min-width: 86px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.55);
  padding: 7px 9px;
  display: grid;
  gap: 3px;
}
.projection-month {
  color: #fbbf24;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.projection-weight {
  color: #6ee7b7;
  font-size: 0.76rem;
  font-weight: 800;
}

.workout-actions {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}
.workout-btn {
  width: 100%;
}
.workout-btn.is-done {
  background: #1d4ed8;
}
.workout-streak-text {
  color: var(--muted);
  font-size: 0.86rem;
}

.empty-chart {
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
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
  margin-bottom: 16px;
}

.day-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.day-btn {
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.day-btn:hover {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.1);
}

.day-btn.active {
  border-color: var(--brand);
  background: rgba(16, 185, 129, 0.2);
  color: var(--brand);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.total-calories-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.2));
  border: 2px solid rgba(16, 185, 129, 0.3);
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 16px;
}

.calories-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--brand);
  line-height: 1;
}

.calories-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.1em;
  margin-top: 4px;
}

.meal-breakdown {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  overflow-y: auto;
  max-height: 500px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.meal-breakdown::-webkit-scrollbar {
  display: none;
}

.meal-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 14px;
  transition: all 0.2s ease;
}

.meal-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
  transform: translateX(4px);
}

.meal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.meal-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.meal-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--ink);
  flex: 1;
}

.meal-percentage {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--brand);
  background: rgba(16, 185, 129, 0.15);
  padding: 4px 10px;
  border-radius: 8px;
}

.meal-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.meal-cal {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--brand);
}

.meal-macro {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 3px 8px;
  border-radius: 6px;
}

.meal-items {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 600;
}

.meal-foods {
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.5;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.foods-label {
  font-weight: 700;
  color: var(--ink);
}

.card {
  background: var(--surface);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 16px;
  border: 1px solid var(--line);
  box-shadow: 0 24px 34px -30px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
  color: var(--ink);
}

.badge {
  background: rgba(16, 185, 129, 0.2);
  color: var(--brand);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chart-section {
  background: var(--surface);
  padding: 16px;
}

.chart-with-stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 280px);
  gap: 20px;
  margin-top: 8px;
  align-items: start;
}

.chart-container {
  height: 320px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 4px 0px;
  min-width: 0;
  overflow: hidden;
}

.log-stats-sidebar {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: fit-content;
  min-width: 0;
  overflow: hidden;
}

.goal-progress-card,
.trend-card,
.consistency-card {
  min-width: 0;
  overflow: hidden;
}

.input-group { margin-bottom: 14px; }
.input-group label { font-size: 0.82rem; font-weight: 700; margin-bottom: 7px; display: block; color: var(--brand); }
.input-group input,
.input-group textarea {
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: inherit;
  font-size: 0.95rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--ink);
  box-sizing: border-box;
}

.input-group input:focus,
.input-group textarea:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.btn-primary {
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--brand), var(--brand-dark));
  color: white;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 14px 24px -16px rgba(16, 185, 129, 0.5);
  transition: transform 140ms ease, filter 140ms ease;
}

.btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); }

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

@media (max-width: 1400px) {
  .middle-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1320px) {
  .chart-with-stats { grid-template-columns: 1fr; }
}

@media (max-width: 1160px) {
  .main-content { grid-template-columns: 1fr; }
  .top-row { grid-template-columns: 1fr; }
  .middle-row { grid-template-columns: 1fr; }
  .goal-row { grid-template-columns: 1fr; }
  .bottom-row { grid-template-columns: 1fr; }
}

@media (max-width: 900px) {
  .bottom-row { grid-template-columns: 1fr; }
  .goal-mini-chart.featured { height: 190px; }
}

@media (max-width: 760px) {
  .dashboard-wrapper { padding: 22px 12px 24px; }
  .dash-header { flex-direction: column; align-items: flex-start; }
  .card { padding: 16px; border-radius: 16px; }
  .quote-card.standout { border-radius: 18px; padding: 18px; }
  .stats-grid { grid-template-columns: 1fr; }
  .stat-card { padding: 14px; border-radius: 14px; }
  .stat-icon-large { font-size: 1.6rem; }
  .stat-details h4 { font-size: 0.65rem; }
  .stat-details p { font-size: 0.95rem; }
  .chart-with-stats { grid-template-columns: 1fr; }
  .chart-container { height: 280px; }
  .adherence-summary { flex-direction: column; gap: 8px; }
  .adherence-row { grid-template-columns: 40px 1fr; }
  .adherence-track:nth-child(3), .adherence-track:nth-child(4) { display: none; }
  .trend-grid { grid-template-columns: 1fr; }
  .food-plan-content { grid-template-columns: 1fr; }
}
`;
