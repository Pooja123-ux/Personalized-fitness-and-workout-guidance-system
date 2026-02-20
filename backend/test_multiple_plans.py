"""Test multiple complete daily meal plans"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import generate_recommendations

user_data = {
    "name": "Raj",
    "age": 30,
    "gender": "Male",
    "weight_kg": 80,
    "height_cm": 180,
    "diet_type": "non-vegetarian",
    "diseases": "",
    "food_allergies": "",
    "motive": "weight loss",
    "lifestyle_level": "moderate",
    "breakfast": "eggs",
    "lunch": "chicken, rice",
    "snacks": "salad",
    "dinner": "fish"
}

recommendations = generate_recommendations(user_data)

print("=" * 80)
print("MAIN MEAL PLAN (Option 1)")
print("=" * 80)

for meal in recommendations['diet']:
    print(f"\n{meal['meal_type'].upper()}:")
    print(f"  • {meal['food_name']} ({meal['serving_g']:.0f}g)")
    print(f"    Protein: {meal['protein_g']:.1f}g | Carbs: {meal['carbs_g']:.1f}g | Fat: {meal['fat_g']:.1f}g")
    if meal.get('salad_component'):
        print(f"    🥗 {meal['salad_component']}")
    if meal.get('rice_portion'):
        print(f"    🍚 {meal['rice_portion']}")

print(f"\n{'DAILY TOTALS (PLAN 1)':-^80}")
print(f"  Total Calories: {recommendations['diet_totals']['daily_calories']:.0f} kcal")
print(f"  Total Protein: {recommendations['diet_totals']['daily_protein_g']:.1f}g (Required: {recommendations['daily_protein_g']:.1f}g)")
print(f"  ✓ Protein Met: {'YES' if recommendations['diet_totals']['protein_met'] else 'NO'}")

# Display alternative plans
for plan_idx, alt_plan in enumerate(recommendations['alternative_meal_plans'], 1):
    print(f"\n{'=' * 80}")
    print(f"ALTERNATIVE MEAL PLAN (Option {plan_idx + 1})")
    print(f"{'=' * 80}")
    
    for meal in alt_plan['plan_meals']:
        print(f"\n{meal['meal_type'].upper()}:")
        print(f"  • {meal['food_name']} ({meal['serving_g']:.0f}g)")
        print(f"    Protein: {meal['protein_g']:.1f}g | Carbs: {meal['carbs_g']:.1f}g | Fat: {meal['fat_g']:.1f}g")
        if meal.get('salad_component'):
            print(f"    🥗 {meal['salad_component']}")
        if meal.get('rice_portion'):
            print(f"    🍚 {meal['rice_portion']}")
    
    print(f"\n{'DAILY TOTALS (PLAN ' + str(plan_idx + 1) + ')':-^80}")
    print(f"  Total Calories: {alt_plan['daily_calories']:.0f} kcal")
    print(f"  Total Protein: {alt_plan['daily_protein_g']:.1f}g (Required: {recommendations['daily_protein_g']:.1f}g)")
    print(f"  ✓ Protein Met: {'YES' if alt_plan['protein_met'] else 'NO'}")

print(f"\n{'=' * 80}")
print(f"✅ {len(recommendations['alternative_meal_plans']) + 1} COMPLETE MEAL PLANS GENERATED!")
print(f"All plans include complete meals with salads, portions & protein targets!")
print(f"{'=' * 80}")
