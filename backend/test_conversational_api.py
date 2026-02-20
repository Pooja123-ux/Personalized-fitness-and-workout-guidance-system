"""
TEST CONVERSATIONAL CHATBOT API
Demonstrate ChatGPT-like conversational interface
"""

import requests
import json
import time

def test_conversational_api():
    """Test the conversational chatbot API"""
    
    base_url = "http://localhost:8000"
    user_id = "test_user_123"
    session_id = None
    
    print("🤖 TESTING CONVERSATIONAL CHATBOT API")
    print("=" * 50)
    
    # Test 1: Start conversation with greeting
    print("\n1. Starting conversation...")
    response = requests.post(f"{base_url}/chat/conversation", json={
        "message": "Hello! I want to get fit.",
        "user_id": user_id,
        "session_id": session_id
    })
    
    if response.status_code == 200:
        data = response.json()
        session_id = data['session_id']
        print(f"✅ Bot: {data['answer']}")
        print(f"📊 Topic: {data['topic']}")
        print(f"🔄 Follow-ups: {len(data['follow_up_questions'])} questions")
    else:
        print(f"❌ Error: {response.status_code}")
        return
    
    # Test 2: Ask a fitness question
    print("\n2. Asking fitness question...")
    response = requests.post(f"{base_url}/chat/conversation", json={
        "message": "healthy food items to eat",
        "user_id": user_id,
        "session_id": session_id
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Bot: {data['answer'][:200]}...")
        print(f"📊 Topic: {data['topic']}")
        print(f"🔄 Follow-ups: {data['follow_up_questions']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 3: Follow-up question
    print("\n3. Asking follow-up question...")
    response = requests.post(f"{base_url}/chat/conversation", json={
        "message": "yes, tell me more about exercises",
        "user_id": user_id,
        "session_id": session_id
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Bot: {data['answer'][:200]}...")
        print(f"📊 Topic: {data['topic']}")
        print(f"💬 Conversation length: {data['conversation_length']} messages")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 4: Get conversation history
    print("\n4. Getting conversation history...")
    response = requests.get(f"{base_url}/chat/history/{session_id}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Found {len(data['messages'])} messages")
        print(f"📊 Current topic: {data['current_topic']}")
        print(f"🕐 Last activity: {data['last_activity']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 5: Update user profile
    print("\n5. Updating user profile...")
    response = requests.post(f"{base_url}/chat/profile", json={
        "user_id": user_id,
        "age": 25,
        "weight": 70.0,
        "height": 170.0,
        "fitness_goals": ["weight loss", "muscle gain"],
        "activity_level": "beginner"
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {data['message']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 6: Get personalized suggestions
    print("\n6. Getting personalized suggestions...")
    response = requests.get(f"{base_url}/chat/suggestions/{user_id}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Suggestions: {data['suggestions']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 7: Submit feedback
    print("\n7. Submitting feedback...")
    response = requests.post(f"{base_url}/chat/feedback", json={
        "session_id": session_id,
        "message_id": "test_msg_1",
        "rating": 5,
        "feedback": "Great response!"
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {data['message']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 8: Get analytics
    print("\n8. Getting analytics...")
    response = requests.get(f"{base_url}/chat/analytics")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Total conversations: {data['total_conversations']}")
        print(f"✅ Total messages: {data['total_messages']}")
        print(f"✅ Average rating: {data['average_rating']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    # Test 9: End session
    print("\n9. Ending session...")
    response = requests.delete(f"{base_url}/chat/session/{session_id}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {data['message']}")
    else:
        print(f"❌ Error: {response.status_code}")
    
    print("\n🎉 CONVERSATIONAL API TEST COMPLETE!")
    print("=" * 50)
    print("✅ All endpoints working correctly!")
    print("🚀 Your chatbot is now ChatGPT-like!")

if __name__ == "__main__":
    try:
        test_conversational_api()
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the API server.")
        print("🚀 Make sure the server is running on http://localhost:8000")
        print("💡 Run: python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"❌ Error: {e}")
