import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import api from '../api';

interface UserProfile {
  name: string;
  bmi: number;
  bmi_category: string;
  weight_kg: number;
  height_cm: number;
  lifestyle_level: string;
  water_l: number;
  daily_calories?: number;
  age: number;
  gender: 'male' | 'female';
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  health_goals: string[];
  medical_conditions: string[];
  allergies: string[];
  dietary_restrictions: string[];
  preferred_cuisines: string[];
  foods_to_avoid: string[];
  preferred_foods: string[];
  supplements: string[];
  medical_records?: {
    blood_pressure?: string;
    cholesterol?: string;
    blood_sugar?: string;
    medications?: string[];
    supplements?: string[];
  };
}

interface PersonalizedMeal {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  vitamins: { [key: string]: number };
  minerals: { [key: string]: number };
  health_benefits: string[];
  meal_type: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  preparation_time: number;
  ingredients: string[];
  cooking_tips: string[];
  medical_notes: string[];
  serving_size: string; // Added serving size
  quantity: string;     // Added quantity recommendation
}

interface PersonalizedDailyPlan {
  day: string;
  meals: {
    breakfast: PersonalizedMeal[];
    lunch: PersonalizedMeal[];
    snacks: PersonalizedMeal[];
    dinner: PersonalizedMeal[];
  };
  total_calories: number;
  total_protein: number;
  health_score: number;
  personalized_notes: string[];
}

interface ReportItem {
  id: number | string;
  filename?: string;
  summary?: string;
}

interface ReportInsights {
  conditions: string[];
  foodsToConsume: string[];
  foodsToAvoid: string[];
  labs: Record<string, string>;
}

interface ReportComparison {
  duplicateGroups: Array<{ filenames: string[]; count: number }>;
  duplicateReportsCount: number;
  latestIsDuplicate: boolean;
  diseaseTrendAlerts: Array<{
    condition: string;
    lab: string;
    previousValue: string;
    currentValue: string;
    direction: 'up' | 'down' | 'same';
    changePercent: number | null;
    level: 'warning' | 'good' | 'neutral';
  }>;
}

interface AdherenceExtraFood {
  name: string;
  calories: number;
}

