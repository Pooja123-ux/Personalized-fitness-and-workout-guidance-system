from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import date, datetime, timedelta
from ..deps import get_db, get_current_user
from ..models import Profile, Report, WorkoutDailyLog
from .. import logic
import json

router = APIRouter()

# Pydantic models for weekly workout plan
class WorkoutItem(BaseModel):
    name: str
    body_part: str
    equipment: str
    difficulty: str
    reps: str
    sets: str
    duration_minutes: int
    calories_burned: int
    instructions: List[str]

class DailyWorkoutPlan(BaseModel):
    day: str
    focus_area: str  # e.g., "Upper Body", "Lower Body", "Cardio", "Full Body"
    warmup: List[WorkoutItem]
    main_exercises: List[WorkoutItem]
    cooldown: List[WorkoutItem]
    total_duration: int
    estimated_calories: int

class WeeklyWorkoutPlan(BaseModel):
    week_start: str
    week_end: str
    workouts: Dict[str, DailyWorkoutPlan]  # Monday to Sunday
    weekly_duration: int
    weekly_calories: int
    based_on_weight: float
    based_on_target_area: str
    last_updated: str
    rest_days: List[str]

# In-memory storage for demo (use database in production)
weekly_workout_plans = {}

def _split_csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    s = str(value).lower()
    for sep in ["|", ";", "/", "\n"]:
        s = s.replace(sep, ",")
    out = [p.strip() for p in s.split(",") if p.strip()]
    return list(dict.fromkeys(out))

def _extract_report_injuries(summary_text: Optional[str]) -> List[str]:
    if not summary_text:
        return []
    try:
        data = json.loads(summary_text)
        vals = data.get("injury_body_parts") or data.get("injuries") or []
        if isinstance(vals, list):
            return list(dict.fromkeys([str(v).strip().lower() for v in vals if str(v).strip()]))
    except Exception:
        pass
    return []

def infer_level_from_lifestyle(lifestyle_level: Optional[str]) -> str:
    """Map profile lifestyle_level to workout level."""
    value = (lifestyle_level or "").strip().lower()
    if value in {"very_active", "active"}:
        return "advanced"
    if value in {"moderate", "light"}:
        return "intermediate"
    return "beginner"

def get_weekly_workout_variety(target_area: str, level: str, weight_kg: float) -> Dict:
    """Get diverse workout plan for the week based on target area and user level"""
    
    # Define workout focus areas for each day
    weekly_focus = {
        0: {"day": "Monday", "focus": "Upper Body", "intensity": "moderate"},
        1: {"day": "Tuesday", "focus": "Lower Body", "intensity": "high"},
        2: {"day": "Wednesday", "focus": "Cardio", "intensity": "moderate"},
        3: {"day": "Thursday", "focus": "Upper Body", "intensity": "low"},
        4: {"day": "Friday", "focus": "Full Body", "intensity": "high"},
        5: {"day": "Saturday", "focus": "Core & Flexibility", "intensity": "moderate"},
        6: {"day": "Sunday", "focus": "Rest", "intensity": "rest"}
    }
    
    # Adjust focus based on target area
    if target_area.lower() in ["weight loss", "fat loss", "cardio"]:
        weekly_focus[1]["focus"] = "Cardio + Lower Body"
        weekly_focus[2]["focus"] = "HIIT Cardio"
        weekly_focus[4]["focus"] = "Full Body + Cardio"
    elif target_area.lower() in ["muscle gain", "strength", "bulking"]:
        weekly_focus[0]["focus"] = "Upper Body Strength"
        weekly_focus[1]["focus"] = "Lower Body Strength"
        weekly_focus[4]["focus"] = "Full Body Strength"
    elif target_area.lower() in ["endurance", "stamina"]:
        weekly_focus[2]["focus"] = "Endurance Cardio"
        weekly_focus[4]["focus"] = "Circuit Training"
    
    return weekly_focus

def _normalize_text(value: str) -> str:
    return str(value or "").strip().lower()

def _dedupe_workouts(items: List[WorkoutItem]) -> List[WorkoutItem]:
    seen = set()
    out: List[WorkoutItem] = []
    for item in items:
        key = _normalize_text(item.name)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out

def _rotate_by(items: List[WorkoutItem], day_index: int) -> List[WorkoutItem]:
    if not items:
        return items
    shift = day_index % len(items)
    return items[shift:] + items[:shift]

