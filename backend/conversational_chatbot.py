"""
Conversational chatbot - session management with Gemini LLM.

Maintains per-session conversation history and forwards each turn to the
Google Gemini model. The model itself carries a fitness-specific system
instruction (see gemini_service.py) so it behaves like a knowledgeable
fitness assistant rather than a generic ChatGPT clone.
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.gemini_service import generate_response, is_available


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
            "user_id": self.user_id,
            "session_id": self.session_id,
            "messages": [asdict(msg) for msg in self.messages],
            "context": self.context,
            "current_topic": self.current_topic,
            "last_activity": self.last_activity.isoformat(),
        }


class ConversationalChatbot:
    """Session-aware chatbot backed by Google Gemini."""

    def __init__(self):
        self.conversations: Dict[str, ConversationState] = {}
        self.session_timeout = 30 * 60  # 30 minutes

    def get_or_create_conversation(
        self, user_id: str, session_id: Optional[str] = None
    ) -> str:
        if not session_id:
            session_id = str(uuid.uuid4())
        if session_id not in self.conversations:
            self.conversations[session_id] = ConversationState(
                user_id=user_id,
                session_id=session_id,
                messages=[],
                context={},
                current_topic=None,
                last_activity=datetime.now(),
            )
        return session_id

    def _build_history(self, conversation: ConversationState) -> List[dict]:
        """Convert stored messages into the format expected by Gemini."""
        history: List[dict] = []
        for msg in conversation.messages:
            history.append(
                {
                    "role": "user" if msg.role == "user" else "assistant",
                    "content": msg.content,
                }
            )
        return history

    def process_message(
        self, user_id: str, message: str, session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        session_id = self.get_or_create_conversation(user_id, session_id)
        conversation = self.conversations[session_id]

        # Add user message
        user_message = Message(
            role="user", content=message, timestamp=datetime.now()
        )
        conversation.messages.append(user_message)

        # Generate response via Gemini
        try:
            history = self._build_history(conversation)[:-1]  # exclude current turn
            response_content = generate_response(message, conversation_history=history)
        except Exception:
            response_content = (
                "I'm having trouble processing that question. Could you try "
                "rephrasing it, or would you like to talk about something else "
                "like exercises or nutrition?"
            )

        # Add assistant message
        assistant_message = Message(
            role="assistant",
            content=response_content,
            timestamp=datetime.now(),
            metadata={"model": "gemini-2.5-flash"},
        )
        conversation.messages.append(assistant_message)
        conversation.last_activity = datetime.now()

        return {
            "session_id": session_id,
            "answer": response_content,
            "follow_up_questions": [],
            "suggestions": [],
            "topic": conversation.current_topic,
            "conversation_length": len(conversation.messages),
        }

    def get_conversation_history(self, session_id: str) -> Optional[Dict]:
        if session_id not in self.conversations:
            return None
        conversation = self.conversations[session_id]
        return {
            "session_id": session_id,
            "messages": [asdict(msg) for msg in conversation.messages],
            "context": conversation.context,
            "current_topic": conversation.current_topic,
            "last_activity": conversation.last_activity.isoformat(),
        }

    def cleanup_expired_sessions(self) -> int:
        current_time = datetime.now()
        expired = [
            sid
            for sid, conv in self.conversations.items()
            if current_time - conv.last_activity > timedelta(seconds=self.session_timeout)
        ]
        for sid in expired:
            del self.conversations[sid]
        return len(expired)


# Global singleton
conversational_chatbot = ConversationalChatbot()


def process_conversational_message(
    user_id: str, message: str, session_id: Optional[str] = None
) -> Dict[str, Any]:
    return conversational_chatbot.process_message(user_id, message, session_id)


def get_conversation_history(session_id: str) -> Optional[Dict]:
    return conversational_chatbot.get_conversation_history(session_id)