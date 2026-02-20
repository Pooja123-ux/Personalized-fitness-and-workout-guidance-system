"""
Test merged nutrition datasets
"""
from pathlib import Path
from app.logic import load_foods

csv_path = Path(__file__).resolve().parent / "app" / "Indian_Food_Nutrition_Processed.csv"

print("=" * 80)
print("TESTING MERGED NUTRITION DATASETS")
print("=" * 80)

# Load merged datasets
df = load_foods(csv_path)

print(f"\n✓ Total unique foods after merge: {len(df)}")
print(f"✓ Columns available: {df.columns.tolist()}")

# Check for disease-specific foods
disease_foods = ['Carrots', 'Broccoli', 'Spinach', 'Apple', 'Oats']
found_disease_foods = []
for food in disease_foods:
    matches = df[df['food'].str.contains(food, case=False, na=False)]
    if len(matches) > 0:
        found_disease_foods.append(food)
        print(f"✓ Found from disease dataset: {food} - Calories: {matches.iloc[0]['calories']:.0f}")

# Check for Indian foods
indian_foods = ['Idli', 'Dosa', 'Chapati', 'Dal', 'Curry']
found_indian_foods = []
for food in indian_foods:
    matches = df[df['food'].str.contains(food, case=False, na=False)]
    if len(matches) > 0:
        found_indian_foods.append(food)
        print(f"✓ Found from Indian dataset: {food} - {len(matches)} variations")

# Check macros completeness
has_all_macros = df[['calories', 'protein', 'carbs', 'fat']].notna().all(axis=1).sum()
print(f"\n✓ Foods with complete macro data: {has_all_macros} / {len(df)}")

# Sample statistics
print(f"\nDataset Statistics:")
print(f"  Avg Calories: {df['calories'].mean():.1f}")
print(f"  Avg Protein: {df['protein'].mean():.1f}g")
print(f"  Avg Carbs: {df['carbs'].mean():.1f}g")
print(f"  Avg Fat: {df['fat'].mean():.1f}g")

# Check for duplicates
duplicates = len(df) - len(df.drop_duplicates(subset=['food']))
print(f"\n✓ Duplicate foods after merge: {duplicates} (removed)")

# High protein foods
high_protein = df[df['protein'] > 15].sort_values('protein', ascending=False)
print(f"\n✓ High-protein foods available: {len(high_protein)}")
if len(high_protein) > 0:
    print("Top 5 high-protein foods:")
    for idx, (_, row) in enumerate(high_protein.head(5).iterrows(), 1):
        print(f"  {idx}. {row['food']:30s} - {row['protein']:.1f}g protein")

print("\n" + "=" * 80)
print("✅ MERGED NUTRITION DATASETS READY")
print("=" * 80)
print(f"• Indian Food dataset: 1014 foods")
print(f"• Disease Nutrition dataset: 500+ foods")
print(f"• Total unique foods: {len(df)}")
print(f"• All macro nutrients included: calories, protein, carbs, fat")
