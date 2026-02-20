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

router = APIRouter()

# Pydantic models for meal planning
class MealItem(BaseModel):
    name: str
    calories: int
    protein: float
    carbs: float
    fats: float
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

def should_update_plan(profile: Profile, latest_report: Optional[Report] = None) -> tuple[bool, str]:
    """Determine if meal plan should be updated based on health changes"""
    
    reasons = []
    
    # Check weight change
    if profile.weight_kg:
        current_plan = weekly_plans.get("current")
        if current_plan and abs(profile.weight_kg - current_plan.based_on_weight) >= health_triggers.weight_change_threshold:
            reasons.append(f"Weight changed by {abs(profile.weight_kg - current_plan.based_on_weight):.1f}kg")
    
    # Check BMI category change
    if profile.height_cm and profile.weight_kg:
        current_bmi = logic.compute_bmi(profile.height_cm, profile.weight_kg)
        current_category = calculate_bmi_category(current_bmi)
        
        current_plan = weekly_plans.get("current")
        if current_plan:
            previous_bmi = logic.compute_bmi(profile.height_cm, current_plan.based_on_weight)
            previous_category = calculate_bmi_category(previous_bmi)
            
            if current_category != previous_category:
                reasons.append(f"BMI category changed from {previous_category} to {current_category}")
    
    # Check new health report
    if latest_report and health_triggers.new_health_condition:
        current_plan = weekly_plans.get("current")
        if current_plan:
            if latest_report.uploaded_at > current_plan.last_updated:
                reasons.append("New health report uploaded")
    
    should_update = len(reasons) > 0
    return should_update, "; ".join(reasons) if reasons else ""

def generate_meal_item(food_name: str, food_data: Dict) -> MealItem:
    """Generate a meal item from food data"""
    return MealItem(
        name=food_name,
        calories=int(food_data.get('calories', 0)),
        protein=float(food_data.get('protein', 0)),
        carbs=float(food_data.get('carbs', 0)),
        fats=float(food_data.get('fat', 0)),
        preparation_time=15,  # Default prep time
        difficulty="easy"
    )

