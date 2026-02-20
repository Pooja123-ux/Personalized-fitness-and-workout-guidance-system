#!/usr/bin/env python3
"""Test generating 8 complete meal plans"""

from backend.app.logic import generate_recommendations

# Test with 65kg vegetarian female
user_data = {
    "age": 28,
    "gender": "female",
    "weight": 65,
    "height": 165,
    "veg_pref": "vegetarian",
    "diseases": "diabetes",
    "allergies": "peanuts",
    "motive": "weight_loss",
    "level": "intermediate",
    "breakfast": "oats, eggs",
    "lunch": "dal rice, paneer",
    "dinner": "roti sabzi"
}

print("=" * 80)
print("GENERATING 8 COMPLETE MEAL PLANS")
print("=" * 80)

rec = generate_recommendations(user_data)

print(f"\n📊 MAIN PLAN TOTALS:")
print(f"   Calories: {rec['diet_totals']['daily_calories']}")
print(f"   Protein: {rec['diet_totals']['daily_protein_g']}g")
print(f"   Protein Met: {'✓' if rec['diet_totals']['protein_met'] else '✗'}")

print(f"\n🔢 ALTERNATIVE PLANS: {len(rec['alternative_meal_plans'])} plans generated")

for plan_idx, plan in enumerate(rec['alternative_meal_plans'], 1):
    print(f"\n{'='*80}")
    print(f"PLAN {plan_idx + 1} (Alternative)")
    print(f"{'='*80}")
    print(f"Calories: {plan['daily_calories']} | Protein: {plan['daily_protein_g']}g | Protein Met: {'✓' if plan['protein_met'] else '✗'}")
    print()
    
    for meal_idx, meal in enumerate(plan['plan_meals'], 1):
        print(f"  {meal_idx}. {meal['meal_type'].title()}")
        print(f"     Main: {meal['food_name']}")
        if meal.get('salad_component'):
            print(f"     + Salad: {meal['salad_component']}")
        if meal.get('rice_portion'):
            print(f"     + Rice: {meal['rice_portion']}")
        print(f"     Nutrition: {meal['protein_g']}g protein, {meal['calories']} cal")
        print()

print(f"\n✅ Total plans displayed: {1 + len(rec['alternative_meal_plans'])} (1 main + {len(rec['alternative_meal_plans'])} alternatives)")
