"""
Debug script to test different endpoints
"""

import requests

def test_all_endpoints():
    base_url = "http://localhost:8000"
    question = "calories in eggs"
    
    print("🔍 Testing All Chat Endpoints")
    print("=" * 50)
    print(f"Question: {question}")
    print()
    
    # Test 1: Public JSON endpoint
    print("1. POST /chat/public-ask (JSON)")
    try:
        response = requests.post(
            f"{base_url}/chat/public-ask",
            json={"question": question},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"📝 Answer: {result['answer'][:100]}...")
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    
    # Test 2: Original authenticated endpoint
    print("2. POST /chat/ask (Form - Requires Auth)")
    try:
        response = requests.post(
            f"{base_url}/chat/ask",
            data={"message": question}
        )
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"📝 Answer: {result['answer'][:100]}...")
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()
    
    # Test 3: Comprehensive authenticated endpoint
    print("3. POST /chat/comprehensive-ask (JSON - Requires Auth)")
    try:
        response = requests.post(
            f"{base_url}/chat/comprehensive-ask",
            json={"question": question},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"📝 Answer: {result['answer'][:100]}...")
        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_all_endpoints()
