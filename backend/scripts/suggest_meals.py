#!/usr/bin/env python3
"""Suggest food items and serving sizes from Indian_Food_Nutrition_Processed.csv.
Usage:
  python suggest_meals.py            # uses default targets
  python suggest_meals.py --breakfast 700 --lunch 1000 --snacks 400 --dinner 700
"""
import argparse
import json
from pathlib import Path
import pandas as pd

DEFAULT_TARGETS = {"breakfast": 720, "lunch": 1008, "snacks": 432, "dinner": 720}
CSV_PATH = Path(__file__).resolve().parent.parent / "app" / "Indian_Food_Nutrition_Processed.csv"


def load_foods(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")
    df = pd.read_csv(path)
    # normalize column names
    df.columns = [c.strip().lower() for c in df.columns]
    rename_map = {}
    if "dish name" in df.columns:
        rename_map["dish name"] = "food"
    if "calories (kcal)" in df.columns:
        rename_map["calories (kcal)"] = "calories"
    if "protein (g)" in df.columns:
        rename_map["protein (g)"] = "protein"
    if "carbohydrates (g)" in df.columns:
        rename_map["carbohydrates (g)"] = "carbs"
    if "fats (g)" in df.columns:
        rename_map["fats (g)"] = "fat"
    df = df.rename(columns=rename_map)
    # require food and calories
    if "food" not in df.columns:
        raise ValueError("Required column 'food' not found in CSV")
    if "calories" not in df.columns:
        # try common alternatives
        for col in ["cal", "kcal"]:
            if col in df.columns:
                df = df.rename(columns={col: "calories"})
                break
    df["food"] = df["food"].astype(str)
    df["calories"] = pd.to_numeric(df.get("calories", 0), errors="coerce").fillna(0)
    return df


def suggest_for_target(df: pd.DataFrame, meal_cal: float, topn: int = 5):
    # compute serving size (grams) to meet meal_cal based on calories per 100g
    df2 = df.copy()
    # avoid zero calories: treat as unknown and use fallback density later
    df2["calories_per_100g"] = df2["calories"].astype(float)

    # when calories_per_100g <=0, we'll set to fallback 200 kcal/100g
    df2["calories_per_100g"] = df2["calories_per_100g"].replace(0, pd.NA)
    fallback_density = 200.0

    def compute_serving(cal_per_100):
        c = float(cal_per_100) if pd.notna(cal_per_100) else fallback_density
        serving = (meal_cal / c) * 100.0
        return serving

    df2["serving_g"] = df2["calories_per_100g"].apply(lambda c: compute_serving(c))

    # filter unrealistic serving sizes
    df2 = df2[(df2["serving_g"] >= 40) & (df2["serving_g"] <= 1000)].copy()

    # score: prefer servings near typical 150-300g and moderate calorie density
    df2["score"] = (df2["serving_g"] - 220).abs()  # closer to 220g better
    df2["score"] += (df2["calories_per_100g"].fillna(fallback_density) - 200).abs() * 0.02

    df2 = df2.sort_values(by=["score", "serving_g"])

    results = []
    for _, r in df2.head(topn).iterrows():
        cal100 = r.get("calories_per_100g")
        if pd.isna(cal100) or float(cal100) <= 0:
            cal100 = fallback_density
        serving = round(float((meal_cal / cal100) * 100.0), 1)
        results.append({
            "food": r["food"],
            "calories_per_100g": round(float(cal100), 1),
            "serving_g": serving,
            "calories_serving": round(float(cal100) * serving / 100.0, 1),
        })
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--breakfast", type=float, default=DEFAULT_TARGETS["breakfast"])
    parser.add_argument("--lunch", type=float, default=DEFAULT_TARGETS["lunch"])
    parser.add_argument("--snacks", type=float, default=DEFAULT_TARGETS["snacks"])
    parser.add_argument("--dinner", type=float, default=DEFAULT_TARGETS["dinner"])
    parser.add_argument("--topn", type=int, default=3)
    args = parser.parse_args()

    df = load_foods(CSV_PATH)
    targets = {"breakfast": args.breakfast, "lunch": args.lunch, "snacks": args.snacks, "dinner": args.dinner}
    out = {}
    for meal, cal in targets.items():
        out[meal] = suggest_for_target(df, cal, topn=args.topn)

    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