def _fallback_main_pool(level: str) -> List[WorkoutItem]:
    return [
        WorkoutItem(name="Push-ups", body_part="Upper Body", equipment="Body Weight", difficulty=level, reps="3x10", sets="3", duration_minutes=8, calories_burned=60, instructions=["Start in plank position", "Lower body to ground", "Push back up"]),
        WorkoutItem(name="Squats", body_part="Lower Body", equipment="Body Weight", difficulty=level, reps="3x15", sets="3", duration_minutes=8, calories_burned=70, instructions=["Stand with feet shoulder-width", "Lower hips back and down", "Return to starting position"]),
        WorkoutItem(name="Plank", body_part="Core", equipment="Body Weight", difficulty=level, reps="3x30s", sets="3", duration_minutes=6, calories_burned=40, instructions=["Hold forearm plank", "Keep body straight", "Engage core muscles"]),
        WorkoutItem(name="Glute Bridge", body_part="Lower Body", equipment="Body Weight", difficulty=level, reps="3x15", sets="3", duration_minutes=6, calories_burned=45, instructions=["Lie on your back", "Drive hips up", "Pause and lower with control"]),
        WorkoutItem(name="Mountain Climbers", body_part="Cardio", equipment="Body Weight", difficulty=level, reps="3x30s", sets="3", duration_minutes=6, calories_burned=55, instructions=["Start in plank", "Drive knees alternately", "Keep core tight"]),
        WorkoutItem(name="Lunges", body_part="Lower Body", equipment="Body Weight", difficulty=level, reps="3x12 each side", sets="3", duration_minutes=7, calories_burned=58, instructions=["Step forward", "Lower both knees", "Push through front heel"]),
        WorkoutItem(name="Pike Push-up", body_part="Upper Body", equipment="Body Weight", difficulty=level, reps="3x8", sets="3", duration_minutes=6, calories_burned=42, instructions=["Form inverted V", "Lower head toward floor", "Press back up"]),
        WorkoutItem(name="Bicycle Crunch", body_part="Core", equipment="Body Weight", difficulty=level, reps="3x20", sets="3", duration_minutes=5, calories_burned=35, instructions=["Lie on back", "Alternate elbow to opposite knee", "Control each rep"]),
    ]

def _fallback_warmup_pool(level: str) -> List[WorkoutItem]:
    return [
        WorkoutItem(name="Jumping Jacks", body_part="Full Body", equipment="Body Weight", difficulty=level, reps="3x30", sets="3", duration_minutes=5, calories_burned=50, instructions=["Start with feet together", "Jump while spreading legs", "Raise arms overhead"]),
        WorkoutItem(name="Arm Circles", body_part="Upper Body", equipment="Body Weight", difficulty=level, reps="2x20", sets="2", duration_minutes=3, calories_burned=20, instructions=["Extend arms to sides", "Make small circles", "Reverse direction"]),
        WorkoutItem(name="High Knees", body_part="Cardio", equipment="Body Weight", difficulty=level, reps="3x30s", sets="3", duration_minutes=4, calories_burned=38, instructions=["Run in place", "Drive knees high", "Keep chest up"]),
        WorkoutItem(name="Hip Openers", body_part="Lower Body", equipment="Body Weight", difficulty=level, reps="2x12", sets="2", duration_minutes=4, calories_burned=18, instructions=["Stand tall", "Open hip outward", "Alternate sides"]),
    ]

def _fallback_cooldown_pool(level: str) -> List[WorkoutItem]:
    return [
        WorkoutItem(name="Stretching", body_part="Full Body", equipment="Body Weight", difficulty=level, reps="5x30s", sets="5", duration_minutes=5, calories_burned=20, instructions=["Stretch major muscle groups", "Hold each stretch 30 seconds", "Focus on breathing"]),
        WorkoutItem(name="Deep Breathing", body_part="Full Body", equipment="Body Weight", difficulty=level, reps="10x", sets="1", duration_minutes=3, calories_burned=10, instructions=["Sit comfortably", "Inhale deeply", "Exhale slowly"]),
        WorkoutItem(name="Child Pose Hold", body_part="Flexibility", equipment="Yoga Mat", difficulty=level, reps="2x45s", sets="2", duration_minutes=3, calories_burned=8, instructions=["Kneel on mat", "Sit hips back", "Reach arms forward"]),
        WorkoutItem(name="Hamstring Stretch", body_part="Lower Body", equipment="Body Weight", difficulty=level, reps="2x30s each side", sets="2", duration_minutes=3, calories_burned=8, instructions=["Hinge forward gently", "Keep back flat", "Breathe steadily"]),
    ]

