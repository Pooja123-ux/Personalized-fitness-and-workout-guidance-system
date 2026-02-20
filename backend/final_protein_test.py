"""
Final comprehensive test of the fixed chatbot
"""

import requests

def test_protein_questions():
    """Test all variations of protein food questions"""
    
    base_url = "http://localhost:8000"
    
    test_questions = [
        "protein rich foods",
        "high protein foods", 
        "foods rich in protein",
        "protein foods",
        "suggest protein rich foods",
        "recommend high protein foods"
    ]
    
    print("🥩 Testing Protein Food Questions")
    print("=" * 50)
    
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
                if "High Protein Healthy Foods" in result['answer']:
                    print(f"✅ SUCCESS! Got protein foods list")
                    print(f"📊 Category: {result['category']}")
                    print(f"🎯 Confidence: {result['confidence']}")
                else:
                    print(f"❌ FAILED! Got generic response")
                    print(f"💬 Answer: {result['answer'][:100]}...")
            else:
                print(f"❌ API Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_protein_questions()
