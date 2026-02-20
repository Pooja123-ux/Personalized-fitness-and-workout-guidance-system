"""Check if eggs/chicken/meat are in the dataset"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import load_foods
from pathlib import Path
import pandas as pd

# Load all foods
BASE_DIR = r'c:\Fitness\backend\app'
csv_path = Path(BASE_DIR) / "Indian_Food_Nutrition_Processed.csv"
df = load_foods(csv_path)

# Search for eggs, chicken, meat
search_terms = ["egg", "chicken", "fish", "meat", "mutton"]

for term in search_terms:
    matching = df[df["food"].str.lower().str.contains(term, na=False)]
    print(f"\n{term.upper()}: {len(matching)} foods found")
    if len(matching) > 0:
        print(matching[["food", "protein", "calories_per_100g"]].head(5).to_string())
