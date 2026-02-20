"""
Comprehensive Test of Dynamic Fitness Chatbot
Shows how it can answer ANY question about ANY dataset attribute
"""

from app.chatbot_logic import answer_fitness_question

def test_dynamic_chatbot():
    """Test the dynamic chatbot with various types of questions"""
    
    print("🤖 DYNAMIC FITNESS CHATBOT COMPREHENSIVE TEST")
    print("=" * 60)
    
    test_questions = [
        # Exercise queries
        "show me squats",
        "chest exercises", 
        "how many exercises for legs",
        "barbell bench press",
        "exercises with no equipment",
        
        # Nutrition queries
        "highest calorie foods",
        "lowest protein foods", 
        "foods with more than 20g protein",
        "calories in boiled egg",
        "average protein in indian foods",
        
        # Disease/Health queries
        "diabetes recommendations",
        "foods to avoid for hypertension",
        "heart disease foods",
        
        # Yoga queries
        "beginner yoga poses",
        "downward dog pose",
        "how many yoga poses",
        "advanced yoga for flexibility",
        
        # Diet recommendation queries
        "weight loss diet plan",
        "muscle gain nutrition",
        "diet for 30 year old male",
        
        # Complex queries
        "show me exercises for chest that use dumbbells",
        "high protein foods under 300 calories",
        "yoga poses for stress relief",
        "count exercises that target glutes",
        
        # General queries
        "tell me about deadlifts",
        "what are the benefits of yoga",
        "list all equipment types"
    ]
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n📝 Test {i}: {question}")
        print("-" * 50)
        
        try:
            answer = answer_fitness_question(question)
            # Show first 300 characters to keep output manageable
            print(f"🤖 Answer: {answer[:300]}...")
            
            # Check if it's a fallback response
            if "I couldn't find specific information" in answer:
                print("⚠️  Fallback response")
            else:
                print("✅ Successful response")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
        
        print()
    
    print("\n🎉 DYNAMIC CHATBOT TEST COMPLETE!")
    print("=" * 60)

if __name__ == "__main__":
    test_dynamic_chatbot()
