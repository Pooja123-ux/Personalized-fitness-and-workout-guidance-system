#!/usr/bin/env python3
"""Test showing 8 complete meal plans formatted nicely"""

from backend.app.logic import generate_recommendations

# Test with male non-vegetarian
user_data = {
    "age": 30,
    "gender": "male",
    "weight": 80,
    "height": 180,
    "veg_pref": "non_vegetarian",
    "diseases": "",
    "allergies": "",
    "motive": "muscle_gain",
    "level": "intermediate",
    "breakfast": "eggs, oats",
    "lunch": "chicken, rice",
    "dinner": "fish, dal"
}

print("\n" + "="*100)
print("                    🎯 8 COMPLETE DAILY MEAL PLANS - NON-VEGETARIAN MALE")
print("="*100 + "\n")

rec = generate_recommendations(user_data)

# Main plan
print("═" * 100)
print(f"{'PLAN 1 - MAIN RECOMMENDATION':^100}")
print("═" * 100 + "\n")

for meal in rec['diet']:
    print(f"  📌 {meal['meal_type'].upper()}: {meal['food_name']}")
    if meal.get('salad_component'):
        print(f"     🥗 + {meal['salad_component']}")
    if meal.get('rice_portion'):
        print(f"     🍚 + {meal['rice_portion']}")
    print()

print(f"\n  📊 DAILY TOTALS:")
print(f"     Calories: {rec['diet_totals']['daily_calories']} kcal")
print(f"     Protein: {rec['diet_totals']['daily_protein_g']}g {'✓ TARGET MET' if rec['diet_totals']['protein_met'] else ''}")
print("\n")

# Alternative plans
for plan_idx, plan in enumerate(rec['alternative_meal_plans'], 2):
    print("═" * 100)
    print(f"{'PLAN ' + str(plan_idx) + ' - ALTERNATIVE OPTION':^100}")
    print("═" * 100 + "\n")
    
    for meal in plan['plan_meals']:
        print(f"  📌 {meal['meal_type'].upper()}: {meal['food_name']}")
        if meal.get('salad_component'):
            print(f"     🥗 + {meal['salad_component']}")
        if meal.get('rice_portion'):
            print(f"     🍚 + {meal['rice_portion']}")
        print()
    
    print(f"\n  📊 DAILY TOTALS:")
    print(f"     Calories: {plan['daily_calories']} kcal")
    print(f"     Protein: {plan['daily_protein_g']}g {'✓ TARGET MET' if plan['protein_met'] else ''}")
    print("\n")

print("=" * 100)
print(f"{'✅ TOTAL OPTIONS: 1 MAIN + 7 ALTERNATIVE = 8 COMPLETE DAILY PLANS':^100}")
print("=" * 100)
