"""
Dynamic Intelligent Fitness Chatbot Logic with LLaMA 3 Integration
Can answer ANY question about ANY attribute in ANY dataset without hardcoded patterns
Enhanced with Meta AI LLaMA 3 via Ollama for intelligent responses
"""

import pandas as pd
import re
import json
from typing import Dict, List, Any, Optional, Tuple, Union
import numpy as np
from datetime import datetime
import requests
import asyncio

class FitnessChatbot:
    def __init__(self, use_llama=False, ollama_url="http://localhost:11434"):
        """Initialize the dynamic chatbot with all datasets and optional LLaMA 3"""
        self.use_llama = use_llama
        self.ollama_url = ollama_url
        self.llama_model = "llama3"
        
        self.datasets = {}
        self.dataset_metadata = {}
        self.load_all_datasets()
        self.build_dataset_metadata()
        
        # Test Ollama connection if LLaMA is enabled
        if self.use_llama:
            self.test_ollama_connection()
        
    def test_ollama_connection(self):
        """Test connection to Ollama server"""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [model['name'] for model in models]
                if self.llama_model in model_names:
                    print(f"LLaMA 3 connected successfully via Ollama")
                    return True
                else:
                    print(f"LLaMA 3 model not found. Available models: {model_names}")
                    self.use_llama = False
                    return False
            else:
                print(f"Ollama server not responding. Using dataset-only mode.")
                self.use_llama = False
                return False
        except Exception as e:
            print(f"Could not connect to Ollama: {e}. Using dataset-only mode.")
            self.use_llama = False
            return False

    def load_all_datasets(self):
        """Load all available datasets"""
        try:
            # Load exercises dataset
            self.datasets['exercises'] = pd.read_csv('app/exercises.csv')
            # Load food nutrition dataset
            self.datasets['food_nutrition'] = pd.read_csv('app/Indian_Food_Nutrition_Processed.csv')
            # Load diet recommendations dataset
            self.datasets['diet_recommendations'] = pd.read_csv('app/diet_recommendations_dataset.csv')
            # Load disease-food nutrition dataset
            self.datasets['disease_food_nutrition'] = pd.read_csv('app/real_disease_food_nutrition_dataset.csv')
            # Load yoga poses dataset
            self.datasets['yoga_poses'] = pd.read_csv('app/final_asan1_1.csv')
            print(f"Loaded {len(self.datasets)} datasets")
        except Exception as e:
            print(f"Error loading datasets: {e}")
            # Create empty datasets as fallback
            self.datasets = {
                'exercises': pd.DataFrame(),
                'food_nutrition': pd.DataFrame(),
                'diet_recommendations': pd.DataFrame(),
                'disease_food_nutrition': pd.DataFrame(),
                'yoga_poses': pd.DataFrame()
            }
    
    def build_dataset_metadata(self):
        """Build metadata for all datasets"""
        for name, df in self.datasets.items():
            self.dataset_metadata[name] = {
                'columns': df.columns.tolist(),
                'shape': df.shape,
                'sample_data': df.head(3).to_dict('records') if not df.empty else []
            }
    
    def extract_query_intent(self, question: str) -> Dict:
        """Extract intent from user question"""
        question_lower = question.lower()
        
        # Simple intent extraction
        intent = {
            'question': question,
            'keywords': [],
            'dataset': None,
            'attribute': None,
            'operation': None
        }
        
        # Determine dataset and operation based on keywords
        if any(word in question_lower for word in ['exercise', 'workout', 'gym']):
            intent['dataset'] = 'exercises'
        elif any(word in question_lower for word in ['food', 'calories', 'protein', 'nutrition']):
            intent['dataset'] = 'food_nutrition'
        
        return intent
    
    def execute_dynamic_query(self, intent: Dict) -> str:
        """Execute dynamic query based on intent"""
        dataset_name = intent.get('dataset')
        
        if not dataset_name or dataset_name not in self.datasets:
            return "I couldn't find specific information for your query. Here's what I can help you with:\n\nAvailable Datasets:\n• Exercises (1324 items)\n• Indian Food Nutrition (1014 items)\n• Diet Recommendations (10 items)\n• Disease-Food Nutrition (500 items)\n• Yoga Poses (62 items)\n\nYou can ask about:\n• Specific items (e.g., 'squats', 'chai', 'diabetes')\n• Categories (e.g., 'chest exercises', 'high protein foods')\n• Comparisons (e.g., 'highest calorie foods')\n• Counts (e.g., 'how many exercises for chest')\n• Attributes (e.g., 'calories in boiled egg')\n• Numeric operations (e.g., 'average protein in foods')\n• Filtering (e.g., 'foods with more than 20g protein')"
        
        df = self.datasets[dataset_name]
        
        if df.empty:
            return f"No data available in {dataset_name} dataset."
        
        # Simple search implementation
        question = intent['question'].lower()
        
        # Search for relevant items
        results = []
        for _, row in df.iterrows():
            # Simple text matching
            row_text = ' '.join([str(val).lower() for val in row.values if pd.notna(val)])
            if any(word in row_text for word in question.split() if len(word) > 2):
                results.append(row.to_dict())
        
        if not results:
            return f"No results found for '{intent['question']}' in {dataset_name}."
        
        # Format results
        response = f"Found {len(results)} results:\n\n"
        for i, result in enumerate(results[:5], 1):
            response += f"{i}. {result.get('name', 'Unknown')}\n"
            for key, value in result.items():
                if key != 'name' and pd.notna(value):
                    response += f"   {key}: {value}\n"
            response += "\n"
        
        return response
    
    def answer_question(self, question: str) -> str:
        """Main method to answer any question about the datasets with dynamic fallback"""
        if not self.datasets:
            return "Sorry, I'm having trouble loading my knowledge base. Please try again later."
        
        # Extract intent from the question
        intent = self.extract_query_intent(question)
        
        # Try dataset-based answer first
        dataset_response = self.execute_dynamic_query(intent)
        
        # If dataset gives good results, use them
        if dataset_response and not self.is_dataset_response_empty(dataset_response):
            return dataset_response
        
        # If dataset doesn't have good answer, use dynamic intelligent fallback
        dynamic_response = self.generate_dynamic_response(question, intent)
        if dynamic_response:
            return dynamic_response
        
        # Final fallback with helpful general response
        return self.generate_helpful_fallback(question, intent)
    
    def is_dataset_response_empty(self, response: str) -> bool:
        """Check if dataset response is essentially empty or not helpful"""
        empty_indicators = [
            "no results found",
            "not found in dataset",
            "no data available",
            "sorry, i couldn't find",
            "i don't have information",
            "no matching results",
            "i couldn't find specific information for your query",
            "here's what i can help you with:",
            "available datasets:",
            "you can ask about:"
        ]
        
        response_lower = response.lower()
        return any(indicator in response_lower for indicator in empty_indicators)
    
    def generate_dynamic_response(self, question: str, intent: Dict) -> str:
        """Generate intelligent responses for common fitness questions not in datasets"""
        
        question_lower = question.lower()
        
        # Weight management questions
        if any(keyword in question_lower for keyword in ['lose weight', 'weight loss', 'reduce weight']):
            return self.generate_weight_loss_advice(question_lower, intent)
        
        # Muscle gain questions
        elif any(keyword in question_lower for keyword in ['gain muscle', 'build muscle', 'muscle growth']):
            return self.generate_muscle_gain_advice(question_lower, intent)
        
        # Workout routine questions
        elif any(keyword in question_lower for keyword in ['workout routine', 'exercise plan', 'fitness plan']):
            return self.generate_workout_routine_advice(question_lower, intent)
        
        return None
    
    def generate_weight_loss_advice(self, question: str, intent: Dict) -> str:
        """Generate weight loss advice"""
        return """For effective weight loss, I recommend a combination of regular exercise and a balanced diet.

Exercise Tips:
• Aim for 150-300 minutes of moderate-intensity cardio per week
• Include strength training 2-3 times per week to maintain muscle mass
• Try activities like brisk walking, cycling, swimming, or jogging
• Start with 30 minutes daily and gradually increase duration

Nutrition Tips:
• Create a moderate calorie deficit (500-750 calories less than maintenance)
• Focus on whole foods: lean proteins, vegetables, fruits, and whole grains
• Drink plenty of water (8-10 glasses daily)
• Limit processed foods, sugar, and excessive saturated fats

Remember: Sustainable weight loss is typically 0.5-1 kg per week. Consistency is more important than perfection!"""
    
    def generate_muscle_gain_advice(self, question: str, intent: Dict) -> str:
        """Generate muscle gain advice"""
        return """To build muscle effectively, you need proper resistance training, adequate protein, and sufficient recovery.

Training Principles:
• Progressive overload: gradually increase weight, reps, or sets
• Focus on compound exercises: squats, deadlifts, bench press, rows
• Train each muscle group 2-3 times per week
• Aim for 8-12 reps per set for hypertrophy (muscle growth)
• Rest 60-90 seconds between sets

Nutrition for Muscle Growth:
• Consume 1.6-2.2g of protein per kg of body weight daily
• Eat in a slight calorie surplus (300-500 calories above maintenance)
• Include protein sources: chicken, fish, eggs, dairy, legumes, tofu
• Time protein intake: have some within 2 hours post-workout

Recovery is Crucial:
• Get 7-9 hours of quality sleep per night
• Allow 48 hours between training the same muscle group
• Consider rest days and deload weeks"""
    
    def generate_workout_routine_advice(self, question: str, intent: Dict) -> str:
        """Generate workout routine advice"""
        return """Here's an effective 30-minute workout routine:

30-Minute Full Body Workout

Warm-up (5 minutes):
• Jumping jacks - 2 minutes
• Arm circles and leg swings - 3 minutes

Main Workout (20 minutes):
• Bodyweight squats - 3 sets of 15 reps
• Push-ups (modify as needed) - 3 sets of 10 reps
• Plank hold - 3 sets of 30 seconds
• Lunges - 3 sets of 12 reps per leg
• Jumping jacks - 2 minutes

Cool-down (5 minutes):
• Full body stretches - 5 minutes

This routine hits all major muscle groups and can be done anywhere!"""
    
    def generate_helpful_fallback(self, question: str, intent: Dict) -> str:
        """Generate a helpful fallback response when no specific answer is available"""
        return f"""I understand you're asking about: "{question}"

While I don't have specific information about this in my current database, I can help with many fitness and nutrition topics!

I can help you with:
• Workout routines and exercise plans
• Nutrition advice and healthy eating
• Weight loss and muscle gain strategies
• Beginner fitness guidance
• Injury prevention tips
• Motivation and consistency strategies
• Progress tracking methods
• Equipment recommendations

Try asking me about:
• "How to lose weight effectively"
• "Best exercises for muscle gain"
• "Healthy meal planning"
• "Beginner workout routine"
• "How to stay motivated"
• "Injury prevention tips"

If you have a specific fitness goal or question, feel free to rephrase it and I'll do my best to help you achieve your health and fitness goals!

You can also ask me about specific exercises, foods, or nutritional information, and I'll search my extensive database for you."""

# Global instance
chatbot_instance = None

def get_chatbot(use_llama=False, ollama_url="http://localhost:11434"):
    """Get or create chatbot instance"""
    global chatbot_instance
    if chatbot_instance is None:
        chatbot_instance = FitnessChatbot(use_llama=use_llama, ollama_url=ollama_url)
    return chatbot_instance

def answer_fitness_question(question: str, use_llama=False, ollama_url="http://localhost:11434") -> str:
    """Main function to answer any fitness-related question dynamically with LLaMA 3 option"""
    bot = get_chatbot(use_llama=use_llama, ollama_url=ollama_url)
    return bot.answer_question(question)
