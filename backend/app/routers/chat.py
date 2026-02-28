from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Dict, List, Optional
from ..deps import get_current_user
from ..deps import get_db
from ..logic import kcal_per_100g, healthy_alternatives, answer_from_datasets
from .. import logic
from ..chatbot_logic import answer_fitness_question
from ..models import Profile
from sqlalchemy.orm import Session
import re
import sys
import os

# Import conversational chatbot
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from conversational_chatbot import process_conversational_message

router = APIRouter()

class ChatIn(BaseModel):
    message: str

class ComprehensiveChatIn(BaseModel):
    question: str
    context: Optional[str] = None

# Optional: define a small sample food kcal mapping if needed
FOOD_KCAL_100G = {
    "apple": 52,
    "banana": 89,
    "oats": 389,
    "salmon": 208,
    "spinach": 23,
    "white bread": 265,
    "fried food": 312
}

def simple_health_ai(message: str) -> str:
    msg = message.lower()
    if re.search(r'\b(symptom|symptoms|pain|ache)\b', msg):
        return "Please consult a doctor for symptoms. Common advice: rest, hydrate, and monitor."
    if re.search(r'\b(diabetes|blood sugar)\b', msg):
        return "For diabetes, maintain balanced diet, exercise regularly, monitor blood sugar. Consult endocrinologist."
    if re.search(r'\b(weight loss|diet)\b', msg):
        return "For weight loss, focus on calorie deficit, high protein, veggies. Combine with cardio."
    if re.search(r'\b(muscle|build muscle|strength)\b', msg):
        return "To build muscle, lift weights 3-4x/week, high protein intake, progressive overload."
    if re.search(r'\b(yoga|meditation)\b', msg):
        return "Yoga improves flexibility and stress. Try sun salutation for beginners."
    # Remove the general calories keyword to let comprehensive chatbot handle it
    if re.search(r'\b(water|intake)\b', msg):
        return "Drink at least 2-3 liters/day. More if active or hot weather."
    return "I'm a basic health AI. For personalized advice, consult a healthcare professional."

def _food_from_text(text: str) -> Optional[str]:
    t = (text or "").lower()
    for k in FOOD_KCAL_100G.keys():
        if k in t:
            return k
    return None

def _match_food_from_dataset(text: str) -> Optional[str]:
    t = (text or "").lower()
    try:
        foods = logic.df_food["food"].astype(str).str.lower().unique().tolist()
    except Exception:
        foods = []
    candidates = [f for f in foods if f in t]
    if candidates:
        candidates.sort(key=len, reverse=True)
        return candidates[0]
    tokens = [tok for tok in t.split() if len(tok) > 2]
    if tokens and foods:
        for f in foods:
            if any(tok in f for tok in tokens):
                return f
    return None

def _extract_float(pattern: str, text: str) -> Optional[float]:
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None

def _extract_int(pattern: str, text: str) -> Optional[int]:
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None

def _parse_lifestyle(text: str) -> Optional[str]:
    t = text.lower()
    if any(k in t for k in ["very active", "highly active"]):
        return "very active"
    if any(k in t for k in ["lightly active", "light activity", "light"]):
        return "lightly active"
    if any(k in t for k in ["moderate", "active"]):
        return "moderate"
    if any(k in t for k in ["sedentary", "low activity", "low"]):
        return "sedentary"
    return None

def _parse_motive(text: str) -> Optional[str]:
    t = text.lower()
    if any(k in t for k in ["weight loss", "fat loss", "lose", "loss", "cut"]):
        return "weight loss"
    if any(k in t for k in ["muscle gain", "gain", "bulk", "build muscle", "build"]):
        return "muscle gain"
    if "fitness" in t or "maintain" in t or "maintenance" in t:
        return "fitness"
    return None

def _parse_gender(text: str) -> Optional[str]:
    t = text.lower()
    if re.search(r"\bmale\b|\bman\b|\bm\b", t):
        return "male"
    if re.search(r"\bfemale\b|\bwoman\b|\bf\b", t):
        return "female"
    return None

def _activity_multiplier(lifestyle: str) -> float:
    lvl = (lifestyle or "").lower()
    if lvl in ["sedentary", "low"]:
        return 1.2
    if lvl in ["lightly active", "moderate", "active"]:
        return 1.45
    if lvl in ["very active", "highly active"]:
        return 1.6
    return 1.45