def generate_exercises_for_focus(
    focus_area: str,
    level: str,
    target_area: str,
    weight_kg: float,
    day_index: int = 0,
    profile_context: Optional[Dict] = None,
) -> Dict:
    """Generate exercises based on focus area and user profile"""
    
    # Get base exercises from logic
    profile_context = profile_context or {}
    base_exercises = logic.get_exercises(
        level,
        target_count=15,
        target_area=target_area,
        age=profile_context.get("age"),
        weight_kg=profile_context.get("weight_kg"),
        medical_conditions=_split_csv(profile_context.get("health_diseases")),
        injured_body_parts=profile_context.get("injured_body_parts", []),
        adherence_rate_14d=profile_context.get("workout_completion_rate_14d"),
        workout_streak_days=profile_context.get("workout_streak_days"),
    )
    
    # Filter and categorize exercises based on focus area
    warmup_exercises = []
    main_exercises = []
    cooldown_exercises = []
    
    focus_lower = focus_area.lower()
    
    for exercise in base_exercises:
        exercise_item = WorkoutItem(
            name=exercise.get("name", "Unknown Exercise"),
            body_part=exercise.get("body_part", exercise.get("bodypart", "Full Body")),
            equipment=exercise.get("equipment", "Body Weight"),
            difficulty=level,
            reps=exercise.get("repetitions", "3x10"),
            sets=exercise.get("sets", "3"),
            duration_minutes=estimate_exercise_duration(exercise, level),
            calories_burned=estimate_calories_burned(exercise, weight_kg, level),
            instructions=exercise.get("steps", [])
        )
        
        # Categorize exercises
        if "warm" in exercise.get("name", "").lower() or "stretch" in exercise.get("name", "").lower():
            warmup_exercises.append(exercise_item)
        elif "cool" in exercise.get("name", "").lower() or "flexibility" in exercise.get("name", "").lower():
            cooldown_exercises.append(exercise_item)
        else:
            # Assign to main exercises based on focus area
            exercise_body = str(exercise.get("body_part", exercise.get("bodypart", ""))).lower()
            if "upper" in focus_lower and any(part in exercise_body for part in ["chest", "back", "shoulder", "arm"]):
                main_exercises.append(exercise_item)
            elif "lower" in focus_lower and any(part in exercise_body for part in ["leg", "glute", "thigh", "calf"]):
                main_exercises.append(exercise_item)
            elif "cardio" in focus_lower or "hiit" in focus_lower:
                if any(cardio in exercise_body for cardio in ["cardio", "full body"]):
                    main_exercises.append(exercise_item)
            elif "core" in focus_lower and any(core in exercise_body for core in ["core", "abdominal", "abs"]):
                main_exercises.append(exercise_item)
            else:
                # Add to main exercises if it doesn't fit specific categories
                main_exercises.append(exercise_item)
    
    warmup_exercises = _dedupe_workouts(warmup_exercises)
    main_exercises = _dedupe_workouts(main_exercises)
    cooldown_exercises = _dedupe_workouts(cooldown_exercises)

    # Enrich with fallback pools instead of replacing everything, then rotate by day.
    warmup_pool = _fallback_warmup_pool(level)
    cooldown_pool = _fallback_cooldown_pool(level)
    main_pool = _fallback_main_pool(level)

    focus = focus_area.lower()
    if "upper" in focus:
        main_pool = [m for m in main_pool if _normalize_text(m.body_part) in {"upper body", "core", "full body"}]
    elif "lower" in focus:
        main_pool = [m for m in main_pool if _normalize_text(m.body_part) in {"lower body", "core", "full body"}]
    elif "cardio" in focus or "hiit" in focus:
        main_pool = [m for m in main_pool if _normalize_text(m.body_part) in {"cardio", "full body", "core"}]
    elif "core" in focus:
        main_pool = [m for m in main_pool if _normalize_text(m.body_part) in {"core", "cardio", "full body"}]

    if len(warmup_exercises) < 2:
        warmup_exercises.extend([w for w in warmup_pool if _normalize_text(w.name) not in {_normalize_text(x.name) for x in warmup_exercises}])
    if len(main_exercises) < 4:
        main_exercises.extend([m for m in main_pool if _normalize_text(m.name) not in {_normalize_text(x.name) for x in main_exercises}])
    if len(cooldown_exercises) < 2:
        cooldown_exercises.extend([c for c in cooldown_pool if _normalize_text(c.name) not in {_normalize_text(x.name) for x in cooldown_exercises}])

    warmup_exercises = _rotate_by(_dedupe_workouts(warmup_exercises), day_index)
    main_exercises = _rotate_by(_dedupe_workouts(main_exercises), day_index)
    cooldown_exercises = _rotate_by(_dedupe_workouts(cooldown_exercises), day_index)

    return {
        "warmup": warmup_exercises[:2],
        "main": main_exercises[:4],
        "cooldown": cooldown_exercises[:2]
    }