def generate_daily_meals(target_calories: int, target_protein: float, 
                        diet_type: str, diseases: List[str], allergies: List[str], 
                        day_index: int = 0, personalized_recommendations: List = None) -> DailyMealPlan:
    """Generate meals for a single day using personalized nutrition recommendations"""
    
    try:
        # Get personalized food recommendations from the existing nutrition system
        user_data = {
            "height_cm": 170,
            "weight_kg": 70,
            "motive": "fitness",
            "diet_type": diet_type,
            "diseases": ", ".join(diseases) if diseases else "",
            "allergies": ", ".join(allergies) if allergies else "",
            "level": "beginner",
            "lifestyle_level": "sedentary",
            "target_area": "",
            "breakfast": "",
            "lunch": "",
            "snacks": "",
            "dinner": "",
            "age": 30,
            "gender": "male"
        }
        
        # Generate recommendations using the existing logic
        recommendations = logic.generate_recommendations(user_data)
        diet_recommendations = recommendations.get("diet", [])
        
        # If personalized recommendations are provided, use them
        if personalized_recommendations:
            diet_recommendations = personalized_recommendations
        
        # Create meal categories from recommendations
        breakfast_foods = []
        lunch_foods = []
        snack_foods = []
        dinner_foods = []
        
        # Distribute personalized recommendations across meal types based on day
        for i, meal in enumerate(diet_recommendations):
            meal_item = MealItem(
                name=meal.get("food_name", "Unknown Food"),
                calories=int(meal.get("calories", 0)),
                protein=float(meal.get("protein_g", 0)),
                carbs=float(meal.get("carbs_g", 0)),
                fats=float(meal.get("fat_g", 0)),
                preparation_time=20,
                difficulty="medium"
            )
            
            # Distribute recommendations across days and meal types
            # Use day_index and meal index to create variety
            meal_distribution = (day_index + i) % 4
            
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
                        carbs=food['carbs'], fats=food['fat'], preparation_time=20, difficulty="medium"
                    ))
            
            if len(lunch_foods) < 2:
                for food in indian_supplements['lunch'][:2-len(lunch_foods)]:
                    lunch_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'], preparation_time=25, difficulty="medium"
                    ))
            
            if len(snack_foods) < 1:
                for food in indian_supplements['snacks'][:1-len(snack_foods)]:
                    snack_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'], preparation_time=10, difficulty="easy"
                    ))
            
            if len(dinner_foods) < 2:
                for food in indian_supplements['dinner'][:2-len(dinner_foods)]:
                    dinner_foods.append(MealItem(
                        name=food['name'], calories=food['calories'], protein=food['protein'],
                        carbs=food['carbs'], fats=food['fat'], preparation_time=30, difficulty="medium"
                    ))
        
        # If no recommendations available, use diverse Indian foods with variety
        if not diet_recommendations:
            indian_foods = get_indian_food_variety(day_index, diet_type)
            
            for food in indian_foods['breakfast']:
                breakfast_foods.append(MealItem(
                    name=food['name'], calories=food['calories'], protein=food['protein'],
                    carbs=food['carbs'], fats=food['fat'], preparation_time=20, difficulty="medium"
                ))
            
            for food in indian_foods['lunch']:
                lunch_foods.append(MealItem(
                    name=food['name'], calories=food['calories'], protein=food['protein'],
                    carbs=food['carbs'], fats=food['fat'], preparation_time=25, difficulty="medium"
                ))
            
            for food in indian_foods['snacks']:
                snack_foods.append(MealItem(
                    name=food['name'], calories=food['calories'], protein=food['protein'],
                    carbs=food['carbs'], fats=food['fat'], preparation_time=10, difficulty="easy"
                ))
            
            for food in indian_foods['dinner']:
                dinner_foods.append(MealItem(
                    name=food['name'], calories=food['calories'], protein=food['protein'],
                    carbs=food['carbs'], fats=food['fat'], preparation_time=30, difficulty="medium"
                ))
        
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
        
        # Ensure we have at least some items in each category
        if not breakfast_foods:
            breakfast_foods = [MealItem(name="Oatmeal", calories=150, protein=5, carbs=27, fats=3, preparation_time=15, difficulty="easy")]
        if not lunch_foods:
            lunch_foods = [MealItem(name="Rice and Dal", calories=300, protein=8, carbs=50, fats=6, preparation_time=25, difficulty="medium")]
        if not snack_foods:
            snack_foods = [MealItem(name="Fruit", calories=60, protein=1, carbs=15, fats=0, preparation_time=5, difficulty="easy")]
        if not dinner_foods:
            dinner_foods = [MealItem(name="Vegetable Curry", calories=250, protein=6, carbs=35, fats=10, preparation_time=30, difficulty="medium")]
        
    except Exception as e:
        # Fallback to basic meals if anything fails
        breakfast_foods = [MealItem(name="Oatmeal", calories=150, protein=5, carbs=27, fats=3, preparation_time=15, difficulty="easy")]
        lunch_foods = [MealItem(name="Rice and Dal", calories=300, protein=8, carbs=50, fats=6, preparation_time=25, difficulty="medium")]
        snack_foods = [MealItem(name="Fruit", calories=60, protein=1, carbs=15, fats=0, preparation_time=5, difficulty="easy")]
        dinner_foods = [MealItem(name="Vegetable Curry", calories=250, protein=6, carbs=35, fats=10, preparation_time=30, difficulty="medium")]
    
    # Calculate totals
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
    supplements = {
        'breakfast': [
            {'name': 'Fresh Fruit', 'calories': 60, 'protein': 1, 'carbs': 15, 'fat': 0},
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

def generate_weekly_plan(profile_data: Dict, latest_report: Optional[Dict] = None) -> WeeklyMealPlan:
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
    
    # Process diseases and allergies
    diseases_list = [d.strip() for d in health_diseases.split(",") if d.strip()] if health_diseases else []
    allergies_list = [a.strip() for a in food_allergies.split(",") if a.strip()] if food_allergies else []
    
    # Get personalized recommendations from the nutrition system
    user_data = {
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "motive": motive,
        "diet_type": diet_type,
        "diseases": health_diseases,
        "allergies": food_allergies,
        "level": "beginner",
        "lifestyle_level": lifestyle_level,
        "target_area": "",
        "breakfast": "",
        "lunch": "",
        "snacks": "",
        "dinner": "",
        "age": age or 30,
        "gender": gender or "male"
    }
    
    # Generate personalized recommendations
    recommendations = logic.generate_recommendations(user_data)
    personalized_recommendations = recommendations.get("diet", [])
    
    # Calculate daily calorie and protein targets
    daily_calories = logic.daily_calorie_target(weight_kg, height_cm, lifestyle_level, motive, age, gender)
    daily_protein = logic.daily_protein_target(weight_kg, motive, lifestyle_level, age)
    
    # Create meals for each day of the week
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    meals = {}
    
    for day in days:
        # Vary calories slightly throughout the week for variety
        day_multiplier = 1.0 + (0.1 * (days.index(day) % 3 - 1))  # -10%, 0%, +10% variation
        day_calories = int(daily_calories * day_multiplier)
        day_protein = daily_protein * day_multiplier
        
        # Generate daily meals with personalized recommendations
        daily_plan = generate_daily_meals(
            day_calories, 
            day_protein, 
            diet_type,
            diseases_list, 
            allergies_list,
            days.index(day),  # Pass day index for variety
            personalized_recommendations  # Pass personalized recommendations
        )
        daily_plan.day = day
        meals[day] = daily_plan
    
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
                "food_allergies": ""
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
                "food_allergies": profile.food_allergies or ""
            }
            latest_report = db.query(Report).filter(Report.user_id == user.id).order_by(Report.uploaded_at.desc()).first()
        
        # Check if plan needs updating
        current_plan = weekly_plans.get("current")
        
        # For demo purposes, always generate fresh plan
        should_update = force_refresh or not current_plan
        
        if should_update:
            # Generate new plan
            new_plan = generate_weekly_plan(profile_data, 
                {"uploaded_at": latest_report.uploaded_at.isoformat()} if latest_report else None)
            weekly_plans["current"] = new_plan
            
            return {
                "weekly_plan": new_plan,
                "message": "New meal plan generated!",
                "is_fresh": True
            }
        else:
            return {
                "weekly_plan": current_plan,
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
