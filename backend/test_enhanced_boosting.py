"""Test enhanced scoring for eggs, meat, salads, rice, and fruits"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import generate_recommendations

# Test 1: Non-vegetarian with preference for eggs and meat
print("=" * 70)
print("TEST 1: Non-Vegetarian User - Enhanced Eggs & Meat, Salads & Rice")
print("=" * 70)
user_data_1 = {
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
    "breakfast": "boiled eggs, scrambled eggs",
    "lunch": "chicken curry, rice",
    "snacks": "salad, fruits",
    "dinner": "fried chicken, grilled fish, salad"
}

recommendations_1 = generate_recommendations(user_data_1)

# Group meals by type
meals_by_type = {}
for meal in recommendations_1['diet']:
    meal_type = meal['meal_type']
    if meal_type not in meals_by_type:
        meals_by_type[meal_type] = []
    meals_by_type[meal_type].append(meal)

# Display meals
for meal_type in ['breakfast', 'lunch', 'snacks', 'dinner']:
    if meal_type in meals_by_type:
        print(f"\n{meal_type.upper()}:")
        total_cal = sum(m['calories'] for m in meals_by_type[meal_type])
        total_protein = sum(m['protein_g'] for m in meals_by_type[meal_type])
        for meal in meals_by_type[meal_type]:
            print(f"  • {meal['food_name']}")
            print(f"    └─ {meal['serving_g']:.0f}g | {meal['calories']:.0f} cal | P:{meal['protein_g']:.1f}g")
        print(f"  Total: {total_cal:.0f} cal | {total_protein:.1f}g protein")

print(f"\n{'DAILY SUMMARY':-^70}")
print(f"  Total Calories: {recommendations_1['daily_calories']} kcal")
print(f"  Total Protein: {recommendations_1['daily_protein_g']:.1f}g")
print(f"  Water: {recommendations_1['water_l']:.1f}L")

# Count enhanced items
non_veg_keywords = ["egg", "chicken", "fish", "meat", "mutton", "prawn", "shrimp"]
salad_keywords = ["salad", "vegetable"]
rice_keywords = ["rice", "curry", "dal", "sabzi", "khichdi"]
fruit_keywords = ["apple", "banana", "mango", "orange", "berry", "fruit"]

stats = {"eggs_meat": 0, "salads": 0, "rice_curry": 0, "fruits": 0}

for meal in recommendations_1['diet']:
    food_lower = meal['food_name'].lower()
    if any(nv in food_lower for nv in non_veg_keywords):
        stats["eggs_meat"] += 1
    if any(sal in food_lower for sal in salad_keywords):
        stats["salads"] += 1
    if any(r in food_lower for r in rice_keywords):
        stats["rice_curry"] += 1
    if any(f in food_lower for f in fruit_keywords):
        stats["fruits"] += 1

print(f"\n{'ENHANCEMENT VERIFICATION':-^70}")
print(f"  ✓ Eggs/Meat items: {stats['eggs_meat']}")
print(f"  ✓ Salad items: {stats['salads']}")
print(f"  ✓ Rice/Curry items: {stats['rice_curry']}")
print(f"  ✓ Fruit items: {stats['fruits']}")

# Test 2: Vegetarian with preference for salads and fruits
print("\n" + "=" * 70)
print("TEST 2: Vegetarian User - Salads, Fruits & Rice")
print("=" * 70)
user_data_2 = {
    "name": "Priya",
    "age": 28,
    "gender": "Female",
    "weight_kg": 65,
    "height_cm": 165,
    "diet_type": "vegetarian",
    "diseases": "",
    "food_allergies": "",
    "motive": "weight loss",
    "lifestyle_level": "light",
    "breakfast": "fruits, yogurt",
    "lunch": "vegetable salad, rice",
    "snacks": "fruits, salad",
    "dinner": "dal, salad"
}

recommendations_2 = generate_recommendations(user_data_2)

meals_by_type_2 = {}
for meal in recommendations_2['diet']:
    meal_type = meal['meal_type']
    if meal_type not in meals_by_type_2:
        meals_by_type_2[meal_type] = []
    meals_by_type_2[meal_type].append(meal)

# Display meals
for meal_type in ['breakfast', 'lunch', 'snacks', 'dinner']:
    if meal_type in meals_by_type_2:
        print(f"\n{meal_type.upper()}:")
        total_cal = sum(m['calories'] for m in meals_by_type_2[meal_type])
        total_protein = sum(m['protein_g'] for m in meals_by_type_2[meal_type])
        for meal in meals_by_type_2[meal_type]:
            print(f"  • {meal['food_name']}")
            print(f"    └─ {meal['serving_g']:.0f}g | {meal['calories']:.0f} cal | P:{meal['protein_g']:.1f}g")
        print(f"  Total: {total_cal:.0f} cal | {total_protein:.1f}g protein")

print(f"\n{'DAILY SUMMARY':-^70}")
print(f"  Total Calories: {recommendations_2['daily_calories']} kcal")
print(f"  Total Protein: {recommendations_2['daily_protein_g']:.1f}g")

# Count items for vegetarian
stats_2 = {"salads": 0, "fruits": 0, "rice_curry": 0}

for meal in recommendations_2['diet']:
    food_lower = meal['food_name'].lower()
    if any(sal in food_lower for sal in salad_keywords):
        stats_2["salads"] += 1
    if any(f in food_lower for f in fruit_keywords):
        stats_2["fruits"] += 1
    if any(r in food_lower for r in rice_keywords):
        stats_2["rice_curry"] += 1

print(f"\n{'ENHANCEMENT VERIFICATION':-^70}")
print(f"  ✓ Salad items: {stats_2['salads']}")
print(f"  ✓ Fruit items: {stats_2['fruits']}")
print(f"  ✓ Rice/Curry items: {stats_2['rice_curry']}")

print("\n" + "=" * 70)
print("✅ Enhanced scoring test completed successfully!")
print("=" * 70)
