from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
from ..deps import get_current_user
from ..logic import kcal_per_100g, healthy_alternatives, answer_from_datasets
from .. import logic
from ..chatbot_logic import answer_fitness_question
import re
import sys
import os

# Import conversational chatbot
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from conversational_chatbot import process_conversational_message

router = APIRouter()

class ChatIn(BaseModel):
    message: str

class ComprehensiveChatIn(BaseModel):
    question: str
    context: Optional[str] = None

# Optional: define a small sample food kcal mapping if needed
FOOD_KCAL_100G = {
    "apple": 52,
    "banana": 89,
    "oats": 389,
    "salmon": 208,
    "spinach": 23,
    "white bread": 265,
    "fried food": 312
}

def simple_health_ai(message: str) -> str:
    msg = message.lower()
    if re.search(r'\b(symptom|symptoms|pain|ache)\b', msg):
        return "Please consult a doctor for symptoms. Common advice: rest, hydrate, and monitor."
    if re.search(r'\b(diabetes|blood sugar)\b', msg):
        return "For diabetes, maintain balanced diet, exercise regularly, monitor blood sugar. Consult endocrinologist."
    if re.search(r'\b(weight loss|diet)\b', msg):
        return "For weight loss, focus on calorie deficit, high protein, veggies. Combine with cardio."
    if re.search(r'\b(muscle|build muscle|strength)\b', msg):
        return "To build muscle, lift weights 3-4x/week, high protein intake, progressive overload."
    if re.search(r'\b(yoga|meditation)\b', msg):
        return "Yoga improves flexibility and stress. Try sun salutation for beginners."
    # Remove the general calories keyword to let comprehensive chatbot handle it
    if re.search(r'\b(water|intake)\b', msg):
        return "Drink at least 2-3 liters/day. More if active or hot weather."
    return "I'm a basic health AI. For personalized advice, consult a healthcare professional."

def _food_from_text(text: str) -> Optional[str]:
    t = (text or "").lower()
    for k in FOOD_KCAL_100G.keys():
        if k in t:
            return k
    return None

def _match_food_from_dataset(text: str) -> Optional[str]:
    t = (text or "").lower()
    try:
        foods = logic.df_food["food"].astype(str).str.lower().unique().tolist()
    except Exception:
        foods = []
    candidates = [f for f in foods if f in t]
    if candidates:
        candidates.sort(key=len, reverse=True)
        return candidates[0]
    tokens = [tok for tok in t.split() if len(tok) > 2]
    if tokens and foods:
        for f in foods:
            if any(tok in f for tok in tokens):
                return f
    return None

@router.post("/ask")
async def ask(
    message: str = Form(""),
    images: Optional[List[UploadFile]] = None,
    audio: Optional[UploadFile] = None,
    user=Depends(get_current_user)
):
    if images:
        for img in images:
            name = (img.filename or "").lower()
            food = _food_from_text(name)
            if food:
                kcal100 = kcal_per_100g(food)
                alts = healthy_alternatives(food)
                alt_txt = f"Healthy alternatives: {', '.join(alts)}." if alts else ""
                return {
                    "answer": f"Detected food: {food}. It is ~{kcal100} kcal per 100g. {alt_txt} How many grams did you consume?"
                }
    if audio:
        return {"answer": "Received audio. Speech-to-text is not enabled. Please type your question for now."}
    if message:
        resp = answer_from_datasets(message)
        if resp.get("answer"):
            pass
        food = _food_from_text(message) or _match_food_from_dataset(message)
        qty_match = re.search(r'(\d{1,4})\s*(g|gram|grams|ml)', message.lower())
        if food:
            kcal100 = kcal_per_100g(food)
            if qty_match:
                grams = int(qty_match.group(1))
                total = round(kcal100 * grams / 100)
                prot_per100 = 0.0
                carbs_per100 = 0.0
                fat_per100 = 0.0
                try:
                    row = logic.df_food[logic.df_food["food"].str.lower() == food.lower()].iloc[0]
                    prot_per100 = float(row.get("protein", 0) or 0)
                    carbs_per100 = float(row.get("carbs", 0) or 0)
                    fat_per100 = float(row.get("fat", 0) or 0)
                except Exception:
                    pass
                prot_serv = round(prot_per100 * grams / 100, 2)
                carbs_serv = round(carbs_per100 * grams / 100, 2)
                fat_serv = round(fat_per100 * grams / 100, 2)
                alts = healthy_alternatives(food)
                alt_txt = f" Consider: {', '.join(alts)}." if alts else ""
                return {
                    "answer": f"{grams}g of {food} is ~{total} kcal.{alt_txt}",
                    "food_name": food,
                    "kcal_per_100g": float(kcal100),
                    "grams": grams,
                    "kcal_total": float(total),
                    "protein_g": prot_serv,
                    "carbs_g": carbs_serv,
                    "fat_g": fat_serv,
                }
            else:
                alts = healthy_alternatives(food)
                alt_txt = f"Healthy alternatives: {', '.join(alts)}." if alts else ""
                return {
                    "answer": f"{food} is ~{kcal100} kcal per 100g. {alt_txt} Tell me quantity (in grams) to estimate calories.",
                    "food_name": food,
                    "kcal_per_100g": float(kcal100),
                }
        if resp.get("answer"):
            return resp
        
        # Try comprehensive chatbot as fallback
        try:
            comprehensive_answer = answer_fitness_question(message)
            if comprehensive_answer and "I couldn't find" not in comprehensive_answer and "I'm not sure" not in comprehensive_answer and "I'm a basic health AI" not in comprehensive_answer:
                return {"answer": comprehensive_answer}
        except Exception:
            pass
        
        # Only use simple_health_ai if comprehensive chatbot fails
        return {"answer": simple_health_ai(message)}
    return {"answer": "Ask a health question or upload an image/audio for analysis."}

