"""
Adherence tracking routes for meal completion, extra food logs, and water intake.
DB-backed with in-memory fallback.
"""

from datetime import date, timedelta
import json
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Profile, AdherenceLog, WorkoutDailyLog

router = APIRouter()


class ExtraFoodItem(BaseModel):
    name: str
    calories: float


class DayAdherencePayload(BaseModel):
    date: date
    planned_calories: float = 0
    consumed_planned_calories: float = 0
    completed_items_count: int = 0
    total_items_count: int = 0
    completed_item_ids: List[str] = []
    extra_foods: List[ExtraFoodItem] = []
    water_ml: int = 0
    water_target_ml: int = 2000


class WorkoutDayPayload(BaseModel):
    date: date
    completed: bool = False
    calories_burned: float = 0


# Emergency fallback if DB is unavailable.
adherence_store: Dict[str, DayAdherencePayload] = {}


def _key(user_id: str, target_date: date) -> str:
    return f"{user_id}:{target_date.isoformat()}"


def _default_water_target_ml(profile: Optional[Profile]) -> int:
    if profile and profile.water_consumption_l:
        return int(round(float(profile.water_consumption_l) * 1000))
    return 2000


def _food_progress_percent(item: DayAdherencePayload) -> int:
    extra_cal = sum(max(0, float(x.calories)) for x in item.extra_foods)
    total = max(0.0, float(item.consumed_planned_calories) + extra_cal)
    if item.planned_calories <= 0:
        return 0
    return int(round(min(100.0, (total / float(item.planned_calories)) * 100.0)))


def _water_progress_percent(item: DayAdherencePayload) -> int:
    target = max(1, int(item.water_target_ml or 2000))
    return int(round(min(100.0, (max(0, item.water_ml) / target) * 100.0)))


def _food_goal_met(item: DayAdherencePayload) -> bool:
    return _food_progress_percent(item) >= 90


def _water_goal_met(item: DayAdherencePayload) -> bool:
    return _water_progress_percent(item) >= 100


def _has_food_log(item: DayAdherencePayload) -> bool:
    if item.completed_items_count > 0:
        return True
    if item.consumed_planned_calories > 0:
        return True
    if item.planned_calories > 0:
        return True
    if item.extra_foods:
        return True
    return False


def _has_water_log(item: DayAdherencePayload) -> bool:
    return item.water_ml > 0


def _has_workout_log(completed: bool, calories_burned: float) -> bool:
    return bool(completed) or float(calories_burned or 0) > 0


def _payload_from_row(row: AdherenceLog) -> DayAdherencePayload:
    try:
        completed_ids = json.loads(row.completed_item_ids_json or "[]")
        if not isinstance(completed_ids, list):
            completed_ids = []
    except Exception:
        completed_ids = []
    try:
        extras = json.loads(row.extra_foods_json or "[]")
        if not isinstance(extras, list):
            extras = []
    except Exception:
        extras = []
    extra_foods = []
    for e in extras:
        try:
            name = str(e.get("name", "")).strip()
            calories = float(e.get("calories", 0) or 0)
            if name:
                extra_foods.append(ExtraFoodItem(name=name, calories=calories))
        except Exception:
            continue
    return DayAdherencePayload(
        date=date.fromisoformat(row.log_date),
        planned_calories=float(row.planned_calories or 0),
        consumed_planned_calories=float(row.consumed_planned_calories or 0),
        completed_items_count=int(row.completed_items_count or 0),
        total_items_count=int(row.total_items_count or 0),
        completed_item_ids=[str(x) for x in completed_ids],
        extra_foods=extra_foods,
        water_ml=int(row.water_ml or 0),
        water_target_ml=int(row.water_target_ml or 2000),
    )


def _upsert_row(db: Session, user_id: int, payload: DayAdherencePayload) -> None:
    log_date = payload.date.isoformat()
    row = (
        db.query(AdherenceLog)
        .filter(AdherenceLog.user_id == user_id, AdherenceLog.log_date == log_date)
        .first()
    )
    if not row:
        row = AdherenceLog(user_id=user_id, log_date=log_date)
        db.add(row)

    row.planned_calories = float(payload.planned_calories or 0)
    row.consumed_planned_calories = float(payload.consumed_planned_calories or 0)
    row.completed_items_count = int(payload.completed_items_count or 0)
    row.total_items_count = int(payload.total_items_count or 0)
    row.completed_item_ids_json = json.dumps(payload.completed_item_ids or [])
    row.extra_foods_json = json.dumps([x.model_dump() for x in (payload.extra_foods or [])])
    row.water_ml = int(payload.water_ml or 0)
    row.water_target_ml = int(payload.water_target_ml or 2000)
    db.commit()


def _get_or_default_day(db: Session, user_id: int, target_date: date, default_target: int) -> DayAdherencePayload:
    row = (
        db.query(AdherenceLog)
        .filter(AdherenceLog.user_id == user_id, AdherenceLog.log_date == target_date.isoformat())
        .first()
    )
    if row:
        return _payload_from_row(row)
    return DayAdherencePayload(date=target_date, water_target_ml=default_target)


