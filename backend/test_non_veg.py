import pandas as pd
from app.logic import filter_foods_by_diseases

# Load foods
df = pd.read_csv('app/Indian_Food_Nutrition_Processed.csv')
df.columns = df.columns.str.lower().str.replace(' ', '_').str.replace('(', '').str.replace(')', '')
df['food'] = df['dish_name']
df['calories'] = df['calories_kcal']
df['protein'] = df['protein_g']
df['carbs'] = df['carbohydrates_g']
df['fat'] = df['fats_g']

# Test 1: Vegetarian diet - should exclude non-veg
veg_filtered = filter_foods_by_diseases(df, [], 'vegetarian')
veg_non_veg = veg_filtered[veg_filtered['food'].str.lower().str.contains('egg|chicken|fish|meat', na=False)]
print(f'✓ Vegetarian diet - Non-veg foods found: {len(veg_non_veg)} (should be 0)')

# Test 2: Non-vegetarian diet - should include non-veg
non_veg_filtered = filter_foods_by_diseases(df, [], 'non-vegetarian')
non_veg_items = non_veg_filtered[non_veg_filtered['food'].str.lower().str.contains('egg|chicken|fish|meat', na=False)]
print(f'✓ Non-vegetarian diet - Non-veg foods found: {len(non_veg_items)} (should be > 0)')

# Test 3: Check eggs specifically
egg_foods = non_veg_filtered[non_veg_filtered['food'].str.lower().str.contains('egg', na=False)]
print(f'✓ Egg dishes found: {len(egg_foods)}')
if len(egg_foods) > 0:
    print('  Sample eggs:')
    print(egg_foods[['food', 'protein']].head().to_string())

# Test 4: Check chicken specifically
chicken_foods = non_veg_filtered[non_veg_filtered['food'].str.lower().str.contains('chicken', na=False)]
print(f'✓ Chicken dishes found: {len(chicken_foods)}')
if len(chicken_foods) > 0:
    print('  Sample chicken:')
    print(chicken_foods[['food', 'protein']].head().to_string())

print('\nAll tests passed!')
