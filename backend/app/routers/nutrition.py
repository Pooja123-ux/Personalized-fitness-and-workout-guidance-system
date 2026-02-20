"""
Nutrition Tracking API Routes
Handle macronutrient tracking and daily nutrition data
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
from ..deps import get_current_user

router = APIRouter()

# Pydantic models for nutrition tracking
class MacroData(BaseModel):
    protein: float
    carbs: float
    fats: float

class DailyNutrition(BaseModel):
    date: date
    consumed: MacroData
    target: MacroData
    calories: int
    water_ml: int

class NutritionEntry(BaseModel):
    food_name: str
    quantity: float  # in grams
    macros: MacroData
    calories: int

# In-memory storage for demo (use database in production)
nutrition_data = {}

def calculate_macros_from_calories(calories: int, target_ratio: dict = None) -> MacroData:
    """Calculate target macros based on calories and ratio"""
    if not target_ratio:
        # Default ratio: 30% protein, 45% carbs, 25% fats
        target_ratio = {"protein": 0.30, "carbs": 0.45, "fats": 0.25}
    
    protein_calories = calories * target_ratio["protein"]
    carbs_calories = calories * target_ratio["carbs"]
    fats_calories = calories * target_ratio["fats"]
    
    return MacroData(
        protein=round(protein_calories / 4, 1),  # 4 calories per gram
        carbs=round(carbs_calories / 4, 1),      # 4 calories per gram
        fats=round(fats_calories / 9, 1)         # 9 calories per gram
    )

@router.get("/daily/{target_date}")
async def get_daily_nutrition(
    target_date: date,
    user=Depends(get_current_user)
):
    """Get daily nutrition data for a specific date"""
    try:
        user_id = user.id if hasattr(user, 'id') else "demo_user"
        date_str = target_date.isoformat()
        
        if date_str not in nutrition_data:
            # Generate sample data for demo
            target_calories = 2000  # Default target
            target_macros = calculate_macros_from_calories(target_calories)
            
            # Sample consumed data (60% of target)
            consumed_macros = MacroData(
                protein=round(target_macros.protein * 0.7, 1),
                carbs=round(target_macros.carbs * 0.6, 1),
                fats=round(target_macros.fats * 0.5, 1)
            )
            
            nutrition_data[date_str] = DailyNutrition(
                date=target_date,
                consumed=consumed_macros,
                target=target_macros,
                calories=round(
                    consumed_macros.protein * 4 + 
                    consumed_macros.carbs * 4 + 
                    consumed_macros.fats * 9
                ),
                water_ml=2000
            )
        
        return nutrition_data[date_str]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nutrition data: {str(e)}")

@router.post("/daily/{target_date}")
async def update_daily_nutrition(
    target_date: date,
    nutrition: DailyNutrition,
    user=Depends(get_current_user)
):
    """Update daily nutrition data"""
    try:
        user_id = user.id if hasattr(user, 'id') else "demo_user"
        date_str = target_date.isoformat()
        
        nutrition_data[date_str] = nutrition
        
        return {
            "message": "Nutrition data updated successfully",
            "date": date_str,
            "calories": nutrition.calories,
            "macro_completeness": {
                "protein": min(100, round((nutrition.consumed.protein / nutrition.target.protein) * 100)),
                "carbs": min(100, round((nutrition.consumed.carbs / nutrition.target.carbs) * 100)),
                "fats": min(100, round((nutrition.consumed.fats / nutrition.target.fats) * 100))
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating nutrition data: {str(e)}")

@router.get("/weekly")
async def get_weekly_nutrition(
    user=Depends(get_current_user)
):
    """Get nutrition data for the past week"""
    try:
        user_id = user.id if hasattr(user, 'id') else "demo_user"
        
        # Generate data for the past 7 days
        weekly_data = []
        today = date.today()
        
        for i in range(7):
            target_date = today - datetime.timedelta(days=i)
            date_str = target_date.isoformat()
            
            if date_str not in nutrition_data:
                # Generate sample data
                target_calories = 2000
                target_macros = calculate_macros_from_calories(target_calories)
                
                # Vary the consumption for demo
                consumption_factor = 0.5 + (i * 0.1)  # 50% to 110%
                consumed_macros = MacroData(
                    protein=round(target_macros.protein * consumption_factor, 1),
                    carbs=round(target_macros.carbs * consumption_factor, 1),
                    fats=round(target_macros.fats * consumption_factor, 1)
                )
                
                nutrition_data[date_str] = DailyNutrition(
                    date=target_date,
                    consumed=consumed_macros,
                    target=target_macros,
                    calories=round(
                        consumed_macros.protein * 4 + 
                        consumed_macros.carbs * 4 + 
                        consumed_macros.fats * 9
                    ),
                    water_ml=2000
                )
            
            weekly_data.append(nutrition_data[date_str])
        
        return {
            "weekly_data": weekly_data,
            "averages": {
                "calories": round(sum(d.calories for d in weekly_data) / 7),
                "protein": round(sum(d.consumed.protein for d in weekly_data) / 7, 1),
                "carbs": round(sum(d.consumed.carbs for d in weekly_data) / 7, 1),
                "fats": round(sum(d.consumed.fats for d in weekly_data) / 7, 1)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching weekly nutrition data: {str(e)}")

@router.get("/targets")
async def get_nutrition_targets(
    user=Depends(get_current_user)
):
    """Get nutrition targets based on user profile"""
    try:
        user_id = user.id if hasattr(user, 'id') else "demo_user"
        
        # Default targets - in real app, calculate based on user profile
        target_calories = 2000
        target_macros = calculate_macros_from_calories(target_calories)
        
        return {
            "calories": target_calories,
            "macros": target_macros,
            "water_ml": 2000,
            "recommendations": {
                "protein": "Aim for lean meats, fish, eggs, and legumes",
                "carbs": "Focus on complex carbs like whole grains and vegetables",
                "fats": "Include healthy fats from nuts, avocados, and olive oil"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nutrition targets: {str(e)}")

@router.post("/targets")
async def update_nutrition_targets(
    calories: int,
    protein_ratio: float = 0.30,
    carbs_ratio: float = 0.45,
    fats_ratio: float = 0.25,
    user=Depends(get_current_user)
):
    """Update nutrition targets"""
    try:
        if abs(protein_ratio + carbs_ratio + fats_ratio - 1.0) > 0.01:
            raise HTTPException(status_code=400, detail="Macro ratios must sum to 1.0")
        
        target_macros = calculate_macros_from_calories(
            calories, 
            {"protein": protein_ratio, "carbs": carbs_ratio, "fats": fats_ratio}
        )
        
        return {
            "message": "Nutrition targets updated successfully",
            "calories": calories,
            "macros": target_macros,
            "ratios": {
                "protein": protein_ratio,
                "carbs": carbs_ratio,
                "fats": fats_ratio
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating nutrition targets: {str(e)}")

@router.get("/summary")
async def get_nutrition_summary(
    user=Depends(get_current_user)
):
    """Get overall nutrition summary"""
    try:
        # Get today's data
        today = date.today()
        daily_data = await get_daily_nutrition(today, user)
        
        # Calculate completion percentages
        protein_completion = min(100, round((daily_data.consumed.protein / daily_data.target.protein) * 100))
        carbs_completion = min(100, round((daily_data.consumed.carbs / daily_data.target.carbs) * 100))
        fats_completion = min(100, round((daily_data.consumed.fats / daily_data.target.fats) * 100))
        
        return {
            "date": today.isoformat(),
            "consumed": daily_data.consumed,
            "target": daily_data.target,
            "calories": daily_data.calories,
            "completion_percentages": {
                "protein": protein_completion,
                "carbs": carbs_completion,
                "fats": fats_completion,
                "overall": round((protein_completion + carbs_completion + fats_completion) / 3)
            },
            "remaining": {
                "protein": max(0, daily_data.target.protein - daily_data.consumed.protein),
                "carbs": max(0, daily_data.target.carbs - daily_data.consumed.carbs),
                "fats": max(0, daily_data.target.fats - daily_data.consumed.fats)
            },
            "water_ml": daily_data.water_ml,
            "on_track": protein_completion >= 90 and carbs_completion >= 90 and fats_completion >= 90
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nutrition summary: {str(e)}")
