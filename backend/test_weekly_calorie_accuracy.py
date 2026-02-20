"""
Test weekly meal plan calorie accuracy
"""

import requests

def test_weekly_calorie_accuracy():
    print('🎯 TESTING WEEKLY MEAL PLAN CALORIE ACCURACY')
    print('=' * 50)
    
    # Test with a specific user profile
    test_profile = {
        "weight_kg": 70,
        "height_cm": 170,
        "lifestyle_level": "moderate",
        "motive": "weight_loss",
        "age": 30,
        "gender": "male",
        "diet_type": "vegetarian"
    }
    
    try:
        response = requests.post('http://localhost:8000/meal-plan/weekly', 
                               json=test_profile)
        
        if response.status_code == 200:
            plan = response.json()
            
            # Calculate expected daily calories
            expected_daily = 1800  # Approximate for 70kg person with moderate activity and weight loss goal
            
            print(f'Expected daily calories: {expected_daily}')
            print()
            
            # Check each day
            for day_name, day_plan in plan['meals'].items():
                actual_calories = day_plan['total_calories']
                difference = actual_calories - expected_daily
                accuracy = (actual_calories / expected_daily) * 100
                
                print(f'{day_name}:')
                print(f'  Target: {expected_daily} kcal')
                print(f'  Actual: {actual_calories} kcal')
                print(f'  Difference: {difference:+d} kcal')
                print(f'  Accuracy: {accuracy:.1f}%')
                
                if abs(difference) <= 100:
                    print(f'  Status: ✅ ON TARGET')
                elif abs(difference) <= 200:
                    print(f'  Status: ⚠️ CLOSE TO TARGET')
                else:
                    print(f'  Status: ❌ OFF TARGET')
                print()
            
            # Calculate weekly totals
            weekly_total = sum(day['total_calories'] for day in plan['meals'].values())
            expected_weekly = expected_daily * 7
            weekly_accuracy = (weekly_total / expected_weekly) * 100
            
            print('WEEKLY SUMMARY:')
            print(f'Expected weekly: {expected_weekly} kcal')
            print(f'Actual weekly: {weekly_total} kcal')
            print(f'Weekly accuracy: {weekly_accuracy:.1f}%')
            
            if weekly_accuracy >= 95 and weekly_accuracy <= 105:
                print('✅ WEEKLY PLAN ACCURATE!')
            else:
                print('⚠️ WEEKLY PLAN NEEDS ADJUSTMENT')
                
        else:
            print(f'❌ Error: {response.status_code}')
            print(response.text)
            
    except Exception as e:
        print(f'❌ Exception: {e}')

if __name__ == "__main__":
    test_weekly_calorie_accuracy()
