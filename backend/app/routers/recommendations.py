from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..schemas import Recommendation
from ..models import Profile, Report
from ..deps import get_db, get_current_user
from .. import logic
import json

router = APIRouter()


@router.get("", response_model=Recommendation)
def get_recommendations(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    # ---------------- WATER INTAKE ----------------
    water_l = 2.0
    if profile and profile.weight_kg is not None:
        water_l = round(max(1.8, float(profile.weight_kg) * 0.033), 2)

    # ---------------- DEFAULT FALLBACK ----------------
    lifestyle_level = getattr(profile, "lifestyle_level", None) or "sedentary"
    motive = (getattr(profile, "motive", None) or "remain fit and healthy").lower()
    diet_type = getattr(profile, "diet_type", None) or "vegetarian"
    health_diseases = getattr(profile, "health_diseases", None) or ""
    allergies = getattr(profile, "food_allergies", None) or ""
    breakfast = getattr(profile, "breakfast", None) or ""
    lunch = getattr(profile, "lunch", None) or ""
    snacks = getattr(profile, "snacks", None) or ""
    dinner = getattr(profile, "dinner", None) or ""
    height_cm = getattr(profile, "height_cm", 170)
    weight_kg = getattr(profile, "weight_kg", 70)
    level = getattr(profile, "level", "beginner")
    age = getattr(profile, "age", None)
    gender = getattr(profile, "gender", None)
    bmi = logic.compute_bmi(height_cm, weight_kg)

    # ---------------- GENERATE RECOMMENDATIONS ----------------
    user_data = {
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "motive": motive,
        "diet_type": diet_type,
        "diseases": health_diseases,
        "allergies": allergies,
        "level": level,
        "lifestyle_level": lifestyle_level,
        "target_area": getattr(profile, "target_area", None) or "",
        "breakfast": breakfast,
        "lunch": lunch,
        "snacks": snacks,
        "dinner": dinner,
        "age": age,
        "gender": gender,
        "bmi": bmi,
    }

    rec = logic.generate_recommendations(user_data)
    
    # Calculate daily protein target
    daily_protein = logic.daily_protein_target(weight_kg, motive, lifestyle_level, age)

    raw_daily_calories = rec.get("daily_calories")
    rounded_daily_calories = int(round(float(raw_daily_calories))) if raw_daily_calories is not None else None

    return Recommendation(
        workouts=rec.get("workouts", []),
        yoga=rec.get("yoga", []),
        diet=rec.get("diet", []),
        water_l=water_l,
        daily_calories=rounded_daily_calories,
        daily_protein_g=daily_protein,
        diet_alternatives=rec.get("diet_alternatives"),
        diet_recommendation_text=rec.get("diet_recommendation_text"),
    )
