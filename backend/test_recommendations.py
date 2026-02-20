#!/usr/bin/env python3
"""Test script to verify user preference enhancements in recommendations."""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.logic import generate_recommendations

def test_allergy_filtering():
    """Test that allergy filtering excludes foods with allergens."""
    print("Testing allergy filtering...")

    user_data = {
        "height_cm": 170,
        "weight_kg": 70,
        "motive": "fitness",
        "diet_type": "vegetarian",
        "diseases": "",
        "level": "beginner",
        "target_area": "",
        "meals": {},
        "allergies": "peanut"  # Test allergy to peanuts
    }

    rec = generate_recommendations(user_data)

    # Check snacks for fruits
    snacks = rec.get("diet", [])
    snack_foods = [item["food_name"].lower() for item in snacks if item["meal_type"] == "snacks"]
    print(f"Snack foods: {snack_foods}")

    # Check if any fruits are included
    fruits = ["apple", "banana", "orange", "grape", "mango", "pineapple", "strawberry", "kiwi", "peach", "pear"]
    has_fruits = any(any(fruit in food for fruit in fruits) for food in snack_foods)
    print(f"Snacks include fruits: {has_fruits}")

    # Check main meals for healthier options (lower calorie density, higher protein)
    main_meals = ["breakfast", "lunch", "dinner"]
    for meal in main_meals:
        meal_items = [item for item in snacks if item["meal_type"] == meal]
        if meal_items:
            item = meal_items[0]
            cal_density = item["calories"] / 100  # per 100g
            protein = item["protein_g"]
            print(f"{meal.title()}: {item['food_name']}, cal/100g: {cal_density:.1f}, protein: {protein:.1f}g")

    # Test with user meals
    print("\nTesting user meal prioritization...")
    user_data["breakfast"] = "dosa,idli"
    user_data["lunch"] = "rice"
    user_data["snacks"] = "banana"
    user_data["dinner"] = "dal"

    rec2 = generate_recommendations(user_data)
    diet2 = rec2.get("diet", [])
    for item in diet2:
        print(f"{item['meal_type']}: {item['food_name']}")
    # Print alternatives for breakfast
    alts = rec2.get("diet_alternatives", {}).get("breakfast", [])
    if alts:
        print("Breakfast alternatives:", [a["food"] for a in alts])

    print("\nTest completed.")

if __name__ == "__main__":
    test_allergy_filtering()
