"""
Enhanced Weekly Meal Plan System
Dynamically updates recommendations based on weight changes and health reports
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ..models import Profile, Report
from .. import logic
import json
import re

router = APIRouter()

# Pydantic models for meal planning
class MealItem(BaseModel):
    name: str
    calories: int
    protein: float
    carbs: float
    fats: float
    fiber: float = 0.0
    preparation_time: int  # minutes
    difficulty: str  # easy, medium, hard

class DailyMealPlan(BaseModel):
    day: str
    breakfast: List[MealItem]
    lunch: List[MealItem]
    snacks: List[MealItem]
    dinner: List[MealItem]
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fats: float

class WeeklyMealPlan(BaseModel):
    week_start: date
    week_end: date
    meals: Dict[str, DailyMealPlan]  # Monday to Sunday
    weekly_calories: int
    weekly_protein: float
    weekly_carbs: float
    weekly_fats: float
    based_on_weight: float
    based_on_health_report: Optional[str] = None
    last_updated: datetime
    personalized_items: int = 0  # Number of personalized recommendation items used

class HealthTrigger(BaseModel):
    weight_change_threshold: float = 1.0  # kg
    new_health_condition: bool = True
    bmi_category_change: bool = True

# In-memory storage for demo (use database in production)
weekly_plans = {}
health_triggers = HealthTrigger()

def calculate_bmi_category(bmi: float) -> str:
    """Calculate BMI category"""
    if bmi < 18.5:
        return "underweight"
    elif bmi < 25:
        return "normal"
    elif bmi < 30:
        return "overweight"
    else:
        return "obese"

def should_update_plan(
    profile: Profile,
    latest_report: Optional[Report] = None,
    current_plan: Optional[WeeklyMealPlan] = None
) -> tuple[bool, str]:
    """Determine if meal plan should be updated based on health changes"""
    
    reasons = []
    
    # Check weight change
    if profile.weight_kg:
        plan = current_plan or weekly_plans.get("current")
        if plan and abs(profile.weight_kg - plan.based_on_weight) >= health_triggers.weight_change_threshold:
            reasons.append(f"Weight changed by {abs(profile.weight_kg - plan.based_on_weight):.1f}kg")
    
    # Check BMI category change
    if profile.height_cm and profile.weight_kg:
        current_bmi = logic.compute_bmi(profile.height_cm, profile.weight_kg)
        current_category = calculate_bmi_category(current_bmi)
        
        plan = current_plan or weekly_plans.get("current")
        if plan:
            previous_bmi = logic.compute_bmi(profile.height_cm, plan.based_on_weight)
            previous_category = calculate_bmi_category(previous_bmi)
            
            if current_category != previous_category:
                reasons.append(f"BMI category changed from {previous_category} to {current_category}")
    
    # Check new health report
    if latest_report and health_triggers.new_health_condition:
        plan = current_plan or weekly_plans.get("current")
        if plan:
            if latest_report.created_at > plan.last_updated:
                reasons.append("New health report uploaded")
    
    should_update = len(reasons) > 0
    return should_update, "; ".join(reasons) if reasons else ""

def _build_plan_signature(profile_data: Dict[str, Any], latest_report: Optional[Report]) -> str:
    """Stable signature for detecting profile/report changes that require plan regeneration."""
    report_marker = ""
    if latest_report:
        report_marker = f"{getattr(latest_report, 'id', '')}:{getattr(latest_report, 'created_at', '')}"
    base = {
        "weight_kg": profile_data.get("weight_kg"),
        "height_cm": profile_data.get("height_cm"),
        "lifestyle_level": profile_data.get("lifestyle_level"),
        "motive": profile_data.get("motive"),
        "diet_type": profile_data.get("diet_type"),
        "health_diseases": profile_data.get("health_diseases"),
        "food_allergies": profile_data.get("food_allergies"),
        "breakfast": profile_data.get("breakfast"),
        "lunch": profile_data.get("lunch"),
        "snacks": profile_data.get("snacks"),
        "dinner": profile_data.get("dinner"),
        "target_area": profile_data.get("target_area"),
        "age": profile_data.get("age"),
        "gender": profile_data.get("gender"),
        "report": report_marker,
    }
    return json.dumps(base, sort_keys=True, default=str)

def _split_to_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = re.split(r"[,\n;/|]+", str(value))
    return [p.strip() for p in parts if p and p.strip()]

def _dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for raw in items:
        v = raw.strip()
        key = v.lower()
        if not v or key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out

def _parse_report_context(latest_report: Optional[Report]) -> Dict[str, Any]:
    """
    Parse report.summary and extract medical context for planning.
    Supports JSON object/string or plain text fallbacks.
    """
    ctx: Dict[str, Any] = {
        "diseases": [],
        "allergies": [],
        "consume": [],
        "avoid": [],
        "summary_text": ""
    }
    if not latest_report or not latest_report.summary:
        return ctx

    raw = latest_report.summary
    data: Any = raw
    try:
        if isinstance(raw, str):
            data = json.loads(raw)
    except Exception:
        data = raw

    if isinstance(data, dict):
        disease_keys = ["diseases", "conditions", "health_conditions", "medical_conditions"]
        allergy_keys = ["allergies", "food_allergies"]
        consume_keys = ["foods_to_consume", "consume", "recommended_foods", "eat_more"]
        avoid_keys = ["foods_to_avoid", "avoid", "avoid_foods", "avoid_items", "restricted_foods"]

        diseases: List[str] = []
        allergies: List[str] = []
        consume: List[str] = []
        avoid: List[str] = []

        for k in disease_keys:
            val = data.get(k)
            if isinstance(val, list):
                diseases.extend([str(x) for x in val if x])
            elif isinstance(val, str):
                diseases.extend(_split_to_list(val))
        for k in allergy_keys:
            val = data.get(k)
            if isinstance(val, list):
                allergies.extend([str(x) for x in val if x])
            elif isinstance(val, str):
                allergies.extend(_split_to_list(val))
        for k in consume_keys:
            val = data.get(k)
            if isinstance(val, list):
                consume.extend([str(x) for x in val if x])
            elif isinstance(val, str):
                consume.extend(_split_to_list(val))
        for k in avoid_keys:
            val = data.get(k)
            if isinstance(val, list):
                avoid.extend([str(x) for x in val if x])
            elif isinstance(val, str):
                avoid.extend(_split_to_list(val))

        ctx["diseases"] = _dedupe_keep_order(diseases)
        ctx["allergies"] = _dedupe_keep_order(allergies)
        ctx["consume"] = _dedupe_keep_order(consume)
        ctx["avoid"] = _dedupe_keep_order(avoid)
        ctx["summary_text"] = json.dumps(data)
        return ctx

    text = str(data)
    text_lower = text.lower()
    known_conditions = [
        "diabetes", "hypertension", "cholesterol", "heart", "thyroid",
        "kidney", "liver", "pcos", "anemia", "obesity"
    ]
    found = [c for c in known_conditions if c in text_lower]
    ctx["diseases"] = _dedupe_keep_order(found)
    ctx["summary_text"] = text
    return ctx

def generate_meal_item(food_name: str, food_data: Dict) -> MealItem:
    """Generate a meal item from food data"""
    return MealItem(
        name=food_name,
        calories=int(food_data.get('calories', 0)),
        protein=float(food_data.get('protein', 0)),
        carbs=float(food_data.get('carbs', 0)),
        fats=float(food_data.get('fat', 0)),
        fiber=float(food_data.get('fiber', food_data.get('fibre', 0)) or 0),
        preparation_time=15,  # Default prep time
        difficulty="easy"
    )

RICE_TOKENS = ["rice", "pulao", "biryani", "khichdi", "fried rice", "jeera rice"]
DAL_TOKENS = ["dal", "dhal", "sambar", "sambhar"]

CURRY_ROTATION = [
    {"name": "Mixed Vegetable Curry", "calories": 180, "protein": 5, "carbs": 18, "fats": 8},
    {"name": "Palak Paneer", "calories": 260, "protein": 14, "carbs": 12, "fats": 18},
    {"name": "Kadai Vegetable Curry", "calories": 210, "protein": 6, "carbs": 20, "fats": 10},
    {"name": "Chana Masala", "calories": 230, "protein": 11, "carbs": 30, "fats": 8},
    {"name": "Paneer Bhurji", "calories": 250, "protein": 15, "carbs": 10, "fats": 16},
    {"name": "Aloo Gobi Curry", "calories": 190, "protein": 5, "carbs": 26, "fats": 8},
    {"name": "Mushroom Masala", "calories": 200, "protein": 7, "carbs": 14, "fats": 11},
]

def _is_rice_item(name: str) -> bool:
    n = (name or "").lower()
    return any(tok in n for tok in RICE_TOKENS)

def _is_dal_item(name: str) -> bool:
    n = (name or "").lower()
    return any(tok in n for tok in DAL_TOKENS)

def _is_curry_item(name: str) -> bool:
    n = (name or "").lower()
    return any(tok in n for tok in ["curry", "masala", "korma", "kofta", "paneer", "chana", "gobi", "mushroom"])

def _rotating_curry(day_index: int, offset: int = 0) -> MealItem:
    item = CURRY_ROTATION[(day_index + offset) % len(CURRY_ROTATION)]
    return MealItem(
        name=item["name"],
        calories=int(item["calories"]),
        protein=float(item["protein"]),
        carbs=float(item["carbs"]),
        fats=float(item["fats"]),
        preparation_time=25,
        difficulty="medium",
    )

def _enforce_meal_rules(
    day_index: int,
    snack_foods: List[MealItem],
    lunch_foods: List[MealItem],
    dinner_foods: List[MealItem],
) -> tuple[List[MealItem], List[MealItem], List[MealItem]]:
    # Rule 1: No rice-based foods in snacks.
    snack_foods = [s for s in snack_foods if not _is_rice_item(s.name)]

    # Rule 2: If rice exists in lunch/dinner, pair with varied non-dal curry.
    def normalize_rice_pair(items: List[MealItem], offset: int) -> List[MealItem]:
        # Remove duplicate meal names to reduce repetition within the same meal slot.
        deduped: List[MealItem] = []
        seen = set()
        for m in items:
            key = (m.name or "").strip().lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(m)
        items = deduped

        # Convert generic repeated "rice + curry" names into rotating curry variants.
        rotated_curry = _rotating_curry(day_index, offset)
        for m in items:
            n = (m.name or "").strip().lower()
            if "rice and dal" in n or "rice with mixed vegetable curry" in n:
                m.name = f"Steamed Rice with {rotated_curry.name}"

        # Dedupe again because normalized names can collide.
        deduped_after_normalize: List[MealItem] = []
        seen2 = set()
        for m in items:
            key = (m.name or "").strip().lower()
            if key in seen2:
                continue
            seen2.add(key)
            deduped_after_normalize.append(m)
        items = deduped_after_normalize

        if not any(_is_rice_item(m.name) for m in items):
            return items

        dal_idx = next((i for i, m in enumerate(items) if _is_dal_item(m.name)), None)
        curry_idx = next((i for i, m in enumerate(items) if _is_curry_item(m.name) and not _is_dal_item(m.name)), None)
        curry_item = _rotating_curry(day_index, offset)

        if dal_idx is not None:
            items[dal_idx] = curry_item
        elif curry_idx is None:
            items.append(curry_item)
        return items

    lunch_foods = normalize_rice_pair(lunch_foods, 0)
    dinner_foods = normalize_rice_pair(dinner_foods, 3)
    return snack_foods, lunch_foods, dinner_foods

def select_foods_for_target(food_list, target_calories):
    """Select foods from a list to match target calories as closely as possible"""
    
    selected_foods = []
    current_calories = 0
    
    # Convert food list to MealItem objects
    meal_items = []
    for food in food_list:
        meal_items.append(MealItem(
            name=food['name'], calories=food['calories'], protein=food['protein'],
            carbs=food['carbs'], fats=food['fat'],
            fiber=float(food.get('fiber', food.get('fibre', 0)) or 0),
            preparation_time=20, difficulty="medium"
        ))
    
    # Sort by calorie density (moderate calories first for balance)
    meal_items.sort(key=lambda x: abs(x.calories - target_calories/2))
    
    # Select foods to get close to target
    for item in meal_items:
        if current_calories >= target_calories:
            break
        selected_foods.append(item)
        current_calories += item.calories
    
    # If we're still short, add more items
    if current_calories < target_calories * 0.8:
        for item in meal_items:
            if item not in selected_foods and current_calories < target_calories:
                selected_foods.append(item)
                current_calories += item.calories
    
    return selected_foods

def adjust_calories_to_target(breakfast_foods, lunch_foods, snack_foods, dinner_foods,
                            target_calories, target_protein, current_calories, current_protein, 
                            current_carbs, current_fats):
    """Adjust meal portions to meet target calories and protein"""
    
    calorie_diff = target_calories - current_calories
    protein_diff = target_protein - current_protein
    
    print(f"DEBUG: Calorie difference: {calorie_diff}")
    
    # If we need to add calories
    if calorie_diff > 50:
        # Add multiple high-calorie foods to meet the target
        additional_foods = []
        remaining_calories = calorie_diff
        
        while remaining_calories > 100:
            if remaining_calories > 400:
                # Add a substantial meal item
                additional_foods.append(MealItem(
                    name="Rice with Mixed Vegetable Curry", calories=350, protein=12, carbs=60, fats=8,
                    preparation_time=25, difficulty="medium"
                ))
                remaining_calories -= 350
            elif remaining_calories > 200:
                # Add a moderate meal item
                additional_foods.append(MealItem(
                    name="Mixed Bean Curry", calories=260, protein=14, carbs=28, fats=9,
                    preparation_time=30, difficulty="medium"
                ))
                remaining_calories -= 260
            elif remaining_calories > 100:
                # Add a snack
                additional_foods.append(MealItem(
                    name="Mixed Nuts", calories=180, protein=6, carbs=8, fats=15,
                    preparation_time=5, difficulty="easy"
                ))
                remaining_calories -= 180
            else:
                # Add a small snack
                additional_foods.append(MealItem(
                    name="Banana", calories=105, protein=1.3, carbs=27, fats=0.4,
                    preparation_time=2, difficulty="easy"
                ))
                remaining_calories -= 105
        
        # Distribute additional foods across meals
        for i, food in enumerate(additional_foods):
            if i % 4 == 0:
                breakfast_foods.append(food)
            elif i % 4 == 1:
                lunch_foods.append(food)
            elif i % 4 == 2:
                snack_foods.append(food)
            else:
                dinner_foods.append(food)
        
        print(f"DEBUG: Added {len(additional_foods)} additional foods")
    
    # If we need to reduce calories (remove some high-calorie items)
    elif calorie_diff < -50:
        # Find and remove some high-calorie items
        all_meals = breakfast_foods + lunch_foods + snack_foods + dinner_foods
        
        # Sort by calories (highest first)
        sorted_meals = sorted(all_meals, key=lambda x: x.calories, reverse=True)
        
        # Remove items until we're close to target
        calories_to_remove = abs(calorie_diff)
        for meal in sorted_meals:
            if calories_to_remove <= 0:
                break
            if meal.calories > 150:  # Only remove higher calorie items
                if meal in breakfast_foods:
                    breakfast_foods.remove(meal)
                elif meal in lunch_foods:
                    lunch_foods.remove(meal)
                elif meal in snack_foods:
                    snack_foods.remove(meal)
                elif meal in dinner_foods:
                    dinner_foods.remove(meal)
                calories_to_remove -= meal.calories
    
    # Recalculate totals
    all_meals = breakfast_foods + lunch_foods + snack_foods + dinner_foods
    new_total_calories = sum(item.calories for item in all_meals)
    new_total_protein = sum(item.protein for item in all_meals)
    new_total_carbs = sum(item.carbs for item in all_meals)
    new_total_fats = sum(item.fats for item in all_meals)
    
    print(f"DEBUG: Final calories after adjustment: {new_total_calories}")
    return new_total_calories, new_total_protein, new_total_carbs, new_total_fats

def generate_daily_meals(
    target_calories: int,
    target_protein: float,
    diet_type: str,
    diseases: List[str],
    allergies: List[str],
    day_index: int = 0,
    personalized_recommendations: List = None,
    user_context: Optional[Dict[str, Any]] = None,
    report_context: Optional[Dict[str, Any]] = None,
    recent_foods: Optional[List[str]] = None
) -> DailyMealPlan:
    """Generate meals for a single day using personalized nutrition recommendations"""
    
    try:
        daily_fruits = ["Apple", "Orange", "Papaya", "Guava", "Pomegranate", "Pear", "Kiwi"]
        fallback_fruit = daily_fruits[day_index % len(daily_fruits)]
        user_context = user_context or {}
        report_context = report_context or {}
        report_avoid = [str(x).strip() for x in report_context.get("avoid", []) if str(x).strip()]
        effective_allergies = _dedupe_keep_order(allergies + report_avoid)

        # Get personalized food recommendations from the existing nutrition system
        user_data = {
            "height_cm": user_context.get("height_cm", 170),
            "weight_kg": user_context.get("weight_kg", 70),
            "motive": user_context.get("motive", "fitness"),
            "diet_type": diet_type,
            "diseases": ", ".join(diseases) if diseases else "",
            "allergies": ", ".join(effective_allergies) if effective_allergies else "",
            "level": user_context.get("level", "beginner"),
            "lifestyle_level": user_context.get("lifestyle_level", "sedentary"),
            "target_area": user_context.get("target_area", ""),
            "breakfast": user_context.get("breakfast", ""),
            "lunch": user_context.get("lunch", ""),
            "snacks": user_context.get("snacks", ""),
            "dinner": user_context.get("dinner", ""),
            "age": user_context.get("age", 30),
            "gender": user_context.get("gender", "male"),
            "water_consumption_l": user_context.get("water_consumption_l", 2.5)
        }
        
        # Generate recommendations using the existing logic
        recommendations = logic.generate_recommendations(user_data)
        diet_recommendations = recommendations.get("diet", [])
        
        # If personalized recommendations are provided, use them
        if personalized_recommendations:
            diet_recommendations = personalized_recommendations

        # Improve day-to-day diversity while preserving safety constraints.
        recent_tokens = {str(x).strip().lower() for x in (recent_foods or []) if str(x).strip()}
        if diet_recommendations:
            deduped_recs: List[Dict[str, Any]] = []
            seen_names = set()
            for meal in diet_recommendations:
                name = str(meal.get("food_name", "")).strip()
                if not name:
                    continue
                key = name.lower()
                if key in seen_names:
                    continue
                seen_names.add(key)
                deduped_recs.append(meal)

            if deduped_recs:
                rotate_by = day_index % len(deduped_recs)
                rotated = deduped_recs[rotate_by:] + deduped_recs[:rotate_by]
                fresh_first = []
                repeated_later = []
                for meal in rotated:
                    fname = str(meal.get("food_name", "")).lower()
                    if any(tok in fname for tok in recent_tokens):
                        repeated_later.append(meal)
                    else:
                        fresh_first.append(meal)
                diet_recommendations = fresh_first + repeated_later

        # Honor report-level avoid cues as hard block for weekly plan safety
        if report_avoid:
            filtered_recs = []
            for meal in diet_recommendations:
                fname = str(meal.get("food_name", "")).lower()
                if any(tok.lower() in fname for tok in report_avoid):
                    continue
                filtered_recs.append(meal)
            if filtered_recs:
                diet_recommendations = filtered_recs
        
        # Create meal categories from recommendations
        breakfast_foods = []
        lunch_foods = []
        snack_foods = []
        dinner_foods = []
        
        # Distribute personalized recommendations across meal types based on day and calorie targets
        for i, meal in enumerate(diet_recommendations):
            meal_item = MealItem(
                name=meal.get("food_name", "Unknown Food"),
                calories=int(meal.get("calories", 0)),
                protein=float(meal.get("protein_g", 0)),
                carbs=float(meal.get("carbs_g", 0)),
                fats=float(meal.get("fat_g", 0)),
                fiber=float(
                    meal.get(
                        "fiber_g",
                        meal.get(
                            "fibre_g",
                            meal.get(
                                "fiber (g)",
                                meal.get("fibre (g)", meal.get("fiber", meal.get("fibre", 0)))
                            )
                        )
                    )
                    or 0
                ),
                preparation_time=20,
                difficulty="medium"
            )
            
            # Calculate target calories per meal
            breakfast_target = int(target_calories * 0.25)
            lunch_target = int(target_calories * 0.35)
            snack_target = int(target_calories * 0.10)
            dinner_target = int(target_calories * 0.30)
            
            # Calculate current calories in each meal
            breakfast_current = sum(item.calories for item in breakfast_foods)
            lunch_current = sum(item.calories for item in lunch_foods)
            snack_current = sum(item.calories for item in snack_foods)
            dinner_current = sum(item.calories for item in dinner_foods)
            
            # Distribute based on which meal needs more calories
            meal_distribution = (day_index + i) % 4
            
            # Smart distribution based on calorie needs
            if breakfast_current < breakfast_target * 0.8 and meal_distribution == 0:
                breakfast_foods.append(meal_item)
            elif lunch_current < lunch_target * 0.8 and meal_distribution == 1:
                lunch_foods.append(meal_item)
            elif snack_current < snack_target * 0.8 and meal_distribution == 2:
                snack_foods.append(meal_item)
            elif dinner_current < dinner_target * 0.8:
                dinner_foods.append(meal_item)
            else:
                # Fallback to standard distribution
                if meal_distribution == 0:
                    breakfast_foods.append(meal_item)
                elif meal_distribution == 1:
                    lunch_foods.append(meal_item)
                elif meal_distribution == 2:
                    snack_foods.append(meal_item)
                else:
                    dinner_foods.append(meal_item)
        
        # If we have personalized recommendations but need more variety, supplement with Indian foods
        if diet_recommendations and (len(breakfast_foods) < 2 or len(lunch_foods) < 2 or len(dinner_foods) < 2):
            # Add complementary Indian foods based on what's missing
            indian_supplements = get_indian_food_supplements(day_index, diet_type)
            
            if len(breakfast_foods) < 2:
                for food in indian_supplements['breakfast'][:2-len(breakfast_foods)]:
                    breakfast_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'],
                        fiber=float(food.get('fiber', food.get('fibre', 0)) or 0),
                        preparation_time=20, difficulty="medium"
                    ))
            
            if len(lunch_foods) < 2:
                for food in indian_supplements['lunch'][:2-len(lunch_foods)]:
                    lunch_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'],
                        fiber=float(food.get('fiber', food.get('fibre', 0)) or 0),
                        preparation_time=25, difficulty="medium"
                    ))
            
            if len(snack_foods) < 1:
                for food in indian_supplements['snacks'][:1-len(snack_foods)]:
                    snack_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'],
                        fiber=float(food.get('fiber', food.get('fibre', 0)) or 0),
                        preparation_time=10, difficulty="easy"
                    ))
            
            if len(dinner_foods) < 2:
                for food in indian_supplements['dinner'][:2-len(dinner_foods)]:
                    dinner_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'],
                        fiber=float(food.get('fiber', food.get('fibre', 0)) or 0),
                        preparation_time=30, difficulty="medium"
                    ))
        
        # If no recommendations available, use diverse Indian foods with variety
        if not diet_recommendations:
            indian_foods = get_indian_food_variety(day_index, diet_type)
            
            # Calculate target calories per meal
            breakfast_target = int(target_calories * 0.25)  # 25% for breakfast
            lunch_target = int(target_calories * 0.35)     # 35% for lunch
            snack_target = int(target_calories * 0.10)     # 10% for snacks
            dinner_target = int(target_calories * 0.30)    # 30% for dinner
            
            # Select foods to match meal targets
            breakfast_foods = select_foods_for_target(indian_foods['breakfast'], breakfast_target)
            lunch_foods = select_foods_for_target(indian_foods['lunch'], lunch_target)
            snack_foods = select_foods_for_target(indian_foods['snacks'], snack_target)
            dinner_foods = select_foods_for_target(indian_foods['dinner'], dinner_target)
        
        # Filter foods based on diet type
        if diet_type.lower() == 'vegetarian':
            lunch_foods = [f for f in lunch_foods if not any(meat in f.name.lower() for meat in ['chicken', 'mutton', 'fish', 'egg'])]
            dinner_foods = [f for f in dinner_foods if not any(meat in f.name.lower() for meat in ['chicken', 'mutton', 'fish', 'egg'])]
            breakfast_foods = [f for f in breakfast_foods if not any(meat in f.name.lower() for meat in ['chicken', 'mutton', 'fish', 'egg'])]
        elif diet_type.lower() == 'vegan':
            all_foods = breakfast_foods + lunch_foods + snack_foods + dinner_foods
            filtered_foods = [f for f in all_foods if not any(avoid in f.name.lower() for avoid in ['milk', 'curd', 'paneer', 'cheese', 'egg', 'chicken', 'mutton', 'fish'])]
            # Redistribute filtered foods
            breakfast_foods = filtered_foods[:len(breakfast_foods)]
            lunch_foods = filtered_foods[len(breakfast_foods):len(breakfast_foods)+len(lunch_foods)]
            snack_foods = filtered_foods[len(breakfast_foods)+len(lunch_foods):len(breakfast_foods)+len(lunch_foods)+len(snack_foods)]
            dinner_foods = filtered_foods[len(breakfast_foods)+len(lunch_foods)+len(snack_foods):]

        # Hard safety filter from merged allergy/avoid list
        if effective_allergies:
            avoid_tokens = [a.lower() for a in effective_allergies]
            def _safe(items: List[MealItem]) -> List[MealItem]:
                return [m for m in items if not any(tok in m.name.lower() for tok in avoid_tokens)]
            breakfast_foods = _safe(breakfast_foods)
            lunch_foods = _safe(lunch_foods)
            snack_foods = _safe(snack_foods)
            dinner_foods = _safe(dinner_foods)

        snack_foods, lunch_foods, dinner_foods = _enforce_meal_rules(
            day_index, snack_foods, lunch_foods, dinner_foods
        )
        
        # Ensure we have at least some items in each category
        if not breakfast_foods:
            breakfast_foods = [MealItem(name="Oatmeal", calories=150, protein=5, carbs=27, fats=3, preparation_time=15, difficulty="easy")]
        if not lunch_foods:
            lunch_foods = [MealItem(name="Rice with Mixed Vegetable Curry", calories=320, protein=9, carbs=50, fats=8, preparation_time=25, difficulty="medium")]
        if not snack_foods:
            snack_foods = [MealItem(name=fallback_fruit, calories=60, protein=1, carbs=15, fats=0, preparation_time=5, difficulty="easy")]
        if not dinner_foods:
            dinner_foods = [MealItem(name="Vegetable Curry", calories=250, protein=6, carbs=35, fats=10, preparation_time=30, difficulty="medium")]
        
    except Exception as e:
        # Fallback to basic meals if anything fails
        daily_fruits = ["Apple", "Orange", "Papaya", "Guava", "Pomegranate", "Pear", "Kiwi"]
        fallback_fruit = daily_fruits[day_index % len(daily_fruits)]
        breakfast_foods = [MealItem(name="Oatmeal", calories=150, protein=5, carbs=27, fats=3, preparation_time=15, difficulty="easy")]
        lunch_foods = [MealItem(name="Rice with Mixed Vegetable Curry", calories=320, protein=9, carbs=50, fats=8, preparation_time=25, difficulty="medium")]
        snack_foods = [MealItem(name=fallback_fruit, calories=60, protein=1, carbs=15, fats=0, preparation_time=5, difficulty="easy")]
        dinner_foods = [MealItem(name="Vegetable Curry", calories=250, protein=6, carbs=35, fats=10, preparation_time=30, difficulty="medium")]

    snack_foods, lunch_foods, dinner_foods = _enforce_meal_rules(
        day_index, snack_foods, lunch_foods, dinner_foods
    )
    
    # Calculate totals
    all_meals = breakfast_foods + lunch_foods + snack_foods + dinner_foods
    total_calories = sum(item.calories for item in all_meals)
    total_protein = sum(item.protein for item in all_meals)
    total_carbs = sum(item.carbs for item in all_meals)
    total_fats = sum(item.fats for item in all_meals)
    
    # Debug logging
    print(f"DEBUG: Target calories: {target_calories}, Current calories: {total_calories}")
    print(f"DEBUG: Meal counts - Breakfast: {len(breakfast_foods)}, Lunch: {len(lunch_foods)}, Snacks: {len(snack_foods)}, Dinner: {len(dinner_foods)}")
    
    # Adjust calories to meet target if needed
    if abs(total_calories - target_calories) > 100:  # If off by more than 100 calories
        print(f"DEBUG: Adjusting calories - difference: {target_calories - total_calories}")
        total_calories, total_protein, total_carbs, total_fats = adjust_calories_to_target(
            breakfast_foods, lunch_foods, snack_foods, dinner_foods,
            target_calories, target_protein, total_calories, total_protein, total_carbs, total_fats
        )
        print(f"DEBUG: After adjustment - calories: {total_calories}")
    else:
        print(f"DEBUG: No adjustment needed - calories are within range")

    # Re-apply strict meal rules after calorie adjustment.
    snack_foods, lunch_foods, dinner_foods = _enforce_meal_rules(
        day_index, snack_foods, lunch_foods, dinner_foods
    )
    all_meals = breakfast_foods + lunch_foods + snack_foods + dinner_foods
    total_calories = sum(item.calories for item in all_meals)
    total_protein = sum(item.protein for item in all_meals)
    total_carbs = sum(item.carbs for item in all_meals)
    total_fats = sum(item.fats for item in all_meals)
    
    return DailyMealPlan(
        day="",
        breakfast=breakfast_foods,
        lunch=lunch_foods,
        snacks=snack_foods,
        dinner=dinner_foods,
        total_calories=total_calories,
        total_protein=total_protein,
        total_carbs=total_carbs,
        total_fats=total_fats
    )

def get_indian_food_supplements(day_index: int, diet_type: str) -> dict:
    """Get Indian food supplements to complement personalized recommendations"""
    breakfast_fruits = ["Apple", "Orange", "Papaya", "Guava", "Pomegranate", "Pear", "Kiwi"]
    selected_fruit = breakfast_fruits[day_index % len(breakfast_fruits)]
    supplements = {
        'breakfast': [
            {'name': selected_fruit, 'calories': 60, 'protein': 1, 'carbs': 15, 'fat': 0},
            {'name': 'Sprouts', 'calories': 100, 'protein': 6, 'carbs': 12, 'fat': 2}
        ],
        'lunch': [
            {'name': 'Green Salad', 'calories': 45, 'protein': 2, 'carbs': 8, 'fat': 0},
            {'name': 'Rice', 'calories': 130, 'protein': 3, 'carbs': 28, 'fat': 0}
        ],
        'snacks': [
            {'name': 'Nuts', 'calories': 170, 'protein': 6, 'carbs': 6, 'fat': 15},
            {'name': 'Herbal Tea', 'calories': 2, 'protein': 0, 'carbs': 0, 'fat': 0}
        ],
        'dinner': [
            {'name': 'Roti', 'calories': 120, 'protein': 3, 'carbs': 24, 'fat': 1},
            {'name': 'Vegetable Soup', 'calories': 80, 'protein': 2, 'carbs': 12, 'fat': 2}
        ]
    }
    
    # Filter based on diet type
    if diet_type.lower() == 'vegan':
        supplements['snacks'] = [f for f in supplements['snacks'] if 'dairy' not in f['name'].lower()]
    
    return supplements

def get_indian_food_variety(day_index: int, diet_type: str) -> dict:
    """Get diverse Indian foods for variety when no personalized recommendations available"""
    # This function contains the Indian food variety from before
    # (Keeping the existing Indian food variety logic as fallback)
    food_varieties = {
        0: { # Monday
            'breakfast': [
                {'name': 'Idli with Sambar', 'calories': 220, 'protein': 6, 'carbs': 42, 'fat': 3},
                {'name': 'Upma', 'calories': 180, 'protein': 4, 'carbs': 35, 'fat': 4},
                {'name': 'Banana', 'calories': 105, 'protein': 1.3, 'carbs': 27, 'fat': 0.4}
            ],
            'lunch': [
                {'name': 'Rajma with Rice', 'calories': 350, 'protein': 12, 'carbs': 58, 'fat': 8},
                {'name': 'Mixed Vegetable Curry', 'calories': 180, 'protein': 4, 'carbs': 28, 'fat': 6}
            ],
            'snacks': [
                {'name': 'Samosa', 'calories': 150, 'protein': 3, 'carbs': 20, 'fat': 7},
                {'name': 'Chai', 'calories': 50, 'protein': 1, 'carbs': 8, 'fat': 2}
            ],
            'dinner': [
                {'name': 'Palak Paneer', 'calories': 280, 'protein': 16, 'carbs': 12, 'fat': 20},
                {'name': 'Roti', 'calories': 120, 'protein': 3, 'carbs': 24, 'fat': 1}
            ]
        },
        1: { # Tuesday
            'breakfast': [
                {'name': 'Dosa with Chutney', 'calories': 250, 'protein': 6, 'carbs': 45, 'fat': 6},
                {'name': 'Coconut Chutney', 'calories': 80, 'protein': 1, 'carbs': 6, 'fat': 7},
                {'name': 'Orange', 'calories': 62, 'protein': 1.2, 'carbs': 15, 'fat': 0.2}
            ],
            'lunch': [
                {'name': 'Chole with Rice', 'calories': 380, 'protein': 14, 'carbs': 62, 'fat': 10},
                {'name': 'Cucumber Salad', 'calories': 45, 'protein': 2, 'carbs': 8, 'fat': 0}
            ],
            'snacks': [
                {'name': 'Bhujia', 'calories': 120, 'protein': 3, 'carbs': 15, 'fat': 5},
                {'name': 'Buttermilk', 'calories': 40, 'protein': 2, 'carbs': 6, 'fat': 1}
            ],
            'dinner': [
                {'name': 'Mix Dal', 'calories': 200, 'protein': 10, 'carbs': 30, 'fat': 6},
                {'name': 'Jeera Rice', 'calories': 180, 'protein': 4, 'carbs': 38, 'fat': 2}
            ]
        },
        2: { # Wednesday
            'breakfast': [
                {'name': 'Poha', 'calories': 200, 'protein': 4, 'carbs': 38, 'fat': 4},
                {'name': 'Sprouts', 'calories': 100, 'protein': 6, 'carbs': 12, 'fat': 2},
                {'name': 'Papaya', 'calories': 60, 'protein': 0.9, 'carbs': 15, 'fat': 0.2}
            ],
            'lunch': [
                {'name': 'Sambhar with Rice', 'calories': 320, 'protein': 10, 'carbs': 55, 'fat': 8},
                {'name': 'Bhindi Masala', 'calories': 160, 'protein': 3, 'carbs': 20, 'fat': 8}
            ],
            'snacks': [
                {'name': 'Murmure', 'calories': 80, 'protein': 2, 'carbs': 16, 'fat': 1},
                {'name': 'Green Tea', 'calories': 2, 'protein': 0, 'carbs': 0, 'fat': 0}
            ],
            'dinner': [
                {'name': 'Baingan Bharta', 'calories': 150, 'protein': 2, 'carbs': 20, 'fat': 8},
                {'name': 'Phulka', 'calories': 100, 'protein': 3, 'carbs': 20, 'fat': 1}
            ]
        },
        3: { # Thursday
            'breakfast': [
                {'name': 'Paratha with Curd', 'calories': 280, 'protein': 8, 'carbs': 42, 'fat': 10},
                {'name': 'Aloo Paratha', 'calories': 200, 'protein': 4, 'carbs': 32, 'fat': 7},
                {'name': 'Apple', 'calories': 95, 'protein': 0.5, 'carbs': 25, 'fat': 0.3}
            ],
            'lunch': [
                {'name': 'Dal Makhani', 'calories': 350, 'protein': 12, 'carbs': 45, 'fat': 15},
                {'name': 'Laccha Sabzi', 'calories': 120, 'protein': 3, 'carbs': 18, 'fat': 5}
            ],
            'snacks': [
                {'name': 'Roasted Makhana', 'calories': 100, 'protein': 3, 'carbs': 18, 'fat': 2},
                {'name': 'Lemon Water', 'calories': 6, 'protein': 0, 'carbs': 2, 'fat': 0}
            ],
            'dinner': [
                {'name': 'Kadhi Pakora', 'calories': 280, 'protein': 8, 'carbs': 30, 'fat': 14},
                {'name': 'Steamed Rice', 'calories': 130, 'protein': 3, 'carbs': 28, 'fat': 0}
            ]
        },
        4: { # Friday
            'breakfast': [
                {'name': 'Uttapam', 'calories': 220, 'protein': 6, 'carbs': 40, 'fat': 5},
                {'name': 'Tomato Chutney', 'calories': 60, 'protein': 1, 'carbs': 10, 'fat': 2},
                {'name': 'Pomegranate', 'calories': 72, 'protein': 1.4, 'carbs': 16, 'fat': 0.6}
            ],
            'lunch': [
                {'name': 'Veg Biryani', 'calories': 400, 'protein': 10, 'carbs': 65, 'fat': 12},
                {'name': 'Raita', 'calories': 80, 'protein': 3, 'carbs': 8, 'fat': 4}
            ],
            'snacks': [
                {'name': 'Sev Puri', 'calories': 140, 'protein': 2, 'carbs': 20, 'fat': 6},
                {'name': 'Sugarcane Juice', 'calories': 90, 'protein': 0, 'carbs': 22, 'fat': 0}
            ],
            'dinner': [
                {'name': 'Gobi Aloo', 'calories': 200, 'protein': 4, 'carbs': 28, 'fat': 10},
                {'name': 'Missi Roti', 'calories': 110, 'protein': 4, 'carbs': 22, 'fat': 2}
            ]
        },
        5: { # Saturday
            'breakfast': [
                {'name': 'Masala Dosa', 'calories': 280, 'protein': 7, 'carbs': 48, 'fat': 7},
                {'name': 'Potato Masala', 'calories': 120, 'protein': 2, 'carbs': 20, 'fat': 4},
                {'name': 'Pineapple', 'calories': 50, 'protein': 0.5, 'carbs': 13, 'fat': 0.1}
            ],
            'lunch': [
                {'name': 'Paneer Butter Masala', 'calories': 420, 'protein': 18, 'carbs': 24, 'fat': 32},
                {'name': 'Naan', 'calories': 180, 'protein': 6, 'carbs': 32, 'fat': 4}
            ],
            'snacks': [
                {'name': 'Pani Puri', 'calories': 100, 'protein': 1, 'carbs': 18, 'fat': 3},
                {'name': 'Jaljeera', 'calories': 15, 'protein': 0, 'carbs': 4, 'fat': 0}
            ],
            'dinner': [
                {'name': 'Dal Tadka', 'calories': 180, 'protein': 8, 'carbs': 28, 'fat': 6},
                {'name': 'Vegetable Pulao', 'calories': 250, 'protein': 6, 'carbs': 45, 'fat': 8}
            ]
        },
        6: { # Sunday
            'breakfast': [
                {'name': 'Chole Bhature', 'calories': 450, 'protein': 12, 'carbs': 65, 'fat': 18},
                {'name': 'Onion Salad', 'calories': 25, 'protein': 1, 'carbs': 5, 'fat': 0},
                {'name': 'Mango', 'calories': 60, 'protein': 0.8, 'carbs': 15, 'fat': 0.2}
            ],
            'lunch': [
                {'name': 'Thali (Mixed)', 'calories': 500, 'protein': 15, 'carbs': 70, 'fat': 18},
                {'name': 'Sweet Lassi', 'calories': 120, 'protein': 4, 'carbs': 18, 'fat': 4}
            ],
            'snacks': [
                {'name': 'Mathri', 'calories': 80, 'protein': 1, 'carbs': 10, 'fat': 4},
                {'name': 'Coffee', 'calories': 8, 'protein': 0.3, 'carbs': 1, 'fat': 0}
            ],
            'dinner': [
                {'name': 'Malai Kofta', 'calories': 320, 'protein': 10, 'carbs': 28, 'fat': 20},
                {'name': 'Tandoori Roti', 'calories': 100, 'protein': 3, 'carbs': 20, 'fat': 1}
            ]
        }
    }
    
    # Filter based on diet type
    if diet_type.lower() == 'vegetarian':
        for day in food_varieties.values():
            day['lunch'] = [f for f in day['lunch'] if not any(meat in f['name'].lower() for meat in ['chicken', 'mutton', 'fish', 'egg'])]
            day['dinner'] = [f for f in day['dinner'] if not any(meat in f['name'].lower() for meat in ['chicken', 'mutton', 'fish', 'egg'])]
            day['breakfast'] = [f for f in day['breakfast'] if not any(meat in f['name'].lower() for meat in ['chicken', 'mutton', 'fish', 'egg'])]
    elif diet_type.lower() == 'vegan':
        for day in food_varieties.values():
            all_foods = day['breakfast'] + day['lunch'] + day['snacks'] + day['dinner']
            filtered_foods = [f for f in all_foods if not any(avoid in f['name'].lower() for avoid in ['milk', 'curd', 'paneer', 'cheese', 'egg', 'chicken', 'mutton', 'fish'])]
            # Redistribute (simplified)
            day['breakfast'] = filtered_foods[:3]
            day['lunch'] = filtered_foods[3:5]
            day['snacks'] = filtered_foods[5:6]
            day['dinner'] = filtered_foods[6:8]
    
    return food_varieties.get(day_index % 7, food_varieties[0])

def generate_weekly_plan(profile_data: Dict, latest_report: Optional[Report] = None) -> WeeklyMealPlan:
    """Generate a complete weekly meal plan using personalized recommendations"""
    
    # Extract profile data
    weight_kg = profile_data.get('weight_kg', 70)
    height_cm = profile_data.get('height_cm', 170)
    lifestyle_level = profile_data.get('lifestyle_level', 'sedentary')
    motive = profile_data.get('motive', 'fitness')
    age = profile_data.get('age')
    gender = profile_data.get('gender')
    diet_type = profile_data.get('diet_type', 'vegetarian')
    health_diseases = profile_data.get('health_diseases', '')
    food_allergies = profile_data.get('food_allergies', '')

    # Parse context from profile + report
    report_ctx = _parse_report_context(latest_report)
    profile_diseases = _split_to_list(health_diseases)
    profile_allergies = _split_to_list(food_allergies)
    diseases_list = _dedupe_keep_order(profile_diseases + report_ctx.get("diseases", []))
    allergies_list = _dedupe_keep_order(profile_allergies + report_ctx.get("allergies", []))

    # User consumed / preferred meal items from profile fields
    meal_prefs = {
        "breakfast": profile_data.get("breakfast", "") or "",
        "lunch": profile_data.get("lunch", "") or "",
        "snacks": profile_data.get("snacks", "") or "",
        "dinner": profile_data.get("dinner", "") or ""
    }

    # Merge report "consume" foods as preference hints to increase adoption
    report_consume = _dedupe_keep_order([str(x) for x in report_ctx.get("consume", []) if str(x).strip()])
    if report_consume:
        consume_text = ", ".join(report_consume)
        for meal_key in meal_prefs.keys():
            meal_prefs[meal_key] = ", ".join([x for x in [meal_prefs[meal_key], consume_text] if x]).strip(", ")

    # Build base recommendation context (dataset-driven)
    user_data = {
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "motive": motive,
        "diet_type": diet_type,
        "diseases": ", ".join(diseases_list),
        "allergies": ", ".join(allergies_list),
        "level": "beginner",
        "lifestyle_level": lifestyle_level,
        "target_area": profile_data.get("target_area", ""),
        "breakfast": meal_prefs["breakfast"],
        "lunch": meal_prefs["lunch"],
        "snacks": meal_prefs["snacks"],
        "dinner": meal_prefs["dinner"],
        "age": age or 30,
        "gender": gender or "male",
        "water_consumption_l": profile_data.get("water_consumption_l", 2.5)
    }

    # Generate personalized recommendations from Indian + disease dataset logic
    recommendations = logic.generate_recommendations(user_data)
    personalized_recommendations = recommendations.get("diet", [])
    
    # Calculate daily calorie and protein targets
    daily_calories = logic.daily_calorie_target(weight_kg, height_cm, lifestyle_level, motive, age, gender)
    daily_protein = logic.daily_protein_target(weight_kg, motive, lifestyle_level, age)
    
    # Create meals for each day of the week
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    meals = {}
    recent_foods: List[str] = []
    
    for day in days:
        # Keep each day aligned to the user's daily target
        day_calories = int(daily_calories)
        day_protein = daily_protein

        # Generate daily meals with personalized recommendations
        daily_plan = generate_daily_meals(
            day_calories,
            day_protein,
            diet_type,
            diseases_list,
            allergies_list,
            days.index(day),  # Pass day index for variety
            personalized_recommendations,  # Pass personalized recommendations
            user_context=user_data,
            report_context=report_ctx,
            recent_foods=recent_foods
        )
        daily_plan.day = day
        meals[day] = daily_plan

        # Track recent foods to reduce repetition in subsequent days.
        day_foods = [
            *(m.name for m in daily_plan.breakfast),
            *(m.name for m in daily_plan.lunch),
            *(m.name for m in daily_plan.snacks),
            *(m.name for m in daily_plan.dinner),
        ]
        recent_foods.extend([str(x).strip().lower() for x in day_foods if str(x).strip()])
        if len(recent_foods) > 24:
            recent_foods = recent_foods[-24:]
    
    # Calculate weekly totals
    weekly_calories = sum(plan.total_calories for plan in meals.values())
    weekly_protein = sum(plan.total_protein for plan in meals.values())
    weekly_carbs = sum(plan.total_carbs for plan in meals.values())
    weekly_fats = sum(plan.total_fats for plan in meals.values())
    
    # Calculate week dates
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    return WeeklyMealPlan(
        week_start=start_of_week.isoformat(),
        week_end=end_of_week.isoformat(),
        meals=meals,
        weekly_calories=weekly_calories,
        weekly_protein=weekly_protein,
        weekly_carbs=weekly_carbs,
        weekly_fats=weekly_fats,
        based_on_weight=weight_kg,
        based_on_health_report=report_ctx.get("summary_text") if report_ctx.get("summary_text") else None,
        last_updated=datetime.now().isoformat(),
        personalized_items=len(personalized_recommendations)
    )

@router.get("/weekly-plan")
async def get_weekly_meal_plan(
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get or generate weekly meal plan"""
    try:
        # Get user profile and latest health report
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        
        # Use mock profile data if no profile found
        if not profile:
            profile_data = {
                "weight_kg": 70,
                "height_cm": 170,
                "lifestyle_level": "sedentary",
                "motive": "fitness",
                "age": 30,
                "gender": "male",
                "diet_type": "vegetarian",
                "health_diseases": "",
                "food_allergies": "",
                "breakfast": "",
                "lunch": "",
                "snacks": "",
                "dinner": "",
                "target_area": "",
                "water_consumption_l": 2.5
            }
            latest_report = None
        else:
            profile_data = {
                "weight_kg": profile.weight_kg,
                "height_cm": profile.height_cm,
                "lifestyle_level": profile.lifestyle_level or "sedentary",
                "motive": profile.motive or "fitness",
                "age": profile.age,
                "gender": profile.gender,
                "diet_type": profile.diet_type or "vegetarian",
                "health_diseases": profile.health_diseases or "",
                "food_allergies": profile.food_allergies or "",
                "breakfast": profile.breakfast or "",
                "lunch": profile.lunch or "",
                "snacks": profile.snacks or "",
                "dinner": profile.dinner or "",
                "target_area": profile.target_area or "",
                "water_consumption_l": profile.water_consumption_l or 2.5
            }
            latest_report = db.query(Report).filter(Report.user_id == user.id).order_by(Report.created_at.desc()).first()
        
        # Cache is user-scoped so one user's updates never overwrite another's plan.
        plan_key = f"user:{user.id}"
        cached_entry = weekly_plans.get(plan_key)
        cached_plan = cached_entry.get("plan") if isinstance(cached_entry, dict) else cached_entry
        cached_signature = cached_entry.get("signature") if isinstance(cached_entry, dict) else None

        latest_signature = _build_plan_signature(profile_data, latest_report)
        should_update = force_refresh or not cached_plan or (cached_signature != latest_signature)

        if not should_update and profile:
            try:
                trigger_update, _ = should_update_plan(profile, latest_report, cached_plan)
                should_update = trigger_update
            except Exception:
                should_update = False

        if should_update:
            # Generate new plan
            new_plan = generate_weekly_plan(profile_data, latest_report)
            weekly_plans[plan_key] = {
                "plan": new_plan,
                "signature": latest_signature
            }
            
            return {
                "weekly_plan": new_plan,
                "message": "New meal plan generated!",
                "is_fresh": True
            }
        else:
            return {
                "weekly_plan": cached_plan,
                "message": "Using existing meal plan (no significant health changes detected)",
                "is_fresh": False
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating meal plan: {str(e)}")

@router.get("/daily/{day}")
async def get_daily_meal_plan(
    day: str,  # Monday, Tuesday, etc.
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get meal plan for a specific day"""
    try:
        # Get weekly plan first
        weekly_response = await get_weekly_meal_plan(False, db, user)
        weekly_plan = weekly_response["weekly_plan"]
        
        # Return specific day's meals
        if day not in weekly_plan.meals:
            raise HTTPException(status_code=404, detail=f"No meal plan found for {day}")
        
        daily_plan = weekly_plan.meals[day]
        
        return {
            "day": day,
            "meals": daily_plan,
            "weekly_context": {
                "week_start": weekly_plan.week_start,
                "week_end": weekly_plan.week_end,
                "based_on_weight": weekly_plan.based_on_weight
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting daily meal plan: {str(e)}")

@router.post("/trigger-update")
async def trigger_plan_update(
    reason: str = "Manual update requested",
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Manually trigger meal plan update"""
    try:
        # Force refresh the plan
        weekly_response = await get_weekly_meal_plan(True, db, user)
        
        return {
            "message": f"Meal plan updated successfully! Reason: {reason}",
            "weekly_plan": weekly_response["weekly_plan"],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating meal plan: {str(e)}")

@router.get("/update-triggers")
async def get_update_triggers():
    """Get current update trigger settings"""
    return health_triggers

@router.put("/update-triggers")
async def update_triggers(triggers: HealthTrigger):
    """Update meal plan update trigger settings"""
    global health_triggers
    health_triggers = triggers
    return {
        "message": "Update triggers updated successfully",
        "new_triggers": health_triggers
    }

@router.get("/nutrition-summary")
async def get_nutrition_summary(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get nutrition summary for the current week"""
    try:
        weekly_response = await get_weekly_meal_plan(False, db, user)
        weekly_plan = weekly_response["weekly_plan"]
        
        # Calculate daily averages
        daily_avg_calories = weekly_plan.weekly_calories / 7
        daily_avg_protein = weekly_plan.weekly_protein / 7
        daily_avg_carbs = weekly_plan.weekly_carbs / 7
        daily_avg_fats = weekly_plan.weekly_fats / 7
        
        return {
            "weekly_totals": {
                "calories": weekly_plan.weekly_calories,
                "protein": weekly_plan.weekly_protein,
                "carbs": weekly_plan.weekly_carbs,
                "fats": weekly_plan.weekly_fats
            },
            "daily_averages": {
                "calories": round(daily_avg_calories),
                "protein": round(daily_avg_protein, 1),
                "carbs": round(daily_avg_carbs, 1),
                "fats": round(daily_avg_fats, 1)
            },
            "based_on": {
                "weight_kg": weekly_plan.based_on_weight,
                "health_report": weekly_plan.based_on_health_report,
                "last_updated": weekly_plan.last_updated
            },
            "meals_count": {
                "total_meals": sum(len(plan.breakfast) + len(plan.lunch) + len(plan.snacks) + len(plan.dinner) 
                                 for plan in weekly_plan.meals.values()),
                "days_planned": len(weekly_plan.meals)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting nutrition summary: {str(e)}")

@router.get("/shopping-list")
async def generate_shopping_list(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Generate shopping list based on weekly meal plan"""
    try:
        weekly_response = await get_weekly_meal_plan(False, db, user)
        weekly_plan = weekly_response["weekly_plan"]
        
        # Aggregate all ingredients
        ingredient_counts = {}
        
        for day_plan in weekly_plan.meals.values():
            all_meals = day_plan.breakfast + day_plan.lunch + day_plan.snacks + day_plan.dinner
            for meal in all_meals:
                meal_name = meal.name.lower()
                ingredient_counts[meal_name] = ingredient_counts.get(meal_name, 0) + 1
        
        # Convert to shopping list format
        shopping_list = [
            {"item": name.capitalize(), "quantity": count, "unit": "portion(s)"}
            for name, count in sorted(ingredient_counts.items())
        ]
        
        return {
            "shopping_list": shopping_list,
            "total_items": len(shopping_list),
            "week_start": weekly_plan.week_start,
            "week_end": weekly_plan.week_end,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating shopping list: {str(e)}")
