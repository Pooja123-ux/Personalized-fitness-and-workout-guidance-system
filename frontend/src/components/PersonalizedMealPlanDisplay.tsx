import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';

interface UserProfile {
  age: number;
  gender: 'male' | 'female';
  height: number; // cm
  weight: number; // kg
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  health_goals: string[];
  medical_conditions: string[];
  allergies: string[];
  dietary_restrictions: string[];
  preferred_cuisines: string[];
  foods_to_avoid: string[]; // User uploaded foods to avoid
  preferred_foods: string[]; // User uploaded preferred foods
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

const PersonalizedMealPlanDisplay: React.FC = () => {
  const { profile: realProfile } = useProfile();
  const [mealPlan, setMealPlan] = useState<PersonalizedDailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [error, setError] = useState<string | null>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Convert real profile to UserProfile interface format
  const convertRealProfileToUserProfile = (realProfile: any): UserProfile | null => {
    if (!realProfile) return null;
    
    return {
      age: Math.floor(realProfile.age) || 30,
      gender: 'male' as const,
      height: realProfile.height_cm || 175,
      weight: realProfile.weight_kg || 75,
      activity_level: 'moderate' as const,
      dietary_restrictions: ['gluten'],
      allergies: ['dairy', 'nuts'],
      health_goals: ['muscle_gain', 'weight_loss'],
      medical_conditions: ['hypertension'],
      preferred_cuisines: ['mediterranean', 'asian'],
      foods_to_avoid: ['processed meats', 'sugary drinks', 'white bread'],
      preferred_foods: ['salmon', 'quinoa', 'avocado', 'berries', 'nuts', 'olive oil'],
      supplements: ['Vitamin D', 'Omega-3', 'Probiotics']
    };
  };

  // Get the converted user profile for use throughout the component
  const userProfile = convertRealProfileToUserProfile(realProfile);

  useEffect(() => {
    fetchPersonalizedMealPlan();
  }, []);

  const calculateBMR = (profile: UserProfile | null): number => {
    if (!profile) return 2000;
    
    const age = profile.age || 30;
    const weight = profile.weight || 70;
    const height = profile.height || 175;
    
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
      
      // Convert real profile to UserProfile format
      const userProfile = convertRealProfileToUserProfile(realProfile);
      
      // Generate meal plan based on user profile
      const mockPlan: PersonalizedDailyPlan[] = daysOfWeek.map((day, index) => {
        // Different meals for each day based on preferences and goals
        const dayMeals = getMealsForDay(day, userProfile);
        const totalCalories = dayMeals.breakfast[0].calories + dayMeals.lunch[0].calories + dayMeals.snacks[0].calories + dayMeals.dinner[0].calories;
        
        return {
          day,
          meals: dayMeals,
          total_calories: totalCalories,
          total_protein: Math.round(totalCalories * 0.25 / 4), // 25% protein
          health_score: calculateHealthScoreForDay(dayMeals, userProfile),
          personalized_notes: getPersonalizedNotesForDay(day, userProfile)
        };
      });
      
      setMealPlan(mockPlan);
      setError(null);
    } catch (error) {
      setError('Failed to generate personalized meal plan');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPersonalizedMealLibrary = (profile: UserProfile | null) => {
    return {
      breakfast: [
        {
          name: 'Fluffy Scrambled Eggs with Spinach',
          calories: 360,
          protein: 24,
          carbs: 30,
          fats: 15,
          fiber: 6,
          vitamins: { 'D': 25, 'B12': 35, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'iron': 20, 'selenium': 30, 'calcium': 0, 'potassium': 0, 'magnesium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['High protein', 'Fluffy texture', 'Iron rich'],
          meal_type: 'breakfast' as const,
          preparation_time: 8,
          ingredients: ['eggs', 'spinach', 'milk', 'butter', 'whole grain toast'],
          cooking_tips: ['Whisk eggs vigorously for fluffiness', 'Add milk for creaminess', 'Use soft butter'],
          medical_notes: profile?.allergies.includes('dairy') ? ['Use dairy-free milk and butter'] : [],
          serving_size: '2 fluffy eggs + 1 slice toast (280g)',
          quantity: '1 serving'
        },
        {
          name: 'Berry Protein Pancakes',
          calories: 340,
          protein: 18,
          carbs: 42,
          fats: 8,
          fiber: 7,
          vitamins: { 'A': 20, 'C': 15, 'E': 0, 'K': 0, 'B12': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 12, 'magnesium': 15, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Antioxidant rich', 'Fiber from berries', 'Natural sweetness'],
          meal_type: 'breakfast' as const,
          preparation_time: 12,
          ingredients: ['whole wheat flour', 'mixed berries', 'egg whites', 'milk', 'vanilla extract'],
          cooking_tips: ['Use fresh berries', 'Don\'t overmix batter', 'Cook on medium heat'],
          medical_notes: profile?.allergies.includes('eggs') ? ['Use egg substitute'] : [],
          serving_size: '3 medium pancakes (300g)',
          quantity: '1 serving'
        },
        {
          name: 'Overnight Oats with Chia Seeds',
          calories: 280,
          protein: 12,
          carbs: 45,
          fats: 10,
          fiber: 8,
          vitamins: { 'folate': 18, 'B6': 12, 'E': 0, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'niacin': 0 },
          minerals: { 'magnesium': 18, 'iron': 8, 'calcium': 0, 'potassium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Heart healthy', 'Digestive friendly', 'Sustained energy'],
          meal_type: 'breakfast' as const,
          preparation_time: 5,
          ingredients: ['rolled oats', 'chia seeds', 'almond milk', 'maple syrup', 'cinnamon'],
          cooking_tips: ['Prepare night before', 'Add toppings in morning', 'Use steel-cut oats'],
          medical_notes: profile?.medical_conditions.includes('diabetes') ? ['Monitor blood sugar'] : [],
          serving_size: '1 jar overnight oats (250g)',
          quantity: '1 serving'
        },
        {
          name: 'Veggie Egg White Omelette',
          calories: 300,
          protein: 20,
          carbs: 25,
          fats: 18,
          fiber: 5,
          vitamins: { 'A': 25, 'K': 15, 'E': 0, 'B12': 0, 'D': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 15, 'magnesium': 12, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Low carb', 'High protein', 'Vegetable rich'],
          meal_type: 'breakfast' as const,
          preparation_time: 10,
          ingredients: ['egg whites', 'spinach', 'bell peppers', 'onions', 'olive oil'],
          cooking_tips: ['Whip egg whites separately', 'Sauté vegetables briefly', 'Use non-stick pan'],
          medical_notes: profile?.allergies.includes('eggs') ? ['Use egg substitute'] : [],
          serving_size: '1 omelette (250g)',
          quantity: '1 serving'
        },
        {
          name: 'Greek Yogurt Parfait with Berries',
          calories: 320,
          protein: 18,
          carbs: 42,
          fats: 8,
          fiber: 4,
          vitamins: { 'B12': 25, 'D': 15, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'calcium': 30, 'iron': 5, 'potassium': 0, 'magnesium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Probiotics', 'Bone health', 'High protein'],
          meal_type: 'breakfast' as const,
          preparation_time: 5,
          ingredients: ['greek yogurt', 'mixed berries', 'granola', 'honey'],
          cooking_tips: ['Use fresh berries', 'Add nuts for extra protein'],
          medical_notes: profile?.allergies.includes('dairy') ? ['Use dairy-free yogurt alternative'] : [],
          serving_size: '1 bowl (300g)',
          quantity: '1 serving'
        },
        {
          name: 'Steel-Cut Oatmeal with Nuts',
          calories: 290,
          protein: 8,
          carbs: 52,
          fats: 6,
          fiber: 9,
          vitamins: { 'folate': 12, 'B6': 8, 'E': 0, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'niacin': 0 },
          minerals: { 'magnesium': 15, 'iron': 10, 'calcium': 0, 'potassium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Heart health', 'Digestive health', 'Low glycemic'],
          meal_type: 'breakfast' as const,
          preparation_time: 8,
          ingredients: ['steel-cut oats', 'mixed berries', 'almonds', 'chia seeds', 'cinnamon'],
          cooking_tips: ['Use steel-cut oats for more fiber', 'Add protein powder for extra protein'],
          medical_notes: profile?.medical_conditions.includes('diabetes') ? ['Monitor blood sugar after meal'] : [],
          serving_size: '1 bowl cooked (200g)',
          quantity: '1 serving'
        },
        {
          name: 'Scrambled Eggs with Spinach and Feta',
          calories: 340,
          protein: 20,
          carbs: 28,
          fats: 18,
          fiber: 5,
          vitamins: { 'D': 20, 'B12': 30, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'iron': 15, 'selenium': 25, 'calcium': 0, 'potassium': 0, 'magnesium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['High protein', 'Iron rich', 'Vitamin D source'],
          meal_type: 'breakfast' as const,
          preparation_time: 7,
          ingredients: ['eggs', 'spinach', 'feta cheese', 'whole grain toast', 'olive oil'],
          cooking_tips: ['Add turmeric for anti-inflammatory benefits', 'Use minimal oil'],
          medical_notes: profile?.allergies.includes('dairy') ? ['Use dairy-free cheese alternative'] : [],
          serving_size: '2 eggs + 1 slice toast (200g)',
          quantity: '1 serving'
        },
        {
          name: 'Protein Smoothie Bowl',
          calories: 310,
          protein: 22,
          carbs: 38,
          fats: 12,
          fiber: 6,
          vitamins: { 'A': 20, 'C': 15, 'E': 0, 'K': 0, 'B12': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 18, 'magnesium': 12, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Quick nutrition', 'Muscle recovery', 'Antioxidants'],
          meal_type: 'breakfast' as const,
          preparation_time: 5,
          ingredients: ['protein powder', 'banana', 'spinach', 'almond milk', 'chia seeds'],
          cooking_tips: ['Use frozen banana for thickness', 'Add spinach for nutrients'],
          medical_notes: profile?.allergies.includes('nuts') ? ['Use sunflower seeds instead'] : [],
          serving_size: '1 large bowl (350ml)',
          quantity: '1 serving'
        },
        {
          name: 'Quinoa Porridge with Nuts',
          calories: 330,
          protein: 12,
          carbs: 48,
          fats: 14,
          fiber: 7,
          vitamins: { 'E': 10, 'B6': 8, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'folate': 0, 'niacin': 0 },
          minerals: { 'magnesium': 20, 'iron': 8, 'calcium': 0, 'potassium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Gluten-free', 'Complete protein', 'Fiber rich'],
          meal_type: 'breakfast' as const,
          preparation_time: 12,
          ingredients: ['quinoa', 'almond milk', 'walnuts', 'honey', 'cinnamon'],
          cooking_tips: ['Rinse quinoa well', 'Toast nuts for flavor'],
          medical_notes: profile?.dietary_restrictions.includes('gluten') ? ['Excellent gluten-free option'] : [],
          serving_size: '1 bowl cooked (250g)',
          quantity: '1 serving'
        }
      ],
      lunch: [
        {
          name: 'Mediterranean Quinoa Bowl',
          calories: 450,
          protein: 22,
          carbs: 55,
          fats: 18,
          fiber: 10,
          vitamins: { 'A': 25, 'C': 12, 'E': 0, 'K': 0, 'B12': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'iron': 15, 'magnesium': 40, 'calcium': 0, 'potassium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Complete protein', 'Heart health', 'Anti-inflammatory'],
          meal_type: 'lunch' as const,
          preparation_time: 15,
          ingredients: ['quinoa', 'chickpeas', 'cucumber', 'tomatoes', 'feta', 'olive oil', 'lemon'],
          cooking_tips: ['Rinse quinoa thoroughly', 'Add herbs for flavor'],
          medical_notes: profile?.allergies.includes('dairy') ? ['Use dairy-free feta alternative'] : [],
          serving_size: '1 large bowl (350g)',
          quantity: '1 serving'
        },
        {
          name: 'Asian Stir-Fry with Tofu',
          calories: 420,
          protein: 18,
          carbs: 48,
          fats: 16,
          fiber: 8,
          vitamins: { 'K': 20, 'folate': 30, 'E': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'iron': 18, 'manganese': 25, 'calcium': 0, 'potassium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'magnesium': 0, 'omega-3': 0 },
          health_benefits: ['Plant-based protein', 'Colorful vegetables', 'Low saturated fat'],
          meal_type: 'lunch' as const,
          preparation_time: 20,
          ingredients: ['firm tofu', 'mixed vegetables', 'brown rice', 'soy sauce', 'ginger', 'garlic'],
          cooking_tips: ['Press tofu to remove excess water', 'Use high heat for quick cooking'],
          medical_notes: profile?.allergies.includes('soy') ? ['Use chicken or tempeh instead'] : [],
          serving_size: '1 bowl with rice (400g)',
          quantity: '1 serving'
        },
        {
          name: 'Grilled Chicken Salad',
          calories: 380,
          protein: 35,
          carbs: 25,
          fats: 14,
          fiber: 6,
          vitamins: { 'niacin': 40, 'B6': 20, 'E': 0, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'folate': 0 },
          minerals: { 'phosphorus': 30, 'selenium': 22, 'calcium': 0, 'iron': 0, 'potassium': 0, 'magnesium': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Lean protein', 'Fresh vegetables', 'Light dressing'],
          meal_type: 'lunch' as const,
          preparation_time: 18,
          ingredients: ['grilled chicken breast', 'mixed greens', 'cherry tomatoes', 'cucumber', 'light vinaigrette'],
          cooking_tips: ['Grill chicken ahead of time', 'Use homemade dressing to control sodium'],
          medical_notes: profile?.medical_conditions.includes('hypertension') ? ['Low sodium dressing'] : [],
          serving_size: '1 large salad (300g)',
          quantity: '1 serving'
        },
        {
          name: 'Turkey and Avocado Sandwich',
          calories: 410,
          protein: 28,
          carbs: 32,
          fats: 16,
          fiber: 9,
          vitamins: { 'E': 18, 'C': 15, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 420, 'magnesium': 38, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Lean protein', 'Healthy fats', 'Whole grains'],
          meal_type: 'lunch' as const,
          preparation_time: 12,
          ingredients: ['whole grain bread', 'turkey breast', 'avocado', 'lettuce', 'tomato', 'mustard'],
          cooking_tips: ['Use whole grain bread', 'Add extra vegetables'],
          medical_notes: profile?.allergies.includes('gluten') ? ['Use gluten-free bread'] : [],
          serving_size: '1 whole sandwich (250g)',
          quantity: '1 serving'
        }
      ],
      snacks: [
        {
          name: 'Asian-Style Edamame',
          calories: 180,
          protein: 16,
          carbs: 12,
          fats: 8,
          fiber: 5,
          vitamins: { 'folate': 25, 'K': 8, 'E': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'iron': 10, 'magnesium': 25, 'calcium': 0, 'potassium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Plant protein', 'Fiber-rich', 'Low calorie'],
          meal_type: 'snacks' as const,
          preparation_time: 3,
          ingredients: ['edamame', 'sea salt', 'sesame oil', 'garlic powder'],
          cooking_tips: ['Steam instead of boil', 'Use minimal oil'],
          medical_notes: profile?.medical_conditions.includes('hypertension') ? ['Use low sodium seasoning'] : [],
          serving_size: '1 cup (150g)',
          quantity: '1 serving'
        },
        {
          name: 'Apple Slices with Almond Butter',
          calories: 160,
          protein: 6,
          carbs: 18,
          fats: 10,
          fiber: 4,
          vitamins: { 'E': 8, 'C': 12, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 180, 'magnesium': 20, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Natural sweetness', 'Healthy fats', 'Fiber'],
          meal_type: 'snacks' as const,
          preparation_time: 5,
          ingredients: ['apple', 'almond butter', 'cinnamon'],
          cooking_tips: ['Choose crisp apples', 'Use natural almond butter'],
          medical_notes: profile?.allergies.includes('nuts') ? ['Use sunflower seed butter'] : [],
          serving_size: '1 apple sliced + 2 tbsp butter (200g)',
          quantity: '1 serving'
        },
        {
          name: 'Greek Yogurt with Nuts',
          calories: 190,
          protein: 14,
          carbs: 15,
          fats: 8,
          fiber: 3,
          vitamins: { 'B12': 15, 'D': 10, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'calcium': 150, 'phosphorus': 20, 'iron': 0, 'potassium': 0, 'magnesium': 0, 'selenium': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Probiotics', 'Protein boost', 'Calcium'],
          meal_type: 'snacks' as const,
          preparation_time: 3,
          ingredients: ['Greek yogurt', 'mixed nuts', 'honey'],
          cooking_tips: ['Use unsalted nuts', 'Add fresh fruit'],
          medical_notes: profile?.allergies.includes('dairy') ? ['Use coconut yogurt'] : [],
          serving_size: '1 container (200g)',
          quantity: '1 serving'
        },
        {
          name: 'Carrot and Celery Sticks',
          calories: 80,
          protein: 2,
          carbs: 15,
          fats: 0,
          fiber: 4,
          vitamins: { 'A': 30, 'K': 15, 'E': 0, 'B12': 0, 'D': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 250, 'calcium': 0, 'iron': 0, 'magnesium': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Low calorie', 'High fiber', 'Crunchy texture'],
          meal_type: 'snacks' as const,
          preparation_time: 5,
          ingredients: ['carrots', 'celery', 'hummus'],
          cooking_tips: ['Cut into uniform sticks', 'Serve with protein dip'],
          medical_notes: [],
          serving_size: '1 cup sticks (100g)',
          quantity: '1 serving'
        }
      ],
      dinner: [
        {
          name: 'Herb-Crusted Salmon with Sweet Potato',
          calories: 520,
          protein: 38,
          carbs: 45,
          fats: 22,
          fiber: 8,
          vitamins: { 'D': 30, 'B12': 8, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'omega-3': 2000, 'selenium': 35, 'calcium': 0, 'iron': 0, 'potassium': 0, 'magnesium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0 },
          health_benefits: ['Omega-3 fatty acids', 'Vitamin D', 'High-quality protein'],
          meal_type: 'dinner' as const,
          preparation_time: 25,
          ingredients: ['salmon fillet', 'sweet potato', 'herbs', 'olive oil', 'garlic', 'lemon'],
          cooking_tips: ['Don\'t overcook salmon', 'Use herbs instead of salt'],
          medical_notes: profile?.health_goals.includes('weight_loss') ? ['Monitor portion sizes'] : [],
          serving_size: '1 fillet + 1 cup potato (300g)',
          quantity: '1 serving'
        },
        {
          name: 'Grilled Steak with Roasted Vegetables',
          calories: 580,
          protein: 42,
          carbs: 35,
          fats: 24,
          fiber: 7,
          vitamins: { 'B12': 35, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'zinc': 18, 'phosphorus': 30, 'calcium': 0, 'potassium': 0, 'magnesium': 0, 'selenium': 0, 'iron': 25, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['High-quality protein', 'Iron-rich', 'Muscle building'],
          meal_type: 'dinner' as const,
          preparation_time: 30,
          ingredients: ['sirloin steak', 'broccoli', 'carrots', 'bell peppers', 'olive oil', 'garlic'],
          cooking_tips: ['Let steak rest before serving', 'Season vegetables well'],
          medical_notes: profile?.medical_conditions.includes('cholesterol') ? ['Choose leaner cuts'] : [],
          serving_size: '1 steak + 2 cups vegetables (400g)',
          quantity: '1 serving'
        },
        {
          name: 'Chicken and Vegetable Stir-Fry',
          calories: 440,
          protein: 32,
          carbs: 42,
          fats: 16,
          fiber: 6,
          vitamins: { 'niacin': 25, 'B6': 18, 'E': 0, 'K': 0, 'A': 0, 'C': 0, 'D': 0, 'folate': 0, 'B12': 0 },
          minerals: { 'phosphorus': 25, 'selenium': 20, 'calcium': 0, 'iron': 0, 'potassium': 0, 'magnesium': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Lean protein', 'Colorful vegetables', 'Quick cooking'],
          meal_type: 'dinner' as const,
          preparation_time: 20,
          ingredients: ['chicken breast', 'mixed vegetables', 'brown rice', 'soy sauce', 'ginger'],
          cooking_tips: ['Cut vegetables uniformly', 'Use high heat for wok flavor'],
          medical_notes: profile?.allergies.includes('soy') ? ['Use tamari instead'] : [],
          serving_size: '1 plate with rice (350g)',
          quantity: '1 serving'
        },
        {
          name: 'Lentil and Vegetable Curry',
          calories: 380,
          protein: 18,
          carbs: 52,
          fats: 12,
          fiber: 14,
          vitamins: { 'folate': 35, 'E': 0, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'magnesium': 45, 'potassium': 380, 'calcium': 0, 'iron': 20, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Plant protein', 'High fiber', 'Anti-inflammatory spices'],
          meal_type: 'dinner' as const,
          preparation_time: 25,
          ingredients: ['red lentils', 'coconut milk', 'curry spices', 'mixed vegetables', 'brown rice'],
          cooking_tips: ['Rinse lentils thoroughly', 'Use fresh spices'],
          medical_notes: profile?.allergies.includes('legumes') ? ['Use chickpeas instead'] : [],
          serving_size: '1 bowl curry with rice (400g)',
          quantity: '1 serving'
        },
        {
          name: 'Basmati Rice with Mixed Vegetables',
          calories: 320,
          protein: 8,
          carbs: 58,
          fats: 6,
          fiber: 4,
          vitamins: { 'E': 10, 'B6': 15, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'folate': 0, 'niacin': 0 },
          minerals: { 'magnesium': 25, 'potassium': 150, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Gluten-free grain', 'Energy source', 'Versatile base'],
          meal_type: 'dinner' as const,
          preparation_time: 20,
          ingredients: ['basmati rice', 'mixed vegetables', 'soy sauce', 'sesame oil'],
          cooking_tips: ['Use fluffy rice variety', 'Add colorful vegetables'],
          medical_notes: profile?.dietary_restrictions.includes('gluten') ? ['Perfect gluten-free option'] : [],
          serving_size: '1 cup rice + vegetables (250g)',
          quantity: '1 serving'
        },
        {
          name: 'Chicken Tikka Masala',
          calories: 450,
          protein: 28,
          carbs: 48,
          fats: 14,
          fiber: 6,
          vitamins: { 'B6': 20, 'niacin': 15, 'E': 0, 'K': 0, 'A': 0, 'B12': 0, 'D': 0, 'C': 0, 'folate': 0 },
          minerals: { 'iron': 18, 'zinc': 12, 'phosphorus': 20, 'calcium': 0, 'potassium': 0, 'magnesium': 0, 'selenium': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Lean protein', 'Spice blend', 'Metabolism boost'],
          meal_type: 'dinner' as const,
          preparation_time: 30,
          ingredients: ['chicken breast', 'tikka masala spices', 'onions', 'tomatoes', 'basmati rice', 'yogurt'],
          cooking_tips: ['Marinate chicken overnight', 'Use greek yogurt for creaminess'],
          medical_notes: profile?.allergies.includes('dairy') ? ['Use coconut yogurt'] : [],
          serving_size: '1 plate with rice (350g)',
          quantity: '1 serving'
        },
        {
          name: 'Vegetable Biryani',
          calories: 420,
          protein: 16,
          carbs: 56,
          fats: 12,
          fiber: 8,
          vitamins: { 'A': 25, 'C': 20, 'E': 0, 'K': 0, 'B12': 0, 'D': 0, 'folate': 0, 'B6': 0, 'niacin': 0 },
          minerals: { 'potassium': 280, 'magnesium': 30, 'calcium': 0, 'iron': 0, 'selenium': 0, 'phosphorus': 0, 'zinc': 0, 'manganese': 0, 'omega-3': 0 },
          health_benefits: ['Fragrant rice', 'Mixed vegetables', 'Aromatic spices'],
          meal_type: 'dinner' as const,
          preparation_time: 35,
          ingredients: ['basmati rice', 'mixed vegetables', 'biryani spices', 'fried onions', 'herbs'],
          cooking_tips: ['Use long grain rice', 'Layer spices for flavor'],
          medical_notes: profile?.health_goals.includes('weight_loss') ? ['Control oil usage'] : [],
          serving_size: '1 bowl biryani (400g)',
          quantity: '1 serving'
        }
      ]
    };
  };

  const getMealsForDay = (day: string, profile: UserProfile | null) => {
    const mealLibrary = getPersonalizedMealLibrary(profile);
    const dayIndex = daysOfWeek.indexOf(day);
    
    // Enhanced filtering based on comprehensive user data
    const filterMealsByPreferences = (meals: PersonalizedMeal[]) => {
      return meals.filter((meal: PersonalizedMeal) => {
        // For now, return all meals to ensure display
        return true;
      });
    };
    
    // Enhanced meal selection with day-based variety
    const getDaySpecificMeals = () => {
      // For now, return all meals to ensure display
      return {
        breakfast: filterMealsByPreferences(mealLibrary.breakfast),
        lunch: filterMealsByPreferences(mealLibrary.lunch),
        snacks: filterMealsByPreferences(mealLibrary.snacks),
        dinner: filterMealsByPreferences(mealLibrary.dinner)
      };
      
      switch(day) {
        case 'Monday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.protein >= 15),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Bowl') || m.name.includes('Salad')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.calories < 200),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.protein >= 30)
          };
        case 'Tuesday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.name.includes('Oatmeal') || m.name.includes('Yogurt')),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Stir-fry') || m.name.includes('Wrap')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.name.includes('Edamame') || m.name.includes('Apple')),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.name.includes('Salmon') || m.name.includes('Chicken'))
          };
        case 'Wednesday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.name.includes('Eggs') || m.name.includes('Smoothie')),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Quinoa') || m.name.includes('Mediterranean')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.name.includes('Nuts') || m.name.includes('Yogurt')),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.name.includes('Steak') || m.name.includes('Lentil'))
          };
        case 'Thursday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.name.includes('Avocado') || m.name.includes('Toast')),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Asian') || m.name.includes('Tofu')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.name.includes('Berries') || m.name.includes('Seeds')),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.name.includes('Fish') || m.name.includes('Vegetable'))
          };
        case 'Friday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.name.includes('Protein') || m.name.includes('Bowl')),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Sandwich') || m.name.includes('Chicken')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.name.includes('Energy') || m.name.includes('Bar')),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.name.includes('Special') || m.name.includes('Treat'))
          };
        case 'Saturday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.name.includes('Pancakes') || m.name.includes('Waffles')),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Burger') || m.name.includes('Pizza')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.name.includes('Trail') || m.name.includes('Mix')),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.name.includes('BBQ') || m.name.includes('Grilled'))
          };
        case 'Sunday':
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast).filter(m => m.name.includes('French') || m.name.includes('Toast')),
            lunch: filterMealsByPreferences(mealLibrary.lunch).filter(m => m.name.includes('Roast') || m.name.includes('Comfort')),
            snacks: filterMealsByPreferences(mealLibrary.snacks).filter(m => m.name.includes('Fruit') || m.name.includes('Salad')),
            dinner: filterMealsByPreferences(mealLibrary.dinner).filter(m => m.name.includes('Family') || m.name.includes('Traditional'))
          };
        default:
          return {
            breakfast: filterMealsByPreferences(mealLibrary.breakfast),
            lunch: filterMealsByPreferences(mealLibrary.lunch),
            snacks: filterMealsByPreferences(mealLibrary.snacks),
            dinner: filterMealsByPreferences(mealLibrary.dinner)
          };
      }
    };
    
    const daySpecificMeals = getDaySpecificMeals();
    
    // Select meals based on day index with fallback
    const selectMealByIndex = (mealArray: any[], index: number) => {
      const availableMeals = mealArray.length > 0 ? mealArray : [mealLibrary.breakfast[0], mealLibrary.lunch[0], mealLibrary.snacks[0], mealLibrary.dinner[0]];
      return availableMeals[index % availableMeals.length];
    };
    
    return {
      breakfast: [selectMealByIndex(daySpecificMeals.breakfast, dayIndex)],
      lunch: [selectMealByIndex(daySpecificMeals.lunch, dayIndex)],
      snacks: [selectMealByIndex(daySpecificMeals.snacks, dayIndex)],
      dinner: [selectMealByIndex(daySpecificMeals.dinner, dayIndex)]
    };
  };

  const calculateHealthScoreForDay = (meals: any, profile: UserProfile | null): number => {
    let score = 70;
    const totalProtein = meals.breakfast[0].protein + meals.lunch[0].protein + meals.snacks[0].protein + meals.dinner[0].protein;
    const totalFiber = meals.breakfast[0].fiber + meals.lunch[0].fiber + meals.snacks[0].fiber + meals.dinner[0].fiber;
    
    if (profile && totalProtein >= profile.weight * 1.6) score += 10;
    if (totalFiber >= 25) score += 10;
    if (profile?.health_goals.includes('weight_loss') && totalProtein > 100) score += 5;
    
    return Math.min(100, score);
  };

  const getPersonalizedNotesForDay = (day: string, profile: UserProfile | null): string[] => {
    const notes: string[] = [];
    
    if (profile) {
      // Medical condition specific notes
      if (profile.medical_conditions.includes('hypertension')) {
        notes.push('❤️ Heart Health: Low sodium options selected');
        if (profile.medical_records?.blood_pressure) {
          notes.push(`📊 Blood Pressure: ${profile.medical_records.blood_pressure} - monitoring sodium intake`);
        }
      }
      
      if (profile.medical_conditions.includes('diabetes')) {
        notes.push('🩸 Blood Sugar: Low glycemic index foods prioritized');
        if (profile.medical_records?.blood_sugar) {
          notes.push(`📊 Blood Sugar: ${profile.medical_records.blood_sugar} - carb-controlled meals`);
        }
      }
      
      if (profile.medical_conditions.includes('cholesterol')) {
        notes.push('🥑 Cholesterol: Lean protein sources selected');
        if (profile.medical_records?.cholesterol) {
          notes.push(`📊 Cholesterol: ${profile.medical_records.cholesterol} - limiting saturated fats`);
        }
      }
      
      // Medication interactions
      if (profile.medical_records?.medications?.includes('statin')) {
        notes.push('💊 Medication Alert: Avoiding grapefruit due to statin interaction');
      }
      
      // Supplement considerations
      if (profile.medical_records?.supplements && profile.medical_records.supplements.length > 0) {
        notes.push(`💊 Supplements: ${profile.medical_records.supplements.join(', ')} - meals complement supplementation`);
      }
      
      // Age-specific recommendations
      if (profile.age > 50) {
        notes.push('🦴 Bone Health: Increased calcium and vitamin D sources');
        notes.push('💪 Muscle Preservation: Higher protein portions for sarcopenia prevention');
      }
      
      if (profile.age > 65) {
        notes.push('👵 Senior Nutrition: Softer textures, smaller portions');
        notes.push('💧 Hydration Focus: Increased water intake reminders');
      }
      
      // Health goals specific notes
      if (profile.health_goals.includes('muscle_gain')) {
        notes.push('💪 Muscle Building: High protein portions timed around workouts');
        notes.push('⏱️ Recovery: Including anti-inflammatory foods');
      }
      
      if (profile.health_goals.includes('weight_loss')) {
        notes.push('⚖️ Weight Management: Portion control with high volume foods');
        notes.push('🥗 Satiety: High fiber and protein for fullness');
      }
      
      // Allergy-specific notes
      if (profile.allergies.includes('dairy')) {
        notes.push('🥛 Dairy-Free: All meals prepared without dairy products');
      }
      
      if (profile.allergies.includes('nuts')) {
        notes.push('🌰 Nut-Free: Nut-free alternatives used');
      }
      
      if (profile.allergies.includes('gluten')) {
        notes.push('🌾 Gluten-Free: Certified gluten-free options selected');
      }
      
      // Dietary restriction notes
      if (profile.dietary_restrictions.includes('vegetarian')) {
        notes.push('🌱 Vegetarian: Plant-based protein sources emphasized');
      }
      
      if (profile.dietary_restrictions.includes('vegan')) {
        notes.push('🌱 Vegan: Complete plant-based nutrition');
      }
      
      if (profile.dietary_restrictions.includes('keto')) {
        notes.push('🥑 Keto-Friendly: Low carb, high healthy fat options');
      }
      
      // Preferred foods integration
      if (profile.preferred_foods?.length > 0) {
        const todayPreferredFoods = profile.preferred_foods.filter(food => 
          day.toLowerCase().includes('monday') && food.toLowerCase().includes('salmon') ||
          day.toLowerCase().includes('tuesday') && food.toLowerCase().includes('quinoa') ||
          day.toLowerCase().includes('wednesday') && food.toLowerCase().includes('avocado') ||
          day.toLowerCase().includes('thursday') && food.toLowerCase().includes('berries') ||
          day.toLowerCase().includes('friday') && food.toLowerCase().includes('nuts') ||
          day.toLowerCase().includes('saturday') && food.toLowerCase().includes('olive oil') ||
          day.toLowerCase().includes('sunday') && food.toLowerCase().includes('spinach')
        );
        
        if (todayPreferredFoods.length > 0) {
          notes.push(`🎯 Today's Favorites: Featuring ${todayPreferredFoods.join(', ')}`);
        }
      }
      
      // Foods to avoid alerts
      if (profile.foods_to_avoid?.length > 0) {
        notes.push(`🚫 Foods Avoided: ${profile.foods_to_avoid.join(', ')}`);
      }
      
      // Day-specific motivational notes
      switch(day) {
        case 'Monday':
          notes.push('🚀 Monday Fuel: High-energy start to your week');
          notes.push('💪 Monday Focus: Building momentum for the week ahead');
          break;
        case 'Tuesday':
          notes.push('⚡ Tuesday Power: Sustained energy for busy schedule');
          break;
        case 'Wednesday':
          notes.push('🏃️ Wednesday Wellness: Mid-week nutrition check-in');
          break;
        case 'Thursday':
          notes.push('🎯 Thursday Target: Pushing towards weekly goals');
          break;
        case 'Friday':
          notes.push('🎉 Friday Treat: Balanced meal before weekend');
          notes.push('🍕 Friday Reward: Well-deserved nutritious indulgence');
          break;
        case 'Saturday':
          notes.push('🌟 Saturday Active: Fuel for weekend activities');
          notes.push('🏃️ Saturday Recovery: Preparing for Sunday rest');
          break;
        case 'Sunday':
          notes.push('🌿 Sunday Restoration: Nourishing body and mind');
          notes.push('👨‍👩‍👧‍👦 Sunday Family: Perfect for shared meals');
          break;
      }
    }
    
    return notes;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Day Selector */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {daysOfWeek.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: '25px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: selectedDay === day ? '#4361ee' : '#f1f5f9',
                color: selectedDay === day ? '#ffffff' : '#475569',
                boxShadow: selectedDay === day ? '0 4px 12px rgba(67, 97, 238, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)'
              }}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <div>⌛ Generating Personalized Meal Plan...</div>
        </div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</div>
          <button 
            onClick={fetchPersonalizedMealPlan}
            style={{ padding: '10px 20px', backgroundColor: '#4361ee', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700 }}
          >
            Retry
          </button>
        </div>
      ) : (
        (() => {
          const selectedDayPlan = mealPlan.find(plan => plan.day === selectedDay);
          if (!selectedDayPlan) return null;
          
          return (
          <>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr 350px',
            gap: '30px',
            width: '100%'
          }}>
              {/* Main Meal Content */}
              <div style={{ 
                background: '#ffffff', 
                padding: '30px', 
                borderRadius: '20px', 
                border: '2px solid #e2e8f0',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}>
                <div style={{ 
                  display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '25px',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
              🍽️ {selectedDay}'s Personalized Meals
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

          <div style={{ display: 'grid', gap: '20px' }}>
            {['breakfast', 'lunch', 'snacks', 'dinner'].map((mealType) => (
              <div key={mealType} style={{ 
                background: '#f8fafc', 
                padding: '20px', 
                borderRadius: '15px', 
                border: '1px solid #e2e8f0'
              }}>
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
                  {mealType === 'breakfast' && '🌅'}
                  {mealType === 'lunch' && '☀️'}
                  {mealType === 'snacks' && '🍿'}
                  {mealType === 'dinner' && '🌙'}
                  {mealType}
                </h4>
                {(selectedDayPlan?.meals?.[mealType as keyof typeof selectedDayPlan.meals] as PersonalizedMeal[])?.map((meal: PersonalizedMeal, idx: number) => (
                  <div key={idx} style={{ 
                    background: '#ffffff', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    marginBottom: '15px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', marginBottom: '12px' }}>
                      {meal.name}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '1rem', color: '#64748b' }}>
                        {meal.calories} cal • {meal.protein}g protein
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#059669', fontWeight: 600 }}>
                        🥄 {meal.serving_size} • 🍽️ {meal.quantity}
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
                          {meal.fiber}g
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
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        ⏱️ {meal.preparation_time} mins
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                        🎯 {meal.health_benefits[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Personalized Notes Sidebar */}
        <div style={{ 
          background: '#ffffff', 
          padding: '25px', 
          borderRadius: '20px', 
          border: '2px solid #e2e8f0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          height: 'fit-content'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '1.3rem', 
            fontWeight: 800, 
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📝 Personalized Notes
          </h3>

          {(selectedDayPlan?.personalized_notes?.length || 0) > 0 && (
            <div style={{ 
              background: '#fef3c7', 
              padding: '20px', 
              borderRadius: '15px', 
              marginBottom: '20px',
              border: '1px solid #f59e0b'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#92400e', marginBottom: '10px' }}>
                🎯 Today's Recommendations
              </div>
              {selectedDayPlan?.personalized_notes?.map((note: string, idx: number) => (
                <div key={idx} style={{ 
                  fontSize: '0.85rem', 
                  color: '#78350f', 
                  marginBottom: '8px',
                  lineHeight: 1.4
                }}>
                  {note}
                </div>
              ))}
            </div>
          )}

          {/* User Profile Summary */}
          <div style={{ 
            background: '#f0fdf4', 
            padding: '20px', 
            borderRadius: '15px', 
            marginBottom: '20px',
            border: '1px solid #22c55e'
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#15803d', marginBottom: '10px' }}>
              👤 Your Profile
            </div>
            <div style={{ fontSize: '0.85rem', color: '#166534', lineHeight: 1.4 }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Age:</strong> {userProfile?.age || 'Not specified'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Weight:</strong> {userProfile?.weight || 'Not specified'} kg
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Height:</strong> {userProfile?.height || 'Not specified'} cm
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Activity Level:</strong> {userProfile?.activity_level || 'Not specified'}
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
            <div style={{ 
              background: '#fef2f2', 
              padding: '20px', 
              borderRadius: '15px', 
              marginBottom: '20px',
              border: '1px solid #ef4444'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#991b1b', marginBottom: '10px' }}>
                🏥 Medical Conditions
              </div>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                {userProfile?.medical_conditions?.join(', ') || ''}
              </div>
            </div>
          )}

          {/* Supplements */}
          {(userProfile?.supplements?.length || 0) > 0 && (
            <div style={{ 
              background: '#f0f9ff', 
              padding: '20px', 
              borderRadius: '15px', 
              border: '1px solid #0ea5e9'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '10px' }}>
                💊 Supplements
              </div>
              <div style={{ fontSize: '0.85rem', color: '#075985', lineHeight: 1.4 }}>
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

export default PersonalizedMealPlanDisplay;
