from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..schemas import ProgressIn, ProgressOut
from ..models import Progress, Profile
from ..logic import compute_bmi, bmi_category
from ..deps import get_db, get_current_user

router = APIRouter()

def _invalidate_weekly_plan_cache(user_id: int) -> None:
    try:
        from .weekly_meal_plan import weekly_plans
        weekly_plans.pop(f"user:{user_id}", None)
        weekly_plans.pop("current", None)
    except Exception:
        pass

@router.post("", response_model=ProgressOut)
def add_progress(payload: ProgressIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    record = Progress(user_id=user.id, month=str(payload.month), weight_kg=float(payload.weight_kg), notes=payload.notes)
    db.add(record)
    db.commit()
    db.refresh(record)
    # Update user's profile weight and BMI so dashboard reflects latest values
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile:
        try:
            profile.weight_kg = float(payload.weight_kg)
            profile.bmi = compute_bmi(float(profile.height_cm), float(payload.weight_kg))
            profile.bmi_category = str(bmi_category(profile.bmi))
            db.add(profile)
            db.commit()
            db.refresh(profile)
        except Exception:
            db.rollback()
    _invalidate_weekly_plan_cache(user.id)

    return ProgressOut(month=str(record.month), weight_kg=float(record.weight_kg), notes=str(record.notes) if record.notes else "")

@router.get("", response_model=List[ProgressOut])
def get_progress(db: Session = Depends(get_db), user=Depends(get_current_user)):
    items = db.query(Progress).filter(Progress.user_id == user.id).order_by(Progress.created_at.desc()).all()
    return [ProgressOut(month=str(i.month), weight_kg=float(i.weight_kg), notes=str(i.notes) if i.notes else "") for i in items]
