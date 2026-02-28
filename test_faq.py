# Test FAQ System
# Run: python test_faq.py

import sys
sys.path.append('backend')

from fuzzywuzzy import fuzz
import pandas as pd

# Load FAQ dataset
faq_df = pd.read_csv('backend/app/general_fitness_faq_training_dataset.csv')

# Response templates
RESPONSES = {
    "weight_loss": "To lose weight: 1) Create a calorie deficit (eat 300-500 cal below maintenance), 2) Do cardio 3-4x/week, 3) Strength train 2-3x/week, 4) Eat high protein (1.6-2g per kg), 5) Stay hydrated, 6) Sleep 7-8 hours.",
    "muscle_gain": "To gain muscle: 1) Eat in calorie surplus (300-500 cal above maintenance), 2) Consume 1.6-2.2g protein per kg bodyweight, 3) Progressive strength training 4-5x/week, 4) Rest 48hrs between muscle groups, 5) Sleep 7-9 hours.",
    "diet_general": "A balanced diet includes: 1) Lean proteins (chicken, fish, lentils, paneer), 2) Complex carbs (brown rice, oats, quinoa), 3) Healthy fats (nuts, avocado, olive oil), 4) Fruits & vegetables, 5) 2-3L water daily.",
    "calorie_query": "Daily calories depend on age, weight, height, activity level. Use: BMR × Activity Factor. For weight loss: subtract 300-500 cal. For muscle gain: add 300-500 cal. Track using apps or consult our recommendations.",
    "protein_query": "Protein sources: Vegetarian - paneer, dal, chickpeas, tofu, Greek yogurt, quinoa, nuts. Non-veg - chicken breast, fish, eggs. Aim for 1.6-2.2g per kg bodyweight for muscle building, 1.2-1.6g for maintenance.",
    "workout_general": "Beginner workout: 1) Start 3-4 days/week, 2) 30-45 min sessions, 3) Mix cardio & strength, 4) Full body or upper/lower split, 5) Rest days crucial. Home workouts work great - no gym needed initially.",
    "belly_fat": "Reduce belly fat: 1) Overall calorie deficit (spot reduction is a myth), 2) HIIT cardio 3x/week, 3) Core exercises (planks, crunches), 4) Reduce sugar & processed foods, 5) Manage stress, 6) Sleep well.",
    "bmi_query": "BMI = weight(kg) / height(m)². Normal: 18.5-24.9, Overweight: 25-29.9, Obese: 30+. Note: BMI doesn't account for muscle mass. Use it as one indicator among others like body fat %, waist circumference.",
    "water_intake": "Water intake: 0.033L per kg bodyweight (minimum 2L). More if exercising, hot climate, or sweating heavily. Benefits: metabolism boost, appetite control, better performance, toxin removal, skin health.",
    "stamina_energy": "Improve stamina: 1) Regular cardio (running, cycling, swimming), 2) Interval training, 3) Eat complex carbs pre-workout, 4) Stay hydrated, 5) Adequate sleep, 6) B-vitamins & iron-rich foods, 7) Gradual progression."
}

def ask_faq(question):
    best_match = None
    best_score = 0
    best_intent = None
    
    for _, row in faq_df.iterrows():
        score = fuzz.token_set_ratio(question.lower(), row['text'].lower())
        if score > best_score:
            best_score = score
            best_match = row['text']
            best_intent = row['intent']
    
    if best_score < 40:
        return {
            "question": question,
            "answer": "I'm not sure about that. Please ask about weight loss, muscle gain, diet, calories, protein, workouts, belly fat, BMI, water intake, or stamina.",
            "intent": "unknown",
            "confidence": 0.0
        }
    
    return {
        "question": best_match,
        "answer": RESPONSES.get(best_intent, "Information not available."),
        "intent": best_intent,
        "confidence": round(best_score / 100, 2)
    }

# Test questions
test_questions = [
    "how do i lose weight?",
    "build muscle tips",
    "what to eat daily",
    "protein foods",
    "reduce tummy fat",
    "calculate bmi",
    "water per day"
]

print("=== FAQ System Test ===\n")
for q in test_questions:
    result = ask_faq(q)
    print(f"Q: {q}")
    print(f"Matched: {result['question']}")
    print(f"Intent: {result['intent']} (confidence: {result['confidence']})")
    print(f"A: {result['answer']}\n")
