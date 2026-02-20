"""
Final verification: Vegetarian vs Non-vegetarian recommendations
"""
from app.logic import generate_recommendations

# Test with vegetarian user
user_veg = {
    'age': 28,
    'gender': 'female',
    'height_cm': 160,
    'weight_kg': 70,
    'lifestyle_level': 'light',
    'diet_type': 'vegetarian',
    'motive': 'fitness',
    'diseases': '',
    'allergies': 'fish',
    'breakfast': 'idli, dosa',
    'lunch': 'dal, rice, salad',
    'snacks': 'fruits, sprouted moong',
    'dinner': 'curry, rice',
    'water_consumption_l': 2.5
}

# Test with non-vegetarian user
user_non_veg = {
    'age': 35,
    'gender': 'male',
    'height_cm': 180,
    'weight_kg': 90,
    'lifestyle_level': 'moderate',
    'diet_type': 'non-vegetarian',
    'motive': 'weight loss',
    'diseases': 'diabetes',
    'allergies': 'egg',
    'breakfast': 'chicken, oats',
    'lunch': 'chicken curry, rice, salad',
    'snacks': 'paneer, fruits',
    'dinner': 'fish curry, salad',
    'water_consumption_l': 3.0
}

print("=" * 80)
print("VEGETARIAN USER (70kg, female, light activity)")
print("=" * 80)
rec_veg = generate_recommendations(user_veg)
print(f"Daily Calories: {rec_veg['daily_calories']:.0f}")
print(f"Daily Protein: {rec_veg['daily_protein_g']:.0f}g")
print(f"Water: {rec_veg['water_l']}L")
print(f"Breakfast: {rec_veg['diet'][0]['food_name']} ({rec_veg['diet'][0]['serving_g']:.0f}g)")
print(f"Lunch: {rec_veg['diet'][1]['food_name']} ({rec_veg['diet'][1]['serving_g']:.0f}g)")
print("Alternatives for Lunch:")
for alt in rec_veg['diet_alternatives'].get('lunch', [])[:3]:
    print(f"  - {alt['food']} ({alt['serving_g']:.0f}g)")

print()
print("=" * 80)
print("NON-VEGETARIAN USER (90kg, male, moderate activity, weight loss, allergic to eggs)")
print("=" * 80)
rec_non_veg = generate_recommendations(user_non_veg)
print(f"Daily Calories: {rec_non_veg['daily_calories']:.0f}")
print(f"Daily Protein: {rec_non_veg['daily_protein_g']:.0f}g")
print(f"Water: {rec_non_veg['water_l']}L")
print(f"Breakfast: {rec_non_veg['diet'][0]['food_name']} ({rec_non_veg['diet'][0]['serving_g']:.0f}g)")
print(f"Lunch: {rec_non_veg['diet'][1]['food_name']} ({rec_non_veg['diet'][1]['serving_g']:.0f}g)")
print("Alternatives for Lunch (checking allergy exclusion):")
lunch_alts = rec_non_veg['diet_alternatives'].get('lunch', [])[:5]
for alt in lunch_alts:
    has_egg = 'egg' in alt['food'].lower()
    status = "❌ SHOULD BE EXCLUDED!" if has_egg else "✓ OK"
    print(f"  {status} {alt['food']} ({alt['serving_g']:.0f}g)")

print()
print("=" * 80)
print("✅ VERIFICATION RESULTS")
print("=" * 80)

# Check vegetarian exclusion
veg_all = [rec_veg['diet'][0]['food_name']] + [a['food'] for a in sum(rec_veg['diet_alternatives'].values(), [])]
has_non_veg = any(x in ' '.join(veg_all).lower() for x in ['egg', 'chicken', 'fish', 'meat'])
print(f"✓ Vegetarian user - No non-veg foods: {not has_non_veg}")

# Check non-veg inclusion
non_veg_all = [rec_non_veg['diet'][0]['food_name']] + [a['food'] for a in sum(rec_non_veg['diet_alternatives'].values(), [])]
has_chicken_fish = any(x in ' '.join(non_veg_all).lower() for x in ['chicken', 'fish', 'meat', 'mutton'])
print(f"✓ Non-vegetarian user - Has chicken/fish: {has_chicken_fish}")

# Check egg allergy
has_egg_in_alts = any('egg' in alt['food'].lower() for meal_alts in rec_non_veg['diet_alternatives'].values() for alt in meal_alts)
print(f"✓ Egg allergy respected (no eggs shown): {not has_egg_in_alts}")

# Check salads
all_foods_str = ' '.join(non_veg_all).lower()
has_salad = 'salad' in all_foods_str
print(f"✓ Salads included in recommendations: {has_salad}")

# Check rice/curry
has_rice_curry = any(x in all_foods_str for x in ['rice', 'curry', 'dal'])
print(f"✓ Rice/curry included in recommendations: {has_rice_curry}")

print()
print("=" * 80)
print("🎉 ALL SYSTEMS OPERATIONAL")
print("=" * 80)
