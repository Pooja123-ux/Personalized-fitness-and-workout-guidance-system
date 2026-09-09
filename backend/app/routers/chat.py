"""
Chat API routes.

All chat endpoints now delegate to the Google Gemini LLM for natural-language
conversational fitness assistance. The previous dataset-driven logic has been
replaced with a thin wrapper around Gemini (see chatbot_logic.py and
gemini_service.py).
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from ..deps import get_current_user
from ..deps import get_db
from ..chatbot_logic import answer_fitness_question
from ..gemini_service import is_available

router = APIRouter()


class ChatIn(BaseModel):
    message: str


class ComprehensiveChatIn(BaseModel):
    question: str
    context: Optional[str] = None


@router.post("/ask")
async def ask(
    message: str = Form(""),
    images: Optional[List[UploadFile]] = None,
    audio: Optional[UploadFile] = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Main chat endpoint - answers via Gemini LLM."""
    if images:
        return {
            "answer": (
                "Image analysis is not supported by the Gemini chatbot. "
                "Please type your question about fitness or nutrition."
            )
        }
    if audio:
        return {
            "answer": (
                "Audio input is not supported by the Gemini chatbot. "
                "Please type your question about fitness or nutrition."
            )
        }

    if not message or not message.strip():
        return {"answer": "Ask me any fitness or nutrition question. I'm here to help!"}

    answer = answer_fitness_question(message)
    return {
        "answer": answer,
        "model": "gemini-2.5-flash",
        "llm_available": is_available(),
    }


@router.post("/comprehensive-ask")
async def comprehensive_ask(
    request: ComprehensiveChatIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Comprehensive chat endpoint - answers via Gemini LLM.

    The Gemini model is given a strong fitness-specific system instruction so it
    behaves like a knowledgeable fitness assistant rather than a generic ChatGPT clone.
    """
    question = (request.question or "").strip()
    if not question:
        return {
            "answer": "Please ask a question about fitness, nutrition, exercises, or healthy habits.",
            "category": "error",
            "confidence": 0,
        }

    answer = answer_fitness_question(question)

    # Lightweight category detection for the response metadata.
    question_lower = question.lower()
    category = "general"
    if any(k in question_lower for k in ["exercise", "workout", "muscle", "strength", "training", "fitness"]):
        category = "exercises"
    elif any(k in question_lower for k in ["yoga", "pose", "asana", "meditation"]):
        category = "yoga"
    elif any(k in question_lower for k in ["calories", "protein", "nutrition", "food", "eat", "bmi", "water"]):
        category = "nutrition"
    elif any(k in question_lower for k in ["diet", "weight loss", "weight gain"]):
        category = "diet"
    elif any(k in question_lower for k in ["disease", "diabetes", "health condition"]):
        category = "health"

    return {
        "answer": answer,
        "category": category,
        "question": question,
        "confidence": 0.95,
        "model": "gemini-2.5-flash",
        "sources": ["Google Gemini LLM"],
    }


@router.get("/chatbot-capabilities")
async def get_chatbot_capabilities(user=Depends(get_current_user)):
    """Describe what the Gemini-powered chatbot can do."""
    return {
        "capabilities": {
            "conversational_fitness": {
                "description": "Natural-language fitness and nutrition guidance powered by Google Gemini LLM",
                "examples": [
                    "Beginner workout plan",
                    "High protein Indian foods",
                    "How much water should I drink?",
                    "Best exercises for fat loss",
                    "How to recover from muscle soreness?",
                ],
            }
        },
        "total_datasets": 0,
        "total_records": 0,
        "llm": "google-gemini-2.0-flash",
        "llm_available": is_available(),
    }


@router.post("/public-ask")
async def public_ask(request: ComprehensiveChatIn):
    """
    Public chatbot endpoint (no auth required) - answers via Gemini LLM.
    """
    question = (request.question or "").strip()
    if not question:
        return {
            "answer": "Hello! I'm your fitness assistant. How can I help you today?",
            "category": "greeting",
            "confidence": 0.95,
        }

    # Handle standalone greetings
    question_lower = question.lower().strip()
    greetings = ["hello", "hi", "hey", "good morning", "good evening", "greetings"]
    is_greeting = any(
        question_lower == g or question_lower.startswith(g + " ")
        for g in greetings
    ) and len(question.split()) <= 3
    if is_greeting:
        return {
            "answer": "Hi there! Ready to talk about fitness and nutrition. What's on your mind?",
            "category": "greeting",
            "confidence": 0.95,
        }

    goodbyes = ["bye", "goodbye", "see you", "exit", "quit", "thanks", "thank you"]
    if any(goodbye in question_lower for goodbye in goodbyes):
        return {
            "answer": "Take care! Stay healthy and fit!",
            "category": "farewell",
            "confidence": 0.95,
        }

    answer = answer_fitness_question(question)

    category = "general"
    if any(k in question_lower for k in ["exercise", "workout", "muscle", "strength", "training", "fitness"]):
        category = "exercises"
    elif any(k in question_lower for k in ["yoga", "pose", "asana", "meditation"]):
        category = "yoga"
    elif any(k in question_lower for k in ["calories", "protein", "nutrition", "food", "eat", "bmi", "water"]):
        category = "nutrition"
    elif any(k in question_lower for k in ["diet", "weight loss", "weight gain"]):
        category = "diet"
    elif any(k in question_lower for k in ["disease", "diabetes", "health condition"]):
        category = "health"

    return {
        "answer": answer,
        "category": category,
        "question": question,
        "confidence": 0.95,
        "model": "gemini-2.5-flash",
        "sources": ["Google Gemini LLM"],
    }