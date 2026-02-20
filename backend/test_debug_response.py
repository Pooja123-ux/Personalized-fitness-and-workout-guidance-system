"""Debug response structure"""
import sys
sys.path.insert(0, r'c:\Fitness\backend')

from app.logic import generate_recommendations

user_data = {
    "name": "Raj",
    "age": 30,
    "gender": "Male",
    "weight": 80,
    "height": 180,
    "vegetarian": False,
    "diseases": [],
    "allergies": [],
    "motive": "weight loss",
    "activity_level": "moderate",
    "user_preferences": {
        "breakfast_type": ["eggs"],
        "lunch_type": ["chicken"],
        "snack_type": ["salad"],
        "dinner_type": ["chicken"]
    },
    "consume": [],
    "avoid": []
}

recommendations = generate_recommendations(user_data)
print("Response structure:")
print(recommendations.keys())
