import requests

print('🔍 TESTING ENHANCED CHATBOT:')
print('=' * 40)

# Test the enhanced chatbot with a dynamic question
try:
    response = requests.post('http://localhost:8000/conversational/chat/conversation', 
                           json={
                               'message': 'How can I lose weight effectively?',
                               'user_id': 'test_user',
                               'session_id': None
                           })
    
    print(f'Status Code: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✅ ENHANCED CHATBOT WORKING!')
        print(f'Answer: {data["answer"][:400]}...')
        print(f'Topic: {data.get("topic", "general")}')
        print(f'Follow-up Questions: {len(data.get("follow_up_questions", []))}')
        print(f'Suggestions: {len(data.get("suggestions", []))}')
        
        # Test another question
        print('\n' + '='*40)
        print('TESTING MUSCLE GAIN QUESTION:')
        
        response2 = requests.post('http://localhost:8000/conversational/chat/conversation', 
                                json={
                                    'message': 'Give me a 30 minute workout routine',
                                    'user_id': 'test_user',
                                    'session_id': None
                                })
        
        if response2.status_code == 200:
            data2 = response2.json()
            print('✅ WORKOUT ROUTINE QUESTION WORKING!')
            print(f'Answer: {data2["answer"][:400]}...')
            print(f'Topic: {data2.get("topic", "general")}')
        
    else:
        print(f'❌ Error: {response.text}')
        
except Exception as e:
    print(f'❌ Exception: {e}')

print('\n🎯 TESTING COMPLETE!')
