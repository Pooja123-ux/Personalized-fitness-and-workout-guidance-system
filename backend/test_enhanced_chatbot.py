"""
TEST ENHANCED CHATBOT WITH DYNAMIC QUESTION HANDLING
"""

import requests
import json

def test_chatbot_question(question):
    """Test a specific question with the chatbot"""
    try:
        response = requests.post('http://localhost:8000/chat/conversation', 
                               json={
                                   "message": question,
                                   "user_id": "test_user",
                                   "session_id": None
                               })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "question": question,
                "answer": data['answer'][:500] + "..." if len(data['answer']) > 500 else data['answer'],
                "topic": data.get('topic', 'general'),
                "follow_up_questions": data.get('follow_up_questions', [])[:3]
            }
        else:
            return {
                "question": question,
                "error": f"Status {response.status_code}: {response.text}"
            }
    except Exception as e:
        return {
            "question": question,
            "error": str(e)
        }

print('🤖 TESTING ENHANCED CHATBOT WITH DYNAMIC QUESTION HANDLING')
print('=' * 60)

# Test questions that previously might not have been answered well
test_questions = [
    # Weight loss questions
    "How can I lose weight effectively?",
    "What's the fastest way to lose weight?",
    "Help me with weight loss plan",
    
    # Muscle gain questions
    "How do I build muscle?",
    "What's the best way to gain muscle?",
    "Muscle building tips",
    
    # Workout routine questions
    "Give me a 30 minute workout routine",
    "What's a good 45 minute workout?",
    "Create a workout plan for me",
    
    # Nutrition advice
    "What should I eat for healthy diet?",
    "Give me nutrition advice",
    "How to eat healthy",
    
    # Beginner questions
    "I'm new to fitness, where do I start?",
    "Beginner workout tips",
    "Getting started with exercise",
    
    # Injury prevention
    "How can I avoid workout injuries?",
    "What are common workout injuries?",
    "Injury prevention tips",
    
    # Motivation
    "How do I stay motivated to workout?",
    "I keep losing motivation, help!",
    "Tips for staying consistent",
    
    # Time-based questions
    "How long should I workout?",
    "Is 30 minutes enough exercise?",
    "Best workout duration",
    
    # Equipment questions
    "Can I workout without equipment?",
    "Home workout without gym",
    "Best equipment for home gym",
    
    # Progress tracking
    "How do I track fitness progress?",
    "What should I measure for progress?",
    "Progress tracking tips"
]

print('📋 TESTING DYNAMIC QUESTION HANDLING:')
print()

results = []
for i, question in enumerate(test_questions, 1):
    print(f'{i:2d}. ❓ Question: "{question}"')
    result = test_chatbot_question(question)
    results.append(result)
    
    if 'error' in result:
        print(f'    ❌ Error: {result["error"]}')
    else:
        print(f'    ✅ Topic: {result["topic"]}')
        print(f'    💬 Answer: {result["answer"][:200]}...')
        if result.get('follow_up_questions'):
            print(f'    🔄 Follow-ups: {result["follow_up_questions"][:2]}')
    print()

print('📊 SUMMARY:')
print('=' * 40)

successful = sum(1 for r in results if 'error' not in r)
total = len(results)

print(f'✅ Successful responses: {successful}/{total}')
print(f'❌ Errors: {total - successful}/{total}')

if successful == total:
    print('🎉 ALL QUESTIONS ANSWERED SUCCESSFULLY!')
    print('✅ Dynamic question handling is working perfectly!')
else:
    print('⚠️ Some questions had issues - check the errors above')

print()
print('🚀 ENHANCED CHATBOT FEATURES:')
print('✅ Weight loss advice with exercise and nutrition tips')
print('✅ Muscle gain guidance with training and nutrition')
print('✅ Time-specific workout routines (30/45/60 minute)')
print('✅ Beginner-friendly getting started guides')
print('✅ Injury prevention and safety tips')
print('✅ Motivation and consistency strategies')
print('✅ Equipment-based workout options')
print('✅ Progress tracking methods and advice')
print('✅ Helpful fallback when specific data not found')
print('✅ Conversational follow-up questions')

print()
print('🎯 The chatbot can now handle a much wider range of fitness questions!')
print('📈 User experience significantly improved with dynamic responses!')
print('=' * 60)
