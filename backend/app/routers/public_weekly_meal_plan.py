"""
Public weekly meal plan endpoints for testing without authentication
"""

from fastapi import APIRouter
from .weekly_meal_plan import (
    weekly_plans,
    health_triggers,
    generate_weekly_plan,
    generate_daily_meals,
    get_nutrition_summary,
    generate_shopping_list
)
from datetime import date

router = APIRouter()

@router.get("/weekly-plan")
async def get_public_weekly_meal_plan(force_refresh: bool = False):
    """Public endpoint for weekly meal plan (no auth required)"""
    try:
        # Try to get actual user profile data for demo
        # In production, this would use authenticated user data
        profile_data = await get_demo_user_profile()
        
        # Check if plan needs updating
        current_plan = weekly_plans.get("current")
        should_update = force_refresh or not current_plan
        
        if should_update:
            # Generate new plan with actual user data
            new_plan = generate_weekly_plan(profile_data)
            weekly_plans["current"] = new_plan
            
            return {
                "weekly_plan": new_plan,
                "message": "New meal plan generated!",
                "is_fresh": True,
                "user_profile": {
                    "weight_kg": profile_data.get("weight_kg"),
                    "height_cm": profile_data.get("height_cm"),
                    "diet_type": profile_data.get("diet_type")
                }
            }
        else:
            return {
                "weekly_plan": current_plan,
                "message": "Using existing meal plan",
                "is_fresh": False,
                "user_profile": {
                    "weight_kg": profile_data.get("weight_kg"),
                    "height_cm": profile_data.get("height_cm"),
                    "diet_type": profile_data.get("diet_type")
                }
            }
            
    except Exception as e:
        return {"error": f"Error generating meal plan: {str(e)}"}

async def get_demo_user_profile():
    """Get demo user profile data - in production this would use authenticated user"""
    try:
        # Try to get actual profile data from database
        from ..deps import get_db
        from ..models import Profile
        
        # For demo purposes, we'll try to get the first available profile
        # In production, this would use the authenticated user's ID
        db = next(get_db())
        profile = db.query(Profile).first()
        
        if profile:
            return {
                "weight_kg": profile.weight_kg or 70,
                "height_cm": profile.height_cm or 170,
                "lifestyle_level": profile.lifestyle_level or "sedentary",
                "motive": profile.motive or "fitness",
                "age": profile.age or 30,
                "gender": profile.gender or "male",
                "diet_type": profile.diet_type or "vegetarian",
                "health_diseases": profile.health_diseases or "",
                "food_allergies": profile.food_allergies or ""
            }
        else:
            # Fallback to demo data if no profile found
            return {
                "weight_kg": 70,
                "height_cm": 170,
                "lifestyle_level": "sedentary",
                "motive": "fitness",
                "age": 30,
                "gender": "male",
                "diet_type": "vegetarian",
                "health_diseases": "",
                "food_allergies": ""
            }
    except Exception as e:
        # Fallback to demo data if database access fails
        return {
            "weight_kg": 70,
            "height_cm": 170,
            "lifestyle_level": "sedentary",
            "motive": "fitness",
            "age": 30,
            "gender": "male",
            "diet_type": "vegetarian",
            "health_diseases": "",
            "food_allergies": ""
        }

@router.get("/daily/{day}")
async def get_public_daily_meal_plan(day: str):
    """Public endpoint for daily meal plan (no auth required)"""
    try:
        # Get weekly plan first
        weekly_response = await get_public_weekly_meal_plan(False)
        if "error" in weekly_response:
            return weekly_response
            
        weekly_plan = weekly_response["weekly_plan"]
        
        # Return specific day's meals
        if day not in weekly_plan.meals:
            return {"error": f"No meal plan found for {day}"}
        
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
        
    except Exception as e:
        return {"error": f"Error getting daily meal plan: {str(e)}"}

@router.post("/trigger-update")
async def trigger_public_plan_update(reason: str = "Manual update requested"):
    """Public endpoint for triggering plan update (no auth required)"""
    try:
        # Force refresh the plan
        weekly_response = await get_public_weekly_meal_plan(True)
        
        if "error" in weekly_response:
            return weekly_response
        
        from datetime import datetime
        return {
            "message": f"Meal plan updated successfully! Reason: {reason}",
            "weekly_plan": weekly_response["weekly_plan"],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": f"Error updating meal plan: {str(e)}"}

@router.get("/update-triggers")
async def get_public_update_triggers():
    """Public endpoint for update triggers (no auth required)"""
    return health_triggers

@router.put("/update-triggers")
async def update_public_triggers(triggers):
    """Public endpoint for updating triggers (no auth required)"""
    try:
        global health_triggers
        health_triggers = triggers
        return {
            "message": "Update triggers updated successfully",
            "new_triggers": health_triggers
        }
    except Exception as e:
        return {"error": f"Error updating triggers: {str(e)}"}

@router.get("/nutrition-summary")
async def get_public_nutrition_summary():
    """Public endpoint for nutrition summary (no auth required)"""
    try:
        # Get weekly plan first
        weekly_response = await get_public_weekly_meal_plan(False)
        if "error" in weekly_response:
            return weekly_response
            
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
        return {"error": f"Error getting nutrition summary: {str(e)}"}

@router.get("/shopping-list")
async def generate_public_shopping_list():
    """Public endpoint for shopping list (no auth required)"""
    try:
        # Get weekly plan first
        weekly_response = await get_public_weekly_meal_plan(False)
        if "error" in weekly_response:
            return weekly_response
            
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
        
        from datetime import datetime
        return {
            "shopping_list": shopping_list,
            "total_items": len(shopping_list),
            "week_start": weekly_plan.week_start,
            "week_end": weekly_plan.week_end,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": f"Error generating shopping list: {str(e)}"}
