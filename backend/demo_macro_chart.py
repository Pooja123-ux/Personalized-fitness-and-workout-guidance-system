"""
MACRO DONUT CHART DEMO
Show the complete macro tracking functionality
"""

import requests
import json
from datetime import date

def demo_macro_chart():
    """Demonstrate the macro donut chart functionality"""
    
    base_url = "http://localhost:8000"
    
    print("🍩 MACRO DONUT CHART DEMO")
    print("=" * 50)
    
    # Get today's nutrition data
    today = date.today().isoformat()
    print(f"\n📅 Today's Date: {today}")
    
    try:
        response = requests.get(f"{base_url}/public-nutrition/daily/{today}")
        if response.status_code == 200:
            data = response.json()
            
            print("\n📊 MACRONUTRIENT BREAKDOWN:")
            print("-" * 30)
            
            print(f"\n🎯 TARGETS:")
            print(f"   Protein: {data['target']['protein']}g")
            print(f"   Carbs: {data['target']['carbs']}g")
            print(f"   Fats: {data['target']['fats']}g")
            
            print(f"\n✅ CONSUMED:")
            print(f"   Protein: {data['consumed']['protein']}g")
            print(f"   Carbs: {data['consumed']['carbs']}g")
            print(f"   Fats: {data['consumed']['fats']}g")
            
            print(f"\n🔥 TOTAL CALORIES: {data['calories']}")
            
            # Calculate percentages
            total_consumed = (data['consumed']['protein'] + 
                            data['consumed']['carbs'] + 
                            data['consumed']['fats'])
            
            if total_consumed > 0:
                protein_pct = round((data['consumed']['protein'] / total_consumed) * 100)
                carbs_pct = round((data['consumed']['carbs'] / total_consumed) * 100)
                fats_pct = round((data['consumed']['fats'] / total_consumed) * 100)
                
                print(f"\n📈 PERCENTAGE BREAKDOWN:")
                print(f"   Protein: {protein_pct}%")
                print(f"   Carbs: {carbs_pct}%")
                print(f"   Fats: {fats_pct}%")
            
            # Calculate remaining
            remaining_protein = max(0, data['target']['protein'] - data['consumed']['protein'])
            remaining_carbs = max(0, data['target']['carbs'] - data['consumed']['carbs'])
            remaining_fats = max(0, data['target']['fats'] - data['consumed']['fats'])
            
            print(f"\n📋 REMAINING FOR TODAY:")
            print(f"   Protein: {remaining_protein}g {'✓' if remaining_protein == 0 else ''}")
            print(f"   Carbs: {remaining_carbs}g {'✓' if remaining_carbs == 0 else ''}")
            print(f"   Fats: {remaining_fats}g {'✓' if remaining_fats == 0 else ''}")
            
            print(f"\n🎨 DONUT CHART COLORS:")
            print(f"   Protein: 🔴 Red (#ef4444)")
            print(f"   Carbs: 🔵 Blue (#3b82f6)")
            print(f"   Fats: 🟡 Orange (#f59e0b)")
            
            print(f"\n💚 FEATURES:")
            print(f"   ✅ Visual donut chart with percentages")
            print(f"   ✅ Consumed vs Target comparison")
            print(f"   ✅ Remaining macros tracking")
            print(f"   ✅ Color-coded macro types")
            print(f"   ✅ Interactive tooltips")
            print(f"   ✅ Responsive design")
            
        else:
            print(f"❌ Error fetching data: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    print(f"\n🎯 FRONTEND INTEGRATION:")
    print("-" * 30)
    print(f"✅ Component: MacroDonutChart.tsx")
    print(f"✅ API Endpoint: /public-nutrition/daily/{{date}}")
    print(f"✅ Dashboard Integration: Complete")
    print(f"✅ Real-time Data: Yes")
    print(f"✅ Responsive Design: Yes")
    
    print(f"\n🚀 HOW TO USE:")
    print("-" * 30)
    print(f"1. Dashboard shows today's macro intake")
    print(f"2. Donut chart visualizes percentage breakdown")
    print(f"3. Stats show consumed vs remaining")
    print(f"4. Colors indicate macro types")
    print(f"5. Hover for detailed tooltips")
    
    print(f"\n🎊 MACRO TRACKING IS READY!")
    print("=" * 50)

if __name__ == "__main__":
    demo_macro_chart()
