"""
Quick test to check what's actually in the datasets
"""

import pandas as pd

def check_datasets():
    print("Checking dataset contents...")
    
    # Check exercises
    exercises_df = pd.read_csv('app/exercises.csv')
    print(f"\n📋 Exercises dataset: {len(exercises_df)} rows")
    print("Sample exercise names:")
    for i, name in enumerate(exercises_df['name'].head(10)):
        print(f"  {i+1}. {name}")
    
    # Check for specific exercises
    squat_exercises = exercises_df[exercises_df['name'].str.lower().str.contains('squat', na=False)]
    print(f"\nFound {len(squat_exercises)} exercises with 'squat' in name:")
    for name in squat_exercises['name'].head(5):
        print(f"  - {name}")
    
    # Check Indian food
    food_df = pd.read_csv('app/Indian_Food_Nutrition_Processed.csv')
    print(f"\n🥗 Indian Food dataset: {len(food_df)} rows")
    print("Sample food names:")
    for i, name in enumerate(food_df['Dish Name'].head(10)):
        print(f"  {i+1}. {name}")
    
    # Check for specific foods
    chai_foods = food_df[food_df['Dish Name'].str.lower().str.contains('chai', na=False)]
    print(f"\nFound {len(chai_foods)} foods with 'chai' in name:")
    for name in chai_foods['Dish Name']:
        print(f"  - {name}")
    
    # Check disease food
    disease_df = pd.read_csv('app/real_disease_food_nutrition_dataset.csv')
    print(f"\n🏥 Disease-Food dataset: {len(disease_df)} rows")
    print("Sample diseases:")
    diseases = disease_df['Disease'].unique()
    for i, disease in enumerate(diseases[:10]):
        print(f"  {i+1}. {disease}")
    
    # Check yoga poses
    yoga_df = pd.read_csv('app/final_asan1_1.csv')
    print(f"\n🧘 Yoga dataset: {len(yoga_df)} rows")
    print("Sample yoga poses:")
    for i, name in enumerate(yoga_df['AName'].head(10)):
        print(f"  {i+1}. {name}")

if __name__ == "__main__":
    check_datasets()
