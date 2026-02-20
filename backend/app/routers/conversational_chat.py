"""
CONVERSATIONAL CHATBOT API ENDPOINTS
FastAPI routes for ChatGPT-like conversational interface
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

# Import the conversational chatbot
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from conversational_chatbot import process_conversational_message, get_conversation_history, conversational_chatbot

router = APIRouter()

# Pydantic models for API requests/responses
class ChatMessage(BaseModel):
    message: str
    user_id: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    session_id: str
    answer: str
    follow_up_questions: List[str]
    suggestions: List[str]
    topic: Optional[str]
    conversation_length: int
    timestamp: str

class ConversationHistory(BaseModel):
    session_id: str
    messages: List[Dict]
    context: Dict
    current_topic: Optional[str]
    last_activity: str

class UserProfile(BaseModel):
    user_id: str
    age: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    fitness_goals: List[str] = []
    dietary_restrictions: List[str] = []
    activity_level: Optional[str] = None

class FeedbackRequest(BaseModel):
    session_id: str
    message_id: str
    rating: int  # 1-5 stars
    feedback: Optional[str] = None

# In-memory storage for demo (use database in production)
user_profiles = {}
feedback_data = []

@router.post("/chat/conversation", response_model=ChatResponse)
async def chat_conversation(message: ChatMessage):
    """
    Main conversational chat endpoint
    Like ChatGPT's chat completion API
    """
    try:
        # Process the message
        response = process_conversational_message(
            user_id=message.user_id,
            message=message.message,  # Fix: use message.message instead of message_content
            session_id=message.session_id
        )
        
        return ChatResponse(
            session_id=response['session_id'],
            answer=response['answer'],
            follow_up_questions=response['follow_up_questions'],
            suggestions=response['suggestions'],
            topic=response['topic'],
            conversation_length=response['conversation_length'],
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@router.get("/chat/history/{session_id}", response_model=ConversationHistory)
async def get_chat_history(session_id: str):
    """
    Get conversation history for a session
    """
    try:
        history = get_conversation_history(session_id)
        if not history:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return ConversationHistory(**history)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")

@router.post("/chat/profile")
async def update_user_profile(profile: UserProfile):
    """
    Update user profile for personalization
    """
    try:
        user_profiles[profile.user_id] = profile.dict()
        
        return {
            "message": "Profile updated successfully",
            "user_id": profile.user_id,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating profile: {str(e)}")

@router.get("/chat/profile/{user_id}")
async def get_user_profile(user_id: str):
    """
    Get user profile
    """
    try:
        if user_id not in user_profiles:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        return user_profiles[user_id]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving profile: {str(e)}")

@router.post("/chat/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """
    Submit feedback on chatbot responses
    """
    try:
        feedback_entry = {
            "id": str(uuid.uuid4()),
            "session_id": feedback.session_id,
            "message_id": feedback.message_id,
            "rating": feedback.rating,
            "feedback": feedback.feedback,
            "timestamp": datetime.now().isoformat()
        }
        
        feedback_data.append(feedback_entry)
        
        return {
            "message": "Feedback submitted successfully",
            "feedback_id": feedback_entry["id"],
            "timestamp": feedback_entry["timestamp"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting feedback: {str(e)}")

@router.get("/chat/suggestions/{user_id}")
async def get_personalized_suggestions(user_id: str):
    """
    Get personalized suggestions based on user profile and conversation history
    """
    try:
        suggestions = []
        
        # Get user profile if available
        profile = user_profiles.get(user_id, {})
        
        # Generate suggestions based on profile
        if profile.get('fitness_goals'):
            suggestions.extend([
                f"Workout plan for {profile['fitness_goals'][0]}",
                f"Nutrition tips for {profile['fitness_goals'][0]}"
            ])
        
        if profile.get('age') and profile['age'] < 30:
            suggestions.append("Beginner-friendly exercises")
        elif profile.get('age') and profile['age'] >= 30:
            suggestions.append("Age-appropriate fitness routines")
        
        if profile.get('dietary_restrictions'):
            suggestions.append(f"Recipes for {profile['dietary_restrictions'][0]} diet")
        
        # Default suggestions if no profile
        if not suggestions:
            suggestions = [
                "Start with basic fitness assessment",
                "Learn about nutrition basics",
                "Try beginner workout routines",
                "Explore healthy meal options",
                "Set realistic fitness goals"
            ]
        
        return {
            "user_id": user_id,
            "suggestions": suggestions,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating suggestions: {str(e)}")

@router.delete("/chat/session/{session_id}")
async def end_chat_session(session_id: str):
    """
    End a chat session and clean up
    """
    try:
        if session_id in conversational_chatbot.conversations:
            del conversational_chatbot.conversations[session_id]
            return {"message": "Session ended successfully"}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ending session: {str(e)}")

@router.get("/chat/analytics")
async def get_chat_analytics():
    """
    Get basic analytics about chatbot usage
    """
    try:
        total_conversations = len(conversational_chatbot.conversations)
        total_messages = sum(
            len(conv.messages) 
            for conv in conversational_chatbot.conversations.values()
        )
        total_feedback = len(feedback_data)
        
        if total_feedback > 0:
            avg_rating = sum(f['rating'] for f in feedback_data) / total_feedback
        else:
            avg_rating = 0
        
        return {
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "total_feedback": total_feedback,
            "average_rating": round(avg_rating, 2),
            "active_sessions": total_conversations,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving analytics: {str(e)}")

@router.post("/chat/cleanup")
async def cleanup_expired_sessions():
    """
    Clean up expired sessions
    """
    try:
        cleaned_count = conversational_chatbot.cleanup_expired_sessions()
        return {
            "message": f"Cleaned up {cleaned_count} expired sessions",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cleaning up sessions: {str(e)}")

# Legacy endpoint for backward compatibility
@router.post("/chat/conversational")
async def conversational_chat_endpoint(message: ChatMessage):
    """
    Legacy endpoint for backward compatibility
    """
    return await chat_conversation(message)

if __name__ == "__main__":
    print("🤖 CONVERSATIONAL CHATBOT API ENDPOINTS")
    print("=" * 50)
    print("\n📋 Available Endpoints:")
    print("POST /chat/conversation - Main chat endpoint")
    print("GET /chat/history/{session_id} - Get conversation history")
    print("POST /chat/profile - Update user profile")
    print("GET /chat/profile/{user_id} - Get user profile")
    print("POST /chat/feedback - Submit feedback")
    print("GET /chat/suggestions/{user_id} - Get personalized suggestions")
    print("DELETE /chat/session/{session_id} - End chat session")
    print("GET /chat/analytics - Get usage analytics")
    print("POST /chat/cleanup - Clean up expired sessions")
    print("\n🚀 Ready for ChatGPT-like conversations!")
