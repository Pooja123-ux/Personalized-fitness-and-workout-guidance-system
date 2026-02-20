"""
BASIC CONVERSATIONAL CHATBOT IMPLEMENTATION
Phase 1: Conversation Management + Basic Follow-up Questions
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from app.chatbot_logic import answer_fitness_question

@dataclass
class Message:
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime
    metadata: Optional[Dict] = None

@dataclass
class ConversationState:
    user_id: str
    session_id: str
    messages: List[Message]
    context: Dict[str, Any]
    current_topic: Optional[str]
    last_activity: datetime
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'session_id': self.session_id,
            'messages': [asdict(msg) for msg in self.messages],
            'context': self.context,
            'current_topic': self.current_topic,
            'last_activity': self.last_activity.isoformat()
        }

class ConversationalChatbot:
    """
    Basic conversational chatbot with follow-up questions
    """
    
    def __init__(self):
        self.conversations = {}  # session_id -> ConversationState
        self.session_timeout = 30 * 60  # 30 minutes
        
        # Response templates
        self.greetings = [
            "Hello! I'm your fitness assistant. How can I help you today?",
            "Hi there! Ready to talk about fitness and nutrition. What's on your mind?",
            "Welcome! I'm here to help with your health and fitness questions."
        ]
        
        self.follow_up_templates = [
            "Would you like to know more about {topic}?",
            "Do you have any specific questions about {topic}?",
            "Would you like me to suggest some {topic} options?",
            "Is there anything specific about {topic} you'd like to explore?",
            "Can I help you with anything else related to {topic}?"
        ]
        
        self.goodbyes = [
            "Take care! Stay healthy and fit!",
            "Goodbye! Feel free to come back anytime for fitness advice.",
            "See you later! Keep up the great work on your fitness journey!"
        ]
    
    def get_or_create_conversation(self, user_id: str, session_id: Optional[str] = None) -> str:
        """Get existing conversation or create new one"""
        if not session_id:
            session_id = str(uuid.uuid4())
        
        if session_id not in self.conversations:
            self.conversations[session_id] = ConversationState(
                user_id=user_id,
                session_id=session_id,
                messages=[],
                context={},
                current_topic=None,
                last_activity=datetime.now()
            )
        
        return session_id
    
    def is_greeting(self, message: str) -> bool:
        """Check if message is a greeting"""
        greetings = ['hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings']
        return any(greeting in message.lower() for greeting in greetings)
    
    def is_goodbye(self, message: str) -> bool:
        """Check if message is a goodbye"""
        goodbyes = ['bye', 'goodbye', 'see you', 'exit', 'quit', 'thanks', 'thank you']
        return any(goodbye in message.lower() for goodbye in goodbyes)
    
    def extract_topic(self, message: str) -> Optional[str]:
        """Extract main topic from message"""
        # Simple topic extraction - can be enhanced with NLP
        fitness_topics = {
            'exercise': ['exercise', 'workout', 'gym', 'training', 'fitness'],
            'nutrition': ['food', 'diet', 'nutrition', 'eat', 'calories', 'protein'],
            'weight loss': ['weight loss', 'lose weight', 'dieting', 'fat loss'],
            'muscle gain': ['muscle', 'gain muscle', 'build muscle', 'strength'],
            'yoga': ['yoga', 'meditation', 'stretching', 'flexibility'],
            'health': ['health', 'healthy', 'disease', 'medical']
        }
        
        message_lower = message.lower()
        for topic, keywords in fitness_topics.items():
            if any(keyword in message_lower for keyword in keywords):
                return topic
        
        return None
    
    def generate_follow_up_questions(self, topic: str, context: Dict) -> List[str]:
        """Generate relevant follow-up questions"""
        if not topic:
            return [
                "Would you like to know about exercises or nutrition?",
                "Do you have any specific fitness goals I can help with?",
                "Are you looking for workout advice or dietary guidance?"
            ]
        
        follow_ups = {
            'exercise': [
                "Would you like specific exercise recommendations?",
                "Are you interested in home workouts or gym routines?",
                "Do you want exercises for a specific body part?"
            ],
            'nutrition': [
                "Would you like healthy meal suggestions?",
                "Are you looking for high-protein or low-calorie options?",
                "Do you have any dietary restrictions I should consider?"
            ],
            'weight loss': [
                "Would you like a personalized weight loss plan?",
                "Are you interested in diet or exercise for weight loss?",
                "Do you want to know about healthy food options?"
            ],
            'muscle gain': [
                "Would you like muscle-building exercises?",
                "Are you looking for high-protein food recommendations?",
                "Do you want a workout routine for muscle gain?"
            ],
            'yoga': [
                "Would you like beginner yoga poses?",
                "Are you interested in yoga for flexibility or relaxation?",
                "Do you want yoga routines for specific goals?"
            ],
            'health': [
                "Would you like health tips for a specific condition?",
                "Are you looking for preventive health advice?",
                "Do you want to know about healthy lifestyle habits?"
            ]
        }
        
        return follow_ups.get(topic, [
            f"Would you like more information about {topic}?",
            f"Can I help you with specific {topic} questions?",
            f"Are there any {topic} topics you'd like to explore?"
        ])
    
    def generate_conversational_response(self, topic: str, data_answer: str, original_message: str) -> str:
        """Generate a conversational response from dataset answer"""
        
        message_lower = original_message.lower()
        
        # Handle specific food queries
        if 'cake' in message_lower or 'calories in' in message_lower:
            if "Results" in data_answer:
                return f"Here's the calorie information for cake:\n\n{data_answer}\n\nWould you like to know about any specific type of cake, or do you have questions about nutrition in general?"
            else:
                return f"Based on my nutrition database, here's what I found about cake:\n\n{data_answer}\n\nIs there anything specific about cake nutrition you'd like to know more about?"
        
        # Make the response more conversational for other topics
        elif topic == 'nutrition':
            if "Results" in data_answer or "food options" in data_answer:
                return f"I found some great food options for you! Here are the healthy choices I'd recommend:\n\n{data_answer}\n\nWould you like me to explain more about any of these foods, or do you have specific dietary preferences I should consider?"
            else:
                return f"Based on my nutrition database, here's what I found:\n\n{data_answer}\n\nIs there anything specific about nutrition you'd like to know more about?"
        
        elif topic == 'exercise':
            return f"Great question about exercises! Here's what I found for you:\n\n{data_answer}\n\nWould you like me to show you how to perform any of these exercises, or do you have specific fitness goals I can help with?"
        
        elif topic == 'weight loss':
            return f"For weight loss, I found some helpful information:\n\n{data_answer}\n\nWould you like me to create a personalized weight loss plan, or do you have questions about any of these options?"
        
        else:
            return f"Here's what I found for you:\n\n{data_answer}\n\nWould you like to know more about this topic, or is there something specific I can help you with?"
    
    def process_message(self, user_id: str, message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Process user message and generate response"""
        # Get or create conversation
        session_id = self.get_or_create_conversation(user_id, session_id)
        conversation = self.conversations[session_id]
        
        # Add user message
        user_message = Message(
            role='user',
            content=message,
            timestamp=datetime.now()
        )
        conversation.messages.append(user_message)
        
        # Generate response
        response_content = ""
        follow_up_questions = []
        suggestions = []
        
        # Check for greetings
        if self.is_greeting(message):
            response_content = self.greetings[hash(message) % len(self.greetings)]
            conversation.current_topic = 'general'
        
        # Check for goodbyes
        elif self.is_goodbye(message):
            response_content = self.goodbyes[hash(message) % len(self.goodbyes)]
            conversation.current_topic = 'ending'
        
        # Process fitness/nutrition questions
        else:
            # Extract topic
            topic = self.extract_topic(message)
            if topic:
                conversation.current_topic = topic
            
            # Get answer from existing chatbot logic
            try:
                fitness_answer = answer_fitness_question(message)
                # Make it conversational
                response_content = self.generate_conversational_response(conversation.current_topic or "general", fitness_answer, message)
            except Exception as e:
                response_content = "I'm having trouble processing that question. Could you try rephrasing it, or would you like to talk about something else like exercises or nutrition?"
            
            # Generate follow-up questions
            if conversation.current_topic:
                follow_up_questions = self.generate_follow_up_questions(conversation.current_topic, conversation.context)
            
            # Generate suggestions
            suggestions = [
                "Tell me more about your fitness goals",
                "Ask about nutrition advice", 
                "Get workout recommendations",
                "Learn about healthy eating"
            ]
        
        # Add assistant message
        assistant_message = Message(
            role='assistant',
            content=response_content,
            timestamp=datetime.now(),
            metadata={
                'follow_up_questions': follow_up_questions,
                'suggestions': suggestions,
                'topic': conversation.current_topic
            }
        )
        conversation.messages.append(assistant_message)
        conversation.last_activity = datetime.now()
        
        return {
            'session_id': session_id,
            'answer': response_content,
            'follow_up_questions': follow_up_questions,
            'suggestions': suggestions,
            'topic': conversation.current_topic,
            'conversation_length': len(conversation.messages)
        }
    
    def get_conversation_history(self, session_id: str) -> Optional[Dict]:
        """Get conversation history"""
        if session_id not in self.conversations:
            return None
        
        conversation = self.conversations[session_id]
        return {
            'session_id': session_id,
            'messages': [asdict(msg) for msg in conversation.messages],
            'context': conversation.context,
            'current_topic': conversation.current_topic,
            'last_activity': conversation.last_activity.isoformat()
        }
    
    def cleanup_expired_sessions(self):
        """Remove expired conversations"""
        current_time = datetime.now()
        expired_sessions = []
        
        for session_id, conversation in self.conversations.items():
            if current_time - conversation.last_activity > timedelta(seconds=self.session_timeout):
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            del self.conversations[session_id]
        
        return len(expired_sessions)

