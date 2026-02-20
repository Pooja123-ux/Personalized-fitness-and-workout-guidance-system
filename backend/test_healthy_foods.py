"""
Test the improved healthy food suggestions
"""

import sys
import os

# Add the backend directory to the path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.chatbot_logic import answer_fitness_question

def test_healthy_food_suggestions():
    """Test various healthy food suggestion queries"""
    
    test_questions = [
        "suggest healthy foods",
        "recommend high protein foods",
        "suggest low calorie foods",
        "what are high fiber foods",
        "foods with vitamin c",
        "healthy Indian foods",
        "nutritious foods"
    ]
    
    print("🥗 Testing Healthy Food Suggestions")
    print("=" * 50)
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n📝 Question {i}: {question}")
        print("-" * 40)
        
        try:
            answer = answer_fitness_question(question)
            print(f"🤖 Answer: {answer[:300]}...")
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_healthy_food_suggestions()
