import api from '../api'

export interface UserProfile {
  age: number
  gender: string
  height: number
  weight: number
  lifestyle: string
  diet_type: string
  water_intake: number
  junk_food: string
  healthy_food: string
  motive: string
  target_area: string
  duration: number
  allergies: string[]
  diseases: string[]
  meals: {
    breakfast: string[]
    lunch: string[]
    snacks: string[]
    dinner: string[]
  }
}

export interface PersonalizedRecommendation {
  food: string
  calories: number
  reason: string
  swapOptions?: string[]
  score: number
}

const swapDatabase: Record<string, PersonalizedRecommendation[]> = {
  'pineapple milkshake': [
    { food: 'Banana yogurt smoothie', calories: 150, reason: 'Lower sugar, high protein', score: 8.5 },
    { food: 'Oat and berries smoothie', calories: 180, reason: 'Better fiber content', score: 8.2 },
    { food: 'Protein shake with almonds', calories: 200, reason: 'More sustainable energy', score: 7.9 }
  ],
  'apple oats chia seed smoothie': [
    { food: 'Greek yogurt breakfast bowl', calories: 200, reason: 'Higher protein, sustained energy', score: 8.8 },
    { food: 'Quinoa granola bowl', calories: 220, reason: 'Complete amino acids', score: 8.5 }
  ],
  'stewed apple': [
    { food: 'Fresh apple with almond butter', calories: 150, reason: 'More nutrients preserved', score: 8.6 },
    { food: 'Apple salad with walnuts', calories: 180, reason: 'Added healthy fats', score: 8.3 }
  ]
}

export async function getPersonalizedRecommendations(
  detectedFood: string,
  userProfile: UserProfile
): Promise<PersonalizedRecommendation[]> {
  try {
    const response = await api.post('/recommendations/personalized', {
      detected_food: detectedFood,
      user_profile: userProfile
    })
    if (response.data?.recommendations) {
      return response.data.recommendations
    }
  } catch (err) {
    console.warn('Backend recommendation failed, using local database:', err)
  }

  // Fallback: use local database and scoring
  const foodKey = detectedFood.toLowerCase()
  const baseRecs = swapDatabase[foodKey] || generateDefaultRecommendations(detectedFood, userProfile)
  
  return scoreRecommendations(baseRecs, userProfile)
}

function generateDefaultRecommendations(food: string, profile: UserProfile): PersonalizedRecommendation[] {
  const isWeightLoss = profile.motive.toLowerCase().includes('weight loss')
  const isDiabetic = profile.diseases.some(d => d.toLowerCase().includes('diabetes'))
  
  const lowCalOptions = [
    { food: 'Grilled chicken salad', calories: 180, reason: 'High protein, low carb' },
    { food: 'Steamed vegetables with beans', calories: 150, reason: 'Fiber-rich, filling' },
    { food: 'Tofu stir-fry', calories: 170, reason: 'Plant-based protein' }
  ]

  const balancedOptions = [
    { food: 'Brown rice with vegetables', calories: 280, reason: 'Balanced macros' },
    { food: 'Whole grain pasta with veggies', calories: 300, reason: 'Sustained energy' },
    { food: 'Lentil curry with roti', calories: 320, reason: 'Complete protein' }
  ]

  const baseRecs = isWeightLoss ? lowCalOptions : balancedOptions

  return baseRecs.map(r => ({
    ...r,
    swapOptions: [],
    score: 7.5
  }))
}

function scoreRecommendations(
  recs: PersonalizedRecommendation[],
  profile: UserProfile
): PersonalizedRecommendation[] {
  return recs.map(rec => {
    let score = 7.5
    const foodLower = rec.food.toLowerCase()

    // Adjust score based on user profile
    if (profile.motive.toLowerCase().includes('weight loss') && rec.calories < 250) {
      score += 1.5
    }
    if (profile.diet_type.toLowerCase().includes('vegetarian') && 
        !['chicken', 'fish', 'meat', 'beef'].some(m => foodLower.includes(m))) {
      score += 1
    }
    if (profile.diseases.some(d => d.toLowerCase().includes('diabetes'))) {
      if (!['sugar', 'sweet', 'candy', 'dessert'].some(s => foodLower.includes(s))) {
        score += 0.8
      }
    }

    // Deduct for allergies
    const hasAllergen = profile.allergies.some(allergy => 
      foodLower.includes(allergy.toLowerCase())
    )
    if (hasAllergen) {
      score = Math.max(0, score - 3)
    }

    return { ...rec, score: Math.min(10, score) }
  }).sort((a, b) => b.score - a.score)
}

export function filterByAllergies(foods: string[], allergies: string[]): string[] {
  if (!allergies || allergies.length === 0) return foods
  return foods.filter(food => 
    !allergies.some(allergy => food.toLowerCase().includes(allergy.toLowerCase()))
  )
}

export function filterByDiseases(foods: string[], diseases: string[]): string[] {
  const diseaseFilters: Record<string, string[]> = {
    diabetes: ['sugar', 'sweet', 'dessert', 'cake', 'candy', 'juice', 'soda', 'milkshake'],
    'high blood pressure': ['salt', 'sodium', 'processed'],
    cholesterol: ['saturated fat', 'butter', 'cream', 'ghee'],
    'celiac disease': ['wheat', 'gluten', 'bread']
  }
  
  let filtered = foods
  diseases.forEach(disease => {
    const keywords = diseaseFilters[disease.toLowerCase()] || []
    filtered = filtered.filter(food => 
      !keywords.some(kw => food.toLowerCase().includes(kw))
    )
  })
  return filtered
}

export function calculateMacroTargets(profile: UserProfile) {
  const bmi = profile.weight / ((profile.height / 100) ** 2)
  const isWeightLoss = profile.motive.toLowerCase().includes('weight loss')
  const activityMultiplier = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[profile.lifestyle.toLowerCase()] || 1.5
  
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === 'Male' ? 5 : -161)
  const tdee = Math.round(bmr * activityMultiplier)
  const calorieTarget = isWeightLoss ? Math.round(tdee * 0.85) : tdee
  
  return {
    calorieTarget,
    protein: Math.round(calorieTarget * 0.25 / 4),
    carbs: Math.round(calorieTarget * 0.45 / 4),
    fat: Math.round(calorieTarget * 0.3 / 9)
  }
}
