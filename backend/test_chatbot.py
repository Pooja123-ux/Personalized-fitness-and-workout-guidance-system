"""
Test script for the comprehensive fitness chatbot
"""

import sys
import os

# Add the backend directory to the path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.chatbot_logic import answer_fitness_question

def test_chatbot():
    """Test the chatbot with various questions"""
    
    test_questions = [
        # Exercise questions
        "Tell me about squats",
        "What exercises work the chest?",
        "Show me body weight exercises",
        
        # Nutrition questions
        "How many calories are in chai?",
        "What are high protein Indian foods?",
        "Tell me about the nutrition in dal",
        
        # Diet recommendation questions
        "Give me a diet plan for weight loss",
        "What should a 25-year-old male eat for muscle gain?",
        
        # Disease/Health questions
        "What foods should I eat for diabetes?",
        "Foods to avoid with hypertension",
        
        # Yoga questions
        "Tell me about downward dog pose",
            "What are some beginner yoga poses?",
        "Benefits of warrior pose",
        
        # General questions
        "What is the best exercise for abs?",
        "How can I lose weight?"
    ]
    
    print("🏋️ Comprehensive Fitness Chatbot Test")
    print("=" * 60)
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n📝 Question {i}: {question}")
        print("-" * 40)
        
        try:
            answer = answer_fitness_question(question)
            print(f"🤖 Answer: {answer[:200]}...")  # Show first 200 chars
        except Exception as e:
            print(f"❌ Error: {str(e)}")
        
        print()
    
    print("✅ Test completed!")

if __name__ == "__main__":
    test_chatbot()