def _get_or_default_workout_day(db: Session, user_id: int, target_date: date) -> Dict[str, float | bool]:
    _ensure_workout_table(db)
    row = (
        db.query(WorkoutDailyLog)
        .filter(WorkoutDailyLog.user_id == user_id, WorkoutDailyLog.log_date == target_date.isoformat())
        .first()
    )
    if not row:
        return {"completed": False, "calories_burned": 0.0}
    return {
        "completed": bool(row.completed),
        "calories_burned": float(row.calories_burned or 0),
    }


def _ensure_workout_table(db: Session) -> None:
    """Create workout log table lazily if it doesn't exist yet."""
    try:
        WorkoutDailyLog.__table__.create(bind=db.get_bind(), checkfirst=True)
    except Exception:
        # If DB permissions/driver prevent DDL here, fail soft and keep app running.
        pass


@router.get("/day/{target_date}")
async def get_day_adherence(
    target_date: date,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        default_target = _default_water_target_ml(profile)
        item = _get_or_default_day(db, int(user.id), target_date, default_target)
        workout = _get_or_default_workout_day(db, int(user.id), target_date)
        extra_cal = sum(max(0, float(x.calories)) for x in item.extra_foods)
        consumed_total = max(0.0, float(item.consumed_planned_calories) + extra_cal)
        return {
            **item.model_dump(),
            "consumed_total_calories": round(consumed_total, 1),
            "food_progress_percent": _food_progress_percent(item),
            "water_progress_percent": _water_progress_percent(item),
            "food_goal_met": _food_goal_met(item),
            "water_goal_met": _water_goal_met(item),
            "workout_completed": bool(workout["completed"]),
            "workout_calories_burned": round(float(workout["calories_burned"] or 0), 1),
        }
    except Exception as e:
        # Fallback to in-memory if DB path fails unexpectedly.
        try:
            user_id = str(user.id)
            k = _key(user_id, target_date)
            if k not in adherence_store:
                profile = db.query(Profile).filter(Profile.user_id == user_id).first()
                adherence_store[k] = DayAdherencePayload(
                    date=target_date,
                    water_target_ml=_default_water_target_ml(profile),
                )
            item = adherence_store[k]
            extra_cal = sum(max(0, float(x.calories)) for x in item.extra_foods)
            consumed_total = max(0.0, float(item.consumed_planned_calories) + extra_cal)
            return {
                **item.model_dump(),
                "consumed_total_calories": round(consumed_total, 1),
                "food_progress_percent": _food_progress_percent(item),
                "water_progress_percent": _water_progress_percent(item),
                "food_goal_met": _food_goal_met(item),
                "water_goal_met": _water_goal_met(item),
            }
        except Exception:
            raise HTTPException(status_code=500, detail=f"Error fetching day adherence: {str(e)}")


@router.post("/day")
async def upsert_day_adherence(
    payload: DayAdherencePayload,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        _upsert_row(db, int(user.id), payload)
        item = payload
        extra_cal = sum(max(0, float(x.calories)) for x in item.extra_foods)
        consumed_total = max(0.0, float(item.consumed_planned_calories) + extra_cal)
        return {
            "message": "Adherence updated",
            "date": payload.date.isoformat(),
            "consumed_total_calories": round(consumed_total, 1),
            "food_progress_percent": _food_progress_percent(item),
            "water_progress_percent": _water_progress_percent(item),
            "food_goal_met": _food_goal_met(item),
            "water_goal_met": _water_goal_met(item),
        }
    except Exception as e:
        # Fallback write in-memory if DB path fails unexpectedly.
        try:
            user_id = str(user.id)
            k = _key(user_id, payload.date)
            adherence_store[k] = payload
            item = adherence_store[k]
            extra_cal = sum(max(0, float(x.calories)) for x in item.extra_foods)
            consumed_total = max(0.0, float(item.consumed_planned_calories) + extra_cal)
            return {
                "message": "Adherence updated (fallback)",
                "date": payload.date.isoformat(),
                "consumed_total_calories": round(consumed_total, 1),
                "food_progress_percent": _food_progress_percent(item),
                "water_progress_percent": _water_progress_percent(item),
                "food_goal_met": _food_goal_met(item),
                "water_goal_met": _water_goal_met(item),
            }
        except Exception:
            raise HTTPException(status_code=500, detail=f"Error updating day adherence: {str(e)}")


@router.get("/workout/day/{target_date}")
async def get_day_workout_adherence(
    target_date: date,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        data = _get_or_default_workout_day(db, int(user.id), target_date)
        return {
            "date": target_date.isoformat(),
            "workout_completed": bool(data["completed"]),
            "workout_calories_burned": round(float(data["calories_burned"] or 0), 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching workout adherence: {str(e)}")


@router.post("/workout/day")
async def upsert_day_workout_adherence(
    payload: WorkoutDayPayload,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        _ensure_workout_table(db)
        log_date = payload.date.isoformat()
        row = (
            db.query(WorkoutDailyLog)
            .filter(WorkoutDailyLog.user_id == int(user.id), WorkoutDailyLog.log_date == log_date)
            .first()
        )
        if not row:
            row = WorkoutDailyLog(user_id=int(user.id), log_date=log_date)
            db.add(row)
        row.completed = bool(payload.completed)
        row.calories_burned = float(payload.calories_burned or 0)
        db.commit()
        return {
            "message": "Workout adherence updated",
            "date": log_date,
            "workout_completed": bool(row.completed),
            "workout_calories_burned": round(float(row.calories_burned or 0), 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating workout adherence: {str(e)}")


@router.get("/summary")
async def adherence_summary(
    days: int = 30,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_id = int(user.id)
        today = date.today()
        days = min(max(7, int(days)), 60)

        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        default_target = _default_water_target_ml(profile)

        day_lookup: Dict[str, DayAdherencePayload] = {}
        workout_lookup: Dict[str, Dict[str, float | bool]] = {}
        for i in range(days):
            d = today - timedelta(days=i)
            item = _get_or_default_day(db, user_id, d, default_target)
            day_lookup[d.isoformat()] = item
            workout_lookup[d.isoformat()] = _get_or_default_workout_day(db, user_id, d)

        series = []
        for i in range(days):
            d = today - timedelta(days=i)
            item = day_lookup[d.isoformat()]
            workout_item = workout_lookup[d.isoformat()]
            extra_cal = sum(max(0, float(x.calories)) for x in item.extra_foods)
            consumed_total = max(0.0, float(item.consumed_planned_calories) + extra_cal)
            series.append(
                {
                    "date": d.isoformat(),
                    "planned_calories": float(item.planned_calories),
                    "consumed_total_calories": round(consumed_total, 1),
                    "food_progress_percent": _food_progress_percent(item),
                    "water_ml": int(item.water_ml),
                    "water_target_ml": int(item.water_target_ml or default_target),
                    "water_progress_percent": _water_progress_percent(item),
                    "food_goal_met": _food_goal_met(item),
                    "water_goal_met": _water_goal_met(item),
                    "workout_completed": bool(workout_item["completed"]),
                    "workout_calories_burned": round(float(workout_item["calories_burned"] or 0), 1),
                }
            )

        def _streak_from_today(flag: str) -> int:
            count = 0
            for point in series:
                if point.get(flag):
                    count += 1
                else:
                    break
            return count

        def _active_streak(mode: str) -> int:
            cursor = None
            for i in range(days):
                d = today - timedelta(days=i)
                item = day_lookup[d.isoformat()]
                if mode == "food":
                    if _has_food_log(item):
                        cursor = d
                        break
                elif mode == "water":
                    if _has_water_log(item):
                        cursor = d
                        break
                elif mode == "workout":
                    workout = workout_lookup.get(d.isoformat()) or {"completed": False, "calories_burned": 0}
                    if _has_workout_log(bool(workout.get("completed")), float(workout.get("calories_burned") or 0)):
                        cursor = d
                        break
            if cursor is None:
                return 0

            streak = 0
            while True:
                item = day_lookup.get(cursor.isoformat())
                if not item:
                    break
                if mode == "food":
                    if _food_goal_met(item):
                        streak += 1
                    else:
                        break
                else:
                    if mode == "water":
                        if _water_goal_met(item):
                            streak += 1
                        else:
                            break
                    else:
                        workout = workout_lookup.get(cursor.isoformat()) or {"completed": False}
                        if bool(workout.get("completed")):
                            streak += 1
                        else:
                            break
                cursor = cursor - timedelta(days=1)
            return streak

        today_point = series[0]
        latest_logged = None
        latest_food_logged = None
        latest_water_logged = None
        latest_workout_logged = None
        for point in series:
            d = date.fromisoformat(point["date"])
            item = day_lookup.get(d.isoformat())
            if item and (_has_food_log(item) or _has_water_log(item)):
                latest_logged = point
                break
        for point in series:
            d = date.fromisoformat(point["date"])
            item = day_lookup.get(d.isoformat())
            if item and _has_food_log(item):
                latest_food_logged = point
                break
        for point in series:
            d = date.fromisoformat(point["date"])
            item = day_lookup.get(d.isoformat())
            if item and _has_water_log(item):
                latest_water_logged = point
                break
        for point in series:
            d = date.fromisoformat(point["date"])
            workout = workout_lookup.get(d.isoformat()) or {"completed": False, "calories_burned": 0}
            if _has_workout_log(bool(workout.get("completed")), float(workout.get("calories_burned") or 0)):
                latest_workout_logged = point
                break

        return {
            "today": today_point,
            "latest_logged": latest_logged,
            "latest_food_logged": latest_food_logged,
            "latest_water_logged": latest_water_logged,
            "latest_workout_logged": latest_workout_logged,
            "food_streak_days": _streak_from_today("food_goal_met"),
            "water_streak_days": _streak_from_today("water_goal_met"),
            "workout_streak_days": _streak_from_today("workout_completed"),
            "active_food_streak_days": _active_streak("food"),
            "active_water_streak_days": _active_streak("water"),
            "active_workout_streak_days": _active_streak("workout"),
            "last_7_days": list(reversed(series[:7])),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building adherence summary: {str(e)}")
