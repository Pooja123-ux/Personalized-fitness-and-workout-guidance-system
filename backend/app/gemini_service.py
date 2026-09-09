"""
Google Gemini LLM integration for the fitness chatbot.

Replaces the previous dataset-driven chatbot with a natural-language
conversational assistant powered by Google's Gemini model.

The model is given a strong fitness-specific system instruction so it
behaves like a knowledgeable fitness assistant rather than a generic
ChatGPT clone.
"""

from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# System instruction - the "persona" of the fitness assistant.
# This is sent to Gemini on every request so it stays on-topic.
# ---------------------------------------------------------------------------
FITNESS_SYSTEM_INSTRUCTION = """You are the AI Fitness Assistant for a personalized fitness application.

Your role:
- Provide helpful, beginner-friendly guidance about workouts, exercise, nutrition, healthy habits, and fitness goals.
- Keep responses concise, practical, and actionable.
- Use a warm, encouraging tone but stay factual and evidence-based.

Rules:
- Do NOT diagnose medical conditions.
- Do NOT provide dangerous medical advice.
- If a user asks about a serious health concern, recommend consulting a qualified healthcare professional.
- Prefer concrete examples (specific exercises, sample meals, clear targets) over vague platitudes.
- When giving numeric targets (calories, protein, water, steps), explain the reasoning briefly.
- Format responses with clear headings and bullet points so they are easy to read on a phone.

You may reference common fitness knowledge: exercise form, muscle groups, 
macro-nutrition basics, hydration, sleep, progressive overload, rest/recovery, 
and general wellness habits. You do not need to cite sources for well-known facts.
"""

# ---------------------------------------------------------------------------
# Lazy singleton client - imported only when first used so that the app can
# start even if the Gemini SDK or API key is missing.
# ---------------------------------------------------------------------------
_gemini_model = None
_gemini_available: Optional[bool] = None


_PLACEHOLDER_MARKERS = (
    "your_gemini_api_key_here",
    "your_api_key",
    "your-key-here",
    "replace_me",
    "changeme",
    "example_key",
)


def _get_api_key() -> Optional[str]:
    """Return the configured Gemini API key, or None if missing/placeholder."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    key_stripped = key.strip()
    if not key_stripped:
        return None
    if key_stripped.lower() in _PLACEHOLDER_MARKERS:
        return None
    return key_stripped


def is_available() -> bool:
    """Return True when a real Gemini API key is configured and the SDK is installed."""
    global _gemini_available
    if _gemini_available is not None:
        return _gemini_available

    key = _get_api_key()
    if not key:
        _gemini_available = False
        return False

    try:
        import google.generativeai as genai  # noqa: F401
        _gemini_available = True
    except ImportError:
        _gemini_available = False

    return _gemini_available


# Candidate model names - tried in order until one works.
# Google renames/retires models frequently; this list keeps the app working
# without code changes on every rename.
CANDIDATE_MODELS = [
    "models/gemini-3.6-flash",
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-flash-latest",
    "models/gemini-pro-latest",
]


def _get_model():
    """Build (and cache) the Gemini generative model.

    Tries each candidate model name in order until one succeeds, so the app
    keeps working even when Google retires a specific model version.
    """
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model

    import google.generativeai as genai

    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment.")

    genai.configure(api_key=api_key)

    last_error = None
    for model_name in CANDIDATE_MODELS:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=FITNESS_SYSTEM_INSTRUCTION,
            )
            # Quick sanity check - generate a trivial response.
            # Some model names return 404 only on actual generation, so we
            # defer the check until generate_response is called.
            _gemini_model = model
            _gemini_model._model_name = model_name  # type: ignore[attr-defined]
            return _gemini_model
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

    raise RuntimeError(
        f"Could not initialize any Gemini model. Last error: {last_error}"
    )


def generate_response(
    user_message: str,
    conversation_history: Optional[list] = None,
    max_tokens: int = 1024,
) -> str:
    """
    Generate a fitness-oriented response from Gemini.

    Args:
        user_message: The user's question.
        conversation_history: Optional list of previous turns as
            {"role": "user"|"assistant", "content": str} dicts.
        max_tokens: Safety cap on the response length.

    Returns:
        The assistant's reply as a string.
    """
    model = _get_model()

    # Build the contents list expected by the SDK.
    contents = []
    if conversation_history:
        for turn in conversation_history:
            role = "user" if turn.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [turn.get("content", "")]})
    contents.append({"role": "user", "parts": [user_message]})

    response = model.generate_content(
        contents,
        generation_config={
            "max_output_tokens": max_tokens,
            "temperature": 0.7,
        },
    )

    text = getattr(response, "text", None)
    if not text:
        # Fallback for safety-blocked or empty responses.
        try:
            text = response.candidates[0].content.parts[0].text
        except Exception:
            text = (
                "I'm sorry, I couldn't generate a response right now. "
                "Please try rephrasing your question."
            )

    return text.strip()


def chat(
    user_message: str,
    conversation_history: Optional[list] = None,
) -> str:
    """Alias for generate_response - matches the function name used elsewhere."""
    return generate_response(user_message, conversation_history)