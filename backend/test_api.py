"""
Test the comprehensive chatbot API endpoints
"""

import requests
import json

def test_api_endpoints():
    base_url = "http://localhost:8000"
    
    # Test the public capabilities endpoint
    print("🔍 Testing Public Chatbot Capabilities")
    print("=" * 50)
    
    try:
        response = requests.get(f"{base_url}/chat/chatbot-capabilities")
        if response.status_code == 200:
            capabilities = response.json()
            print("✅ Capabilities endpoint working!")
            print(f"📊 Total datasets: {capabilities['total_datasets']}")
            print(f"📋 Available categories: {list(capabilities['capabilities'].keys())}")
        else:
            print(f"❌ Capabilities endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing capabilities: {e}")
    
    print("\n🤖 Testing Public Chat Endpoint (No Auth)")
    print("=" * 50)
    
    # Test questions for the API
    test_questions = [
        "Tell me about barbell squat",
        "How many calories in Hot tea (Garam Chai)?",
        "What foods for Diabetes?",
        "chest exercises",
        "3/4 sit-up"
    ]
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n📝 Test {i}: {question}")
        print("-" * 30)
        
        try:
            response = requests.post(
                f"{base_url}/chat/public-ask",
                json={"question": question},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Success! Category: {result['category']}")
                print(f"🎯 Confidence: {result['confidence']}")
                print(f"💬 Answer: {result['answer'][:200]}...")
            else:
                print(f"❌ Failed: {response.status_code}")
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_api_endpoints()