def estimate_exercise_duration(exercise: Dict, level: str) -> int:
    """Estimate exercise duration in minutes based on exercise and level"""
    
    base_duration = 5  # Base duration in minutes
    
    # Adjust based on exercise type
    name_lower = exercise.get("name", "").lower()
    if "cardio" in name_lower or "run" in name_lower or "jump" in name_lower:
        base_duration = 10
    elif "plank" in name_lower or "hold" in name_lower:
        base_duration = 3
    elif "stretch" in name_lower or "yoga" in name_lower:
        base_duration = 5
    
    # Adjust based on level
    if level == "beginner":
        return max(base_duration - 2, 3)
    elif level == "advanced":
        return base_duration + 3
    else:  # intermediate
        return base_duration

def estimate_calories_burned(exercise: Dict, weight_kg: float, level: str) -> int:
    """Estimate calories burned for an exercise"""
    
    # Base calorie burn rate (calories per minute per kg)
    body_part = exercise.get("bodypart", "").lower()
    
    if "cardio" in body_part or "full body" in body_part:
        rate = 0.1
    elif "upper" in body_part or "lower" in body_part:
        rate = 0.08
    else:
        rate = 0.06
    
    # Adjust based on level
    if level == "beginner":
        rate *= 0.8
    elif level == "advanced":
        rate *= 1.2
    
    duration = estimate_exercise_duration(exercise, level)
    return int(rate * weight_kg * duration)

def generate_daily_workout(
    day_index: int,
    focus_data: Dict,
    level: str,
    target_area: str,
    weight_kg: float,
    profile_context: Optional[Dict] = None,
) -> DailyWorkoutPlan:
    """Generate workout plan for a specific day"""
    
    if focus_data["intensity"] == "rest":
        return DailyWorkoutPlan(
            day=focus_data["day"],
            focus_area="Rest Day",
            warmup=[],
            main_exercises=[],
            cooldown=[],
            total_duration=0,
            estimated_calories=0
        )
    
    exercises = generate_exercises_for_focus(
        focus_data["focus"],
        level,
        target_area,
        weight_kg,
        day_index=day_index,
        profile_context=profile_context
    )
    
    # Calculate totals
    total_duration = sum(item.duration_minutes for item in exercises["warmup"] + exercises["main"] + exercises["cooldown"])
    total_calories = sum(item.calories_burned for item in exercises["warmup"] + exercises["main"] + exercises["cooldown"])
    
    return DailyWorkoutPlan(
        day=focus_data["day"],
        focus_area=focus_data["focus"],
        warmup=exercises["warmup"],
        main_exercises=exercises["main"],
        cooldown=exercises["cooldown"],
        total_duration=total_duration,
        estimated_calories=total_calories
    )

def generate_weekly_workout_plan(profile_data: Dict) -> WeeklyWorkoutPlan:
    """Generate a complete weekly workout plan"""
    
    weight_kg = profile_data.get('weight_kg', 70)
    level = profile_data.get('level', 'beginner')
    target_area = profile_data.get('target_area', 'general fitness')
    
    # Get weekly workout variety
    weekly_focus = get_weekly_workout_variety(target_area, level, weight_kg)
    
    # Generate workouts for each day
    workouts = {}
    total_duration = 0
    total_calories = 0
    rest_days = []
    
    for day_index, focus_data in weekly_focus.items():
        daily_workout = generate_daily_workout(day_index, focus_data, level, target_area, weight_kg, profile_context=profile_data)
        workouts[focus_data["day"]] = daily_workout
        
        total_duration += daily_workout.total_duration
        total_calories += daily_workout.estimated_calories
        
        if focus_data["intensity"] == "rest":
            rest_days.append(focus_data["day"])
    
    # Calculate week dates
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    return WeeklyWorkoutPlan(
        week_start=start_of_week.isoformat(),
        week_end=end_of_week.isoformat(),
        workouts=workouts,
        weekly_duration=total_duration,
        weekly_calories=total_calories,
        based_on_weight=weight_kg,
        based_on_target_area=target_area,
        last_updated=datetime.now().isoformat(),
        rest_days=rest_days
    )

