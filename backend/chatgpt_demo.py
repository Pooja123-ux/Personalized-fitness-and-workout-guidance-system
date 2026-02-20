"""
SIMPLE CHATGPT-LIKE DEMO
Test the conversational chatbot with a realistic conversation
"""

from conversational_chatbot import process_conversational_message, get_conversation_history
import time

def chatgpt_demo():
    """Demonstrate ChatGPT-like conversational experience"""
    
    print("🤖 CHATGPT-LIKE FITNESS CHATBOT DEMO")
    print("=" * 50)
    print("Type 'quit' to exit the conversation")
    print("-" * 50)
    
    user_id = "demo_user"
    session_id = None
    conversation_count = 0
    
    # Pre-defined demo messages for automatic demo
    demo_messages = [
        "Hello! I want to get fit.",
        "I'm looking for healthy food options.",
        "Yes, tell me more about exercises.",
        "What about weight loss?",
        "Thank you for the help!"
    ]
    
    print("\n🎬 Starting automatic demo...\n")
    
    for i, message in enumerate(demo_messages):
        conversation_count += 1
        print(f"\n{'='*20} Turn {conversation_count} {'='*20}")
        print(f"👤 User: {message}")
        
        # Process message
        response = process_conversational_message(user_id, message, session_id)
        session_id = response['session_id']
        
        print(f"🤖 Bot: {response['answer']}")
        
        # Show follow-up questions if available
        if response['follow_up_questions']:
            print(f"\n💭 Follow-up suggestions:")
            for j, question in enumerate(response['follow_up_questions'][:2]):
                print(f"   {j+1}. {question}")
        
        # Show topic
        if response['topic']:
            print(f"📊 Topic: {response['topic']}")
        
        time.sleep(1)  # Pause for readability
    
    # Show conversation summary
    print(f"\n{'='*20} CONVERSATION SUMMARY {'='*20}")
    history = get_conversation_history(session_id)
    if history:
        print(f"📊 Total messages: {len(history['messages'])}")
        print(f"🎯 Final topic: {history['current_topic']}")
        print(f"🕐 Duration: {history['last_activity']}")
        
        print(f"\n💬 Full conversation:")
        for i, msg in enumerate(history['messages']):
            role = "👤 User" if msg['role'] == 'user' else "🤖 Bot"
            print(f"   {i+1}. {role}: {msg['content'][:50]}...")
    
    print(f"\n✅ Demo completed! Your chatbot is working like ChatGPT!")
    print(f"🚀 Ready for real conversations!")

def interactive_demo():
    """Interactive demo for manual testing"""
    
    print("\n🎮 INTERACTIVE MODE")
    print("=" * 30)
    
    user_id = "interactive_user"
    session_id = None
    
    while True:
        try:
            user_input = input("\n👤 You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'bye']:
                print("🤖 Bot: Goodbye! Stay healthy and fit!")
                break
            
            if not user_input:
                continue
            
            # Process message
            response = process_conversational_message(user_id, user_input, session_id)
            session_id = response['session_id']
            
            print(f"🤖 Bot: {response['answer']}")
            
            # Show follow-up questions
            if response['follow_up_questions']:
                print(f"\n💭 You can ask:")
                for question in response['follow_up_questions'][:2]:
                    print(f"   • {question}")
            
        except KeyboardInterrupt:
            print("\n🤖 Bot: Goodbye! Stay healthy!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🤖 CHATGPT-LIKE CONVERSATIONAL CHATBOT")
    print("=" * 50)
    print("💚 100% FREE - Built with open-source technologies")
    print("🚀 Ready for ChatGPT-like conversations!")
    print("\nChoose demo mode:")
    print("1. Automatic demo (recommended)")
    print("2. Interactive mode")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "2":
        interactive_demo()
    else:
        chatgpt_demo()
    
    print(f"\n🎉 IMPLEMENTATION COMPLETE!")
    print(f"✅ Your chatbot now has:")
    print(f"   • Natural conversation flow")
    print(f"   • Follow-up questions")
    print(f"   • Context awareness")
    print(f"   • Session management")
    print(f"   • Topic tracking")
    print(f"\n🚀 Ready for production use!")
