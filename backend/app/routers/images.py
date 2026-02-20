from fastapi import APIRouter, Depends, UploadFile, File
from typing import List
from .. import logic
from ..deps import get_current_user

router = APIRouter()

@router.post("/analyze")
async def analyze_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    return {"detected": "unknown", "notes": "Vision analysis will be integrated with OpenCV and TensorFlow."}

@router.get("/foods", response_model=List[str])
async def list_foods(user=Depends(get_current_user)):
    try:
        df = logic.load_foods(logic.CSV_PATH)
        foods = df["food"].astype(str).str.strip().tolist()
        uniq = sorted(set([f for f in foods if f]))
        return uniq
    except Exception:
        return []

@router.get("/nutrition")
async def get_nutrition(food: str, user=Depends(get_current_user)):
    try:
        df = logic.load_foods(logic.CSV_PATH)
        f = (food or "").strip().lower()
        row = df[df["food"].str.lower() == f]
        if row.empty:
            row = df[df["food"].str.lower().str.contains(f)]
        if row.empty:
            return {"food_name": food, "calories_per_100g": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
        r = row.iloc[0]
        return {
            "food_name": str(r.get("food", "")),
            "calories_per_100g": float(r.get("calories", 0) or 0),
            "protein_g": float(r.get("protein", 0) or 0),
            "carbs_g": float(r.get("carbs", 0) or 0),
            "fat_g": float(r.get("fat", 0) or 0),
        }
    except Exception:
        return {"food_name": food, "calories_per_100g": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
