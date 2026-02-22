"""
Nutrition Tracking API Routes
Handle macronutrient tracking and daily nutrition data
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta
from ..deps import get_current_user
from ..deps import get_db
from sqlalchemy.orm import Session
from ..models import Profile
from .. import logic

router = APIRouter()

# Pydantic models for nutrition tracking
class MacroData(BaseModel):
    protein: float
    carbs: float
    fats: float

class DailyNutrition(BaseModel):
    date: date
    consumed: MacroData
    target: MacroData
    calories: int
    water_ml: int

class NutritionEntry(BaseModel):
    food_name: str
    quantity: float  # in grams
    macros: MacroData
    calories: int

# In-memory storage for demo (use database in production)
nutrition_data = {}

def _user_date_key(user_id: str, target_date: date) -> str:
    return f"{user_id}:{target_date.isoformat()}"

def _build_user_data_from_profile(profile: Optional[Profile]) -> dict:
    if not profile:
        return {
            "height_cm": 170,
            "weight_kg": 70,
            "motive": "fitness",
            "diet_type": "vegetarian",
            "diseases": "",
            "allergies": "",
            "level": "beginner",
            "lifestyle_level": "sedentary",
            "target_area": "",
            "breakfast": "",
            "lunch": "",
            "snacks": "",
            "dinner": "",
            "age": 30,
            "gender": "male",
            "water_consumption_l": 2.0
        }
    return {
        "height_cm": profile.height_cm or 170,
        "weight_kg": profile.weight_kg or 70,
        "motive": profile.motive or "fitness",
        "diet_type": profile.diet_type or "vegetarian",
        "diseases": profile.health_diseases or "",
        "allergies": profile.food_allergies or "",
        "level": "beginner",
        "lifestyle_level": profile.lifestyle_level or "sedentary",
        "target_area": profile.target_area or "",
        "breakfast": profile.breakfast or "",
        "lunch": profile.lunch or "",
        "snacks": profile.snacks or "",
        "dinner": profile.dinner or "",
        "age": profile.age or 30,
        "gender": profile.gender or "male",
        "water_consumption_l": profile.water_consumption_l or 2.0
    }

def _profile_nutrition_snapshot(profile: Optional[Profile]) -> DailyNutrition:
    user_data = _build_user_data_from_profile(profile)
    daily_calories = logic.daily_calorie_target(
        user_data["weight_kg"],
        user_data["height_cm"],
        user_data["lifestyle_level"],
        user_data["motive"],
        user_data["age"],
        user_data["gender"],
    )
    target_macros = calculate_macros_from_calories(int(round(daily_calories)))

    # Build consumed values from current recommendation engine output
    rec = logic.generate_recommendations(user_data)
    diet_totals = rec.get("diet_totals") or {}
    if diet_totals:
        consumed_protein = float(diet_totals.get("daily_protein_g", 0) or 0)
        consumed_carbs = float(diet_totals.get("daily_carbs_g", 0) or 0)
        consumed_fats = float(diet_totals.get("daily_fat_g", 0) or 0)
        consumed_calories = float(diet_totals.get("daily_calories", 0) or 0)
    else:
        diet_items = rec.get("diet", []) or []
        consumed_protein = float(sum(float(m.get("protein_g", 0) or 0) for m in diet_items))
        consumed_carbs = float(sum(float(m.get("carbs_g", 0) or 0) for m in diet_items))
        consumed_fats = float(sum(float(m.get("fat_g", 0) or 0) for m in diet_items))
        consumed_calories = float(sum(
            float(m.get("calories", 0) or 0) * (float(m.get("serving_g", 100) or 100) / 100.0)
            for m in diet_items
        ))

    consumed = MacroData(
        protein=round(consumed_protein, 1),
        carbs=round(consumed_carbs, 1),
        fats=round(consumed_fats, 1),
    )
    calories = int(round(consumed_calories if consumed_calories > 0 else (consumed.protein * 4 + consumed.carbs * 4 + consumed.fats * 9)))
    water_ml = int(round(float(user_data.get("water_consumption_l", 2.0)) * 1000))

    return DailyNutrition(
        date=date.today(),
        consumed=consumed,
        target=target_macros,
        calories=calories,
        water_ml=water_ml
    )

def _estimate_sodium_mg(user_data: dict) -> float:
    """
    Estimate sodium for the day from recommendation foods and serving sizes.
    Returns 0 when sodium data is unavailable.
    """
    try:
        rec = logic.generate_recommendations(user_data)
        diet_items = rec.get("diet", []) or []
        df = logic.load_foods(logic.CSV_PATH)
        if "sodium (mg)" not in df.columns:
            return 0.0

        # Build lookup by normalized food name
        lookup = {}
        for _, row in df.iterrows():
            food = str(row.get("food", "")).strip().lower()
            if not food:
                continue
            sodium_100g = float(row.get("sodium (mg)", 0) or 0)
            if food not in lookup:
                lookup[food] = sodium_100g

        total_sodium = 0.0
        for item in diet_items:
            food_name = str(item.get("food_name", "")).strip().lower()
            serving_g = float(item.get("serving_g", 100) or 100)
            sodium_100g = lookup.get(food_name)
            if sodium_100g is None:
                # fuzzy fallback by partial match
                match = next((lookup[k] for k in lookup.keys() if food_name and food_name in k), None)
                sodium_100g = match if match is not None else 0.0
            total_sodium += float(sodium_100g) * (serving_g / 100.0)
        return round(total_sodium, 1)
    except Exception:
        return 0.0

def _build_smart_alerts(
    consumed_protein: float,
    target_protein: float,
    consumed_calories: float,
    target_calories: float,
    estimated_sodium_mg: float,
    user_data: Optional[dict] = None
) -> List[dict]:
    alerts: List[dict] = []
    user_data = user_data or {}
    diet_type = str(user_data.get("diet_type", "")).lower()
    allergies = str(user_data.get("allergies", "")).lower()

    if target_protein > 0 and consumed_protein < (target_protein * 0.8):
        protein_suggestions = [
            "Add one protein serving at snacks (e.g., sprouts, lentils, eggs, tofu).",
            "Include a protein source in each main meal to spread intake across the day.",
            "Target at least 25-35g protein per main meal."
        ]
        if diet_type == "vegetarian":
            protein_suggestions[0] = "Add one vegetarian protein serving at snacks (sprouts, lentils, paneer/tofu)."
        if "milk" in allergies or "dairy" in allergies:
            protein_suggestions = [s.replace("paneer/", "").replace("paneer", "tofu") for s in protein_suggestions]
        alerts.append({
            "type": "low_protein_day",
            "severity": "medium",
            "message": "Low protein day: you're below 80% of your protein target.",
            "suggestions": protein_suggestions
        })

    if target_calories > 0:
        deficit = target_calories - consumed_calories
        if deficit > 900:
            deficit_suggestions = [
                "Increase calories gradually by 200-300 kcal using balanced meals.",
                "Add one extra meal/snack with protein + complex carbs.",
                "Avoid very low-calorie days repeatedly to protect recovery and adherence."
            ]
            alerts.append({
                "type": "calorie_deficit_too_aggressive",
                "severity": "high",
                "message": "Calorie deficit too aggressive: over 900 kcal below target today.",
                "suggestions": deficit_suggestions
            })

    if estimated_sodium_mg > 2300:
        sodium_suggestions = [
            "Cut packaged snacks/instant sauces for the next meal.",
            "Use herbs, lemon, and spices instead of extra salt.",
            "Increase water intake and prioritize fresh, minimally processed foods."
        ]
        alerts.append({
            "type": "high_sodium_day",
            "severity": "high",
            "message": "High sodium day: estimated sodium is above 2300 mg.",
            "suggestions": sodium_suggestions
        })

    return alerts

def calculate_macros_from_calories(calories: int, target_ratio: Optional[dict] = None) -> MacroData:
    """Calculate target macros based on calories and ratio"""
    if not target_ratio:
        # Default ratio: 30% protein, 45% carbs, 25% fats
        target_ratio = {"protein": 0.30, "carbs": 0.45, "fats": 0.25}
    
    protein_calories = calories * target_ratio["protein"]
    carbs_calories = calories * target_ratio["carbs"]
    fats_calories = calories * target_ratio["fats"]
    
    return MacroData(
        protein=round(protein_calories / 4, 1),  # 4 calories per gram
        carbs=round(carbs_calories / 4, 1),      # 4 calories per gram
        fats=round(fats_calories / 9, 1)         # 9 calories per gram
    )

@router.get("/daily/{target_date}")
async def get_daily_nutrition(
    target_date: date,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily nutrition data for a specific date"""
    try:
        user_id = str(user.id) if hasattr(user, 'id') else "demo_user"
        key = _user_date_key(user_id, target_date)
        legacy_key = target_date.isoformat()

        # Backward compatibility for previously stored global date keys
        if key not in nutrition_data and legacy_key in nutrition_data:
            nutrition_data[key] = nutrition_data[legacy_key]

        if key not in nutrition_data:
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            snap = _profile_nutrition_snapshot(profile)
            snap.date = target_date
            nutrition_data[key] = snap
        
        return nutrition_data[key]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nutrition data: {str(e)}")

