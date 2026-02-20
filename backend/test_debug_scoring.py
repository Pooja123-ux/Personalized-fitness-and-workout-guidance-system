"""Debug the scoring calculation to see why eggs aren't ranking high"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

import pandas as pd
from pathlib import Path

# Manually load the food data
BASE_DIR = r'c:\Fitness\backend\app'
csv_path = Path(BASE_DIR) / "Indian_Food_Nutrition_Processed.csv"

df = pd.read_csv(csv_path)
print("Columns:", df.columns.tolist())

# Rename for easier access
df = df.rename(columns={
    "Dish Name": "food",
    "Calories (kcal)": "calories",
    "Protein (g)": "protein",
    "Carbohydrates (g)": "carbs",
    "Fats (g)": "fat"
})

# Find egg foods
egg_foods = df[df["food"].str.lower().str.contains("egg", na=False)]
print("\nFound egg foods:")
print(egg_foods[["food", "protein", "calories"]].head(10))

# Find chicken foods
chicken_foods = df[df["food"].str.lower().str.contains("chicken", na=False)]
print(f"\nFound {len(chicken_foods)} chicken foods")
print(chicken_foods[["food", "protein", "calories"]].head(5))

# Find salads
salad_foods = df[df["food"].str.lower().str.contains("salad", na=False)]
print(f"\nFound {len(salad_foods)} salad foods")
if len(salad_foods) > 0:
    print(salad_foods[["food", "protein", "calories"]].head(5))
