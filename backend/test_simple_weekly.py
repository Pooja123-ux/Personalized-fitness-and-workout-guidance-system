import requests
import json

try:
    response = requests.get('http://localhost:8000/public-meal-plan/weekly-plan')
    
    print(f'Status: {response.status_code}')
    if response.status_code == 200:
        plan = response.json()
        print('Weekly meal plan working!')
        
        # Access meals through weekly_plan.meals
        if 'weekly_plan' in plan and 'meals' in plan['weekly_plan']:
            meals = plan['weekly_plan']['meals']
            print(f'Plan has {len(meals)} days')
            
            # Show each day's calories
            total_calories = 0
            for day_name, day_plan in meals.items():
                calories = day_plan.get('total_calories', 0)
                print(f'{day_name}: {calories} kcal')
                total_calories += calories
                
                # Check if calories are reasonable
                if calories < 1200:
                    print(f'  WARNING: Too low calories!')
                elif calories > 2500:
                    print(f'  WARNING: Too high calories!')
                else:
                    print(f'  OK: Reasonable calories')
            
            # Calculate average
            average_calories = total_calories / 7
            print(f'\nAverage daily calories: {average_calories:.0f} kcal')
            
            if 1600 <= average_calories <= 2000:
                print('✅ GOOD: Average calories in reasonable range!')
            else:
                print('⚠️ Average calories may need adjustment')
                
            # Check if our calorie adjustment is working
            variance = max(abs(day_plan.get('total_calories', 0) - average_calories) for day_plan in meals.values())
            print(f'Max daily variance: {variance:.0f} kcal')
            
            if variance <= 200:
                print('✅ EXCELLENT: Daily calories are consistent!')
            else:
                print('⚠️ Daily calories vary significantly')
        
        else:
            print('Invalid response structure')
            print('Available keys:', list(plan.keys()))
        
    else:
        print(f'Error: {response.text}')
        
except Exception as e:
    print(f'Exception: {e}')
    import traceback
    traceback.print_exc()
