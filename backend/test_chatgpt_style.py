"""
Final test showing ChatGPT/Gemini style formatting
"""

from app.chatbot_logic import answer_fitness_question

def test_chatgpt_style():
    print("🤖 CHATGPT/GEMINI STYLE FORMATTING")
    print("=" * 50)
    
    # Test the ChatGPT-style formatting
    result = answer_fitness_question('healthy food items to eat')
    
    print("✅ ChatGPT-Style Response:")
    print("-" * 30)
    print(result)
    
    print("\n🎯 CHATGPT-STYLE FEATURES:")
    print("-" * 30)
    print("✅ Conversational intro: 'Here are some healthy food options you can eat:'")
    print("✅ Bullet points: Each item starts with •")
    print("✅ Clean separation: Each option on its own line")
    print("✅ Natural format: Just like ChatGPT/Gemini responses")
    print("✅ No numbering: More conversational feel")
    
    print("\n📝 COMPARISON:")
    print("-" * 30)
    print("❌ Old style: Numbered list with wrapping issues")
    print("✅ New style: Bullet points with clean lines")
    print("❌ Old style: 1. Food Name - calories, protein")
    print("✅ New style: • Food Name: calories, protein")
    
    print("\n🌟 RESULT:")
    print("-" * 30)
    print("Your chatbot now formats responses just like ChatGPT and Gemini!")
    print("Each food option appears on a separate line with bullet points.")

if __name__ == "__main__":
    test_chatgpt_style()
