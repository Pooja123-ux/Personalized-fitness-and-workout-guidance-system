"""
Fitness chatbot logic - thin wrapper around Google Gemini LLM.

This module replaces the previous dataset-driven chatbot with a
natural-language conversational assistant powered by Google's Gemini model.

The Gemini model is given a strong fitness-specific system instruction so it
behaves like a knowledgeable fitness assistant rather than a generic ChatGPT clone.
"""

from __future__ import annotations

from typing import List, Optional

from .gemini_service import generate_response, is_available


def answer_fitness_question(
    question: str,
    conversation_history: Optional[List[dict]] = None,
) -> str:
    """
    Answer a fitness/nutrition question using Google Gemini.

    Args:
        question: The user's question.
        conversation_history: Optional list of previous turns as
            {"role": "user"|"assistant", "content": str} dicts.

    Returns:
        The assistant's reply as a string.
    """
    if not is_available():
        return (
            "I'm currently offline. The Gemini LLM is not configured. "
            "Please set GEMINI_API_KEY in the backend environment."
        )

    try:
        return generate_response(question, conversation_history=conversation_history)
    except Exception as exc:
        return (
            "I'm sorry, I encountered an error while generating a response. "
            "Please try again or rephrase your question."
        )


__all__ = ["answer_fitness_question", "is_available", "generate_response"]