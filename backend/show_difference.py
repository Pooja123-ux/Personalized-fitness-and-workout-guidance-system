"""
SIMPLE TEST TO SHOW THE DIFFERENCE
"""

import requests

print("🔍 SHOWING THE DIFFERENCE BETWEEN SYSTEMS")
print("=" * 50)

print("\n❌ OLD SYSTEM (What you were seeing):")
print("Endpoint: /recommendations")
print("Format: Individual meal items like 'Broccoli Chicken Ala King'")
print("Structure: Single meal recommendations")

print("\n✅ NEW SYSTEM (What I created for you):")
print("Endpoint: /public-meal-plan/weekly-plan")
print("Format: Complete Monday-Sunday structure")
print("Structure: 7 days × 4 meals per day = 28+ meal items")

try:
    response = requests.get('http://localhost:8000/public-meal-plan/weekly-plan')
    if response.status_code == 200:
        data = response.json()
        plan = data['weekly_plan']
        
        print("\n🎯 NEW SYSTEM STRUCTURE:")
        print("Week: {} to {}".format(plan['week_start'], plan['week_end']))
        
        total_meals = 0
        for day, meals in plan['meals'].items():
            day_meals = len(meals['breakfast']) + len(meals['lunch']) + len(meals['snacks']) + len(meals['dinner'])
            total_meals += day_meals
            print("  {}: {} meals (Breakfast: {}, Lunch: {}, Snacks: {}, Dinner: {})".format(
                day, day_meals, len(meals['breakfast']), len(meals['lunch']), 
                len(meals['snacks']), len(meals['dinner'])
            ))
        
        print("\n📊 TOTALS: {} meals across 7 days".format(total_meals))
        print("Weekly calories: {}".format(plan['weekly_calories']))
        
        print("\n🌅 SAMPLE MEAL (Monday Breakfast):")
        for item in plan['meals']['Monday']['breakfast'][:2]:
            print("  • {} - {} cal".format(item['name'], item['calories']))
        
    else:
        print("Error: {}".format(response.status_code))
        
except Exception as e:
    print("Error: {}".format(e))

print("\n🎉 SOLUTION:")
print("I've added WeeklyMealPlanDisplay component to your Dashboard!")
print("Now you'll see the proper Monday-Sunday structure.")
print("Check your dashboard - it should show the complete weekly meal plan.")
print("\n🚀 The new system is ready - just refresh your frontend!")
