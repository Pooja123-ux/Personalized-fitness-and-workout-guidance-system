"""
Final comprehensive test: Non-vegetarian with salads and rice/curry
"""
import pandas as pd
from app.logic import generate_recommendations

# Simulate a non-vegetarian user profile
user_data = {
    'age': 30,
    'gender': 'male',
    'height_cm': 175,
    'weight_kg': 85,
    'lifestyle_level': 'moderate',
    'diet_type': 'non-vegetarian',  # Non-vegetarian
    'motive': 'weight loss',
    'diseases': '',
    'allergies': '',
    'breakfast': 'idli, dosa, upma, egg',  # Non-veg breakfast
    'lunch': 'curry, rice, salad',  # Include salad
    'snacks': 'sprouted moong, salad, egg',  # Non-veg snack
    'dinner': 'curry, rice, salad',  # Dinner with salad
    'water_consumption_l': 3.0
}

print("=" * 100)
print("FINAL TEST: NON-VEGETARIAN USER WITH SALADS AND RICE/CURRY")
print("=" * 100)

print("\nUser Profile:")
print(f"• Diet Type: {user_data['diet_type']}")
print(f"• Weight: {user_data['weight_kg']}kg")
print(f"• Goal: {user_data['motive']}")
print(f"• Preferences: {user_data['breakfast']}, {user_data['lunch']}, {user_data['snacks']}")

# Generate recommendations
recs = generate_recommendations(user_data)

print("\n" + "=" * 100)
print("DAILY RECOMMENDATIONS")
print("=" * 100)

print(f"\n📊 Daily Calorie Target: {recs['daily_calories']:.0f} kcal")
print(f"💪 Daily Protein Target: {recs['daily_protein_g']:.0f}g")
print(f"💧 Water Target: {recs['water_l']}L")

# Display meals
for i, meal in enumerate(recs.get('diet', [])):
    print(f"\n{'─' * 100}")
    print(f"🔹 {meal['meal_type'].upper()}")
    print(f"{'─' * 100}")
    print(f"Main Dish: {meal['food_name']}")
    print(f"  • Quantity: {meal['serving_g']:.0f}g")
    print(f"  • Calories: {meal['serving_g'] * meal['calories'] / 100:.0f} kcal")
    print(f"  • Protein: {meal['protein_g']:.1f}g | Carbs: {meal['carbs_g']:.1f}g | Fat: {meal['fat_g']:.1f}g")
    
    # Show alternatives if available
    alternatives = recs.get('diet_alternatives', {}).get(meal['meal_type'], [])
    if alternatives:
        print(f"\n  Alternative Options (pick based on preference):")
        for j, alt in enumerate(alternatives[1:6], 1):  # Show next 5 alternatives
            is_salad = 'salad' in alt['food'].lower()
            is_rice_curry = any(x in alt['food'].lower() for x in ['rice', 'curry', 'dal'])
            tag = '🥗' if is_salad else '🍚' if is_rice_curry else '🍖' if any(x in alt['food'].lower() for x in ['egg', 'chicken', 'fish']) else '🍜'
            print(f"    {j}. {tag} {alt['food']:45s} | {alt['serving_g']:5.0f}g | Protein: {alt['protein_g']:5.1f}g")

# Total macro summary
total_protein = sum(m['protein_g'] for m in recs.get('diet', []))
total_carbs = sum(m['carbs_g'] for m in recs.get('diet', []))
total_fat = sum(m['fat_g'] for m in recs.get('diet', []))

print("\n" + "=" * 100)
print("📈 DAILY MACRO TOTALS")
print("=" * 100)
print(f"Total Protein: {total_protein:.1f}g")
print(f"Total Carbs: {total_carbs:.1f}g")
print(f"Total Fat: {total_fat:.1f}g")
print(f"Total Calories: {recs['daily_calories']:.0f} kcal")

# Check for specific foods
all_foods = [m['food_name'] for m in recs.get('diet', [])]
alternatives_list = []
for alts in recs.get('diet_alternatives', {}).values():
    alternatives_list.extend([a['food'] for a in alts[:3]])
all_recommendations = all_foods + alternatives_list

has_salad = any('salad' in f.lower() for f in all_recommendations)
has_rice_curry = any(any(x in f.lower() for x in ['rice', 'curry', 'dal']) for f in all_recommendations)
has_egg_chicken = any(any(x in f.lower() for x in ['egg', 'chicken']) for f in all_recommendations)

print("\n" + "=" * 100)
print("✅ VERIFICATION")
print("=" * 100)
print(f"✓ Salads Included: {'YES' if has_salad else 'NO'}")
print(f"✓ Rice/Curry Included: {'YES' if has_rice_curry else 'NO'}")
print(f"✓ Non-veg Proteins (eggs/chicken): {'YES' if has_egg_chicken else 'NO'}")
print(f"✓ Protein Target Met: {'YES' if total_protein >= recs['daily_protein_g'] * 0.95 else 'NO'} ({total_protein:.0f}g / {recs['daily_protein_g']:.0f}g)")

print("\n" + "=" * 100)
print("🎉 RECOMMENDATIONS COMPLETE")
print("=" * 100)
print("\nKey Points:")
print("• Non-vegetarian foods (eggs, chicken) included for high protein")
print("• Salads recommended for balanced, nutritious meals")
print("• Rice/curry portions calculated with specific quantities")
print("• All quantities are in grams for precise portioning")
print("• Multiple alternatives provided for flexibility")
