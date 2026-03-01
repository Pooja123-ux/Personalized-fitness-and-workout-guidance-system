from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..schemas import Recommendation
from ..models import Profile, Report, WorkoutDailyLog
from ..deps import get_db, get_current_user
from .. import logic
import json
from datetime import date, timedelta

router = APIRouter()

def _split_to_list(value: str | None) -> list[str]:
    if not value:
        return []
    s = str(value)
    for sep in ["\n", ";", "|", "/"]:
        s = s.replace(sep, ",")
    return [p.strip() for p in s.split(",") if p and p.strip()]

def _dedupe_keep_order(items: list[str]) -> list[str]:
    seen = set()
    out: list[str] = []
    for raw in items:
        v = str(raw).strip()
        if not v:
            continue
        k = v.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(v)
    return out

def _parse_report_context(summary_text: str) -> dict:
    ctx = {
        "diseases": [],
        "allergies": [],
        "consume": [],
        "avoid": [],
        "injuries": [],
    }
    if not summary_text:
        return ctx
    try:
        data = json.loads(summary_text)
    except Exception:
        return ctx
    if not isinstance(data, dict):
        return ctx

    disease_keys = ["diseases", "conditions", "health_conditions", "medical_conditions"]
    allergy_keys = ["allergies", "food_allergies"]
    consume_keys = ["foods_to_consume", "consume", "recommended_foods", "eat_more"]
    avoid_keys = ["foods_to_avoid", "avoid", "avoid_foods", "avoid_items", "restricted_foods"]
    injury_keys = ["injury_body_parts", "injuries"]

    diseases: list[str] = []
    allergies: list[str] = []
    consume: list[str] = []
    avoid: list[str] = []
    injuries: list[str] = []

    for k in disease_keys:
        v = data.get(k)
        if isinstance(v, list):
            diseases.extend([str(x) for x in v if str(x).strip()])
        elif isinstance(v, str):
            diseases.extend(_split_to_list(v))
    for k in allergy_keys:
        v = data.get(k)
        if isinstance(v, list):
            allergies.extend([str(x) for x in v if str(x).strip()])
        elif isinstance(v, str):
            allergies.extend(_split_to_list(v))
    for k in consume_keys:
        v = data.get(k)
        if isinstance(v, list):
            consume.extend([str(x) for x in v if str(x).strip()])
        elif isinstance(v, str):
            consume.extend(_split_to_list(v))
    for k in avoid_keys:
        v = data.get(k)
        if isinstance(v, list):
            avoid.extend([str(x) for x in v if str(x).strip()])
        elif isinstance(v, str):
            avoid.extend(_split_to_list(v))
    for k in injury_keys:
        v = data.get(k)
        if isinstance(v, list):
            injuries.extend([str(x) for x in v if str(x).strip()])
        elif isinstance(v, str):
            injuries.extend(_split_to_list(v))

    ctx["diseases"] = _dedupe_keep_order(diseases)
    ctx["allergies"] = _dedupe_keep_order(allergies)
    ctx["consume"] = _dedupe_keep_order(consume)
    ctx["avoid"] = _dedupe_keep_order(avoid)
    ctx["injuries"] = _dedupe_keep_order(injuries)
    return ctx

def _merge_preference(pref: str, consume_list: list[str]) -> str:
    p = (pref or "").strip()
    if not consume_list:
        return p
    consume_text = ", ".join(consume_list)
    if not p:
        return consume_text
    return f"{p}, {consume_text}"

def _extract_report_injuries(summary_text: str) -> list[str]:
    if not summary_text:
        return []
    injuries: list[str] = []
    try:
        data = json.loads(summary_text)
        for key in ["injury_body_parts", "injuries"]:
            vals = data.get(key, [])
            if isinstance(vals, list):
                for v in vals:
                    token = str(v).strip().lower()
                    if token:
                        injuries.append(token)
    except Exception:
        pass
    seen = set()
    out = []
    for x in injuries:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


@router.get("", response_model=Recommendation)
def get_recommendations(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    # ---------------- WATER INTAKE ----------------
    water_l = 2.0
    if profile and profile.weight_kg is not None:
        weight_float = float(profile.weight_kg)
        water_calc = weight_float * 0.033
        water_l = round(max(1.8, water_calc), 2)

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
    height_val = getattr(profile, "height_cm", None) if profile else None
    weight_val = getattr(profile, "weight_kg", None) if profile else None
    height_cm = float(height_val) if height_val is not None else 170.0
    weight_kg = float(weight_val) if weight_val is not None else 70.0
    level = getattr(profile, "level", "beginner")
    age = getattr(profile, "age", None)
    gender = getattr(profile, "gender", None)
    bmi = logic.compute_bmi(height_cm, weight_kg)
    latest_report = (
        db.query(Report)
        .filter(Report.user_id == user.id)
        .order_by(Report.created_at.desc())
        .first()
    )
    report_injuries = _extract_report_injuries(getattr(latest_report, "summary", "") if latest_report else "")
    report_ctx = _parse_report_context(getattr(latest_report, "summary", "") if latest_report else "")
    effective_diseases = _dedupe_keep_order(_split_to_list(health_diseases) + report_ctx.get("diseases", []))
    # Treat report avoid items as strict allergy/avoid tokens for safety.
    effective_allergies = _dedupe_keep_order(
        _split_to_list(allergies) + report_ctx.get("allergies", []) + report_ctx.get("avoid", [])
    )
    report_consume = report_ctx.get("consume", [])
    merged_injuries = _dedupe_keep_order(report_injuries + report_ctx.get("injuries", []))

    today = date.today()
    start = today - timedelta(days=13)
    workout_logs = (
        db.query(WorkoutDailyLog)
        .filter(WorkoutDailyLog.user_id == user.id, WorkoutDailyLog.log_date >= start.isoformat())
        .all()
    )
    completion_rate_14d = 0.0
    workout_streak_days = 0
    if workout_logs:
        completed = sum(1 for r in workout_logs if bool(getattr(r, "completed", False)))
        completion_rate_14d = completed / 14.0
    recent_lookup = {str(getattr(r, "log_date", "")): bool(getattr(r, "completed", False)) for r in workout_logs}
    cursor = today
    while recent_lookup.get(cursor.isoformat(), False):
        workout_streak_days += 1
        cursor = cursor - timedelta(days=1)

    # ---------------- GENERATE RECOMMENDATIONS ----------------
    user_data = {
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "motive": motive,
        "diet_type": diet_type,
        "diseases": ", ".join(effective_diseases),
        "allergies": ", ".join(effective_allergies),
        "level": level,
        "lifestyle_level": lifestyle_level,
        "target_area": getattr(profile, "target_area", None) or "",
        "breakfast": _merge_preference(breakfast, report_consume),
        "lunch": _merge_preference(lunch, report_consume),
        "snacks": _merge_preference(snacks, report_consume),
        "dinner": _merge_preference(dinner, report_consume),
        "age": age,
        "gender": gender,
        "bmi": bmi,
        "report_injuries": merged_injuries,
        "workout_completion_rate_14d": completion_rate_14d,
        "workout_streak_days": workout_streak_days,
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
