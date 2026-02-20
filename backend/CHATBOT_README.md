# Comprehensive Fitness Chatbot - Usage Guide

## Overview
The comprehensive fitness chatbot can answer questions from 5 different fitness datasets:
- **Exercises Database** (1,326 exercises)
- **Indian Food Nutrition** (1,016 foods)
- **Diet Recommendations** (12 personalized plans)
- **Disease-Food Nutrition** (502 disease-food pairs)
- **Yoga Poses** (64 yoga asanas)

## API Endpoints

### 1. Comprehensive Chat Endpoint
**POST** `/chat/comprehensive-ask`

**Request Body:**
```json
{
  "question": "Tell me about squats",
  "context": "optional context"
}
```

**Response:**
```json
{
  "answer": "Detailed answer from datasets...",
  "category": "exercises",
  "question": "Tell me about squats",
  "confidence": 0.85,
  "sources": ["Exercises Database", "Indian Food Nutrition Dataset", ...]
}
```

### 2. Chatbot Capabilities Endpoint
**GET** `/chat/chatbot-capabilities`

Returns information about what the chatbot can do and example questions.

## Question Categories & Examples

### 🏋️ Exercises
- "Tell me about squats"
- "What exercises work the chest?"
- "Show me body weight exercises"
- "What equipment do I need for deadlifts?"
- "Exercises for abs"

### 🥗 Nutrition (Indian Foods)
- "How many calories are in chai?"
- "What are high protein Indian foods?"
- "Tell me about the nutrition in dal"
- "What foods are high in fiber?"
- "Nutrition in biryani"

### 📋 Diet Recommendations
- "Give me a diet plan for weight loss"
- "What should a 25-year-old male eat for muscle gain?"
- "Diet plan for diabetes"
- "Vegetarian diet for maintaining weight"
- "30 year old female moderate activity weight loss"

### 🏥 Health Conditions
- "What foods should I eat for diabetes?"
- "Foods to avoid with hypertension"
- "Nutrition for heart health"
- "Diet for anemic patients"
- "Foods for high blood pressure"

### 🧘 Yoga
- "Tell me about downward dog pose"
- "What are some beginner yoga poses?"
- "Benefits of warrior pose"
- "How to do tree pose correctly?"
- "Intermediate yoga poses"

## Features

### Smart Question Classification
The chatbot automatically classifies questions into categories and routes them to the appropriate dataset.

### Fuzzy String Matching
- Uses fuzzy matching to find similar exercise/food names
- Handles typos and variations in naming
- Confidence scoring for matches

### Personalized Diet Plans
- Extracts age, weight, height, gender, activity level, goals from questions
- Provides personalized recommendations based on user profile
- Takes into account health conditions

### Comprehensive Responses
- Detailed exercise instructions with step-by-step guides
- Complete nutritional information including vitamins and minerals
- Yoga pose descriptions with benefits and contraindications
- Disease-specific food recommendations

## Integration Examples

### Frontend Integration (JavaScript)
```javascript
async function askChatbot(question) {
  const response = await fetch('/api/chat/comprehensive-ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ question })
  });
  
  const data = await response.json();
  return data.answer;
}

// Usage
const answer = await askChatbot("Tell me about squats");
console.log(answer);
```

### Python Integration
```python
import requests

def ask_chatbot(question, token):
    url = "http://localhost:8000/api/chat/comprehensive-ask"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    data = {"question": question}
    
    response = requests.post(url, json=data, headers=headers)
    return response.json()

# Usage
result = ask_chatbot("What exercises work the chest?", "your_token")
print(result["answer"])
```

## Error Handling
- Invalid questions return helpful error messages
- Dataset loading errors are handled gracefully
- Fallback responses when no matches found
- Confidence scoring indicates answer reliability

## Performance
- All datasets loaded into memory for fast responses
- Fuzzy matching optimized for performance
- Concurrent request handling
- Response time typically under 500ms

## Limitations
- Diet recommendations limited to available dataset (12 profiles)
- Yoga poses limited to 64 asanas
- Indian food dataset specific to Indian cuisine
- Exercise matching based on name similarity

## Future Enhancements
- Add more diet profiles for better personalization
- Expand yoga pose database
- Add international food datasets
- Implement machine learning for better matching
- Add voice input/output capabilities