# Global instance
conversational_chatbot = ConversationalChatbot()

def process_conversational_message(user_id: str, message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Main function to process conversational messages"""
    return conversational_chatbot.process_message(user_id, message, session_id)

def get_conversation_history(session_id: str) -> Optional[Dict]:
    """Get conversation history"""
    return conversational_chatbot.get_conversation_history(session_id)

if __name__ == "__main__":
    # Test the conversational chatbot
    print("🤖 TESTING CONVERSATIONAL CHATBOT")
    print("=" * 50)
    
    # Simulate a conversation
    user_id = "test_user"
    
    # Test 1: Greeting
    print("\n1. Testing greeting:")
    response = process_conversational_message(user_id, "Hello!")
    print(f"Bot: {response['answer']}")
    print(f"Follow-ups: {response['follow_up_questions']}")
    
    # Test 2: Fitness question
    print("\n2. Testing fitness question:")
    response = process_conversational_message(user_id, "healthy food items to eat", response['session_id'])
    print(f"Bot: {response['answer'][:100]}...")
    print(f"Follow-ups: {response['follow_up_questions']}")
    print(f"Topic: {response['topic']}")
    
    # Test 3: Follow-up question
    print("\n3. Testing follow-up:")
    response = process_conversational_message(user_id, "yes, tell me more", response['session_id'])
    print(f"Bot: {response['answer'][:100]}...")
    print(f"Topic: {response['topic']}")
    
    print("\n✅ Conversational chatbot is working!")
