"""
Test the chatbot with actual data from the datasets
"""

import sys
import os

# Add the backend directory to the path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.chatbot_logic import answer_fitness_question

def test_with_actual_data():
    """Test with actual exercise and food names from datasets"""
    
    # Test with actual data
    test_questions = [
        # Exercise questions with actual names
        "Tell me about barbell squat",
        "What is a 3/4 sit-up?",
        "How to do air bike?",
        "Show me band squat",
        "What about archer push up?",
        
        # Food questions with actual names
        "How many calories in Hot tea (Garam Chai)?",
        "Tell me about Instant coffee",
        "Nutrition in Lemonade",
        "What about Fruit Punch?",
        
        # Disease questions with actual diseases
        "What foods for Diabetes?",
        "Tell me about Hypertension",
        "Foods for Heart Disease",
        
        # General questions
        "chest exercises",
        "abs workout",
        "protein foods"
    ]
    
    print("🏋️ Testing with Actual Dataset Names")
    print("=" * 60)
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n📝 Question {i}: {question}")
        print("-" * 40)
        
        try:
            answer = answer_fitness_question(question)
            print(f"🤖 Answer: {answer[:300]}...")
        except Exception as e:
            print(f"❌ Error: {str(e)}")
        
        print()

if __name__ == "__main__":
    test_with_actual_data()
