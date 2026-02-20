"""
Test LLaMA 3 Integration with Dynamic Fitness Chatbot
"""

from app.chatbot_logic import answer_fitness_question, enable_llama_integration, disable_llama_integration

def test_llama_integration():
    print("🤖 TESTING LLAMA 3 INTEGRATION")
    print("=" * 50)
    
    # Test without LLaMA first (dataset-only mode)
    print("\n1. Testing Dataset-Only Mode:")
    print("-" * 30)
    question = "what are the benefits of yoga?"
    response = answer_fitness_question(question, use_llama=False)
    print(f"Question: {question}")
    print(f"Response: {response[:200]}...")
    
    # Test with LLaMA enabled (if available)
    print("\n2. Testing LLaMA 3 Enhanced Mode:")
    print("-" * 30)
    
    # Try to enable LLaMA
    llama_enabled = enable_llama_integration()
    if llama_enabled:
        print("✅ LLaMA 3 connected successfully!")
        response = answer_fitness_question(question, use_llama=True)
        print(f"Question: {question}")
        print(f"Enhanced Response: {response[:300]}...")
    else:
        print("⚠️ LLaMA 3 not available. Make sure Ollama is running with LLaMA 3 model.")
        print("Install instructions:")
        print("1. Install Ollama: https://ollama.ai/")
        print("2. Pull LLaMA 3: ollama pull llama3")
        print("3. Start Ollama server: ollama serve")
    
    # Test different question types
    test_questions = [
        ("calories in boiled egg", "Factual query - should not use LLaMA"),
        ("explain the benefits of squats", "Explanation - should use LLaMA"),
        ("how many exercises for chest", "Count query - should not use LLaMA"),
        ("give me some workout tips for beginners", "Advice - should use LLaMA")
    ]
    
    print("\n3. Testing Different Question Types:")
    print("-" * 40)
    
    for question, description in test_questions:
        print(f"\n{description}")
        print(f"Q: {question}")
        
        # Dataset-only response
        dataset_response = answer_fitness_question(question, use_llama=False)
        print(f"Dataset: {dataset_response[:100]}...")
        
        # LLaMA enhanced response (if available)
        if llama_enabled:
            llama_response = answer_fitness_question(question, use_llama=True)
            print(f"LLaMA: {llama_response[:100]}...")
        else:
            print("LLaMA: Not available")

if __name__ == "__main__":
    test_llama_integration()
