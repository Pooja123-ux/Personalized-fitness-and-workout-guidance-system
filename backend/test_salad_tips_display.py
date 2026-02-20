"""Test that salads and pro tips are now in separate fields"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import generate_recommendations
import json

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
    "breakfast": "boiled eggs",
    "lunch": "chicken curry",
    "snacks": "salad",
    "dinner": "grilled fish"
}

recommendations = generate_recommendations(user_data)

print("MEAL RECOMMENDATIONS WITH SALADS & PRO TIPS:")
print("=" * 70)

for meal in recommendations['diet']:
    print(f"\n{meal['meal_type'].upper()}:")
    print(f"  Main Dish: {meal['food_name']}")
    print(f"  Serving: {meal['serving_g']:.0f}g | {meal['calories']:.0f} cal | P:{meal['protein_g']:.1f}g")
    
    if meal.get('salad_component'):
        print(f"  🥗 Add Salad: {meal['salad_component']}")
    
    if meal.get('rice_portion'):
        print(f"  🍚 Rice/Curry: {meal['rice_portion']}")
    
    if meal.get('pro_tip'):
        print(f"  {meal['pro_tip']}")

print("\n" + "=" * 70)
print("✅ Salads and pro tips are now in separate fields for frontend display!")
