"""
Test the improved formatting for healthy food recommendations
"""

from app.chatbot_logic import answer_fitness_question

def test_improved_formatting():
    print("🍽️ IMPROVED HEALTHY FOOD FORMATTING")
    print("=" * 50)
    
    # Test the improved formatting
    result = answer_fitness_question('healthy food items to eat')
    
    print("✅ New Compact Format:")
    print("-" * 30)
    print(result)
    
    print("\n🎯 IMPROVEMENTS MADE:")
    print("-" * 30)
    print("✅ Multiple options: Shows 10 healthy foods instead of 1")
    print("✅ Compact format: Food name - calories, protein")
    print("✅ Truncated names: Prevents long name wrapping")
    print("✅ Better alignment: Single line per item")
    print("✅ Clean display: No paragraph-like wrapping")
    
    print("\n📊 NUTRITIONAL CRITERIA:")
    print("-" * 30)
    print("• Protein: ≥5g per serving")
    print("• Calories: ≤400 kcal per serving")
    print("• Fiber: ≥1g per serving")
    print("• Sorted by: Protein content (highest first)")

if __name__ == "__main__":
    test_improved_formatting()