const PersonalizedMealPlanDisplay: React.FC = () => {
  const { profile: realProfile } = useProfile();
  
  const getWaterTargetMl = (): number => {
    const liters = Number(realProfile?.water_l || 2);
    return Math.max(500, Math.round(liters * 1000));
  };
  
  const [mealPlan, setMealPlan] = useState<PersonalizedDailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()] || 'Monday'
  );
  const [error, setError] = useState<string | null>(null);
  const [reportInsights, setReportInsights] = useState<ReportInsights>({
    conditions: [],
    foodsToConsume: [],
    foodsToAvoid: [],
    labs: {}
  });
  const [reportComparison, setReportComparison] = useState<ReportComparison>({
    duplicateGroups: [],
    duplicateReportsCount: 0,
    latestIsDuplicate: false,
    diseaseTrendAlerts: []
  });
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const [completedItemIds, setCompletedItemIds] = useState<string[]>([]);
  const [extraFoods, setExtraFoods] = useState<AdherenceExtraFood[]>([]);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCalories, setNewFoodCalories] = useState<number | ''>('');
  const [waterMl, setWaterMl] = useState<number>(getWaterTargetMl());
  const [adherenceStatus, setAdherenceStatus] = useState<string | null>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealTypes: Array<'breakfast' | 'lunch' | 'snacks' | 'dinner'> = ['breakfast', 'lunch', 'snacks', 'dinner'];

  const getDateForDay = (day: string): string => {
    const dayIndexMap: Record<string, number> = {
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
      Sunday: 6,
    };
    const today = new Date();
    const jsDay = today.getDay(); // 0=Sun
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() + mondayOffset);
    const target = new Date(monday);
    target.setDate(monday.getDate() + (dayIndexMap[day] ?? 0));
    // Keep logs tied to the most recent occurrence of this weekday (not future).
    if (target > today) {
      target.setDate(target.getDate() - 7);
    }
    return target.toISOString().split('T')[0];
  };

  const buildMealItemId = (mealType: string, idx: number, name: string): string =>
    `${mealType}:${idx}:${String(name || '').trim().toLowerCase()}`;

  const splitList = (value?: string): string[] => {
    if (!value) return [];
    return value
      .split(/[,\n;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const dedupe = (items: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  };

  const normalizeText = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const toTitleCase = (value: string): string =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const parseNumericValue = (raw: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    const str = String(raw).trim();
    if (!str) return null;
    const bpMatch = str.match(/(\d+(?:\.\d+)?)\s*[/:-]\s*(\d+(?:\.\d+)?)/);
    if (bpMatch) {
      const systolic = Number(bpMatch[1]);
      const diastolic = Number(bpMatch[2]);
      if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
        return (systolic + diastolic) / 2;
      }
    }
    const numMatch = str.match(/-?\d+(?:\.\d+)?/);
    if (!numMatch) return null;
    const parsed = Number(numMatch[0]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseBloodPressureParts = (raw: unknown): { systolic: number; diastolic: number } | null => {
    const str = String(raw || '').trim();
    const match = str.match(/(\d+(?:\.\d+)?)\s*[/:-]\s*(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
    return { systolic, diastolic };
  };

  const canonicalSummary = (report: ReportItem): string => {
    if (report.summary) {
      try {
        const data = JSON.parse(report.summary);
        const conditions = Array.isArray(data.conditions) ? data.conditions.map((x: unknown) => normalizeText(String(x))).sort() : [];
        const consume = Array.isArray(data.foods_to_consume) ? data.foods_to_consume.map((x: unknown) => normalizeText(String(x))).sort() : [];
        const avoid = Array.isArray(data.foods_to_avoid) ? data.foods_to_avoid.map((x: unknown) => normalizeText(String(x))).sort() : [];
        const labs = data.labs && typeof data.labs === 'object'
          ? Object.entries(data.labs as Record<string, unknown>)
              .map(([k, v]) => `${normalizeText(String(k))}:${normalizeText(String(v ?? ''))}`)
              .sort()
          : [];
        const signature = JSON.stringify({ conditions, consume, avoid, labs });
        if (signature !== '{"conditions":[],"consume":[],"avoid":[],"labs":[]}') return `json:${signature}`;
      } catch {
        const raw = normalizeText(report.summary);
        if (raw) return `text:${raw}`;
      }
    }
    return `file:${normalizeText(String(report.filename || 'unknown'))}`;
  };

  const compareReports = (reports: ReportItem[]): ReportComparison => {
    const groups = new Map<string, ReportItem[]>();
    for (const report of reports) {
      const key = canonicalSummary(report);
      const list = groups.get(key) || [];
      list.push(report);
      groups.set(key, list);
    }

    const duplicateGroups = Array.from(groups.values())
      .filter((g) => g.length > 1)
      .map((g) => ({
        filenames: g.map((r) => String(r.filename || `Report ${r.id}`)),
        count: g.length
      }));
    const duplicateReportsCount = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
    const latest = reports[0];
    const latestIsDuplicate = !!latest && Array.from(groups.values()).some((g) => g.length > 1 && g.some((r) => r.id === latest.id));
    const reportsOldestFirst = [...reports].reverse();
    const conditionToReports = new Map<string, Array<{ labs: Record<string, unknown> }>>();
    for (const report of reportsOldestFirst) {
      if (!report.summary) continue;
      try {
        const data = JSON.parse(report.summary);
        const conditions = Array.isArray(data.conditions) ? data.conditions : [];
        const labs = data.labs && typeof data.labs === 'object' ? (data.labs as Record<string, unknown>) : {};
        for (const rawCondition of conditions) {
          const condition = normalizeText(String(rawCondition));
          if (!condition) continue;
          const list = conditionToReports.get(condition) || [];
          list.push({ labs });
          conditionToReports.set(condition, list);
        }
      } catch {
        // Ignore malformed summary rows
      }
    }

    const diseaseTrendAlerts: ReportComparison['diseaseTrendAlerts'] = [];
    for (const [condition, entries] of conditionToReports.entries()) {
      if (entries.length < 2) continue;
      const latestEntry = entries[entries.length - 1];
      const previousEntry = entries[entries.length - 2];
      const latestLabs = latestEntry.labs || {};
      const previousLabs = previousEntry.labs || {};
      const commonLabKeys = Object.keys(latestLabs).filter((k) => Object.prototype.hasOwnProperty.call(previousLabs, k));

      for (const labKey of commonLabKeys) {
        const latestRaw = latestLabs[labKey];
        const previousRaw = previousLabs[labKey];

        if (normalizeText(labKey) === 'blood pressure') {
          const latestBp = parseBloodPressureParts(latestRaw);
          const previousBp = parseBloodPressureParts(previousRaw);
          if (latestBp && previousBp) {
            const systolicDiff = latestBp.systolic - previousBp.systolic;
            const diastolicDiff = latestBp.diastolic - previousBp.diastolic;
            const direction = systolicDiff > 0 || diastolicDiff > 0 ? 'up' : systolicDiff < 0 || diastolicDiff < 0 ? 'down' : 'same';
            const prevAvg = (previousBp.systolic + previousBp.diastolic) / 2;
            const currAvg = (latestBp.systolic + latestBp.diastolic) / 2;
            const changePercent = prevAvg > 0 ? Number((((currAvg - prevAvg) / prevAvg) * 100).toFixed(1)) : null;
            diseaseTrendAlerts.push({
              condition: toTitleCase(condition),
              lab: 'Blood Pressure',
              previousValue: `${previousBp.systolic}/${previousBp.diastolic}`,
              currentValue: `${latestBp.systolic}/${latestBp.diastolic}`,
              direction,
              changePercent,
              level: direction === 'up' ? 'warning' : direction === 'down' ? 'good' : 'neutral'
            });
            continue;
          }
        }

        const prev = parseNumericValue(previousRaw);
        const curr = parseNumericValue(latestRaw);
        if (prev === null || curr === null) continue;
        const direction = curr > prev ? 'up' : curr < prev ? 'down' : 'same';
        const changePercent = prev !== 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : null;
        diseaseTrendAlerts.push({
          condition: toTitleCase(condition),
          lab: toTitleCase(String(labKey).replace(/_/g, ' ')),
          previousValue: String(previousRaw),
          currentValue: String(latestRaw),
          direction,
          changePercent,
          level: direction === 'up' ? 'warning' : direction === 'down' ? 'good' : 'neutral'
        });
      }
    }

    return { duplicateGroups, duplicateReportsCount, latestIsDuplicate, diseaseTrendAlerts };
  };

  const normalizeGoal = (motive?: string): string[] => {
    const m = (motive || '').toLowerCase();
    const goals: string[] = [];
    if (m.includes('loss') || m.includes('lose')) goals.push('weight_loss');
    if (m.includes('gain') || m.includes('muscle') || m.includes('build')) goals.push('muscle_gain');
    if (goals.length === 0 && m.trim()) goals.push(m.trim().replace(/\s+/g, '_'));
    return goals;
  };

  const normalizeActivity = (level?: string): UserProfile['activity_level'] => {
    const l = (level || '').toLowerCase();
    if (l.includes('sedentary')) return 'sedentary';
    if (l.includes('light')) return 'light';
    if (l.includes('very') || l.includes('high')) return 'very_active';
    if (l.includes('active')) return 'active';
    return 'moderate';
  };

  const parseReports = (reports: ReportItem[]): ReportInsights => {
    const conditions: string[] = [];
    const foodsToConsume: string[] = [];
    const foodsToAvoid: string[] = [];
    const labs: Record<string, string> = {};

    for (const report of reports) {
      if (!report.summary) continue;
      try {
        const data = JSON.parse(report.summary);
        const c = Array.isArray(data.conditions) ? data.conditions.map(String) : [];
        const consume = Array.isArray(data.foods_to_consume) ? data.foods_to_consume.map(String) : [];
        const avoid = Array.isArray(data.foods_to_avoid) ? data.foods_to_avoid.map(String) : [];
        const labObj = data.labs && typeof data.labs === 'object' ? data.labs : {};

        conditions.push(...c);
        foodsToConsume.push(...consume);
        foodsToAvoid.push(...avoid);
        for (const [k, v] of Object.entries(labObj)) {
          if (!labs[k] && v !== null && v !== undefined) labs[k] = String(v);
        }
      } catch {
        // Ignore non-JSON summaries
      }
    }

    return {
      conditions: dedupe(conditions),
      foodsToConsume: dedupe(foodsToConsume),
      foodsToAvoid: dedupe(foodsToAvoid),
      labs
    };
  };

  // Convert real profile to UserProfile interface format
  const convertRealProfileToUserProfile = (realProfile: any, insights: ReportInsights): UserProfile | null => {
    if (!realProfile) return null;

    const allergies = dedupe(splitList(realProfile.food_allergies));
    const diseases = dedupe([...splitList(realProfile.health_diseases), ...insights.conditions]);
    const mealPrefs = dedupe([
      ...splitList(realProfile.breakfast),
      ...splitList(realProfile.lunch),
      ...splitList(realProfile.snacks),
      ...splitList(realProfile.dinner)
    ]);
    const foodsToAvoid = dedupe(insights.foodsToAvoid);

    const fishFamily = ['fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'seafood'];
    const allergyTokens = allergies.map((a) => a.toLowerCase());
    const allergyExpanded = allergyTokens.includes('fish') ? [...allergyTokens, ...fishFamily] : allergyTokens;
    const preferredFromReports = insights.foodsToConsume.filter(
      (food) => !allergyExpanded.some((a) => food.toLowerCase().includes(a))
    );

    const dietaryRestrictions = realProfile.diet_type
      ? [String(realProfile.diet_type).toLowerCase().replace(/\s+/g, '_')]
      : [];

    const genderValue = String(realProfile.gender || '').toLowerCase().startsWith('f') ? 'female' : 'male';

    const bloodPressure = insights.labs['blood_pressure'];
    const cholesterol = insights.labs['cholesterol'];
    const bloodSugar = insights.labs['blood_sugar'];

    return {
      name: realProfile.name,
      bmi: Number(realProfile.bmi || 0),
      bmi_category: String(realProfile.bmi_category || ''),
      weight_kg: Number(realProfile.weight_kg || 75),
      height_cm: Number(realProfile.height_cm || 175),
      lifestyle_level: String(realProfile.lifestyle_level || 'moderate'),
      water_l: Number(realProfile.water_l || 2),
      daily_calories: realProfile.daily_calories ? Number(realProfile.daily_calories) : undefined,
      age: Math.floor(realProfile.age) || 30,
      gender: genderValue as 'male' | 'female',
      activity_level: normalizeActivity(realProfile.lifestyle_level),
      dietary_restrictions: dietaryRestrictions,
      allergies,
      health_goals: normalizeGoal(realProfile.motive),
      medical_conditions: diseases,
      preferred_cuisines: [],
      foods_to_avoid: foodsToAvoid,
      preferred_foods: dedupe([...mealPrefs, ...preferredFromReports]),
      supplements: [],
      medical_records: {
        blood_pressure: bloodPressure,
        cholesterol,
        blood_sugar: bloodSugar
      }
    };
  };

  // Get the converted user profile for use throughout the component
  const userProfile = convertRealProfileToUserProfile(realProfile, reportInsights);

  useEffect(() => {
    fetchReportsAndInsights();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('personalized_selected_day_v1', selectedDay);
    } catch {
      // ignore storage errors
    }
  }, [selectedDay]);

  useEffect(() => {
    if (!realProfile || !insightsLoaded) return;
    fetchPersonalizedMealPlan();
  }, [realProfile, reportInsights, insightsLoaded]);

  const fetchReportsAndInsights = async () => {
    try {
      const response = await api.get<ReportItem[]>('/reports');
      const reportList = Array.isArray(response.data) ? response.data : [];
      const insights = parseReports(reportList);
      const comparison = compareReports(reportList);
      setReportInsights(insights);
      setReportComparison(comparison);
    } catch (err) {
      console.error('Failed to fetch report insights:', err);
      setReportInsights({ conditions: [], foodsToConsume: [], foodsToAvoid: [], labs: {} });
      setReportComparison({ duplicateGroups: [], duplicateReportsCount: 0, latestIsDuplicate: false, diseaseTrendAlerts: [] });
    } finally {
      setInsightsLoaded(true);
    }
  };

  const calculateBMR = (profile: UserProfile | null): number => {
    if (!profile) return 2000;
    
    const age = profile.age || 30;
    const weight = profile.weight_kg || 70;
    const height = profile.height_cm || 175;
    
    if (profile.gender === 'male') {
      return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
      return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }
  };

  const calculateTDEE = (bmr: number, activityLevel: string): number => {
    const activityMultipliers: { [key: string]: number } = {
      'sedentary': 1.2,
      'light': 1.375,
      'moderate': 1.55,
      'active': 1.725,
      'very_active': 1.9
    };
    return bmr * (activityMultipliers[activityLevel] || 1.55);
  };

  const fetchPersonalizedMealPlan = async () => {
    try {
      setLoading(true);

      const estimateFiberFromName = (name: string): number => {
        const n = String(name || '').toLowerCase();
        if (!n) return 2;
        if (/(apple|banana|orange|papaya|guava|pear|kiwi|pomegranate|mango|fruit)/.test(n)) return 3;
        if (/(sprout|beans|chana|rajma|lentil|dal|sambar|oat|oatmeal)/.test(n)) return 6;
        if (/(salad|vegetable|bhindi|gobi|palak|baingan|mushroom)/.test(n)) return 4;
        if (/(rice|pulao|biryani|naan|roti|paratha|dosa|idli)/.test(n)) return 2;
        if (/(nuts|makhana|seeds)/.test(n)) return 3;
        return 2;
      };

      const inferQuantityFromName = (name: string): string => {
        const n = String(name || '').toLowerCase();
        if (/(apple|banana|orange|guava|pear|kiwi|pomegranate|mango|papaya)/.test(n)) return '1 fruit';
        if (/(roti|chapati|phulka|tandoori roti|missi roti)/.test(n)) return '2 pieces';
        if (/(idli)/.test(n)) return '2 pieces';
        if (/(dosa|paratha|uttapam|samosa)/.test(n)) return '1 piece';
        return '1 serving';
      };

      const inferServingGrams = (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner'): string => {
        if (mealType === 'snacks') return '120 g';
        if (mealType === 'breakfast') return '220 g';
        if (mealType === 'lunch') return '320 g';
        return '300 g';
      };

      const mapMeal = (meal: any, mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner'): PersonalizedMeal => ({
        // Weekly API currently returns minimal meal fields, so we infer missing display nutrition/serving info here.
        // Prefer backend values when available.
        name: String(meal?.name || 'Meal'),
        calories: Math.round(Number(meal?.calories || 0)),
        protein: Number(meal?.protein || 0),
        carbs: Number(meal?.carbs || 0),
        fats: Number(meal?.fats || 0),
        fiber: (function () {
          const candidates = [
            meal?.fiber,
            meal?.fibre,
            meal?.fiber_g,
            meal?.fibre_g,
            meal?.['Fiber (g)'],
            meal?.['Fibre (g)'],
            meal?.['fiber (g)'],
            meal?.['fibre (g)'],
          ];
          for (const c of candidates) {
            const v = Number(c);
            if (Number.isFinite(v) && v > 0) return v;
          }
          return estimateFiberFromName(meal?.name || '');
        })(),
        vitamins: {},
        minerals: {},
        health_benefits: [],
        meal_type: mealType,
        preparation_time: Number(meal?.preparation_time || 15),
        ingredients: [],
        cooking_tips: [],
        medical_notes: [],
        serving_size: String(meal?.serving_size || inferServingGrams(mealType)),
        quantity: String(meal?.quantity || inferQuantityFromName(meal?.name || ''))
      });

      const toPlanArray = (weeklyMeals: any, normalizedProfile: UserProfile | null): PersonalizedDailyPlan[] => {
        return daysOfWeek.map((day) => {
          const dayMeals = weeklyMeals?.[day] || {};
          const mappedMeals = {
            breakfast: Array.isArray(dayMeals?.breakfast) ? dayMeals.breakfast.map((m: any) => mapMeal(m, 'breakfast')) : [],
            lunch: Array.isArray(dayMeals?.lunch) ? dayMeals.lunch.map((m: any) => mapMeal(m, 'lunch')) : [],
            snacks: Array.isArray(dayMeals?.snacks) ? dayMeals.snacks.map((m: any) => mapMeal(m, 'snacks')) : [],
            dinner: Array.isArray(dayMeals?.dinner) ? dayMeals.dinner.map((m: any) => mapMeal(m, 'dinner')) : []
          };

          const allMeals = [...mappedMeals.breakfast, ...mappedMeals.lunch, ...mappedMeals.snacks, ...mappedMeals.dinner];

          const totalCalories = allMeals.reduce((sum, m) => sum + Number(m.calories || 0), 0);
          const totalProtein = allMeals.reduce((sum, m) => sum + Number(m.protein || 0), 0);

          return {
            day,
            meals: mappedMeals,
            total_calories: Math.round(totalCalories),
            total_protein: Math.round(totalProtein * 10) / 10,
            health_score: calculateHealthScoreForDay(mappedMeals, normalizedProfile),
            personalized_notes: getPersonalizedNotesForDay(day, normalizedProfile, mappedMeals)
          };
        });
      };

      const normalizedProfile = convertRealProfileToUserProfile(realProfile, reportInsights);

      try {
        const response = await api.get('/meal-plan/weekly-plan');
        const weeklyMeals = response?.data?.weekly_plan?.meals;
        if (weeklyMeals && typeof weeklyMeals === 'object') {
          const livePlan = toPlanArray(weeklyMeals, normalizedProfile);
          setMealPlan(livePlan);
          try {
            localStorage.setItem('personalized_meal_plan_v1', JSON.stringify(livePlan));
          } catch {
            // ignore storage errors
          }
          setError(null);
          return;
        }
      } catch {
        // fall back to public endpoint
      }

      const publicResponse = await api.get('/public-meal-plan/weekly-plan');
      const publicWeeklyMeals = publicResponse?.data?.weekly_plan?.meals;
      if (publicWeeklyMeals && typeof publicWeeklyMeals === 'object') {
        const livePlan = toPlanArray(publicWeeklyMeals, normalizedProfile);
        setMealPlan(livePlan);
        try {
          localStorage.setItem('personalized_meal_plan_v1', JSON.stringify(livePlan));
        } catch {
          // ignore storage errors
        }
        setError(null);
        return;
      }

      throw new Error('Weekly meal plan unavailable');
    } catch (error) {
      setError('Failed to generate personalized meal plan');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHealthScoreForDay = (meals: any, profile: UserProfile | null): number => {
    let score = 70;
    const bucket = (items: any[]) => Array.isArray(items) ? items : [];
    const allMeals = [...bucket(meals.breakfast), ...bucket(meals.lunch), ...bucket(meals.snacks), ...bucket(meals.dinner)];
    const totalProtein = allMeals.reduce((sum, m) => sum + Number(m?.protein || 0), 0);
    const totalFiber = allMeals.reduce((sum, m) => sum + Number(m?.fiber || 0), 0);
    
    if (profile && totalProtein >= profile.weight_kg * 1.6) score += 10;
    if (totalFiber >= 25) score += 10;
    if (profile?.health_goals.includes('weight_loss') && totalProtein > 100) score += 5;
    
    return Math.min(100, score);
  };

  const getPersonalizedNotesForDay = (
    day: string,
    profile: UserProfile | null,
    mealsForDay?: {
      breakfast: PersonalizedMeal[];
      lunch: PersonalizedMeal[];
      snacks: PersonalizedMeal[];
      dinner: PersonalizedMeal[];
    }
  ): string[] => {
    const notes: string[] = [];

    if (!profile) return notes;

    const plannedMeals = mealsForDay || { breakfast: [], lunch: [], snacks: [], dinner: [] };
    const plannedFoodNames = [
      ...plannedMeals.breakfast,
      ...plannedMeals.lunch,
      ...plannedMeals.snacks,
      ...plannedMeals.dinner
    ].map((m) => String(m.name || '').toLowerCase());

    const avoidTokens = dedupe([...(profile.foods_to_avoid || []), ...(profile.allergies || [])])
      .map((x) => x.toLowerCase())
      .filter(Boolean);
    const preferredTokens = (profile.preferred_foods || [])
      .map((x) => x.toLowerCase())
      .filter(Boolean);

    const mealContainsToken = (token: string) => plannedFoodNames.some((name) => name.includes(token));
    const matchedPreferred = preferredTokens.filter((token) => mealContainsToken(token));
    const missingPreferred = preferredTokens.filter((token) => !mealContainsToken(token));
    const conflictingPlanned = avoidTokens.filter((token) => mealContainsToken(token));

    if (profile.medical_conditions.includes('hypertension')) {
      notes.push('Heart health: low-sodium meal options prioritized.');
      if (profile.medical_records?.blood_pressure) {
        notes.push(`Blood pressure context: ${profile.medical_records.blood_pressure} (sodium kept controlled).`);
      }
    }

    if (profile.medical_conditions.includes('diabetes')) {
      notes.push('Blood sugar: lower glycemic load meal pattern selected.');
      if (profile.medical_records?.blood_sugar) {
        notes.push(`Blood sugar context: ${profile.medical_records.blood_sugar} (carbs distributed across meals).`);
      }
    }

    if (profile.medical_conditions.includes('cholesterol')) {
      notes.push('Cholesterol: leaner protein and lower saturated fat choices selected.');
      if (profile.medical_records?.cholesterol) {
        notes.push(`Cholesterol context: ${profile.medical_records.cholesterol} (fat quality prioritized).`);
      }
    }

    if (profile.health_goals.includes('muscle_gain')) {
      notes.push('Muscle goal: higher-protein portions placed around training windows.');
    }

    if (profile.health_goals.includes('weight_loss')) {
      notes.push('Weight goal: calorie-aware portions with high satiety foods.');
    }

    if (profile.dietary_restrictions.length > 0) {
      notes.push(`Diet style applied: ${profile.dietary_restrictions.join(', ')}.`);
    }

    if (matchedPreferred.length > 0) {
      notes.push(`Included from your regular foods: ${matchedPreferred.slice(0, 3).join(', ')}.`);
    } else if (missingPreferred.length > 0) {
      notes.push(`From your usual foods, consider adding: ${missingPreferred.slice(0, 3).join(', ')}.`);
    }

    if (avoidTokens.length > 0) {
      notes.push(`Avoid list enforced: ${avoidTokens.slice(0, 5).join(', ')}.`);
    }

    if (conflictingPlanned.length > 0) {
      notes.push(`Safety check: remove/replace these from add-ons today: ${conflictingPlanned.slice(0, 3).join(', ')}.`);
    }

    notes.push(`${day} plan is aligned to your health profile and latest medical context.`);
    return notes;
  };

  const selectedDayPlan = mealPlan.find(plan => plan.day === selectedDay) || mealPlan[0] || null;
  const effectiveSelectedDay = selectedDayPlan?.day || selectedDay;
  const selectedDayDate = getDateForDay(selectedDay);

  const getServingDisplayText = (meal: PersonalizedMeal): string => {
    const quantity = String(meal.quantity || '').trim();
    const servingSize = String(meal.serving_size || '').trim();
    const gramsMatch = servingSize.match(/\(([^)]*g)\)/i) || servingSize.match(/(\d+\s?g(?:ms)?)\b/i);
    const gramsText = gramsMatch?.[1] ? String(gramsMatch[1]).replace(/[()]/g, '') : '';
    const isCountBased = /(fruit|piece|pieces|roti|chapati|phulka|idli|dosa|paratha|samosa)/i.test(quantity);

    if (isCountBased) {
      return gramsText ? `${quantity} (~${gramsText})` : quantity;
    }

    if (gramsText) return gramsText;
    if (servingSize && servingSize.toLowerCase() !== 'standard portion') return servingSize;
    if (quantity && quantity.toLowerCase() !== '1 serving') return quantity;
    return '250 g';
  };

  const calculateConsumedPlannedCalories = (
    dayPlan: PersonalizedDailyPlan | null,
    completedIds: string[]
  ): number => {
    if (!dayPlan) return 0;
    const selected = new Set(completedIds);
    let total = 0;
    for (const mealType of mealTypes) {
      const items = (dayPlan.meals?.[mealType] || []) as PersonalizedMeal[];
      items.forEach((meal, idx) => {
        const id = buildMealItemId(mealType, idx, meal.name);
        if (selected.has(id)) {
          total += Number(meal.calories || 0);
        }
      });
    }
    return Math.round(total);
  };

  const getTotalMealItems = (dayPlan: PersonalizedDailyPlan | null): number => {
    if (!dayPlan) return 0;
    return mealTypes.reduce((sum, mealType) => sum + (dayPlan.meals[mealType]?.length || 0), 0);
  };

  const persistAdherence = async (
    nextCompletedIds: string[],
    nextExtraFoods: AdherenceExtraFood[],
    nextWaterMl: number
  ) => {
    if (!selectedDayPlan) return;
    try {
      const payload = {
        date: selectedDayDate,
        planned_calories: Number(selectedDayPlan.total_calories || 0),
        consumed_planned_calories: calculateConsumedPlannedCalories(selectedDayPlan, nextCompletedIds),
        completed_items_count: nextCompletedIds.length,
        total_items_count: getTotalMealItems(selectedDayPlan),
        completed_item_ids: nextCompletedIds,
        extra_foods: nextExtraFoods.map((f) => ({
          name: String(f.name || '').trim(),
          calories: Number(f.calories || 0),
        })).filter((f) => f.name && f.calories > 0),
        water_ml: Math.max(0, Number(nextWaterMl || 0)),
        water_target_ml: getWaterTargetMl(),
      };
      await api.post('/adherence/day', payload);
      localStorage.setItem('adherence:last_updated', new Date().toISOString());
      window.dispatchEvent(new Event('adherence-updated'));
      setAdherenceStatus('Saved');
      setTimeout(() => setAdherenceStatus(null), 1200);
    } catch (err) {
      console.error('Failed to save adherence:', err);
      setAdherenceStatus('Save failed');
      setTimeout(() => setAdherenceStatus(null), 1800);
    }
  };

  useEffect(() => {
    if (!selectedDayPlan) return;
    const loadDayAdherence = async () => {
      try {
        const response = await api.get(`/adherence/day/${selectedDayDate}`);
        const data = response.data || {};
        setCompletedItemIds(Array.isArray(data.completed_item_ids) ? data.completed_item_ids : []);
        setExtraFoods(Array.isArray(data.extra_foods) ? data.extra_foods : []);
        setWaterMl(Number(data.water_ml || 0));
      } catch (err) {
        setCompletedItemIds([]);
        setExtraFoods([]);
        setWaterMl(0);
      }
    };
    loadDayAdherence();
  }, [selectedDayDate, selectedDayPlan]);

  const consumedPlannedCalories = calculateConsumedPlannedCalories(selectedDayPlan, completedItemIds);
  const consumedExtraCalories = extraFoods.reduce((sum, x) => sum + Number(x.calories || 0), 0);
  const consumedTotalCalories = consumedPlannedCalories + consumedExtraCalories;
  const foodProgressPercent = selectedDayPlan?.total_calories
    ? Math.min(100, Math.round((consumedTotalCalories / Number(selectedDayPlan.total_calories)) * 100))
    : 0;
  const waterTargetMl = getWaterTargetMl();
  const waterProgressPercent = Math.min(100, Math.round((waterMl / Math.max(1, waterTargetMl)) * 100));
  const getLabTrend = (labName: string) =>
    reportComparison.diseaseTrendAlerts.find((a) => normalizeText(a.lab) === normalizeText(labName));
  const findLabValue = (...aliases: string[]): string | null => {
    const entries = Object.entries(reportInsights.labs || {});
    if (entries.length === 0) return null;
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      const hit = entries.find(([k]) => normalizeText(k) === normalizedAlias);
      if (hit && hit[1]) return String(hit[1]);
    }
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      const looseHit = entries.find(([k]) => {
        const nk = normalizeText(k);
        return nk.includes(normalizedAlias) || normalizedAlias.includes(nk);
      });
      if (looseHit && looseHit[1]) return String(looseHit[1]);
    }
    return null;
  };
  const bpTrend = getLabTrend('blood pressure');
  const sugarTrend = getLabTrend('blood sugar');
  const bpValue =
    findLabValue('blood pressure', 'blood_pressure', 'bp') ||
    userProfile?.medical_records?.blood_pressure ||
    'Not available';
  const sugarValue =
    findLabValue('blood sugar', 'blood_sugar', 'glucose', 'fasting glucose', 'fbs', 'rbs') ||
    userProfile?.medical_records?.blood_sugar ||
    'Not available';
  const weightGoalLabel = userProfile?.health_goals?.length ? userProfile.health_goals.join(', ') : 'General wellness';
  const dietStyleLabel = realProfile?.diet_type ? String(realProfile.diet_type) : 'Not specified';
  const bpStatusText = bpTrend ? (bpTrend.direction === 'up' ? 'Rising' : bpTrend.direction === 'down' ? 'Improving' : 'Stable') : 'Tracked';
  const sugarStatusText = sugarTrend ? (sugarTrend.direction === 'up' ? 'Rising' : sugarTrend.direction === 'down' ? 'Improving' : 'Stable') : 'Tracked';
  const bpStatusClass = bpTrend?.direction === 'down' ? 'good' : 'neutral';
  const sugarStatusClass = sugarTrend?.direction === 'down' ? 'good' : 'neutral';

  return (
    <div className="personalized-reco-shell" style={{ padding: '14px', maxWidth: '1320px', margin: '0 auto', fontFamily: 'Sora, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        .personalized-reco-shell {
          background: #f4f6f8;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
        }
        .personalized-grid { display: grid; grid-template-columns: 1fr 350px; gap: 24px; width: 100%; }
        .plan-day-wrap { margin-bottom: 24px; }
        .plan-day-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .plan-main-card,
        .plan-side-card {
          background: #ffffff;
          border: 1px solid #dbe3ef;
          box-shadow: 0 16px 28px -24px rgba(15, 23, 42, 0.45);
          border-radius: 20px;
        }
        .plan-main-card { padding: 26px; }
        .plan-side-card { padding: 22px; height: fit-content; }
        .tracker-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 18px;
        }
        .meal-type-card {
          background: #f8fafc;
          padding: 18px;
          border-radius: 15px;
          border: 1px solid #dbe3ef;
        }
        .meal-type-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 26px;
          padding: 0 8px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #0f172a;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .meal-item-card {
          background: #ffffff;
          padding: 18px;
          border-radius: 12px;
          border: 1px solid #dbe3ef;
          margin-bottom: 14px;
          box-shadow: 0 10px 18px -16px rgba(15, 23, 42, 0.55);
        }
        .note-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .note-box--recommendations {
          background: #fffcf5;
          border-color: #f3e8cf;
          border-left: 4px solid #b45309;
        }
        .note-box--profile {
          background: #f8fafc;
          border-color: #dce5f0;
          border-left: 4px solid #334155;
        }
        .note-box--medical {
          background: #fff7f7;
          border-color: #f5dcdc;
          border-left: 4px solid #b91c1c;
        }
        .note-box--supplements {
          background: #f7fafc;
          border-color: #d5e3ee;
          border-left: 4px solid #0f766e;
        }
        .note-box-title {
          font-size: 0.92rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 10px;
          letter-spacing: 0.01em;
        }
        .note-box-content {
          font-size: 0.85rem;
          color: #334155;
          line-height: 1.5;
        }
        .note-box-content strong {
          color: #0f172a;
          font-weight: 700;
        }
        @media (max-width: 1080px) {
          .personalized-grid { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>
      {/* Day Selector */}
      <div className="plan-day-wrap">
        <div className="plan-day-row">
          {daysOfWeek.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                padding: '10px 16px',
                border: selectedDay === day ? '1px solid #0f172a' : '1px solid #cbd5e1',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: selectedDay === day ? '#0f172a' : '#ffffff',
                color: selectedDay === day ? '#ffffff' : '#475569',
                boxShadow: selectedDay === day ? '0 10px 20px -14px rgba(15, 23, 42, 0.95)' : '0 2px 4px rgba(0,0,0,0.03)'
              }}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <div>Loading personalized meal plan...</div>
        </div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>
          <button 
            onClick={fetchPersonalizedMealPlan}
            style={{ padding: '10px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700 }}
          >
            Retry
          </button>
        </div>
      ) : (
        (() => {
          if (!selectedDayPlan) {
            return (
              <div style={{ padding: '24px', border: '1px solid #dbe3ef', borderRadius: '14px', background: '#ffffff', color: '#475569' }}>
                No food recommendations available yet. Click Retry to regenerate your plan.
              </div>
            );
          }
          
          return (
          <>
          <div className="personalized-grid">
              {/* Main Meal Content */}
              <div className="plan-main-card">
          <div style={{ 
                  display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '25px',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
              {effectiveSelectedDay}'s Personalized Meals
            </h3>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1rem', color: '#64748b', marginBottom: '5px' }}>
                Total: <span style={{ fontWeight: 800, color: '#d97706' }}>{selectedDayPlan?.total_calories || 0}</span> cal
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Protein: <span style={{ fontWeight: 600, color: '#059669' }}>{selectedDayPlan?.total_protein || 0}g</span>
              </div>
            </div>
          </div>

          <div className="nutrition-sidebar">
            {/* Header Section */}
            <div className="sidebar-header">
              <div className="header-content">
                <div className="header-icon">📊</div>
                <div>
                  <h3 className="header-title">Daily Intake Tracker</h3>
                  {adherenceStatus && (
                    <div className={`status-badge ${adherenceStatus.includes('ahead') ? 'status-success' : adherenceStatus.includes('behind') ? 'status-warning' : 'status-info'}`}>
                      {adherenceStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Cards Grid */}
            <div className="progress-grid">
              <div className="progress-card calories-card">
                <div className="progress-icon">🔥</div>
                <div className="progress-content">
                  <div className="progress-label">Consumed Calories</div>
                  <div className="progress-value">{Math.round(consumedTotalCalories)}</div>
                  <div className="progress-unit">kcal</div>
                </div>
              </div>

              <div className="progress-card food-card">
                <div className="progress-icon">🍽</div>
                <div className="progress-content">
                  <div className="progress-label">Food Progress</div>
                  <div className="progress-value">{foodProgressPercent}%</div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${foodProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="progress-card water-card">
                <div className="progress-icon">💧</div>
                <div className="progress-content">
                  <div className="progress-label">Water Progress</div>
                  <div className="progress-value">{waterProgressPercent}%</div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill water-fill" 
                      style={{ width: `${waterProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Add Food Section */}
            <div className="add-food-section">
              <div className="section-header">
                <div className="section-icon">➕</div>
                <h4 className="section-title">Add Other Food</h4>
              </div>
              
              <div className="food-input-group">
                <input
                  value={newFoodName}
                  onChange={(e) => setNewFoodName(e.target.value)}
                  placeholder="Food name"
                  className="food-input"
                />
                <input
                  type="number"
                  value={newFoodCalories}
                  onChange={(e) => setNewFoodCalories(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Calories"
                  className="calories-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newFoodName.trim() || !newFoodCalories || Number(newFoodCalories) <= 0) return;
                    const next = [...extraFoods, { name: newFoodName.trim(), calories: Number(newFoodCalories) }];
                    setExtraFoods(next);
                    setNewFoodName('');
                    setNewFoodCalories('');
                    persistAdherence(completedItemIds, next, waterMl);
                  }}
                  className="add-food-btn"
                  disabled={!newFoodName.trim() || !newFoodCalories || Number(newFoodCalories) <= 0}
                >
                  Add Food
                </button>
              </div>

              {extraFoods.length > 0 && (
                <div className="extra-foods-list">
                  {extraFoods.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="extra-food-item">
                      <span className="food-name">{f.name}</span>
                      <span className="food-calories">{Math.round(f.calories)} kcal</span>
                      <button
                        onClick={() => {
                          const next = extraFoods.filter((_, idx) => idx !== i);
                          setExtraFoods(next);
                          persistAdherence(completedItemIds, next, waterMl);
                        }}
                        className="remove-food-btn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Water Intake Section */}
            <div className="water-section">
              <div className="section-header">
                <div className="section-icon">💧</div>
                <h4 className="section-title">Water Intake</h4>
              </div>
              
              <div className="water-controls">
                <div className="water-display">
                  <span className="current-water">{waterMl}</span>
                  <span className="water-target">/ {waterTargetMl} ml</span>
                </div>
                
                <div className="water-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(0, waterMl + 250);
                      setWaterMl(next);
                      persistAdherence(completedItemIds, extraFoods, next);
                    }}
                    className="water-btn increment-btn"
                  >
                    +250 ml
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = waterTargetMl;
                      setWaterMl(next);
                      persistAdherence(completedItemIds, extraFoods, next);
                    }}
                    className="water-btn target-btn"
                  >
                    Mark Target Done
                  </button>
                </div>
                
                <input
                  type="number"
                  value={waterMl}
                  onChange={(e) => setWaterMl(Number(e.target.value || 0))}
                  onBlur={() => persistAdherence(completedItemIds, extraFoods, waterMl)}
                  className="water-input"
                  min="0"
                  max="5000"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {['breakfast', 'lunch', 'snacks', 'dinner'].map((mealType) => (
              <div key={mealType} className="meal-type-card">
                <h4 style={{ 
                  margin: '0 0 15px 0', 
                  fontSize: '1.1rem', 
                  fontWeight: 700, 
                  color: '#475569',
                  textTransform: 'capitalize',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {mealType === 'breakfast' && <span className="meal-type-badge">B</span>}
                  {mealType === 'lunch' && <span className="meal-type-badge">L</span>}
                  {mealType === 'snacks' && <span className="meal-type-badge">S</span>}
                  {mealType === 'dinner' && <span className="meal-type-badge">D</span>}
                  {mealType}
                </h4>
                {(() => {
                  const planned = (selectedDayPlan?.meals?.[mealType as keyof typeof selectedDayPlan.meals] as PersonalizedMeal[]) || [];
                  if (planned.length === 0) {
                    return (
                      <div style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600, padding: '6px 0 2px' }}>
                        No recommended items for this meal slot.
                      </div>
                    );
                  }
                  return planned.map((meal: PersonalizedMeal, idx: number) => (
                  <div key={idx} className="meal-item-card">
                    {(() => {
                      const itemId = buildMealItemId(mealType, idx, meal.name);
                      const checked = completedItemIds.includes(itemId);
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? completedItemIds.filter((id) => id !== itemId)
                                : [...completedItemIds, itemId];
                              setCompletedItemIds(next);
                              persistAdherence(next, extraFoods, waterMl);
                            }}
                          />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: checked ? '#059669' : '#475569' }}>
                            Mark as finished
                          </span>
                        </label>
                      );
                    })()}
                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', marginBottom: '12px' }}>
                      {meal.name}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '1rem', color: '#64748b' }}>
                        {meal.calories} cal • {meal.protein}g protein
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#059669', fontWeight: 600 }}>
                        Serving: {getServingDisplayText(meal)}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 600, marginBottom: '4px', color: '#64748b' }}>MACROS</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            P: {meal.protein}g
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            C: {meal.carbs}g
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            F: {meal.fats}g
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 600, marginBottom: '4px', color: '#64748b' }}>FIBER</div>
                        <span style={{ fontSize: '0.8rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {Number(meal.fiber || 0).toFixed(1)}g
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 600, marginBottom: '4px', color: '#64748b' }}>INGREDIENTS</div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                        {meal.ingredients.join(', ')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Prep: {meal.preparation_time} mins
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>Benefit: {meal.health_benefits[0]}
                      </span>
                    </div>
                  </div>
                ));
                })()}
              </div>
            ))}
          </div>
        </div>

        {/* Personalized Notes Sidebar */}
        <div className="plan-side-card">
          {/* Enhanced Header with Health Focus */}
          <div className="notes-header">
            <div className="notes-header-icon"></div>
            <div className="notes-header-content">
              <h3 className="notes-title">Personalized Health Updates</h3>
              <div className="day-focus">
                <span className="day-label">{effectiveSelectedDay}</span>
                <span className="focus-badge">Heart Health Focus</span>
              </div>
            </div>
          </div>

          {/* Health Status Cards */}
          <div className="health-status-grid">
            <div className="health-card blood-pressure-card">
              <div className="health-icon">💗</div>
              <div className="health-content">
                <div className="health-title">Blood Pressure</div>
                <div className="health-value">{bpValue}</div>
                <div className={`health-status ${bpStatusClass}`}>{bpStatusText}</div>
                <div className="health-detail">{bpTrend ? `${bpTrend.previousValue} -> ${bpTrend.currentValue}` : 'Waiting for trend data from reports'}</div>
              </div>
            </div>

            <div className="health-card blood-sugar-card">
              <div className="health-icon">🩸</div>
              <div className="health-content">
                <div className="health-title">Blood Sugar</div>
                <div className="health-value">{sugarValue}</div>
                <div className={`health-status ${sugarStatusClass}`}>{sugarStatusText}</div>
                <div className="health-detail">{sugarTrend ? `${sugarTrend.previousValue} -> ${sugarTrend.currentValue}` : 'Waiting for trend data from reports'}</div>
              </div>
            </div>

            <div className="health-card weight-card">
              <div className="health-icon">⚖️</div>
              <div className="health-content">
                <div className="health-title">Weight Goal</div>
                <div className="health-value">{weightGoalLabel}</div>
                <div className="health-status neutral">Active Goal</div>
                <div className="health-detail">Current weight: {userProfile?.weight_kg ? `${userProfile.weight_kg} kg` : 'Not available'}</div>
              </div>
            </div>

            <div className="health-card diet-card">
              <div className="health-icon">🥗</div>
              <div className="health-content">
                <div className="health-title">Diet Style</div>
                <div className="health-value">{dietStyleLabel}</div>
                <div className="health-status neutral">Customized</div>
                <div className="health-detail">Protein target: {selectedDayPlan?.total_protein ? `${Math.round(selectedDayPlan.total_protein)} g/day` : 'Calculated from plan'}</div>
              </div>
            </div>
          </div>

          {/* Daily Recommendations */}
          {(selectedDayPlan?.personalized_notes?.length || 0) > 0 && (
            <div className="recommendations-section">
              <div className="section-header recommendations-header">
                <div className="section-icon">📋</div>
                <h4 className="section-title">{effectiveSelectedDay} Meal Plan</h4>
              </div>
              <div className="recommendations-list">
                {selectedDayPlan?.personalized_notes?.map((note: string, idx: number) => (
                  <div key={idx} className="recommendation-item">
                    <div className="recommendation-priority">
                      <div className="priority-indicator high"></div>
                      <span className="priority-text">Priority</span>
                    </div>
                    <div className="recommendation-content">
                      {note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="note-box note-box--recommendations">
            <div className="note-box-title">Report Comparison Summary</div>
            <div className="note-box-content">
              
              {reportComparison.latestIsDuplicate ? ' Latest upload appears to be already uploaded before.' : ''}
              {reportComparison.duplicateGroups.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.84rem' }}>
                  {reportComparison.duplicateGroups.slice(0, 2).map((group, idx) => (
                    <div key={idx} style={{ marginBottom: '4px' }}>
                      {group.filenames.join(', ')} ({group.count} uploads)
                    </div>
                  ))}
                </div>
              )}
              {reportComparison.diseaseTrendAlerts.length > 0 && (
                <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
                  {reportComparison.diseaseTrendAlerts.slice(0, 6).map((alert, idx) => (
                    <div
                      key={`${alert.condition}-${alert.lab}-${idx}`}
                      style={{
                        border: `1px solid ${alert.level === 'warning' ? '#fecaca' : alert.level === 'good' ? '#bbf7d0' : '#cbd5e1'}`,
                        background: alert.level === 'warning' ? '#fef2f2' : alert.level === 'good' ? '#f0fdf4' : '#f8fafc',
                        color: alert.level === 'warning' ? '#991b1b' : alert.level === 'good' ? '#166534' : '#334155',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      {alert.level === 'warning' ? 'ALERT:' : alert.level === 'good' ? 'Improved:' : 'Stable:'} {alert.condition} - {alert.lab} {alert.direction === 'up' ? 'went up' : alert.direction === 'down' ? 'fell down' : 'did not change'} ({alert.previousValue} {'->'} {alert.currentValue}{alert.changePercent !== null ? `, ${alert.changePercent > 0 ? '+' : ''}${alert.changePercent}%` : ''})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Food Integration */}
          <div className="food-integration-section">
            <div className="section-header food-header">
              <div className="section-icon">🍽</div>
              <h4 className="section-title">Food Integration</h4>
            </div>
            
            <div className="food-categories">
              <div className="food-category included">
                <div className="category-title">Included Foods</div>
                <div className="food-tags">
                  <span className="food-tag primary">🍛 Roti</span>
                  <span className="food-tag primary">🍛 Curry</span>
                  <span className="food-tag primary">🍛 Rice</span>
                </div>
              </div>

              <div className="food-category avoided">
                <div className="category-title">Avoid Foods</div>
                <div className="food-tags">
                  <span className="food-tag danger">🚫 Butter</span>
                  <span className="food-tag danger">🚫 Sugary Drinks</span>
                  <span className="food-tag danger">🚫 Chips</span>
                  <span className="food-tag danger">🚫 Ice Cream</span>
                  <span className="food-tag danger">🚫 Red Meat</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Profile Summary */}
          <div className="note-box note-box--profile">
            <div className="note-box-title">
              Your Profile
            </div>
            <div className="note-box-content">
              <div style={{ marginBottom: '8px' }}>
                <strong>Age:</strong> {userProfile?.age || 'Not specified'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Weight:</strong> {userProfile?.weight_kg || 'Not specified'} kg
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Height:</strong> {userProfile?.height_cm || 'Not specified'} cm
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Activity Level:</strong> {userProfile?.lifestyle_level || 'Not specified'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Health Goals:</strong> {userProfile?.health_goals?.join(', ') || 'Not specified'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Dietary Restrictions:</strong> {userProfile?.dietary_restrictions?.join(', ') || 'None'}
              </div>
              {(userProfile?.allergies?.length || 0) > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Allergies:</strong> {userProfile?.allergies?.join(', ') || ''}
                </div>
              )}
              {(userProfile?.preferred_foods?.length || 0) > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Preferred Foods:</strong> {userProfile?.preferred_foods?.join(', ') || ''}
                </div>
              )}
              {(userProfile?.foods_to_avoid?.length || 0) > 0 && (
                <div>
                  <strong>Foods to Avoid:</strong> {userProfile?.foods_to_avoid?.join(', ') || ''}
                </div>
              )}
            </div>
          </div>

          {/* Medical Conditions */}
          {(userProfile?.medical_conditions?.length || 0) > 0 && (
            <div className="note-box note-box--medical">
              <div className="note-box-title">
                Medical Conditions
              </div>
              <div className="note-box-content">
                {userProfile?.medical_conditions?.join(', ') || ''}
              </div>
            </div>
          )}

          {/* Supplements */}
          {(userProfile?.supplements?.length || 0) > 0 && (
            <div className="note-box note-box--supplements">
              <div className="note-box-title">
                Supplements
              </div>
              <div className="note-box-content">
                {userProfile?.supplements?.join(', ') || ''}
              </div>
            </div>
          )}
        </div>
      </div>
          </>
          );
        })()
      )}
    </div>
  );
};

// CSS-in-JS styles for elegant nutrition sidebar
const sidebarStyles = `
.nutrition-sidebar {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
}

.sidebar-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 12px;
  color: white;
}

.header-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.status-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.status-info {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.progress-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.progress-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.progress-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.progress-icon {
  font-size: 1.8rem;
  margin-bottom: 8px;
  text-align: center;
  background: transparent;
  color: inherit;
}

.progress-content {
  text-align: center;
}

.progress-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 8px;
}

.progress-unit {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.calories-card .progress-fill {
  background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
}

.food-card .progress-fill {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.water-fill {
  background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%);
}

.add-food-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 1.2rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #8b5cf6;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

.food-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.food-input, .calories-input {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: white;
}

.food-input:focus, .calories-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.food-input {
  flex: 1;
  min-width: 140px;
}

.calories-input {
  width: 110px;
}

.add-food-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.add-food-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.add-food-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.extra-foods-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.extra-food-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.extra-food-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.food-name {
  font-weight: 600;
  color: #1e293b;
  flex: 1;
}

.food-calories {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.remove-food-btn {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.remove-food-btn:hover {
  background: #fef2f2;
  color: #dc2626;
}

.water-section {
  margin-bottom: 24px;
}

.water-controls {
  margin-bottom: 16px;
}

.water-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
}

.current-water {
  font-size: 1.8rem;
  font-weight: 800;
  color: #06b6d4;
}

.water-target {
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
}

.water-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.water-btn {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.water-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  transform: translateY(-1px);
}

.increment-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-color: #059669;
}

.target-btn {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-color: #8b5cf6;
}

.water-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: white;
}

.water-input:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

// Enhanced Personalized Notes Styles
.notes-header {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.notes-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.notes-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: #1e293b;
}

.day-focus {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-label {
  font-size: 1rem;
  color: #64748b;
  font-weight: 600;
}

.focus-badge {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.health-status-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.health-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s ease;
}

.health-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.health-title {
  font-size: 0.9rem;
  color: #374151;
  font-weight: 700;
  margin-bottom: 4px;
}

.health-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 4px;
}

.health-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.health-status.good {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.health-status.neutral {
  background: linear-gradient(135deg, #6b7280 0%, #8b5cf6 100%);
  color: white;
}

.health-detail {
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.3;
}

.recommendations-section {
  margin-bottom: 24px;
}

.recommendations-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #10b981;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.recommendation-item:hover {
  background: #f0f9ff;
  border-left-color: #059669;
  transform: translateX(4px);
}

.recommendation-priority {
  display: flex;
  align-items: center;
  gap: 6px;
}

.priority-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.priority-text {
  font-size: 0.7rem;
  color: #10b981;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recommendation-content {
  flex: 1;
  font-size: 0.9rem;
  color: #1e293b;
  line-height: 1.4;
}

.food-integration-section {
  margin-bottom: 24px;
}

.food-categories {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.food-category {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
}

.category-title {
  font-size: 0.9rem;
  color: #374151;
  font-weight: 700;
  margin-bottom: 8px;
}

.food-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.food-tag {
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.food-tag.primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.food-tag.danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

@media (max-width: 768px) {
  .health-status-grid {
    grid-template-columns: 1fr;
  }
  
  .food-categories {
    grid-template-columns: 1fr;
  }
  
  .recommendation-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;

// Inject styles into document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = sidebarStyles;
  document.head.appendChild(styleSheet);
}

export default PersonalizedMealPlanDisplay;
