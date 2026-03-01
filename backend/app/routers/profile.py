from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import shutil
import os
import json
import re

from ..schemas import ProfileIn, ProfileOut, Recommendation
from ..models import Profile, Report
from ..deps import get_db, get_current_user
from ..logic import (
    compute_bmi,
    bmi_category,
    generate_recommendations,
    analyze_medical_pdf,
    get_exercises,
    get_disease_recommendations,
    df_disease,
    df_food,
    df_chatbot,
)
from typing import Dict, Optional

router = APIRouter()

_INJURY_PARTS = ["knee", "shoulder", "lower back", "back", "neck", "ankle", "wrist", "elbow", "hip"]

def _split_csv(value: Optional[str]) -> list[str]:
    if not value:
        return []
    s = str(value).lower()
    for sep in ["|", ";", "/", "\n"]:
        s = s.replace(sep, ",")
    out = []
    for part in s.split(","):
        token = part.strip()
        if token:
            out.append(token)
    seen = set()
    dedup = []
    for x in out:
        if x not in seen:
            seen.add(x)
            dedup.append(x)
    return dedup

def _extract_profile_injuries(health_diseases: Optional[str]) -> Dict[str, str]:
    text = (health_diseases or "")
    lower = text.lower()
    injured_parts = []
    for p in _INJURY_PARTS:
        if p in lower:
            injured_parts.append(p)
    note_match = re.search(r"injury[_\s]*notes?\s*:\s*([^;|]+)", lower)
    injury_notes = note_match.group(1).strip() if note_match else ""
    return {
        "injured_body_parts": ", ".join(dict.fromkeys(injured_parts)),
        "injury_notes": injury_notes,
    }

def _merge_health_with_injuries(health_diseases: Optional[str], injured_body_parts: Optional[str], injury_notes: Optional[str]) -> str:
    base = (health_diseases or "").strip()
    injuries = _split_csv(injured_body_parts)
    if not injuries and not (injury_notes and injury_notes.strip()):
        return base
    tokens = [t for t in [base] if t]
    if injuries:
        tokens.append(f"injuries: {', '.join(injuries)}")
    if injury_notes and injury_notes.strip():
        tokens.append(f"injury_notes: {injury_notes.strip()}")
    return " | ".join(tokens)

def _invalidate_weekly_plan_cache(user_id: int) -> None:
    """Invalidate cached weekly meal plans after profile/medical changes."""
    try:
        from .weekly_meal_plan import weekly_plans
        weekly_plans.pop(f"user:{user_id}", None)
        # Keep public demo endpoint in sync as well.
        weekly_plans.pop("current", None)
    except Exception:
        pass


