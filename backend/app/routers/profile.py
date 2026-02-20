from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import shutil
import os
import json

from ..schemas import ProfileIn, ProfileOut, Recommendation
from ..models import Profile, Report
from ..deps import get_db, get_current_user
from ..logic import (
    compute_bmi,
    bmi_category,
    generate_recommendations,
    analyze_medical_pdf,
)

router = APIRouter()


# =========================================================
# CREATE OR UPDATE PROFILE
# =========================================================
@router.post("", response_model=ProfileOut)
def create_or_update_profile(
    payload: ProfileIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    bmi = compute_bmi(payload.height_cm, payload.weight_kg)
    category = bmi_category(bmi)

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    if profile:
        for k, v in payload.model_dump().items():
            setattr(profile, k, v)
        profile.bmi = bmi
        profile.bmi_category = category
    else:
        profile = Profile(
            user_id=user.id,
            bmi=bmi,
            bmi_category=category,
            **payload.model_dump(),
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)

    return ProfileOut(**profile.__dict__)


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

    return ProfileOut(**profile.__dict__)


# =========================================================
# UPLOAD MEDICAL REPORT (PDF)
# =========================================================
@router.post("/upload-report", response_model=dict)
def upload_medical_report(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
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

    # Fetch or auto-create profile
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not initialized")

    rec = generate_recommendations(
        bmi=profile.bmi,
        motive=profile.motive,
        diet_type=profile.diet_type,
        lifestyle_level=profile.lifestyle_level,
        health_diseases=profile.health_diseases,
    )

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

        rec = generate_recommendations(
            bmi=profile.bmi,
            motive=profile.motive,
            diet_type=profile.diet_type,
            lifestyle_level=profile.lifestyle_level,
            health_diseases=profile.health_diseases,
        )

        water_l = round(max(1.8, profile.weight_kg * 0.033), 2)

        return Recommendation(
            workouts=rec.get("workouts", []),
            yoga=rec.get("yoga", []),
            diet=rec.get("diet", []),
            water_l=water_l,
        )
    except Exception as e:
        # If database operations fail, return default recommendations
        rec = generate_recommendations(
            bmi=22,
            motive="remain fit and healthy",
            diet_type="vegetarian",
            lifestyle_level="sedentary",
            health_diseases="",
        )

        return Recommendation(
            workouts=rec.get("workouts", []),
            yoga=rec.get("yoga", []),
            diet=rec.get("diet", []),
            water_l=2.0,
        )
