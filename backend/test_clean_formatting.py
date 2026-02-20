"""
Simple test to verify chatbot formatting fix
"""

import requests

def test_clean_formatting():
    try:
        response = requests.post('http://localhost:8000/conversational/chat/conversation', 
                               json={
                                   'message': 'How can I lose weight effectively?',
                                   'user_id': 'test_user',
                                   'session_id': None
                               })
        
        if response.status_code == 200:
            data = response.json()
            answer = data['answer']
            
            print('✅ CHATBOT RESPONSE:')
            print('=' * 50)
            print(answer)
            print('=' * 50)
            
            # Check if ** formatting is removed
            has_bold_formatting = '**' in answer
            has_emojis = any(emoji in answer for emoji in ['🏃', '🥗', '💪', '⏰'])
            
            print(f'Bold formatting (**): {"❌ Still Present" if has_bold_formatting else "✅ Removed"}')
            print(f'Emojis: {"❌ Still Present" if has_emojis else "✅ Removed"}')
            
            if not has_bold_formatting and not has_emojis:
                print('🎉 SUCCESS: Chatbot responses are now clean!')
            else:
                print('⚠️ Some formatting still needs to be removed')
                
        else:
            print(f'❌ Error: {response.status_code}')
            
    except Exception as e:
        print(f'❌ Exception: {e}')

if __name__ == "__main__":
    test_clean_formatting()
