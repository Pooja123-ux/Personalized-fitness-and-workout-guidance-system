"""Debug suggest_for_target function directly"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import suggest_for_target, load_foods
from pathlib import Path

# Load foods
BASE_DIR = r'c:\Fitness\backend\app'
csv_path = Path(BASE_DIR) / "Indian_Food_Nutrition_Processed.csv"
df = load_foods(csv_path)

# Try suggesting for breakfast with eggs preference
print("Breakfast suggestions for non-veg user (eggs preference):")
breakfast_suggestions = suggest_for_target(
    df,
    meal_cal=376.5,  # 25% of 1506 daily calories
    topn=10,
    user_foods=["eggs"],
    allergies=[],
    is_snack=False,
    is_main_meal=True,
    exclude_foods=[],
    bmi=None,
    motive="weight loss",
    diet_type="non-vegetarian",
    diseases=[],
    age=30,
    gender="Male"
)

for suggestion in breakfast_suggestions[:5]:
    print(f"  • {suggestion['food']}: P:{suggestion['protein_g']}g {suggestion['serving_g']}g")

print("\n\nLunch suggestions for non-veg user (chicken preference):")
lunch_suggestions = suggest_for_target(
    df,
    meal_cal=527.1,  # 35% of daily calories
    topn=10,
    user_foods=["chicken"],
    allergies=[],
    is_snack=False,
    is_main_meal=True,
    exclude_foods=[],
    bmi=None,
    motive="weight loss",
    diet_type="non-vegetarian",
    diseases=[],
    age=30,
    gender="Male"
)

for suggestion in lunch_suggestions[:5]:
    print(f"  • {suggestion['food']}: P:{suggestion['protein_g']}g {suggestion['serving_g']}g")

print("\n\nSnack suggestions for non-veg user (salad preference):")
snack_suggestions = suggest_for_target(
    df,
    meal_cal=225.9,  # 15% of daily calories
    topn=10,
    user_foods=["salad"],
    allergies=[],
    is_snack=True,
    is_main_meal=False,
    exclude_foods=[],
    bmi=None,
    motive="weight loss",
    diet_type="non-vegetarian",
    diseases=[],
    age=30,
    gender="Male"
)

for suggestion in snack_suggestions[:5]:
    print(f"  • {suggestion['food']}: P:{suggestion['protein_g']}g {suggestion['serving_g']}g")
