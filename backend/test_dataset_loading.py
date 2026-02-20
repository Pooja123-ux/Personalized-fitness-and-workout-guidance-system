"""
Test if datasets are loading properly in the chatbot
"""

import requests

def test_dataset_loading():
    print('🔍 TESTING DATASET LOADING')
    print('=' * 40)
    
    try:
        response = requests.post('http://localhost:8000/conversational/chat/conversation', 
                               json={
                                   'message': 'What exercises do you have?',
                                   'user_id': 'test_user',
                                   'session_id': None
                               })
        
        if response.status_code == 200:
            data = response.json()
            answer = data['answer']
            
            print('✅ CHATBOT RESPONSE:')
            print(answer[:300] + '...' if len(answer) > 300 else answer)
            
            # Check if the error message is gone
            if "Sorry, I'm having trouble loading my knowledge base" in answer:
                print('❌ Still having trouble loading knowledge base')
            else:
                print('✅ Knowledge base loading successfully!')
                
            # Check if we get actual dataset results
            if "Found" in answer and "results" in answer:
                print('✅ Dataset queries working!')
            elif "Available Datasets" in answer:
                print('✅ Dataset listing working!')
            else:
                print('⚠️ Unexpected response format')
                
        else:
            print(f'❌ Error: {response.status_code}')
            print(response.text)
            
    except Exception as e:
        print(f'❌ Exception: {e}')

if __name__ == "__main__":
    test_dataset_loading()