@router.post("/comprehensive-ask")
async def comprehensive_ask(
    request: ComprehensiveChatIn,
    user=Depends(get_current_user)
):
    """
    Comprehensive chatbot endpoint that can answer questions from all fitness datasets:
    - Exercises database (workouts, muscles, equipment)
    - Indian Food Nutrition (calories, macros, vitamins)
    - Diet Recommendations (personalized diet plans)
    - Disease-Food Nutrition (condition-specific food advice)
    - Yoga Poses (asanas, benefits, instructions)
    """
    try:
        question = request.question.strip()
        
        if not question:
            return {
                "answer": "Please ask a question about fitness, nutrition, exercises, yoga, or diet.",
                "category": "error",
                "confidence": 0
            }
        
        # Get answer from comprehensive chatbot
        answer = answer_fitness_question(question)
        
        # Determine category based on question content
        question_lower = question.lower()
        category = "general"
        
        if any(keyword in question_lower for keyword in ['exercise', 'workout', 'muscle', 'strength', 'training', 'fitness']):
            category = "exercises"
        elif any(keyword in question_lower for keyword in ['yoga', 'pose', 'asana', 'meditation']):
            category = "yoga"
        elif any(keyword in question_lower for keyword in ['calories', 'protein', 'nutrition', 'food', 'eat']):
            category = "nutrition"
        elif any(keyword in question_lower for keyword in ['diet', 'weight loss', 'weight gain']):
            category = "diet"
        elif any(keyword in question_lower for keyword in ['disease', 'diabetes', 'health condition']):
            category = "health"
        
        return {
            "answer": answer,
            "category": category,
            "question": question,
            "confidence": 0.85,  # High confidence for dataset-based answers
            "sources": [
                "Exercises Database",
                "Indian Food Nutrition Dataset", 
                "Diet Recommendations Dataset",
                "Disease-Food Nutrition Dataset",
                "Yoga Poses Dataset"
            ]
        }
        
    except Exception as e:
        return {
            "answer": f"Sorry, I encountered an error while processing your question: {str(e)}. Please try again.",
            "category": "error",
            "confidence": 0,
            "error": str(e)
        }

@router.get("/chatbot-capabilities")
async def get_chatbot_capabilities(user=Depends(get_current_user)):
    """
    Get information about what the comprehensive chatbot can do
    """
    return {
        "capabilities": {
            "exercises": {
                "description": "Information about exercises, workouts, muscle groups, and equipment",
                "examples": [
                    "Tell me about squats",
                    "What exercises work the chest?",
                    "Show me body weight exercises",
                    "What equipment do I need for deadlifts?"
                ]
            },
            "nutrition": {
                "description": "Nutritional information for Indian foods and general nutrition advice",
                "examples": [
                    "How many calories are in chai?",
                    "What are high protein Indian foods?",
                    "Tell me about the nutrition in dal",
                    "What foods are high in fiber?"
                ]
            },
            "diet_recommendations": {
                "description": "Personalized diet recommendations based on age, weight, goals, and health conditions",
                "examples": [
                    "Give me a diet plan for weight loss",
                    "What should a 25-year-old male eat for muscle gain?",
                    "Diet plan for diabetes",
                    "Vegetarian diet for maintaining weight"
                ]
            },
            "health_conditions": {
                "description": "Food recommendations for specific health conditions and diseases",
                "examples": [
                    "What foods should I eat for diabetes?",
                    "Foods to avoid with hypertension",
                    "Nutrition for heart health",
                    "Diet for anemic patients"
                ]
            },
            "yoga": {
                "description": "Yoga poses, benefits, instructions, and difficulty levels",
                "examples": [
                    "Tell me about downward dog pose",
                    "What are some beginner yoga poses?",
                    "Benefits of warrior pose",
                    "How to do tree pose correctly?"
                ]
            }
        },
        "total_datasets": 5,
        "total_records": {
            "exercises": 1326,
            "indian_food": 1016,
            "diet_recommendations": 12,
            "disease_food": 502,
            "yoga_poses": 64
        }
    }