def _protein_factor(motive: str, lifestyle: str, age: Optional[int]) -> float:
    m = (motive or "").lower()
    l = (lifestyle or "").lower()
    if "loss" in m or "lose" in m or "fat" in m:
        factor = 2.0
    elif "gain" in m or "build" in m or "muscle" in m:
        factor = 1.8
    elif l in ["very active", "highly active"]:
        factor = 1.9
    elif l in ["moderate", "active"]:
        factor = 1.35
    elif l in ["lightly active", "light"]:
        factor = 1.1
    else:
        factor = 0.8
    if age and age >= 60:
        factor = max(factor, 1.0)
    return factor

def _project_logic_answer(message: str, profile: Optional[Profile] = None) -> Optional[str]:
    q = (message or "").strip()
    if not q:
        return None
    ql = q.lower()

    wants_supported = any(
        k in ql for k in ["all logic", "all formulas", "all formula", "project logic", "supported logic", "what logic"]
    )

    asks_bmi = "bmi" in ql
    asks_cal = any(k in ql for k in ["calorie", "calories", "kcal", "tdee", "maintenance"])
    asks_protein = "protein" in ql
    asks_water_target = any(
        k in ql
        for k in [
            "water target",
            "water goal",
            "daily water",
            "how much water",
            "water to consume",
            "consume water",
            "water per day",
        ]
    )
    asks_food_progress = any(k in ql for k in ["food progress", "food adherence", "consumed vs planned"])
    asks_water_progress = any(k in ql for k in ["water progress", "water adherence", "water completion"])
    asks_consistency = any(k in ql for k in ["consistency score", "consistency"])
    asks_meal_split = any(k in ql for k in ["meal split", "meal target", "breakfast lunch snacks dinner"])
    asks_workout_day_cal = any(k in ql for k in ["workout calories", "calories burned workout", "estimated workout calories"])
    asks_formula = any(k in ql for k in ["formula", "logic", "calculate", "how", "compute"])

    if wants_supported:
        return (
            "Project logic I can explain with formula + result when inputs are available:\n"
            "1) BMI and BMI category\n"
            "2) Daily calorie target (Harris-Benedict + activity + goal adjustment)\n"
            "3) Daily protein target (weight x protein factor)\n"
            "4) Water target (profile liters x 1000, else 2000ml default)\n"
            "5) Food progress % = consumed_total / planned x 100\n"
            "6) Water progress % = water_ml / water_target_ml x 100\n"
            "7) Consistency score = ((food_streak + water_streak + workout_streak) / 21) x 100\n"
            "8) Meal calorie split (breakfast/lunch/snacks/dinner) from daily target\n"
            "9) Workout day calories = estimated_calories OR sum(warmup + main + cooldown)\n"
            "Share your inputs in one line and I will calculate all requested values."
        )

    if not (
        asks_bmi
        or asks_cal
        or asks_protein
        or asks_water_target
        or asks_food_progress
        or asks_water_progress
        or asks_consistency
        or asks_meal_split
        or asks_workout_day_cal
    ):
        return None

    weight = _extract_float(r"(\d+(?:\.\d+)?)\s*kg\b", q) or (float(profile.weight_kg) if profile and profile.weight_kg else None)
    height = _extract_float(r"(\d+(?:\.\d+)?)\s*cm\b", q) or (float(profile.height_cm) if profile and profile.height_cm else None)
    age = _extract_int(r"(\d{1,3})\s*(?:years?|yrs?|y/o|yo)\b", q) or (int(profile.age) if profile and profile.age else None)
    gender = _parse_gender(q) or (str(profile.gender).lower() if profile and profile.gender else None)
    lifestyle = _parse_lifestyle(q) or (str(profile.lifestyle_level).lower() if profile and profile.lifestyle_level else "sedentary")
    motive = _parse_motive(q) or (str(profile.motive).lower() if profile and profile.motive else "fitness")
    daily_cal_input = _extract_float(r"(?:daily\s*calories?|target\s*calories?)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)
    planned_cal = _extract_float(r"(?:planned(?:_|\s*)calories?)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)
    consumed_cal = _extract_float(r"(?:consumed(?:_|\s*)(?:total(?:_|\s*))?calories?)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)
    water_ml = _extract_int(r"(?:water(?:_|\s*)ml)\s*[:=]?\s*(\d+)", q) or _extract_int(r"(\d+)\s*ml\b", q)
    water_target_ml = _extract_int(r"(?:water(?:_|\s*)target(?:_|\s*)ml|target(?:_|\s*)water(?:_|\s*)ml)\s*[:=]?\s*(\d+)", q)
    food_streak = _extract_int(r"(?:food(?:_|\s*)streak(?:_|\s*)days?)\s*[:=]?\s*(\d+)", q)
    water_streak = _extract_int(r"(?:water(?:_|\s*)streak(?:_|\s*)days?)\s*[:=]?\s*(\d+)", q)
    workout_streak = _extract_int(r"(?:workout(?:_|\s*)streak(?:_|\s*)days?)\s*[:=]?\s*(\d+)", q)
    estimated_workout_cal = _extract_float(r"(?:estimated(?:_|\s*)calories?)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)
    warm_cal = _extract_float(r"(?:warmup|warm_up)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)
    main_cal = _extract_float(r"(?:main(?:_|\s*)exercises?|main)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)
    cool_cal = _extract_float(r"(?:cooldown|cool_down)\s*[:=]?\s*(\d+(?:\.\d+)?)", q)

    lines: List[str] = []

    if asks_bmi:
        lines.append("BMI logic: BMI = weight(kg) / (height(m)^2).")
        if weight and height and height > 0:
            bmi = logic.compute_bmi(height, weight)
            cat = logic.bmi_category(bmi)
            lines.append(f"Using weight {weight:.1f} kg and height {height:.1f} cm -> BMI {bmi:.2f} ({cat}).")
        else:
            lines.append("Provide `weight in kg` and `height in cm` to calculate your BMI.")

    if asks_cal:
        lines.append("Calories logic (daily target): Harris-Benedict BMR -> activity multiplier -> goal adjustment.")
        lines.append("Adjustments: weight loss -500 kcal, muscle gain +300 kcal; clamped between 1200 and 4000.")
        if weight and height and height > 0:
            daily = logic.daily_calorie_target(
                weight_kg=weight,
                height_cm=height,
                lifestyle=lifestyle,
                motive=motive,
                age=age,
                gender=gender,
            )
            mult = _activity_multiplier(lifestyle)
            if age and gender:
                lines.append(f"Using age {age}, gender {gender}, lifestyle {lifestyle} (x{mult}), motive {motive} -> {daily:.0f} kcal/day.")
            else:
                lines.append(f"Using weight-based fallback maintenance + lifestyle {lifestyle} (x{mult}), motive {motive} -> {daily:.0f} kcal/day.")
        else:
            lines.append("Provide at least `weight (kg)` and `height (cm)` to calculate your daily calorie target.")

    if asks_protein:
        lines.append("Protein logic: protein(g/day) = weight(kg) x protein_factor.")
        if weight:
            factor = _protein_factor(motive, lifestyle, age)
            protein = logic.daily_protein_target(weight_kg=weight, motive=motive, lifestyle=lifestyle, age=age)
            lines.append(f"Using lifestyle {lifestyle}, motive {motive}, factor {factor:.2f} -> {protein:.1f} g/day (bounded 50-200g).")
        else:
            lines.append("Provide `weight in kg` to calculate your protein target.")

    if asks_water_target:
        lines.append("Water target logic: water_target_ml = round(profile.water_consumption_l x 1000), default 2000.")
        if water_target_ml is None:
            if profile and profile.water_consumption_l:
                water_target_ml = int(round(float(profile.water_consumption_l) * 1000))
            else:
                water_target_ml = 2000
        lines.append(f"Water target result -> {int(water_target_ml)} ml/day.")

    if asks_food_progress:
        lines.append("Food progress logic: food_progress_percent = min(100, (consumed_total_calories / planned_calories) x 100).")
        if planned_cal is not None and planned_cal > 0 and consumed_cal is not None:
            food_pct = int(round(min(100.0, (float(consumed_cal) / float(planned_cal)) * 100.0)))
            lines.append(f"Using planned {planned_cal:.1f} and consumed {consumed_cal:.1f} -> {food_pct}%.")
        else:
            lines.append("Provide `planned_calories` and `consumed_total_calories` to calculate.")

    if asks_water_progress:
        lines.append("Water progress logic: water_progress_percent = min(100, (water_ml / water_target_ml) x 100).")
        if water_target_ml is None:
            water_target_ml = int(round(float(profile.water_consumption_l) * 1000)) if profile and profile.water_consumption_l else 2000
        if water_ml is not None and water_target_ml and int(water_target_ml) > 0:
            water_pct = int(round(min(100.0, (max(0, int(water_ml)) / max(1, int(water_target_ml))) * 100.0)))
            lines.append(f"Using water_ml {int(water_ml)} and target {int(water_target_ml)} -> {water_pct}%.")
        else:
            lines.append("Provide `water_ml` (and optionally `water_target_ml`) to calculate.")

    if asks_consistency:
        lines.append("Consistency logic: consistency_score = clamp(0..100, round(((food_streak + water_streak + workout_streak) / 21) x 100)).")
        if food_streak is not None and water_streak is not None and workout_streak is not None:
            consistency = max(0, min(100, round(((food_streak + water_streak + workout_streak) / 21) * 100)))
            lines.append(
                f"Using food {food_streak}, water {water_streak}, workout {workout_streak} -> {consistency}%."
            )
        else:
            lines.append("Provide `food_streak_days`, `water_streak_days`, `workout_streak_days` to calculate.")

    if asks_meal_split:
        lines.append("Meal split logic (core recommender): breakfast 25%, lunch 35%, snacks 15%, dinner 25% of daily calories.")
        daily_for_split = daily_cal_input
        if daily_for_split is None and weight and height and height > 0:
            daily_for_split = logic.daily_calorie_target(
                weight_kg=weight,
                height_cm=height,
                lifestyle=lifestyle,
                motive=motive,
                age=age,
                gender=gender,
            )
        if daily_for_split is not None:
            b = round(daily_for_split * 0.25, 1)
            l = round(daily_for_split * 0.35, 1)
            s = round(daily_for_split * 0.15, 1)
            d = round(daily_for_split * 0.25, 1)
            lines.append(
                f"Using daily calories {daily_for_split:.1f} -> breakfast {b}, lunch {l}, snacks {s}, dinner {d} kcal."
            )
        else:
            lines.append("Provide `daily_calories` (or weight/height/profile) to calculate meal split.")

    if asks_workout_day_cal:
        lines.append("Workout-day calories logic: use estimated_calories if > 0, else sum of warmup + main + cooldown calories.")
        if estimated_workout_cal is not None and estimated_workout_cal > 0:
            lines.append(f"Using estimated_calories {estimated_workout_cal:.1f} -> workout calories {estimated_workout_cal:.1f} kcal.")
        else:
            blocks: Dict[str, float] = {}
            if warm_cal is not None:
                blocks["warmup"] = float(warm_cal)
            if main_cal is not None:
                blocks["main"] = float(main_cal)
            if cool_cal is not None:
                blocks["cooldown"] = float(cool_cal)
            if blocks:
                total_block = round(sum(blocks.values()), 1)
                parts = ", ".join([f"{k}={v:.1f}" for k, v in blocks.items()])
                lines.append(f"Using {parts} -> workout calories {total_block:.1f} kcal.")
            else:
                lines.append("Provide `estimated_calories` or block values like `warmup=.. main=.. cooldown=..`.")

    if asks_formula or profile is not None:
        return "\n".join(lines)
    return "\n".join(lines) if len(lines) > 0 else None

@router.post("/ask")
async def ask(
    message: str = Form(""),
    images: Optional[List[UploadFile]] = None,
    audio: Optional[UploadFile] = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if images:
        for img in images:
            name = (img.filename or "").lower()
            food = _food_from_text(name)
            if food:
                kcal100 = kcal_per_100g(food)
                alts = healthy_alternatives(food)
                alt_txt = f"Healthy alternatives: {', '.join(alts)}." if alts else ""
                return {
                    "answer": f"Detected food: {food}. It is ~{kcal100} kcal per 100g. {alt_txt} How many grams did you consume?"
                }
    if audio:
        return {"answer": "Received audio. Speech-to-text is not enabled. Please type your question for now."}
    if message:
        profile = db.query(Profile).filter(Profile.user_id == int(user.id)).first()
        logic_answer = _project_logic_answer(message, profile=profile)
        if logic_answer:
            return {"answer": logic_answer}

        resp = answer_from_datasets(message)
        if resp.get("answer"):
            pass
        food = _food_from_text(message) or _match_food_from_dataset(message)
        qty_match = re.search(r'(\d{1,4})\s*(g|gram|grams|ml)', message.lower())
        if food:
            kcal100 = kcal_per_100g(food)
            if qty_match:
                grams = int(qty_match.group(1))
                total = round(kcal100 * grams / 100)
                prot_per100 = 0.0
                carbs_per100 = 0.0
                fat_per100 = 0.0
                try:
                    row = logic.df_food[logic.df_food["food"].str.lower() == food.lower()].iloc[0]
                    prot_per100 = float(row.get("protein", 0) or 0)
                    carbs_per100 = float(row.get("carbs", 0) or 0)
                    fat_per100 = float(row.get("fat", 0) or 0)
                except Exception:
                    pass
                prot_serv = round(prot_per100 * grams / 100, 2)
                carbs_serv = round(carbs_per100 * grams / 100, 2)
                fat_serv = round(fat_per100 * grams / 100, 2)
                alts = healthy_alternatives(food)
                alt_txt = f" Consider: {', '.join(alts)}." if alts else ""
                return {
                    "answer": f"{grams}g of {food} is ~{total} kcal.{alt_txt}",
                    "food_name": food,
                    "kcal_per_100g": float(kcal100),
                    "grams": grams,
                    "kcal_total": float(total),
                    "protein_g": prot_serv,
                    "carbs_g": carbs_serv,
                    "fat_g": fat_serv,
                }
            else:
                alts = healthy_alternatives(food)
                alt_txt = f"Healthy alternatives: {', '.join(alts)}." if alts else ""
                return {
                    "answer": f"{food} is ~{kcal100} kcal per 100g. {alt_txt} Tell me quantity (in grams) to estimate calories.",
                    "food_name": food,
                    "kcal_per_100g": float(kcal100),
                }
        if resp.get("answer"):
            return resp
        
        # Try comprehensive chatbot as fallback
        try:
            comprehensive_answer = answer_fitness_question(message)
            if comprehensive_answer and "I couldn't find" not in comprehensive_answer and "I'm not sure" not in comprehensive_answer and "I'm a basic health AI" not in comprehensive_answer:
                return {"answer": comprehensive_answer}
        except Exception:
            pass
        
        # Only use simple_health_ai if comprehensive chatbot fails
        return {"answer": simple_health_ai(message)}
    return {"answer": "Ask a health question or upload an image/audio for analysis."}

@router.post("/comprehensive-ask")
async def comprehensive_ask(
    request: ComprehensiveChatIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Comprehensive chatbot endpoint that can answer questions from all fitness datasets:
    - Exercises database (workouts, muscles, equipment)
    - Indian Food Nutrition (calories, macros, vitamins)
    - Diet Recommendations (personalized diet plans)
    - Disease-Food Nutrition (condition-specific food advice)
    - Yoga Poses (asanas, benefits, instructions)
    """
    try:
        question = request.question.strip()
        
        if not question:
            return {
                "answer": "Please ask a question about fitness, nutrition, exercises, yoga, or diet.",
                "category": "error",
                "confidence": 0
            }

        profile = db.query(Profile).filter(Profile.user_id == int(user.id)).first()
        logic_answer = _project_logic_answer(question, profile=profile)
        if logic_answer:
            return {
                "answer": logic_answer,
                "category": "logic",
                "question": question,
                "confidence": 0.95,
                "sources": [
                    "backend/app/logic.py",
                    "backend/app/routers/adherence.py",
                    "frontend/src/pages/Dashboard.tsx"
                ]
            }
        
        # Get answer from comprehensive chatbot
        answer = answer_fitness_question(question)
        
        # Determine category based on question content
        question_lower = question.lower()
        category = "general"
        
        if any(keyword in question_lower for keyword in ['exercise', 'workout', 'muscle', 'strength', 'training', 'fitness']):
            category = "exercises"
        elif any(keyword in question_lower for keyword in ['yoga', 'pose', 'asana', 'meditation']):
            category = "yoga"
        elif any(keyword in question_lower for keyword in ['calories', 'protein', 'nutrition', 'food', 'eat']):
            category = "nutrition"
        elif any(keyword in question_lower for keyword in ['diet', 'weight loss', 'weight gain']):
            category = "diet"
        elif any(keyword in question_lower for keyword in ['disease', 'diabetes', 'health condition']):
            category = "health"
        
        return {
            "answer": answer,
            "category": category,
            "question": question,
            "confidence": 0.85,  # High confidence for dataset-based answers
            "sources": [
                "Exercises Database",
                "Indian Food Nutrition Dataset", 
                "Diet Recommendations Dataset",
                "Disease-Food Nutrition Dataset",
                "Yoga Poses Dataset"
            ]
        }
        
    except Exception as e:
        return {
            "answer": f"Sorry, I encountered an error while processing your question: {str(e)}. Please try again.",
            "category": "error",
            "confidence": 0,
            "error": str(e)
        }

@router.get("/chatbot-capabilities")
async def get_chatbot_capabilities(user=Depends(get_current_user)):
    """
    Get information about what the comprehensive chatbot can do
    """
    return {
        "capabilities": {
            "exercises": {
                "description": "Information about exercises, workouts, muscle groups, and equipment",
                "examples": [
                    "Tell me about squats",
                    "What exercises work the chest?",
                    "Show me body weight exercises",
                    "What equipment do I need for deadlifts?"
                ]
            },
            "nutrition": {
                "description": "Nutritional information for Indian foods and general nutrition advice",
                "examples": [
                    "How many calories are in chai?",
                    "What are high protein Indian foods?",
                    "Tell me about the nutrition in dal",
                    "What foods are high in fiber?"
                ]
            },
            "diet_recommendations": {
                "description": "Personalized diet recommendations based on age, weight, goals, and health conditions",
                "examples": [
                    "Give me a diet plan for weight loss",
                    "What should a 25-year-old male eat for muscle gain?",
                    "Diet plan for diabetes",
                    "Vegetarian diet for maintaining weight"
                ]
            },
            "health_conditions": {
                "description": "Food recommendations for specific health conditions and diseases",
                "examples": [
                    "What foods should I eat for diabetes?",
                    "Foods to avoid with hypertension",
                    "Nutrition for heart health",
                    "Diet for anemic patients"
                ]
            },
            "yoga": {
                "description": "Yoga poses, benefits, instructions, and difficulty levels",
                "examples": [
                    "Tell me about downward dog pose",
                    "What are some beginner yoga poses?",
                    "Benefits of warrior pose",
                    "How to do tree pose correctly?"
                ]
            }
        },
        "total_datasets": 5,
        "total_records": {
            "exercises": 1326,
            "indian_food": 1016,
            "diet_recommendations": 12,
            "disease_food": 502,
            "yoga_poses": 64
        }
    }

@router.post("/public-ask")
async def public_ask(request: ComprehensiveChatIn):
    """
    Public chatbot endpoint without authentication - NOW CONVERSATIONAL!
    Uses ChatGPT-like conversational logic instead of raw data.
    """
    try:
        question = request.question.strip()
        
        if not question:
            return {
                "answer": "Hello! I'm your fitness assistant. How can I help you today?",
                "category": "greeting",
                "confidence": 0.9
            }
        
        # Check for greetings - only match standalone greetings
        question_lower = question.lower().strip()
        greetings = ['hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings']
        # Only treat as greeting if it's a short standalone greeting (not part of a longer question)
        is_greeting = any(question_lower == greeting or question_lower.startswith(greeting + ' ') for greeting in greetings) and len(question.split()) <= 3
        
        if is_greeting:
            return {
                "answer": "Hi there! Ready to talk about fitness and nutrition. What's on your mind?",
                "category": "greeting",
                "confidence": 0.95
            }
        
        # Check for goodbyes
        goodbyes = ['bye', 'goodbye', 'see you', 'exit', 'quit', 'thanks', 'thank you']
        if any(goodbye in question_lower for goodbye in goodbyes):
            return {
                "answer": "Take care! Stay healthy and fit!",
                "category": "farewell",
                "confidence": 0.95
            }
        
        # Use comprehensive chatbot for all questions
        answer = answer_fitness_question(question)
        
        # Determine category
        category = "general"
        if any(keyword in question_lower for keyword in ['exercise', 'workout', 'muscle', 'strength', 'training', 'fitness']):
            category = "exercises"
        elif any(keyword in question_lower for keyword in ['yoga', 'pose', 'asana', 'meditation']):
            category = "yoga"
        elif any(keyword in question_lower for keyword in ['calories', 'protein', 'nutrition', 'food', 'eat', 'bmi', 'water']):
            category = "nutrition"
        elif any(keyword in question_lower for keyword in ['diet', 'weight loss', 'weight gain']):
            category = "diet"
        elif any(keyword in question_lower for keyword in ['disease', 'diabetes', 'health condition']):
            category = "health"
        
        return {
            "answer": answer,
            "category": category,
            "question": question,
            "confidence": 0.9,
            "sources": [
                "Exercises Database",
                "Indian Food Nutrition Dataset", 
                "Diet Recommendations Dataset",
                "Disease-Food Nutrition Dataset",
                "Yoga Poses Dataset"
            ]
        }
    except Exception as e:
        return {
            "answer": f"I'm having trouble processing that. Could you try rephrasing your question about fitness, nutrition, or exercises?",
            "category": "error",
            "confidence": 0,
            "error": str(e)
        }
