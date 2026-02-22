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
    refreshAdherence();

    const interval = window.setInterval(() => {
      void refreshAdherence(true);
    }, 60000);
    const onFocus = () => {
      void refreshAdherence();
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
    return {
      date: dateKey,
      completed: Boolean(hit?.workout_completed || false)
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

  const profileAny = profile as any;
  const motiveRaw = String(profileAny?.motive || '').toLowerCase();
  const bmiCategoryRaw = String(profileAny?.bmi_category || profile.bmi_category || '').toLowerCase();
  const activeGoalFatLoss = motiveRaw.includes('loss') || motiveRaw.includes('fat') || bmiCategoryRaw.includes('overweight') || bmiCategoryRaw.includes('obese');
  const activeGoalMuscleGain = motiveRaw.includes('muscle') || motiveRaw.includes('gain') || motiveRaw.includes('bulk') || bmiCategoryRaw.includes('underweight');

  const baseWeight = progressList.length > 0 ? Number(progressList[0].weight_kg || profile.weight_kg) : Number(profile.weight_kg);
  const currentWeight = Number(profile.weight_kg || 0);
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
    if (activeGoalFatLoss && !activeGoalMuscleGain) {
      return [
        {
          key: 'fat-loss',
          title: 'Fat Loss',
          targetText: `Target ${idealWeightKg.toFixed(1)} kg | Current ${currentWeight.toFixed(1)} kg`,
          remainingText: `Remaining ${fatLossRemainingKg.toFixed(1)} kg`,
          etaText: etaLabel(fatLossEtaWeeks)
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
          etaText: etaLabel(muscleEtaWeeks)
        }
      ];
    }
    return [
      {
        key: 'fat-loss',
        title: 'Fat Loss',
        targetText: `Target ${idealWeightKg.toFixed(1)} kg | Current ${currentWeight.toFixed(1)} kg`,
        remainingText: `Remaining ${fatLossRemainingKg.toFixed(1)} kg`,
        etaText: etaLabel(fatLossEtaWeeks)
      }
    ];
  })();

  const smartAlerts = (() => {
    const alerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }> = [];
    const baseAlerts = Array.isArray(macroData?.alerts)
      ? macroData.alerts.map((a: any) => ({
        severity: (a?.severity === 'high' || a?.severity === 'medium') ? a.severity : 'low',
        message: String(a?.message || '').trim()
      })).filter((a: any) => a.message)
      : [];
    alerts.push(...baseAlerts);
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

    const yesterdayPoint = adherence7.length >= 2 ? adherence7[adherence7.length - 2] : null;
    if (yesterdayPoint && Number(yesterdayPoint.water_progress_percent || 0) < 100) {
      alerts.push({ severity: 'medium', message: 'Water goal was missed yesterday. Start early today to catch up.' });
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
    }).slice(0, 6);
  })();

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
          { icon: 'H2O', label: 'Water Goal', val: rec?.water_l ? `${rec.water_l}L approx` : '—' },
          { icon: 'KCAL', label: `Burned (${todayLabel})`, val: `${Math.round(currentWorkoutBurned || (workoutCompletedToday ? todayWorkoutCalories : 0))} kcal` },
          { icon: 'MIN', label: 'Workout', val: `${workoutMinutes}m` },
          { icon: 'KG', label: 'Weight', val: `${safeWeight}kg` },
          { icon: 'GOAL', label: 'Calories Goal', val: displayCaloriesGoal != null ? `${displayCaloriesGoal} kcal approx` : '—' },
          { icon: 'PRO', label: 'Protein Goal', val: displayProteinGoal != null ? `${displayProteinGoal} g approx` : '—' },
          { icon: 'EAT', label: hasTodayFoodLog ? 'Ate Today' : 'Latest Intake', val: displayFoodPoint ? `${Math.round(displayFoodPoint.consumed_total_calories || 0)} kcal` : '—' },
          { icon: 'FS', label: 'Food Streak', val: `${foodStreakDays} day${foodStreakDays === 1 ? '' : 's'}` },
          { icon: 'WS', label: 'Water Streak', val: `${waterStreakDays} day${waterStreakDays === 1 ? '' : 's'}` },
          { icon: 'WKS', label: 'Workout Streak', val: `${workoutStreakDays} day${workoutStreakDays === 1 ? '' : 's'}` },
          { icon: 'DONE', label: `Workout ${todayLabel}`, val: workoutCompletedToday ? 'Finished' : 'Pending' }
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-info">
              <h4>{s.label}</h4>
              <p>{s.val}</p>
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
              {progressList.length > 0 ? (
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

          {smartAlerts.length > 0 && (
            <section className="card alerts-card">
              <div className="card-header">
                <h3>Smart Alerts</h3>
                <span className="badge">Today</span>
              </div>
              <div className="alerts-list">
                {smartAlerts.map((a: any, idx: number) => (
                  <div key={`smart-${idx}`} className={`alert-item ${a.severity || 'medium'}`}>
                    <div className="alert-title">{String(a.severity || 'medium')} priority</div>
                    <div className="alert-msg">{a.message}</div>
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

          <section className="card trend-card">
            <div className="card-header">
              <h3>Weekly Trend Cards</h3>
              <span className="badge">Last 7 Days</span>
            </div>
            <div className="trend-grid">
              {[
                { label: 'Weight', values: weightTrendValues, suffix: ' kg', meta: 'from progress logs' },
                { label: 'Calories', values: calories7, suffix: ' kcal', meta: 'consumed' },
                { label: 'Water', values: water7, suffix: '%', meta: 'target completion' },
                { label: 'Protein', values: protein7Safe, suffix: ' g', meta: 'planned/consumed' },
                { label: 'Workout', values: workout7Pct, suffix: '%', meta: 'completed days' }
              ].map((item) => {
                const dir = trendDirection(item.values);
                return (
                  <article key={item.label} className="trend-item">
                    <div className="trend-top">
                      <div className="trend-label">{item.label}</div>
                      <div className={`trend-dir ${dir}`}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'}</div>
                    </div>
                    <div className="trend-value">{trendDeltaText(item.values, item.suffix)}</div>
                    <div className="trend-meta">{item.meta}</div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="card goal-progress-card">
            <div className="card-header">
              <h3>Goal Progress Widgets</h3>
              <span className="badge">Target vs Current</span>
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
                  <div className="goal-eta">ETA: {goal.etaText}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="card workout-streak-card">
            <div className="card-header">
              <h3>Workout Streak</h3>
              <span className="badge">Today: {todayLabel}</span>
            </div>
            <div className="workout-actions">
              <button
                type="button"
                className={`btn-primary workout-btn ${workoutCompletedToday ? 'is-done' : ''}`}
                onClick={toggleTodayWorkoutFinished}
              >
                {workoutCompletedToday ? `Mark ${todayLabel} as Not Finished` : `Mark ${todayLabel} Workout as Finished`}
              </button>
              <div className="workout-streak-text">
                Completion can be marked only for <strong>{todayLabel}</strong>.
              </div>
              <div className="workout-streak-text">
                Current streak: <strong>{workoutStreakDays} day{workoutStreakDays === 1 ? '' : 's'}</strong>
              </div>
            </div>
            <div className="adherence-bars">
              {workout7.map((d: { date: string; completed: boolean }) => (
                <div key={`workout-${d.date}`} className="adherence-row">
                  <div className="adherence-day">{safeWeekdayShort(d.date)}</div>
                  <div className="adherence-track workout">
                    <div className="adherence-fill workout" style={{ width: d.completed ? '100%' : '0%' }} />
                  </div>
                  <div className="workout-day-status">{d.completed ? 'Done' : 'Missed'}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card consistency-card">
            <div className="card-header">
              <h3>Consistency Score</h3>
              <span className="badge">Food + Water + Workout</span>
            </div>
            <div className="compliance-score">{consistencyScore}%</div>
            <div className="compliance-bar">
              <div className="compliance-fill" style={{ width: `${Math.min(100, Math.max(0, consistencyScore))}%` }} />
            </div>
            <p className="compliance-text">
              Based on your active food, water, and workout streaks for the last 7 days.
            </p>
          </section>

          <section className="card adherence-card">
            <div className="card-header">
              <h3>Food, Water & Workout Streaks</h3>
              <span className="badge">Last 7 Days</span>
            </div>
            <div className="adherence-today">
              <div><strong>{hasTodayFoodLog ? 'Today Food' : 'Latest Food'}:</strong> {displayFoodPoint ? `${displayFoodPoint.food_progress_percent}%` : '—'}</div>
              <div><strong>{hasTodayWaterLog ? 'Today Water' : 'Latest Water'}:</strong> {displayWaterPoint ? `${displayWaterPoint.water_progress_percent}%` : '—'}</div>
              <div><strong>Workout ({todayLabel}):</strong> {workoutCompletedToday ? 'Finished' : 'Pending'}</div>
            </div>
            <div className="adherence-bars">
              {adherence7.length > 0 ? adherence7.map((d: any) => (
                <div key={d.date} className="adherence-row">
                  <div className="adherence-day">{safeWeekdayShort(d.date)}</div>
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
.adherence-fill.workout { background: #f97316; }
.adherence-track.workout { background: #ffedd5; }
.workout-day-status {
  font-size: 0.72rem;
  color: #475569;
  font-weight: 700;
  text-align: right;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.trend-item {
  border: 1px solid #dbe8f4;
  border-radius: 12px;
  padding: 10px;
  background: #f8fafc;
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
  color: #334155;
  text-transform: uppercase;
}
.trend-dir { font-weight: 900; font-size: 0.8rem; }
.trend-dir.up { color: #10b981; }
.trend-dir.down { color: #ef4444; }
.trend-dir.flat { color: #64748b; }
.trend-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}
.trend-meta {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 600;
}

.goal-grid {
  display: grid;
  gap: 10px;
}
.goal-item {
  border: 1px solid #dbe8f4;
  border-radius: 12px;
  padding: 12px;
  background: #f8fafc;
}
.goal-item.active {
  border-color: #a7f3d0;
  background: #f0fdf4;
}
.goal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.goal-head h4 {
  margin: 0;
  font-size: 0.92rem;
  color: #0f172a;
  font-weight: 800;
}
.goal-badge {
  font-size: 0.62rem;
  text-transform: uppercase;
  background: #dcfce7;
  color: #166534;
  border-radius: 999px;
  padding: 3px 8px;
  font-weight: 800;
}
.goal-line {
  font-size: 0.82rem;
  color: #334155;
  margin-top: 4px;
  font-weight: 600;
}
.goal-eta {
  margin-top: 6px;
  font-size: 0.8rem;
  color: #0f766e;
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
  color: #334155;
  font-size: 0.86rem;
}

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
  .trend-grid { grid-template-columns: 1fr; }
}
`;
