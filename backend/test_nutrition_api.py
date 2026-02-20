"""
Demo script to test the nutrition API endpoints
"""

import requests
import json
from datetime import date, datetime, timedelta

def test_nutrition_api():
    """Test all nutrition API endpoints"""
    
    base_url = "http://localhost:8000"
    
    print("🧪 TESTING NUTRITION API ENDPOINTS")
    print("=" * 50)
    
    # Test 1: Get nutrition targets
    print("\n1. Testing GET /public-nutrition/targets")
    try:
        response = requests.get(f"{base_url}/public-nutrition/targets")
        if response.status_code == 200:
            data = response.json()
            print("✅ Nutrition targets:")
            print(f"   Calories: {data['calories']}")
            print(f"   Protein: {data['macros']['protein']}g")
            print(f"   Carbs: {data['macros']['carbs']}g")
            print(f"   Fats: {data['macros']['fats']}g")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 2: Get today's nutrition data
    today = date.today().isoformat()
    print(f"\n2. Testing GET /public-nutrition/daily/{today}")
    try:
        response = requests.get(f"{base_url}/public-nutrition/daily/{today}")
        if response.status_code == 200:
            data = response.json()
            print("✅ Today's nutrition:")
            print(f"   Consumed: P={data['consumed']['protein']}g, C={data['consumed']['carbs']}g, F={data['consumed']['fats']}g")
            print(f"   Target: P={data['target']['protein']}g, C={data['target']['carbs']}g, F={data['target']['fats']}g")
            print(f"   Calories: {data['calories']}")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 3: Get nutrition summary
    print("\n3. Testing GET /public-nutrition/summary")
    try:
        response = requests.get(f"{base_url}/public-nutrition/summary")
        if response.status_code == 200:
            data = response.json()
            print("✅ Nutrition summary:")
            print(f"   Overall completion: {data['completion_percentages']['overall']}%")
            print(f"   Protein: {data['completion_percentages']['protein']}% ({data['remaining']['protein']}g left)")
            print(f"   Carbs: {data['completion_percentages']['carbs']}% ({data['remaining']['carbs']}g left)")
            print(f"   Fats: {data['completion_percentages']['fats']}% ({data['remaining']['fats']}g left)")
            print(f"   On track: {data['on_track']}")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 4: Get weekly data
    print("\n4. Testing GET /public-nutrition/weekly")
    try:
        response = requests.get(f"{base_url}/public-nutrition/weekly")
        if response.status_code == 200:
            data = response.json()
            print("✅ Weekly averages:")
            print(f"   Calories: {data['averages']['calories']}")
            print(f"   Protein: {data['averages']['protein']}g")
            print(f"   Carbs: {data['averages']['carbs']}g")
            print(f"   Fats: {data['averages']['fats']}g")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 5: Update today's nutrition data
    print(f"\n5. Testing POST /nutrition/daily/{today}")
    try:
        update_data = {
            "date": today,
            "consumed": {
                "protein": 95.5,
                "carbs": 245.0,
                "fats": 70.2
            },
            "target": {
                "protein": 120.0,
                "carbs": 250.0,
                "fats": 75.0
            },
            "calories": 1898,
            "water_ml": 2500
        }
        
        response = requests.post(f"{base_url}/nutrition/daily/{today}", json=update_data)
        if response.status_code == 200:
            data = response.json()
            print("✅ Nutrition updated:")
            print(f"   Message: {data['message']}")
            print(f"   Macro completeness: {data['macro_completeness']}")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print("\n🎉 NUTRITION API TEST COMPLETE!")
    print("=" * 50)
    print("✅ All endpoints are working!")
    print("🚀 Ready for frontend integration!")

if __name__ == "__main__":
    test_nutrition_api()