@router.post("/daily/{target_date}")
async def update_daily_nutrition(
    target_date: date,
    nutrition: DailyNutrition,
    user=Depends(get_current_user)
):
    """Update daily nutrition data"""
    try:
        user_id = str(user.id) if hasattr(user, 'id') else "demo_user"
        key = _user_date_key(user_id, target_date)
        
        nutrition_data[key] = nutrition
        
        return {
            "message": "Nutrition data updated successfully",
            "date": target_date.isoformat(),
            "calories": nutrition.calories,
            "macro_completeness": {
                "protein": min(100, round((nutrition.consumed.protein / nutrition.target.protein) * 100)),
                "carbs": min(100, round((nutrition.consumed.carbs / nutrition.target.carbs) * 100)),
                "fats": min(100, round((nutrition.consumed.fats / nutrition.target.fats) * 100))
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating nutrition data: {str(e)}")

@router.get("/weekly")
async def get_weekly_nutrition(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get nutrition data for the past week"""
    try:
        user_id = str(user.id) if hasattr(user, 'id') else "demo_user"

        # Ensure today exists
        today = date.today()
        today_data = await get_daily_nutrition(today, user, db)

        # Collect only real available entries for last 7 days (avoid fake constant backfill)
        weekly_data = []
        
        for i in range(7):
            target_date = today - timedelta(days=i)
            key = _user_date_key(user_id, target_date)
            legacy_key = target_date.isoformat()

            if key in nutrition_data:
                weekly_data.append(nutrition_data[key])
            elif legacy_key in nutrition_data:
                legacy = nutrition_data[legacy_key]
                nutrition_data[key] = legacy
                weekly_data.append(legacy)
            elif i == 0:
                weekly_data.append(today_data)

        if not weekly_data:
            weekly_data = [today_data]
        
        days_count = max(1, len(weekly_data))

        return {
            "weekly_data": weekly_data,
            "averages": {
                "calories": round(sum(d.calories for d in weekly_data) / days_count),
                "protein": round(sum(d.consumed.protein for d in weekly_data) / days_count, 1),
                "carbs": round(sum(d.consumed.carbs for d in weekly_data) / days_count, 1),
                "fats": round(sum(d.consumed.fats for d in weekly_data) / days_count, 1)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching weekly nutrition data: {str(e)}")

@router.get("/targets")
async def get_nutrition_targets(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get nutrition targets based on user profile"""
    try:
        user_id = str(user.id) if hasattr(user, 'id') else "demo_user"
        
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        u = _build_user_data_from_profile(profile)
        target_calories = int(round(logic.daily_calorie_target(
            u["weight_kg"], u["height_cm"], u["lifestyle_level"], u["motive"], u["age"], u["gender"]
        )))
        target_macros = calculate_macros_from_calories(target_calories)
        
        return {
            "calories": target_calories,
            "macros": target_macros,
            "water_ml": int(round(float(u.get("water_consumption_l", 2.0)) * 1000)),
            "recommendations": {
                "protein": "Aim for lean meats, fish, eggs, and legumes",
                "carbs": "Focus on complex carbs like whole grains and vegetables",
                "fats": "Include healthy fats from nuts, avocados, and olive oil"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nutrition targets: {str(e)}")

@router.post("/targets")
async def update_nutrition_targets(
    calories: int,
    protein_ratio: float = 0.30,
    carbs_ratio: float = 0.45,
    fats_ratio: float = 0.25,
    user=Depends(get_current_user)
):
    """Update nutrition targets"""
    try:
        if abs(protein_ratio + carbs_ratio + fats_ratio - 1.0) > 0.01:
            raise HTTPException(status_code=400, detail="Macro ratios must sum to 1.0")
        
        target_macros = calculate_macros_from_calories(
            calories, 
            {"protein": protein_ratio, "carbs": carbs_ratio, "fats": fats_ratio}
        )
        
        return {
            "message": "Nutrition targets updated successfully",
            "calories": calories,
            "macros": target_macros,
            "ratios": {
                "protein": protein_ratio,
                "carbs": carbs_ratio,
                "fats": fats_ratio
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating nutrition targets: {str(e)}")

@router.get("/summary")
async def get_nutrition_summary(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall nutrition summary"""
    try:
        user_id = str(user.id) if hasattr(user, 'id') else "demo_user"
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        user_data = _build_user_data_from_profile(profile)

        # Get today's data
        today = date.today()
        daily_data = await get_daily_nutrition(today, user, db)

        target_calories = round(
            daily_data.target.protein * 4 +
            daily_data.target.carbs * 4 +
            daily_data.target.fats * 9
        )
        estimated_sodium_mg = _estimate_sodium_mg(user_data)
        smart_alerts = _build_smart_alerts(
            consumed_protein=daily_data.consumed.protein,
            target_protein=daily_data.target.protein,
            consumed_calories=daily_data.calories,
            target_calories=target_calories,
            estimated_sodium_mg=estimated_sodium_mg,
            user_data=user_data
        )
        
        # Calculate completion percentages
        protein_completion = min(100, round((daily_data.consumed.protein / daily_data.target.protein) * 100))
        carbs_completion = min(100, round((daily_data.consumed.carbs / daily_data.target.carbs) * 100))
        fats_completion = min(100, round((daily_data.consumed.fats / daily_data.target.fats) * 100))
        
        return {
            "date": today.isoformat(),
            "consumed": daily_data.consumed,
            "target": daily_data.target,
            "calories": daily_data.calories,
            "completion_percentages": {
                "protein": protein_completion,
                "carbs": carbs_completion,
                "fats": fats_completion,
                "overall": round((protein_completion + carbs_completion + fats_completion) / 3)
            },
            "remaining": {
                "protein": max(0, daily_data.target.protein - daily_data.consumed.protein),
                "carbs": max(0, daily_data.target.carbs - daily_data.consumed.carbs),
                "fats": max(0, daily_data.target.fats - daily_data.consumed.fats)
            },
            "water_ml": daily_data.water_ml,
            "on_track": protein_completion >= 90 and carbs_completion >= 90 and fats_completion >= 90,
            "estimated_sodium_mg": estimated_sodium_mg,
            "alerts": smart_alerts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nutrition summary: {str(e)}")
