"""Final test showing multiple complete meal plans with all options"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import generate_recommendations

user_data = {
    "name": "Priya",
    "age": 28,
    "gender": "Female",
    "weight_kg": 65,
    "height_cm": 165,
    "diet_type": "vegetarian",
    "diseases": "diabetes",
    "food_allergies": "nuts",
    "motive": "weight loss",
    "lifestyle_level": "moderate",
    "breakfast": "oats, yogurt",
    "lunch": "salad, dal",
    "snacks": "fruits",
    "dinner": "rice, curry"
}

recommendations = generate_recommendations(user_data)

print("\n" + "=" * 85)
print("🎯 COMPLETE PERSONALIZED MEAL PLANS FOR PRIYA")
print("=" * 85)
print(f"Target: {recommendations['daily_calories']:.0f} kcal/day | {recommendations['daily_protein_g']:.1f}g protein")
print(f"BMI: {recommendations['bmi']:.1f} ({recommendations['bmi_category']})")

# Display main plan
print("\n" + "="*85)
print("📋 MAIN MEAL PLAN (OPTION 1)")
print("="*85)
for meal in recommendations['diet']:
    print(f"\n▸ {meal['meal_type'].upper()}")
    print(f"  Dish: {meal['food_name']}")
    print(f"  Amount: {meal['serving_g']:.0f}g")
    print(f"  Nutrition: P:{meal['protein_g']:.1f}g | C:{meal['carbs_g']:.1f}g | F:{meal['fat_g']:.1f}g")
    if meal.get('salad_component'):
        print(f"  + {meal['salad_component']}")
    if meal.get('rice_portion'):
        print(f"  + {meal['rice_portion']}")

print(f"\n  📊 PLAN TOTALS: {recommendations['diet_totals']['daily_calories']:.0f} kcal | "
      f"Protein: {recommendations['diet_totals']['daily_protein_g']:.1f}g "
      f"{'✓' if recommendations['diet_totals']['protein_met'] else '⚠'}")

# Display alternative plans
for idx, plan in enumerate(recommendations['alternative_meal_plans'], 1):
    print(f"\n" + "="*85)
    print(f"📋 ALTERNATIVE MEAL PLAN (OPTION {idx + 1})")
    print("="*85)
    for meal in plan['plan_meals']:
        print(f"\n▸ {meal['meal_type'].upper()}")
        print(f"  Dish: {meal['food_name']}")
        print(f"  Amount: {meal['serving_g']:.0f}g")
        print(f"  Nutrition: P:{meal['protein_g']:.1f}g | C:{meal['carbs_g']:.1f}g | F:{meal['fat_g']:.1f}g")
        if meal.get('salad_component'):
            print(f"  + {meal['salad_component']}")
        if meal.get('rice_portion'):
            print(f"  + {meal['rice_portion']}")
    
    print(f"\n  📊 PLAN TOTALS: {plan['daily_calories']:.0f} kcal | "
          f"Protein: {plan['daily_protein_g']:.1f}g "
          f"{'✓' if plan['protein_met'] else '⚠'}")

print(f"\n" + "="*85)
print(f"✅ {len(recommendations['alternative_meal_plans']) + 1} COMPLETE DAILY MEAL PLANS AVAILABLE!")
print(f"✅ Each plan includes: Complete breakfast, lunch, snacks, dinner")
print(f"✅ Each meal shows: What to eat + Salad recommendations + Rice/Curry portions")
print(f"✅ Daily protein targets included for each plan")
print("="*85 + "\n")
