from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.database import Base, engine
from app import models  # noqa: F401 ensures model metadata is registered
from app.routers import auth, profile, progress, reports, recommendations, images, chat, exercises, conversational_chat, nutrition, public_nutrition, weekly_meal_plan, public_weekly_meal_plan, weekly_workout_plan, adherence

app = FastAPI(title="Personalized Fitness API")

@app.on_event("startup")
def _create_tables():
    Base.metadata.create_all(bind=engine)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(profile.router, prefix="/profile")
app.include_router(progress.router, prefix="/progress")
app.include_router(reports.router, prefix="/reports")
app.include_router(recommendations.router, prefix="/recommendations")
app.include_router(images.router, prefix="/images")
app.include_router(chat.router, prefix="/chat")
app.include_router(exercises.router, prefix="/exercises")
app.include_router(conversational_chat.router, prefix="/conversational")
app.include_router(nutrition.router, prefix="/nutrition")
app.include_router(public_nutrition.router, prefix="/public-nutrition")
app.include_router(weekly_meal_plan.router, prefix="/meal-plan")
app.include_router(public_weekly_meal_plan.router, prefix="/public-meal-plan")
app.include_router(weekly_workout_plan.router, prefix="/workout-plan")
app.include_router(adherence.router, prefix="/adherence")

# Serve local exercise GIF assets from backend/app/gifs
GIF_DIR = Path(__file__).resolve().parent / "gifs"
if GIF_DIR.exists():
    app.mount("/gifs", StaticFiles(directory=str(GIF_DIR)), name="gifs")

# Root
@app.get("/")
def root():
    return {"message": "Welcome to the Personalized Fitness API"}
