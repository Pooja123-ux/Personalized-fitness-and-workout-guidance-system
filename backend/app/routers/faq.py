from fastapi import APIRouter
from pydantic import BaseModel
from fuzzywuzzy import fuzz
import pandas as pd
from pathlib import Path

router = APIRouter()

class FAQResponse(BaseModel):
    question: str
    answer: str
    intent: str
    confidence: float

# Load FAQ dataset
FAQ_PATH = Path(__file__).parent.parent / "fitness_related_questions.csv"
try:
    faq_df = pd.read_csv(FAQ_PATH)
except FileNotFoundError:
    faq_df = pd.DataFrame(columns=['intent', 'question', 'response'])

@router.get("/ask")
def ask_faq(question: str):
    if faq_df.empty:
        return {
            "question": question,
            "answer": "FAQ dataset not available.",
            "intent": "unknown",
            "confidence": 0.0
        }
    
    best_match = None
    best_score = 0
    best_response = None
    best_intent = None
    
    for _, row in faq_df.iterrows():
        score = fuzz.token_set_ratio(question.lower(), row['question'].lower())
        if score > best_score:
            best_score = score
            best_match = row['question']
            best_response = row['response']
            best_intent = row.get('intent', 'general')
    
    if best_score < 40:
        return {
            "question": question,
            "answer": "I'm not sure about that. Please ask about weight loss, muscle gain, diet, calories, protein, workouts, or other fitness topics.",
            "intent": "unknown",
            "confidence": 0.0
        }
    
    return FAQResponse(
        question=best_match,
        answer=best_response or "Information not available.",
        intent=best_intent,
        confidence=round(best_score / 100, 2)
    )