@router.post("/public-ask")
async def public_ask(request: ComprehensiveChatIn):
    """
    Public chatbot endpoint without authentication - NOW CONVERSATIONAL!
    Uses ChatGPT-like conversational logic instead of raw data.
    """
    try:
        question = request.question.strip()
        
        if not question:
            return {
                "answer": "Hello! I'm your fitness assistant. How can I help you today?",
                "category": "greeting",
                "confidence": 0.9
            }
        
        # Check for greetings
        question_lower = question.lower()
        greetings = ['hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings']
        if any(greeting in question_lower for greeting in greetings):
            return {
                "answer": "Hi there! Ready to talk about fitness and nutrition. What's on your mind?",
                "category": "greeting",
                "confidence": 0.95
            }
        
        # Check for goodbyes
        goodbyes = ['bye', 'goodbye', 'see you', 'exit', 'quit', 'thanks', 'thank you']
        if any(goodbye in question_lower for goodbye in goodbyes):
            return {
                "answer": "Take care! Stay healthy and fit!",
                "category": "farewell",
                "confidence": 0.95
            }
        
        # Use conversational chatbot for all other questions
        try:
            # Create a unique user_id for public sessions
            user_id = "public_user"
            
            # Get conversational response
            conversational_response = process_conversational_message(user_id, question)
            
            # Extract answer and metadata
            answer = conversational_response['answer']
            topic = conversational_response.get('topic', 'general')
            follow_ups = conversational_response.get('follow_up_questions', [])
            
            # Determine category
            category = "general"
            if topic == 'nutrition':
                category = "nutrition"
            elif topic == 'exercise':
                category = "exercises"
            elif topic == 'weight loss':
                category = "diet"
            elif topic == 'yoga':
                category = "yoga"
            elif topic == 'health':
                category = "health"
            
            # Add follow-up suggestions to the answer if available
            if follow_ups and len(follow_ups) > 0:
                answer += f"\n\n💭 You can also ask:\n"
                for i, follow_up in enumerate(follow_ups[:2], 1):
                    answer += f"   {i}. {follow_up}\n"
            
            return {
                "answer": answer,
                "category": category,
                "question": question,
                "confidence": 0.9,
                "topic": topic,
                "follow_up_questions": follow_ups,
                "conversational": True,
                "sources": [
                    "Exercises Database",
                    "Indian Food Nutrition Dataset", 
                    "Diet Recommendations Dataset",
                    "Disease-Food Nutrition Dataset",
                    "Yoga Poses Dataset"
                ]
            }
            
        except Exception as conv_error:
            # Fallback to original logic if conversational fails
            answer = answer_fitness_question(question)
            
            # Make it conversational even as fallback
            if "Results" in answer or "cake" in answer.lower():
                answer = f"I found some information for you:\n\n{answer}\n\nWould you like to know more about this topic?"
            
            question_lower = question.lower()
            category = "general"
            
            if any(keyword in question_lower for keyword in ['exercise', 'workout', 'muscle', 'strength', 'training', 'fitness']):
                category = "exercises"
            elif any(keyword in question_lower for keyword in ['yoga', 'pose', 'asana', 'meditation']):
                category = "yoga"
            elif any(keyword in question_lower for keyword in ['calories', 'protein', 'nutrition', 'food', 'eat']):
                category = "nutrition"
            elif any(keyword in question_lower for keyword in ['diet', 'weight loss', 'weight gain']):
                category = "diet"
            elif any(keyword in question_lower for keyword in ['disease', 'diabetes', 'health condition']):
                category = "health"
            
            return {
                "answer": answer,
                "category": category,
                "question": question,
                "confidence": 0.8,
                "conversational": True,
                "sources": [
                    "Exercises Database",
                    "Indian Food Nutrition Dataset", 
                    "Diet Recommendations Dataset",
                    "Disease-Food Nutrition Dataset",
                    "Yoga Poses Dataset"
                ]
            }
        
    except Exception as e:
        return {
            "answer": f"I'm having trouble processing that. Could you try rephrasing your question about fitness, nutrition, or exercises?",
            "category": "error",
            "confidence": 0,
            "error": str(e)
        }
