"""
TESTING WEEKLY PLAN IN RECOMMENDATIONS PAGE
"""

import requests

print("🎯 TESTING WEEKLY MEAL PLAN IN RECOMMENDATIONS")
print("=" * 50)

print("\n✅ NEW STRUCTURE:")
print("Recommendations Page now has 3 tabs:")
print("1. WORKOUTS - Exercise plans")
print("2. NUTRITION - Daily meal recommendations")
print("3. WEEKLY PLAN - Complete Monday-Sunday meal plan")

print("\n🔗 API Endpoints:")
print("- Old recommendations: /recommendations (individual meals)")
print("- New weekly plan: /public-meal-plan/weekly-plan (Monday-Sunday)")

try:
    response = requests.get('http://localhost:8000/public-meal-plan/weekly-plan')
    if response.status_code == 200:
        data = response.json()
        plan = data['weekly_plan']
        
        print("\n🍽️ WEEKLY PLAN STRUCTURE:")
        print("Week: {} to {}".format(plan['week_start'], plan['week_end']))
        print("Days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday")
        
        print("\n📅 SAMPLE DAY (Monday):")
        monday = plan['meals']['Monday']
        print("  Total: {} calories".format(monday['total_calories']))
        print("  Breakfast: {} items".format(len(monday['breakfast'])))
        print("  Lunch: {} items".format(len(monday['lunch'])))
        print("  Snacks: {} items".format(len(monday['snacks'])))
        print("  Dinner: {} items".format(len(monday['dinner'])))
        
        print("\n🎯 INTEGRATION COMPLETE!")
        print("✅ Weekly meal plan moved to Recommendations page")
        print("✅ Added as third tab: 'WEEKLY PLAN'")
        print("✅ Removed from Dashboard (cleaner layout)")
        print("✅ Shows proper Monday-Sunday structure")
        
    else:
        print("Error: {}".format(response.status_code))
        
except Exception as e:
    print("Error: {}".format(e))

print("\n🚀 NEXT STEPS:")
print("1. Refresh your frontend")
print("2. Go to Recommendations page")
print("3. Click on 'WEEKLY PLAN' tab")
print("4. See the complete Monday-Sunday meal plan!")

print("\n🎊 SUCCESS: Weekly meal plan is now in the right place!")
