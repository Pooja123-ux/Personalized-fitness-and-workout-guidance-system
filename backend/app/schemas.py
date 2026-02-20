from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any

# ---------------- AUTH ----------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------- PROFILE (ML INPUT FEATURES) ----------------

class ProfileIn(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None

    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None

    lifestyle_level: Optional[str] = None
    diet_type: Optional[str] = None

    water_consumption_l: Optional[float] = None

    # new: target area the user wants to focus on (e.g., 'upper body', 'core')
    target_area: Optional[str] = None

    junk_food_consumption: Optional[str] = None
    healthy_food_consumption: Optional[str] = None

    breakfast: Optional[str] = None
    lunch: Optional[str] = None
    snacks: Optional[str] = None
    dinner: Optional[str] = None

    motive: Optional[str] = None
    duration_weeks: Optional[int] = None

    food_allergies: Optional[str] = None
    health_diseases: Optional[str] = None


class ProfileOut(ProfileIn):
    bmi: float
    bmi_category: str

    class Config:
        orm_mode = True


# ---------------- ML DIET ITEM STRUCTURE ----------------

class DietItem(BaseModel):
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    meal_type: str
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None
    meal_target_calories: Optional[float] = None
    serving_g: Optional[float] = None
    salad_component: Optional[str] = None
    rice_portion: Optional[str] = None
    pro_tip: Optional[str] = None


# ---------------- RECOMMENDATION OUTPUT ----------------

class PlanTotals(BaseModel):
    daily_calories: float
    daily_protein_g: float
    daily_carbs_g: Optional[float] = None
    daily_fat_g: Optional[float] = None
    protein_met: bool

class AlternativeMealPlan(BaseModel):
    plan_meals: List[DietItem]
    daily_calories: float
    daily_protein_g: float
    daily_carbs_g: Optional[float] = None
    daily_fat_g: Optional[float] = None
    protein_met: bool

class Recommendation(BaseModel):
    workouts: List[Dict[str, Any]]
    yoga: List[Dict[str, Any]]
    diet: List[DietItem]
    diet_totals: Optional[PlanTotals] = None
    alternative_meal_plans: Optional[List[AlternativeMealPlan]] = None
    water_l: float
    daily_calories: Optional[float] = None
    daily_protein_g: Optional[float] = None
    diet_alternatives: Optional[Dict[str, List[Dict[str, Any]]]] = None
    diet_recommendation_text: Optional[str] = None
    test_output: Optional[str] = None


# ---------------- PROGRESS ----------------

class ProgressIn(BaseModel):
    month: str
    weight_kg: float
    notes: Optional[str] = None


class ProgressOut(ProgressIn):
    class Config:
        orm_mode = True