# =========================================================
# CREATE OR UPDATE PROFILE
# =========================================================
@router.post("", response_model=ProfileOut)
def create_or_update_profile(
    payload: ProfileIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    height = float(payload.height_cm) if payload.height_cm else 170.0
    weight = float(payload.weight_kg) if payload.weight_kg else 70.0
    bmi = compute_bmi(height, weight)
    category = bmi_category(bmi)

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    payload_data = payload.model_dump()
    injured_body_parts = payload_data.pop("injured_body_parts", None)
    injury_notes = payload_data.pop("injury_notes", None)
    payload_data["health_diseases"] = _merge_health_with_injuries(
        payload_data.get("health_diseases"),
        injured_body_parts,
        injury_notes,
    )

    if profile:
        for k, v in payload_data.items():
            if hasattr(profile, k):
                setattr(profile, k, v)
    else:
        profile = Profile(
            user_id=user.id,
            bmi=bmi,
            bmi_category=category,
            **payload_data,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    _invalidate_weekly_plan_cache(user.id)

    resp = dict(profile.__dict__)
    resp.update(_extract_profile_injuries(getattr(profile, "health_diseases", "")))
    return ProfileOut(**resp)


# =========================================================
# GET PROFILE (AUTO-CREATE IF NOT EXISTS ✅)
# =========================================================
@router.get("", response_model=ProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    if not profile:
        profile = Profile(
            user_id=user.id,
            name="",
            age=0,
            gender="",
            height_cm=170,
            weight_kg=70,
            lifestyle_level="sedentary",
            diet_type="vegetarian",
            target_area="",
            water_consumption_l=2.0,
            junk_food_consumption="",
            healthy_food_consumption="",
            breakfast="",
            lunch="",
            snacks="",
            dinner="",
            motive="remain fit and healthy",
            duration_weeks=0,
            food_allergies="",
            health_diseases="",
            bmi=22,
            bmi_category="healthy",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    resp = dict(profile.__dict__)
    resp.update(_extract_profile_injuries(getattr(profile, "health_diseases", "")))
    return ProfileOut(**resp)


# =========================================================
# UPLOAD MEDICAL REPORT (PDF)
# =========================================================
@router.post("/upload-report", response_model=dict)
def upload_medical_report(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    upload_dir = "uploads/reports"
    os.makedirs(upload_dir, exist_ok=True)

    filepath = os.path.join(
        upload_dir,
        f"{user.id}_{int(datetime.utcnow().timestamp())}_{file.filename}",
    )

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Analyze medical PDF
    health_summary = analyze_medical_pdf(filepath)

    report = Report(
        user_id=user.id,
        filename=file.filename,
        path=filepath,
        summary=json.dumps(health_summary),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    _invalidate_weekly_plan_cache(user.id)

    # Fetch or auto-create profile
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not initialized")

    rec = generate_recommendations({
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "motive": profile.motive,
        "diet_type": profile.diet_type,
        "lifestyle_level": profile.lifestyle_level,
        "health_diseases": profile.health_diseases,
        "injured_body_parts": _extract_profile_injuries(profile.health_diseases).get("injured_body_parts", ""),
        "age": profile.age,
        "gender": profile.gender,
    })

    return {
        "message": "Report uploaded successfully",
        "health_summary": health_summary,
        "diet_recommendations": rec.get("diet", []),
        "workout_recommendations": rec.get("workouts", []),
    }


# =========================================================
# GET PERSONALIZED RECOMMENDATIONS
# =========================================================
@router.get("/recommendations", response_model=Recommendation)
def get_personalized_recommendations(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()

        if not profile:
            profile = Profile(
                user_id=user.id,
                name="",
                age=0,
                gender="",
                height_cm=170,
                weight_kg=70,
                lifestyle_level="sedentary",
                diet_type="vegetarian",
                target_area="",
                water_consumption_l=2.0,
                junk_food_consumption="",
                healthy_food_consumption="",
                breakfast="",
                lunch="",
                snacks="",
                dinner="",
                motive="remain fit and healthy",
                duration_weeks=0,
                food_allergies="",
                health_diseases="",
                bmi=22,
                bmi_category="healthy",
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        rec = generate_recommendations({
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "motive": profile.motive,
            "diet_type": profile.diet_type,
            "lifestyle_level": profile.lifestyle_level,
            "health_diseases": profile.health_diseases,
            "injured_body_parts": _extract_profile_injuries(profile.health_diseases).get("injured_body_parts", ""),
            "age": profile.age,
            "gender": profile.gender,
        })

        weight_val = profile.weight_kg
        weight = float(weight_val) if weight_val is not None else 70.0
        water_calc = weight * 0.033
        water_l = round(max(1.8, water_calc), 2)

        return Recommendation(
            workouts=rec.get("workouts", []),
            yoga=rec.get("yoga", []),
            diet=rec.get("diet", []),
            water_l=water_l,
        )
    except Exception as e:
        # If database operations fail, return default recommendations
        rec = generate_recommendations({
            "height_cm": 170,
            "weight_kg": 70,
            "motive": "remain fit and healthy",
            "diet_type": "vegetarian",
            "lifestyle_level": "sedentary",
            "health_diseases": "",
            "injured_body_parts": "",
            "age": 30,
            "gender": "male",
        })

        return Recommendation(
            workouts=rec.get("workouts", []),
            yoga=rec.get("yoga", []),
            diet=rec.get("diet", []),
            water_l=2.0,
        )


# =========================================================
# GET AB EXERCISES
# =========================================================
@router.get("/exercises/ab", response_model=dict)
def get_ab_exercises(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    level = str(profile.lifestyle_level) if profile and profile.lifestyle_level else "sedentary"
    injuries = _extract_profile_injuries(getattr(profile, "health_diseases", "")).get("injured_body_parts", "")
    exercises = get_exercises(
        level,
        target_count=8,
        target_area="core",
        age=getattr(profile, "age", None),
        weight_kg=getattr(profile, "weight_kg", None),
        medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
        injured_body_parts=_split_csv(injuries),
    )
    
    return {
        "exercises": exercises,
        "fundamentals": {
            "movement_patterns": [
                {"name": "Squat", "targets": "legs, glutes"},
                {"name": "Hinge", "targets": "deadlifts, back"},
                {"name": "Push", "targets": "chest, shoulders, triceps"},
                {"name": "Pull", "targets": "back, biceps"},
                {"name": "Core", "targets": "planks, rotations"}
            ],
            "tip": "Track your progress and increase load gradually while maintaining proper form."
        }
    }


# =========================================================
# GET UPPER BODY EXERCISES
# =========================================================
@router.get("/exercises/upper-body", response_model=dict)
def get_upper_body_exercises(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    level = str(profile.lifestyle_level) if profile and profile.lifestyle_level else "sedentary"
    injuries = _extract_profile_injuries(getattr(profile, "health_diseases", "")).get("injured_body_parts", "")
    exercises = get_exercises(
        level,
        target_count=10,
        target_area="upper body",
        age=getattr(profile, "age", None),
        weight_kg=getattr(profile, "weight_kg", None),
        medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
        injured_body_parts=_split_csv(injuries),
    )
    
    # Fallback: if no exercises returned, try without target_area filter
    if not exercises:
        exercises = get_exercises(
            level,
            target_count=10,
            target_area="",
            age=getattr(profile, "age", None),
            weight_kg=getattr(profile, "weight_kg", None),
            medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
            injured_body_parts=_split_csv(injuries),
        )
    
    return {
        "exercises": exercises,
        "beginner_guide": {
            "frequency": "Start 3-4 days/week",
            "duration": "30-45 min sessions",
            "workout_mix": "Mix cardio & strength",
            "split": "Full body or upper/lower split",
            "rest": "Rest days crucial",
            "location": "Home workouts work great - no gym needed initially"
        }
    }


# =========================================================
# GET FULL BODY EXERCISES
# =========================================================
@router.get("/exercises/full-body", response_model=dict)
def get_full_body_exercises(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    level = str(profile.lifestyle_level) if profile and profile.lifestyle_level else "sedentary"
    injuries = _extract_profile_injuries(getattr(profile, "health_diseases", "")).get("injured_body_parts", "")
    exercises = get_exercises(
        level,
        target_count=12,
        target_area="full body",
        age=getattr(profile, "age", None),
        weight_kg=getattr(profile, "weight_kg", None),
        medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
        injured_body_parts=_split_csv(injuries),
    )
    
    if not exercises:
        exercises = get_exercises(
            level,
            target_count=12,
            target_area="",
            age=getattr(profile, "age", None),
            weight_kg=getattr(profile, "weight_kg", None),
            medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
            injured_body_parts=_split_csv(injuries),
        )
    
    return {
        "exercises": exercises,
        "beginner_guide": {
            "frequency": "Start 3-4 days/week",
            "duration": "30-45 min sessions",
            "workout_mix": "Mix cardio & strength",
            "split": "Full body or upper/lower split",
            "rest": "Rest days crucial",
            "location": "Home workouts work great - no gym needed initially"
        }
    }


# =========================================================
# GET EXERCISES BY BODY PART
# =========================================================
@router.get("/exercises/bodypart/{bodypart}", response_model=dict)
def get_exercises_by_bodypart(
    bodypart: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    level = str(profile.lifestyle_level) if profile and profile.lifestyle_level else "sedentary"
    injuries = _extract_profile_injuries(getattr(profile, "health_diseases", "")).get("injured_body_parts", "")
    exercises = get_exercises(
        level,
        target_count=10,
        target_area=bodypart,
        age=getattr(profile, "age", None),
        weight_kg=getattr(profile, "weight_kg", None),
        medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
        injured_body_parts=_split_csv(injuries),
    )
    
    if not exercises:
        exercises = get_exercises(
            level,
            target_count=10,
            target_area="",
            age=getattr(profile, "age", None),
            weight_kg=getattr(profile, "weight_kg", None),
            medical_conditions=_split_csv(getattr(profile, "health_diseases", "")),
            injured_body_parts=_split_csv(injuries),
        )
    
    return {
        "bodypart": bodypart,
        "exercises": exercises,
        "total": len(exercises),
        "fundamentals": {
            "movement_patterns": [
                {"name": "Squat", "targets": "legs, glutes"},
                {"name": "Hinge", "targets": "deadlifts, back"},
                {"name": "Push", "targets": "chest, shoulders, triceps"},
                {"name": "Pull", "targets": "back, biceps"},
                {"name": "Core", "targets": "planks, rotations"}
            ],
            "tip": "Track your progress and increase load gradually while maintaining proper form."
        }
    }


# =========================================================
# GET DISEASE-SPECIFIC FOOD RECOMMENDATIONS
# =========================================================
@router.get("/nutrition/disease/{disease}", response_model=dict)
def get_disease_nutrition(
    disease: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    disease_lower = disease.lower()
    matching = df_disease[df_disease["disease"].str.lower().str.contains(disease_lower, na=False)]
    
    consume = []
    avoid = []
    
    for _, row in matching.iterrows():
        # Dynamically get all columns from the dataset
        food_data = {col: row.get(col, "") for col in df_disease.columns}
        
        rec_type = str(row.get("recommendation type", "")).lower()
        if rec_type == "consume":
            consume.append(food_data)
        elif rec_type == "avoid":
            avoid.append(food_data)
    
    return {
        "disease": disease,
        "foods_to_consume": consume,
        "foods_to_avoid": avoid,
        "total_consume": len(consume),
        "total_avoid": len(avoid)
    }


# =========================================================
# GET INDIAN DISHES FOR DISEASE
# =========================================================
@router.get("/nutrition/indian-dishes/{disease}", response_model=dict)
def get_indian_dishes_for_disease(
    disease: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    disease_lower = disease.lower()
    
    if "diabetes" in disease_lower:
        filtered = df_food[
            (df_food["carbohydrates (g)"] < 15) & 
            (df_food["free sugar (g)"] < 5) &
            (df_food["protein (g)"] > 5)
        ].sort_values(by="protein (g)", ascending=False).head(limit)
    elif "cholesterol" in disease_lower or "heart" in disease_lower:
        filtered = df_food[
            (df_food["fats (g)"] < 10) &
            (df_food["sodium (mg)"] < 200)
        ].sort_values(by="protein (g)", ascending=False).head(limit)
    else:
        filtered = df_food.sort_values(by="protein (g)", ascending=False).head(limit)
    
    dishes = [{col: row.get(col, "") for col in df_food.columns} for _, row in filtered.iterrows()]
    
    return {
        "disease": disease,
        "dishes": dishes,
        "total": len(dishes)
    }


# =========================================================
# GET INDIAN DISHES TO AVOID FOR DISEASE
# =========================================================
@router.get("/nutrition/avoid/{disease}", response_model=dict)
def get_dishes_to_avoid(
    disease: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    disease_lower = disease.lower()
    
    if "diabetes" in disease_lower:
        filtered = df_food[
            (df_food["carbohydrates (g)"] > 20) | 
            (df_food["free sugar (g)"] > 10)
        ].sort_values(by="free sugar (g)", ascending=False).head(limit)
    elif "cholesterol" in disease_lower or "heart" in disease_lower:
        filtered = df_food[
            (df_food["fats (g)"] > 15) |
            (df_food["sodium (mg)"] > 300)
        ].sort_values(by="fats (g)", ascending=False).head(limit)
    else:
        filtered = df_food.sort_values(by="calories (kcal)", ascending=False).head(limit)
    
    dishes = [{col: row.get(col, "") for col in df_food.columns} for _, row in filtered.iterrows()]
    
    return {
        "disease": disease,
        "dishes_to_avoid": dishes,
        "total": len(dishes)
    }


# =========================================================
# BMI CALCULATOR
# =========================================================
@router.get("/bmi", response_model=dict)
def calculate_bmi(
    weight_kg: Optional[float] = None,
    height_cm: Optional[float] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if weight_kg is None or height_cm is None:
        return {
            "formula": "BMI = weight (kg) / (height (m))²",
            "example": "For 70kg weight and 175cm height: BMI = 70 / (1.75)² = 22.86",
            "categories": {
                "underweight": "< 18.5",
                "healthy": "18.5 - 24.9",
                "overweight": "25.0 - 29.9",
                "obese": "≥ 30.0"
            },
            "usage": "Provide weight_kg and height_cm as query parameters"
        }
    
    bmi = compute_bmi(height_cm, weight_kg)
    category = bmi_category(bmi)
    
    return {
        "weight_kg": weight_kg,
        "height_cm": height_cm,
        "bmi": bmi,
        "category": category,
        "formula": f"BMI = {weight_kg} / ({height_cm/100})² = {bmi}"
    }


# =========================================================
# CHATBOT QUERY
# =========================================================
@router.get("/chatbot/query", response_model=dict)
def query_chatbot(
    q: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query_lower = q.lower()
    
    # Find matching intents
    matches = df_chatbot[df_chatbot["text"].str.lower().str.contains(query_lower, na=False)]
    
    if matches.empty:
        # Fuzzy match by keywords
        keywords = query_lower.split()
        for keyword in keywords:
            if len(keyword) > 3:
                matches = df_chatbot[df_chatbot["text"].str.lower().str.contains(keyword, na=False)]
                if not matches.empty:
                    break
    
    if not matches.empty:
        intent = matches.iloc[0]["intent"]
        similar_questions = df_chatbot[df_chatbot["intent"] == intent]["text"].tolist()
        
        return {
            "query": q,
            "intent": intent,
            "similar_questions": similar_questions[:5],
            "total_matches": len(matches)
        }
    
    return {
        "query": q,
        "intent": "unknown",
        "similar_questions": [],
        "total_matches": 0
    }