@router.get("/weekly-workout-plan")
async def get_weekly_workout_plan(
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get or generate weekly workout plan"""
    try:
        # Get user profile
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Check if plan needs updating
        current_plan = weekly_workout_plans.get(str(user.id))
        should_update = force_refresh or not current_plan
        
        # Check if weight changed significantly
        profile_weight = getattr(profile, "weight_kg", None)
        if current_plan is not None and profile_weight is not None:
            weight_change = abs(float(profile_weight) - float(current_plan.based_on_weight))
            if weight_change >= 2.0:  # 2kg threshold
                should_update = True
        
        if should_update:
            # Generate new plan
            profile_level = infer_level_from_lifestyle(getattr(profile, "lifestyle_level", None))
            latest_report = (
                db.query(Report)
                .filter(Report.user_id == user.id)
                .order_by(Report.created_at.desc())
                .first()
            )
            report_injuries = _extract_report_injuries(getattr(latest_report, "summary", "") if latest_report else "")
            today = date.today()
            start = today - timedelta(days=13)
            workout_logs = (
                db.query(WorkoutDailyLog)
                .filter(WorkoutDailyLog.user_id == user.id, WorkoutDailyLog.log_date >= start.isoformat())
                .all()
            )
            completion_rate_14d = (sum(1 for r in workout_logs if bool(getattr(r, "completed", False))) / 14.0) if workout_logs else 0.0
            recent_lookup = {str(getattr(r, "log_date", "")): bool(getattr(r, "completed", False)) for r in workout_logs}
            streak = 0
            cursor = today
            while recent_lookup.get(cursor.isoformat(), False):
                streak += 1
                cursor = cursor - timedelta(days=1)
            profile_data = {
                "weight_kg": float(profile_weight) if profile_weight is not None else 70,
                "level": profile_level,
                "target_area": getattr(profile, "target_area", None) or "general fitness",
                "age": getattr(profile, "age", None),
                "health_diseases": getattr(profile, "health_diseases", "") or "",
                "injured_body_parts": list(dict.fromkeys(_split_csv(getattr(profile, "health_diseases", "")) + report_injuries)),
                "workout_completion_rate_14d": completion_rate_14d,
                "workout_streak_days": streak,
            }
            
            new_plan = generate_weekly_workout_plan(profile_data)
            weekly_workout_plans[str(user.id)] = new_plan
            
            return {
                "weekly_workout_plan": new_plan,
                "message": "New workout plan generated!",
                "is_fresh": True
            }
        else:
            return {
                "weekly_workout_plan": current_plan,
                "message": "Using existing workout plan",
                "is_fresh": False
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating workout plan: {str(e)}")

@router.get("/daily-workout/{day}")
async def get_daily_workout_plan(
    day: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get workout plan for a specific day"""
    try:
        # Get weekly plan first
        weekly_response = await get_weekly_workout_plan(False, db, user)
        if "weekly_workout_plan" not in weekly_response:
            raise HTTPException(status_code=404, detail="Weekly workout plan not found")
            
        weekly_plan = weekly_response["weekly_workout_plan"]
        
        # Get specific day's workout
        daily_workout = weekly_plan.workouts.get(day)
        if not daily_workout:
            raise HTTPException(status_code=404, detail=f"No workout plan found for {day}")
        
        return {
            "daily_workout": daily_workout,
            "week_context": {
                "week_start": weekly_plan.week_start,
                "week_end": weekly_plan.week_end,
                "based_on_weight": weekly_plan.based_on_weight,
                "target_area": weekly_plan.based_on_target_area
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting daily workout: {str(e)}")

@router.post("/trigger-update")
async def trigger_workout_plan_update(
    reason: str = "Manual refresh requested",
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Manually trigger workout plan update"""
    try:
        weekly_response = await get_weekly_workout_plan(True, db, user)
        return {
            "weekly_workout_plan": weekly_response["weekly_workout_plan"],
            "message": f"Workout plan updated: {reason}",
            "is_fresh": True
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating workout plan: {str(e)}")

# Public endpoints (no auth required)
@router.get("/public/weekly-workout-plan")
async def get_public_weekly_workout_plan(force_refresh: bool = False):
    """Public endpoint for weekly workout plan (no auth required)"""
    try:
        # Demo profile data for public access
        profile_data = {
            "weight_kg": 70,
            "level": "beginner",
            "target_area": "general fitness"
        }
        
        # Check if plan needs updating
        current_plan = weekly_workout_plans.get("demo")
        should_update = force_refresh or not current_plan
        
        if should_update:
            # Generate new plan
            new_plan = generate_weekly_workout_plan(profile_data)
            weekly_workout_plans["demo"] = new_plan
            
            return {
                "weekly_workout_plan": new_plan,
                "message": "New workout plan generated!",
                "is_fresh": True,
                "demo_profile": profile_data
            }
        else:
            return {
                "weekly_workout_plan": current_plan,
                "message": "Using existing workout plan",
                "is_fresh": False,
                "demo_profile": profile_data
            }
            
    except Exception as e:
        return {"error": f"Error generating workout plan: {str(e)}"}
