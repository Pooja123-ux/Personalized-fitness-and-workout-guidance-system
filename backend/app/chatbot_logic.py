"""
Dataset-first fitness chatbot logic.
Answers are generated from available datasets using keyword and column matching.

Enhanced with:
- Advanced fuzzy logic for typos, misspellings, phonetic variants
- Comprehensive synonym/alias maps so the same question asked differently always works
- Unstructured grammar parsing (fragmented, reversed, informal queries)
- Low-confidence clarification dialogues
- Multi-signal intent inference
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from difflib import SequenceMatcher

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# GLOBAL SYNONYM / ALIAS MAP
# Maps messy user vocabulary → canonical token the rest of logic understands.
# Covers typos, abbreviations, slang, regional spellings, concatenations.
# ---------------------------------------------------------------------------
SYNONYM_MAP: Dict[str, str] = {
    # --- calorie variants ---
    "cal": "calories", "cals": "calories", "calori": "calories", "caloreis": "calories",
    "callories": "calories", "kcals": "calories", "calroies": "calories",
    "calries": "calories", "claories": "calories", "caloroes": "calories",
    # --- protein variants ---
    "protien": "protein", "protin": "protein", "protine": "protein",
    "protain": "protein", "proten": "protein", "proteen": "protein",
    "prtein": "protein", "protien": "protein", "ptrotein": "protein",
    # --- carbohydrate variants ---
    "carb": "carbohydrates", "carbs": "carbohydrates", "carbo": "carbohydrates",
    "carbos": "carbohydrates", "carbohydrate": "carbohydrates",
    # --- fat variants ---
    "fats": "fat", "fatt": "fat", "lipid": "fat", "lipids": "fat",
    # --- fiber variants ---
    "fibre": "fiber", "fibere": "fiber", "fibres": "fiber", "fiver": "fiber",
    # --- weight / BMI ---
    "bmi": "bmi", "bodymass": "bmi", "body mass": "bmi",
    "wieght": "weight", "wight": "weight", "weigth": "weight",
    "kgs": "kg", "kgd": "kg", "kilo": "kg", "kilos": "kg", "kilogram": "kg",
    "lbs": "pounds", "lb": "pounds", "pond": "pounds",
    # --- height ---
    "cms": "cm", "centimeter": "cm", "centimetre": "cm", "centimeters": "cm",
    "meter": "m", "metre": "m", "meters": "m",
    # --- exercise ---
    "exersice": "exercise", "excercise": "exercise", "exercice": "exercise",
    "exrecise": "exercise", "exercize": "exercise", "exersize": "exercise",
    "worktout": "workout", "workotu": "workout", "wrk": "workout",
    "traing": "training", "trainning": "training", "trainnig": "training",
    "gym": "gym", "gyming": "gym",
    # --- muscle groups ---
    "sholder": "shoulder", "sholders": "shoulder", "shulder": "shoulder",
    "tricep": "triceps", "bicep": "biceps",
    "hamstring": "hamstrings", "quad": "quads", "quadricep": "quads",
    "abs": "core", "abdomen": "core", "ab": "core",
    "glute": "glutes", "butt": "glutes", "buttocks": "glutes",
    "calve": "calves", "calf": "calves",
    # --- yoga ---
    "yog": "yoga", "yogaa": "yoga", "yuoga": "yoga",
    "pose": "pose", "asana": "pose", "asan": "pose",
    # --- nutrition / diet ---
    "nutirtion": "nutrition", "nutrion": "nutrition", "nutrtion": "nutrition",
    "nutricients": "nutrients", "nutients": "nutrients",
    "deit": "diet", "diett": "diet", "dieting": "diet",
    "weigh loss": "weight loss", "fat loss": "weight loss",
    "loose weight": "lose weight", "loosing weight": "losing weight",
    "shed weight": "lose weight", "slim down": "lose weight",
    "how long to workout": "how long should a workout be",
    "how long to exercise": "how long should a workout be",
    "workout for how long": "how long should a workout be",
    "exercise for how long": "how long should a workout be",
    # --- health conditions ---
    "diabeties": "diabetes", "diabetis": "diabetes", "diebetes": "diabetes",
    "hypertenshion": "hypertension", "hypertenstion": "hypertension",
    "cholestrol": "cholesterol", "cholesteral": "cholesterol",
    # --- water ---
    "hyddration": "hydration", "hydartion": "hydration",
    "h2o": "water", "watter": "water",
    # --- general health / fitness ---
    "helath": "health", "heatlh": "health", "helth": "health",
    "fitnes": "fitness", "fitnss": "fitness", "fittness": "fitness",
    "stamnia": "stamina", "stmina": "stamina",
    # --- food items ---
    "roti": "roti", "chapati": "roti", "chapatti": "roti",
    "paneer": "paneer", "paner": "paneer",
    "dhal": "dal", "dhaal": "dal", "daal": "dal",
    "ricee": "rice", "rie": "rice",
    # --- supplements ---
    "whey protien": "whey protein", "whey protin": "whey protein",
    "creatine": "creatine", "creatien": "creatine",
    # --- body composition ---
    "bdy fat": "body fat", "bdy fatt": "body fat",
    "muscel": "muscle", "muscl": "muscle", "muscels": "muscles",
    # --- sleep / recovery ---
    "recvoery": "recovery", "recov": "recovery",
    "sleap": "sleep", "sleeep": "sleep",
    # --- action verbs (common typos) ---
    "caluclate": "calculate", "calcuate": "calculate", "calculat": "calculate",
    "calculte": "calculate", "calc": "calculate",
    "recommed": "recommend", "reccomend": "recommend", "recomend": "recommend",
    "sugest": "suggest", "sugggest": "suggest",
}

# ---------------------------------------------------------------------------
# INTENT SYNONYM MAP
# Maps many surface phrasings to a canonical intent label.
# Used by the enhanced intent extractor to normalize diverse queries.
# ---------------------------------------------------------------------------
INTENT_KEYWORD_MAP: Dict[str, List[str]] = {
    "weight_loss": [
        "lose weight", "weight loss", "fat loss", "lose fat", "slim", "slimming",
        "drop weight", "shed kilos", "lose kilos", "cut fat", "cut weight",
        "reduce weight", "burn fat", "get lean", "get slim", "belly fat",
        "tummy fat", "love handles", "calorie deficit", "body fat reduction",
        "how to reduce", "how to slim", "loose weight", "loosing weight",
    ],
    "muscle_gain": [
        "build muscle", "muscle gain", "gain muscle", "bulk up", "bulking",
        "hypertrophy", "get bigger", "increase muscle", "mass building",
        "muscle building", "strength gain", "gain mass", "put on muscle",
        "muscle growth", "how to grow", "grow muscle",
    ],
    "bmi": [
        "bmi", "body mass index", "calculate bmi", "bmi calculator",
        "what is my bmi", "my bmi", "check bmi", "bmi check",
        "am i overweight", "am i underweight", "body weight index",
    ],
    "calories": [
        "calories", "kcal", "calorie intake", "daily calories", "tdee", "bmr",
        "calorie needs", "how many calories", "calorie requirement",
        "maintenance calories", "calorie calculation", "total calories",
        "how much should i eat", "energy intake",
    ],
    "protein": [
        "protein", "how much protein", "protein intake", "daily protein",
        "protein requirement", "protein per day", "protein consumption",
        "protein needed", "protein goal", "protein calculation",
        "how much protien", "protein per kg",
    ],
    "water": [
        "water", "hydration", "water intake", "how much water", "daily water",
        "water per day", "h2o", "drink water", "water requirement",
        "how much should i drink", "fluid intake",
    ],
    "macros": [
        "macros", "macro", "macro split", "macronutrients", "calculate macros",
        "protein carb fat", "macro breakdown", "macro ratio",
    ],
    "exercise": [
        "exercise", "workout", "training", "gym", "strength training",
        "weight training", "resistance", "bodyweight", "calisthenics",
        "cardio", "hiit", "aerobics", "lifting", "weightlifting",
    ],
    "yoga": [
        "yoga", "asana", "pose", "flexibility", "stretch", "stretching",
        "meditation", "pranayama", "yin yoga", "vinyasa", "hatha",
    ],
    "nutrition": [
        "nutrition", "diet", "food", "eating", "meal", "calories",
        "healthy eating", "nutrient", "vitamins", "minerals",
        "macronutrients", "micronutrients", "balanced diet",
    ],
    "health": [
        "health", "wellness", "wellbeing", "healthy", "disease", "condition",
        "diabetes", "hypertension", "cholesterol", "heart", "blood pressure",
        "blood sugar", "joint", "bone",
    ],
    "sleep": [
        "sleep", "rest", "recovery", "sleeping", "insomnia", "nap",
        "sleep schedule", "sleep quality", "sleep hours",
    ],
    "supplements": [
        "supplement", "supplements", "protein powder", "whey", "creatine",
        "bcaa", "multivitamin", "pre workout", "post workout",
        "fish oil", "omega", "vitamin d",
    ],
    "motivation": [
        "motivation", "motivate", "inspired", "inspire", "keep going",
        "give up", "consistency", "discipline", "habit", "routine",
    ],
    "stamina": [
        "stamina", "endurance", "energy", "fatigue", "tired", "exhausted",
        "run longer", "last longer", "improve stamina", "increase energy",
    ],
}


class FitnessChatbot:
    def __init__(self):
        self.datasets: Dict[str, pd.DataFrame] = {}
        self.dataset_metadata: Dict[str, Dict[str, Any]] = {}
        self.qa_cache: Dict[str, str] = {}  # Cache for QA responses
        self.inferred_knowledge: Dict[str, Any] = {}  # Dynamic knowledge base
        self.vocabulary: set = set()  # Dynamic vocabulary from datasets
        self.stop_words = set()  # Will be inferred
        self.generic_query_tokens = set()  # Will be inferred

        self.load_all_datasets()
        self.build_dataset_metadata()
        self._preprocess_qa_dataset()  # Preprocess QA for faster matching
        self._infer_knowledge_from_datasets()  # NEW: Learn from all datasets
        self._build_vocabulary()  # Build vocabulary from datasets

    def _fuzzy_match(self, word: str, targets: List[str], threshold: float = 0.6) -> Optional[str]:
        """Find closest matching word from targets using fuzzy matching.
        Enhanced: checks SYNONYM_MAP first, then edit-distance, then token-prefix."""
        word_l = word.lower().strip()
        
        # 1. Direct synonym lookup (instant, zero cost)
        if word_l in SYNONYM_MAP:
            canonical = SYNONYM_MAP[word_l]
            # If canonical is in targets return it, else fall through to fuzzy
            if canonical in targets:
                return canonical
        
        # 2. Check if word is already an exact target
        if word_l in targets:
            return word_l
        
        # 3. Prefix match (e.g. "calc" → "calculate")
        prefix_matches = [t for t in targets if t.startswith(word_l) and len(t) - len(word_l) <= 4]
        if len(prefix_matches) == 1:
            return prefix_matches[0]
        
        # 4. Sequence ratio fuzzy match
        best_match = None
        best_ratio = 0.0
        for target in targets:
            ratio = SequenceMatcher(None, word_l, target.lower()).ratio()
            if ratio > best_ratio and ratio >= threshold:
                best_ratio = ratio
                best_match = target
        
        return best_match

    def _apply_synonym_map(self, text: str) -> str:
        """Apply SYNONYM_MAP to an entire text string (phrase-level and word-level)."""
        result = text.lower().strip()
        
        # Phase 1: phrase-level replacements (longer phrases first to avoid partial replacement)
        sorted_phrases = sorted(
            [(k, v) for k, v in SYNONYM_MAP.items() if ' ' in k],
            key=lambda x: len(x[0]), reverse=True
        )
        for phrase, replacement in sorted_phrases:
            result = result.replace(phrase, replacement)
        
        # Phase 2: word-level replacements
        words = result.split()
        corrected = []
        for word in words:
            clean_word = re.sub(r'[^a-z0-9]', '', word)
            if clean_word in SYNONYM_MAP:
                corrected.append(SYNONYM_MAP[clean_word])
            else:
                corrected.append(word)
        return ' '.join(corrected)

    def _detect_intents_from_synonyms(self, question: str) -> List[str]:
        """Detect ALL applicable intents from question using INTENT_KEYWORD_MAP.
        Handles unstructured grammar — e.g. 'protien 70kg how much daily i need'
        returns ['protein', 'weight_loss'] intents."""
        q = question.lower()
        detected = []
        for intent_name, keywords in INTENT_KEYWORD_MAP.items():
            for kw in keywords:
                if kw in q:
                    if intent_name not in detected:
                        detected.append(intent_name)
                    break
        return detected

    def _compute_fuzzy_confidence(self, question: str, candidate_response: str) -> float:
        """Estimate how confident we are that candidate_response answers question.
        Returns 0.0–1.0. Used to decide whether to ask a clarifying question."""
        if not candidate_response or not question:
            return 0.0
        q_tokens = set(re.findall(r'[a-z]{3,}', question.lower()))
        r_tokens = set(re.findall(r'[a-z]{3,}', candidate_response.lower()))
        if not q_tokens:
            return 0.5
        overlap = len(q_tokens & r_tokens) / len(q_tokens)
        return min(1.0, overlap * 1.5)  # Slight boost; cap at 1.0

    def _should_ask_clarification(self, question: str, intent: Dict[str, Any]) -> Optional[str]:
        """Return a clarifying question string if the user query is too vague,
        or None if the bot can proceed to answer."""
        q = question.lower().strip()
        detected_intents = self._detect_intents_from_synonyms(q)
        
        # If question is extremely short (1-2 words) and generic, ask for more
        tokens_count = len([t for t in q.split() if len(t) > 2])
        if tokens_count <= 1 and not re.search(r'\d', q):
            # Check what domain it loosely belongs to
            if any(k in q for k in ['exercise', 'workout', 'gym', 'training']):
                return ("Sure! To give you the most relevant exercises, could you tell me:\n"
                        "• Which body part or muscle group? (e.g., chest, back, legs, arms)\n"
                        "• Any equipment preference? (bodyweight, dumbbells, barbell)\n"
                        "• Your goal? (strength, weight loss, muscle gain)")
            if any(k in q for k in ['diet', 'food', 'eat', 'meal', 'nutrition']):
                return ("Happy to help with nutrition! Could you clarify:\n"
                        "• What's your goal? (weight loss, muscle gain, energy, general health)\n"
                        "• Any dietary restrictions? (vegetarian, vegan, diabetic, etc.)")
            if any(k in q for k in ['yoga', 'pose', 'asana']):
                return ("Great! For yoga recommendations, it helps to know:\n"
                        "• Your experience level? (beginner, intermediate, advanced)\n"
                        "• Your goal? (flexibility, stress relief, strength, balance)")
        
        # Calculation queries missing required inputs
        if any(k in q for k in ['bmi', 'calculate bmi', 'my bmi']):
            has_weight = re.search(r'\d+\s*kg', q)
            has_height = re.search(r'\d+\s*cm|\d+\s*m\b', q)
            if not has_weight and not has_height:
                return ("To calculate your BMI, I need:\n"
                        "• Your weight (e.g., 70kg)\n"
                        "• Your height (e.g., 175cm)\n\n"
                        "Example: 'calculate bmi for 70kg 175cm'")
        
        if any(k in q for k in ['calorie', 'calories', 'tdee', 'bmr']):
            has_weight = re.search(r'\d+\s*kg', q)
            has_height = re.search(r'\d+\s*cm', q)
            is_asking_daily = any(k in q for k in ['how much', 'should i eat', 'per day', 'daily', 'calculate'])
            if is_asking_daily and not (has_weight and has_height):
                return ("To calculate your daily calorie needs, please share:\n"
                        "• Weight (kg) and height (cm)\n"
                        "• Age (optional but improves accuracy)\n"
                        "• Gender (male/female)\n"
                        "• Activity level (sedentary / light / moderate / very active)\n\n"
                        "Example: 'calories for 70kg 175cm age 25 male moderate'")
        
        if any(k in q for k in ['protein', 'protien', 'protin']):
            is_asking_daily = any(k in q for k in ['how much', 'per day', 'daily', 'need', 'require', 'calculate'])
            has_weight = re.search(r'\d+\s*kg', q)
            if is_asking_daily and not has_weight:
                return ("To calculate your protein needs, I need your:\n"
                        "• Body weight (e.g., 70kg)\n"
                        "• Goal (weight loss / muscle gain / maintenance)\n\n"
                        "Example: 'how much protein for 70kg muscle gain'")
        
        return None  # No clarification needed

    def _preprocess_qa_dataset(self) -> None:
        """Preprocess QA dataset for faster matching and clean responses"""
        qa_df = self.datasets.get("fitness_qa")
        if qa_df is None or qa_df.empty:
            return
        if 'question' not in qa_df.columns or 'response' not in qa_df.columns:
            return
        
        # Clean response column - remove intent, question, response labels
        if 'response' in qa_df.columns:
            qa_df['response'] = qa_df['response'].apply(
                lambda x: re.sub(r'^(intent:|question:|response:)\s*', '', str(x), flags=re.IGNORECASE).strip()
            )
        if 'intent' not in qa_df.columns:
            qa_df['intent'] = 'general'
        qa_df['intent'] = qa_df['intent'].fillna('general').astype(str).str.lower().str.strip()
        qa_df['question'] = qa_df['question'].astype(str).str.strip()
        qa_df['response'] = qa_df['response'].astype(str).str.strip()
        qa_df = qa_df[(qa_df['question'] != '') & (qa_df['response'] != '')].copy()
        
        # Add preprocessed columns
        qa_df['normalized'] = qa_df['question'].apply(
            lambda x: ' '.join(re.sub(r'[^a-z0-9\s]', '', str(x).lower()).split())
        )
        qa_df['tokens'] = qa_df['normalized'].apply(
            lambda x: set([t for t in x.split() if t not in self.stop_words and len(t) > 2])
        )
        self.datasets["fitness_qa"] = qa_df.reset_index(drop=True)

    def _infer_knowledge_from_datasets(self) -> None:
        """Dynamically infer knowledge patterns from all datasets using fuzzy logic"""
        try:
            knowledge = {}
            
            # Infer from food nutrition dataset
            food_df = self.datasets.get("food_nutrition")
            if food_df is not None and not food_df.empty:
                knowledge['nutrition'] = self._infer_nutrition_patterns(food_df)
            
            # Infer from exercises dataset
            exercise_df = self.datasets.get("exercises")
            if exercise_df is not None and not exercise_df.empty:
                knowledge['exercises'] = self._infer_exercise_patterns(exercise_df)
            
            # Infer from disease dataset
            disease_df = self.datasets.get("disease_food_nutrition")
            if disease_df is not None and not disease_df.empty:
                knowledge['health_conditions'] = self._infer_health_patterns(disease_df)
            
            # Infer from yoga dataset
            yoga_df = self.datasets.get("yoga_poses")
            if yoga_df is not None and not yoga_df.empty:
                knowledge['yoga'] = self._infer_yoga_patterns(yoga_df)
            
            # Infer from QA dataset (general conversational fitness knowledge)
            qa_df = self.datasets.get("fitness_qa")
            if qa_df is not None and not qa_df.empty:
                knowledge['qa'] = self._infer_qa_patterns(qa_df)
            
            self.inferred_knowledge = knowledge
            print(f"Inferred knowledge from {len(knowledge)} dataset categories")
        except Exception as e:
            print(f"Error inferring knowledge: {e}")
            self.inferred_knowledge = {}

    def _infer_qa_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Infer QA intent clusters and high-signal keywords from QA dataset."""
        patterns: Dict[str, Any] = {"intents": {}, "keywords": {}}
        if "intent" not in df.columns or "question" not in df.columns or "response" not in df.columns:
            return patterns

        grouped = df.groupby(df["intent"].fillna("general").astype(str).str.lower().str.strip())
        for intent_name, grp in grouped:
            questions = grp["question"].astype(str).tolist()
            responses = grp["response"].astype(str).tolist()
            token_bucket: List[str] = []
            for q in questions:
                qn = self._apply_synonym_map(re.sub(r"[^a-z0-9\s]", " ", q.lower()))
                token_bucket.extend([t for t in qn.split() if len(t) > 2 and t not in self.stop_words])
            top_keywords = [w for w, _ in Counter(token_bucket).most_common(15)]

            patterns["intents"][intent_name] = {
                "count": len(grp),
                "sample_questions": questions[:5],
                "sample_responses": responses[:5],
                "top_keywords": top_keywords,
            }
            for kw in top_keywords:
                patterns["keywords"].setdefault(kw, set()).add(intent_name)

        patterns["keywords"] = {k: sorted(list(v)) for k, v in patterns["keywords"].items()}
        return patterns

    def _answer_from_inferred_qa(self, question: str) -> Optional[str]:
        """Fallback to QA knowledge for typo-heavy / unstructured general questions."""
        qa_df = self.datasets.get("fitness_qa")
        if qa_df is None or qa_df.empty:
            return None
        if "question" not in qa_df.columns or "response" not in qa_df.columns:
            return None

        qn = self._apply_synonym_map(re.sub(r"[^a-z0-9\s]", " ", (question or "").lower()))
        q_tokens = set([t for t in qn.split() if len(t) > 2 and t not in self.stop_words])
        if not q_tokens:
            return None

        best_score = 0.0
        best_response: Optional[str] = None
        for _, row in qa_df.iterrows():
            candidate_q = str(row.get("question", ""))
            candidate_r = str(row.get("response", "")).strip()
            if not candidate_q or not candidate_r:
                continue
            rn = self._apply_synonym_map(re.sub(r"[^a-z0-9\s]", " ", candidate_q.lower()))
            r_tokens = set([t for t in rn.split() if len(t) > 2 and t not in self.stop_words])
            if not r_tokens:
                continue
            overlap = len(q_tokens & r_tokens) / max(1, len(q_tokens | r_tokens))
            seq = SequenceMatcher(None, qn, rn).ratio()
            score = overlap * 0.7 + seq * 0.3
            if score > best_score:
                best_score = score
                best_response = candidate_r

        if best_score >= 0.28 and best_response:
            return best_response
        return None

    def _infer_nutrition_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Infer nutrition patterns and thresholds from food data"""
        patterns = {}
        
        # Find nutrition columns
        for col in df.columns:
            col_lower = col.lower()
            if any(nutrient in col_lower for nutrient in ['calorie', 'protein', 'fat', 'carb', 'fiber', 'sodium']):
                numeric_vals = pd.to_numeric(df[col], errors='coerce').dropna()
                if len(numeric_vals) > 0:
                    numeric_vals = numeric_vals.astype(float)
                    patterns[col] = {
                        'median': float(numeric_vals.median()),
                        'q25': float(numeric_vals.quantile(0.25)),
                        'q75': float(numeric_vals.quantile(0.75)),
                        'mean': float(numeric_vals.mean()),
                        'std': float(numeric_vals.std())
                    }
        
        # Infer food categories by clustering
        if 'Calories (kcal)' in df.columns:
            cal_col = 'Calories (kcal)'
            cals = pd.to_numeric(df[cal_col], errors='coerce').dropna()
            cals = cals.astype(float)
            patterns['categories'] = {
                'very_low_cal': cals[cals < cals.quantile(0.2)].mean(),
                'low_cal': cals[(cals >= cals.quantile(0.2)) & (cals < cals.quantile(0.4))].mean(),
                'moderate_cal': cals[(cals >= cals.quantile(0.4)) & (cals < cals.quantile(0.6))].mean(),
                'high_cal': cals[cals >= cals.quantile(0.6)].mean()
            }
        
        return patterns

    def _infer_exercise_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Infer exercise patterns from exercise data"""
        patterns = {}
        
        # Infer body part groupings
        if 'target' in df.columns:
            body_parts = df['target'].value_counts().to_dict()
            patterns['popular_targets'] = dict(list(body_parts.items())[:10])
        
        # Infer equipment usage
        if 'equipment' in df.columns:
            equipment = df['equipment'].value_counts().to_dict()
            patterns['equipment_types'] = dict(list(equipment.items())[:10])
        
        # Infer exercise difficulty by instruction complexity
        if any(col.startswith('instructions/') for col in df.columns):
            instr_cols = [c for c in df.columns if c.startswith('instructions/')]
            df['instruction_count'] = df[instr_cols].notna().sum(axis=1)
            patterns['difficulty'] = {
                'beginner': df[df['instruction_count'] <= 3]['name'].tolist()[:5] if 'name' in df.columns else [],
                'intermediate': df[(df['instruction_count'] > 3) & (df['instruction_count'] <= 5)]['name'].tolist()[:5] if 'name' in df.columns else [],
                'advanced': df[df['instruction_count'] > 5]['name'].tolist()[:5] if 'name' in df.columns else []
            }
        
        return patterns

    def _infer_health_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Infer health condition patterns from disease dataset"""
        patterns = {}
        
        # Infer condition-food relationships
        if 'Condition' in df.columns and 'Food Item' in df.columns:
            conditions = df['Condition'].unique()
            patterns['conditions'] = {}
            
            for condition in conditions[:10]:  # Top 10 conditions
                condition_df = df[df['Condition'] == condition]
                
                if 'Recommendation Type' in df.columns:
                    avoid = condition_df[condition_df['Recommendation Type'].str.lower() == 'avoid']['Food Item'].tolist()
                    consume = condition_df[condition_df['Recommendation Type'].str.lower() == 'consume']['Food Item'].tolist()
                    
                    patterns['conditions'][condition] = {
                        'avoid_count': len(avoid),
                        'consume_count': len(consume),
                        'top_avoid': avoid[:5],
                        'top_consume': consume[:5]
                    }
        
        return patterns

    def _infer_yoga_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Infer yoga patterns from yoga dataset"""
        patterns = {}
        
        # Infer difficulty levels
        if 'Level' in df.columns:
            levels = df['Level'].value_counts().to_dict()
            patterns['difficulty_distribution'] = levels
        
        # Infer common benefits
        if 'Benefits' in df.columns:
            all_benefits = ' '.join(df['Benefits'].dropna().astype(str)).lower()
            benefit_words = [w for w in all_benefits.split() if len(w) > 4 and w not in self.stop_words]
            from collections import Counter
            patterns['common_benefits'] = dict(Counter(benefit_words).most_common(10))
        
        return patterns

    def _build_vocabulary(self) -> None:
        """Build vocabulary dynamically from all datasets"""
        vocab = set()
        word_freq = {}
        
        for dataset_name, df in self.datasets.items():
            if df.empty:
                continue
            
            # Extract words from text columns
            text_cols = self.dataset_metadata.get(dataset_name, {}).get('text_columns', [])
            for col in text_cols[:5]:  # Limit to first 5 text columns
                if col in df.columns:
                    words = df[col].dropna().astype(str).str.lower().str.split()
                    for word_list in words:
                        word_items = word_list if isinstance(word_list, list) else str(word_list).split()
                        for w in word_items:
                            w = re.sub(r'[^a-z0-9-]', '', w)
                            if len(w) > 2:
                                vocab.add(w)
                                word_freq[w] = word_freq.get(w, 0) + 1
        
        # Infer stop words: very common words (top 5% frequency)
        if word_freq:
            sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
            stop_threshold = int(len(sorted_words) * 0.05)
            self.stop_words = {w for w, _ in sorted_words[:stop_threshold] if len(w) <= 4}
        
        # Infer generic tokens: common category words
        generic_patterns = ['exercise', 'food', 'workout', 'diet', 'yoga', 'pose', 'nutrition', 'fitness']
        self.generic_query_tokens = {w for w in vocab if any(p in w for p in generic_patterns)}
        
        self.vocabulary = vocab
        print(f"Built vocabulary: {len(vocab)} words, {len(self.stop_words)} stop words, {len(self.generic_query_tokens)} generic tokens")

    def _check_faq(self, question: str) -> Optional[str]:
        """Check fitness QA dataset for matching questions using optimized fuzzy logic.
        
        Enhanced to handle:
        - Unstructured grammar: 'protien how much per day i need for 70kg'
        - Reversed phrasing: 'gain muscle how' == 'how to gain muscle'
        - Partial matches: 'belly fat' == 'how do I lose belly fat'
        - Synonym coverage via SYNONYM_MAP tokens
        """
        qa_df = self.datasets.get("fitness_qa")
        if qa_df is None or qa_df.empty:
            return None
        
        q_lower = question.lower()
        
        # Check cache first
        if q_lower in self.qa_cache:
            return self.qa_cache[q_lower]
        
        # Skip QA if asking for list of foods (should query food dataset instead)
        food_list_indicators = ['foods to', 'food items to', 'foods for', 'food items for', 'list of foods', 
                                'what foods', 'which foods', 'best foods', 'good foods']
        if any(indicator in q_lower for indicator in food_list_indicators):
            return None
        
        # Skip QA if this looks like a specific food query
        if (' in ' in q_lower or ' of ' in q_lower) and any(nutrient in q_lower for nutrient in ['calorie', 'protein', 'carb', 'fat', 'fiber', 'iron']):
            return None
        
        # Skip QA if this is an exercise query with specific body part
        body_parts = ['chest', 'back', 'legs', 'upper legs', 'lower legs', 'arms', 'upper arms', 'lower arms', 
                      'shoulders', 'core', 'abs', 'biceps', 'triceps', 'calves', 'quads', 'hamstrings', 'glutes']
        exercise_keywords = ['exercise', 'exercises', 'workout', 'workouts']
        
        has_body_part = any(part in q_lower for part in body_parts)
        has_exercise_keyword = any(keyword in q_lower for keyword in exercise_keywords)
        if has_body_part and has_exercise_keyword:
            return None
        
        # Skip QA if this is an exercise instruction query
        exercise_indicators = ['how to do', 'how do i do', 'instructions for', 'steps for', 'how to perform']
        if any(indicator in q_lower for indicator in exercise_indicators):
            return None
        
        # Normalize question using synonym map for better token matching
        q_synonymized = self._apply_synonym_map(q_lower)
        q_normalized = ' '.join(re.sub(r'[^a-z0-9\s]', '', q_synonymized).split())
        question_tokens = set([t for t in q_normalized.split() if t not in self.stop_words and len(t) > 2])
        
        # Also build a "bag of intent tokens" for unstructured grammar support
        detected_intents = self._detect_intents_from_synonyms(q_lower)
        intent_tokens = set()
        for intent in detected_intents:
            for kw in INTENT_KEYWORD_MAP.get(intent, []):
                intent_tokens.update(kw.split())
        
        all_query_tokens = question_tokens | intent_tokens
        
        if not all_query_tokens:
            return None
        
        best_score = 0
        best_response = None
        
        for _, row in qa_df.iterrows():
            qa_tokens = row.get('tokens', set())
            if not qa_tokens:
                continue
            
            # Signal 1: token overlap with query (including synonym-expanded tokens)
            common_tokens = all_query_tokens & qa_tokens
            token_overlap = len(common_tokens) / max(len(all_query_tokens), len(qa_tokens)) if common_tokens else 0
            
            # Early exit if overlap too low
            if token_overlap < 0.15:
                continue
            
            # Signal 2: sequence similarity on normalized strings
            qa_normalized = row.get('normalized', '')
            seq_similarity = SequenceMatcher(None, q_normalized, qa_normalized).ratio()
            
            # Signal 3: intent match bonus
            intent_bonus = 0.0
            for intent in detected_intents:
                intent_kws = INTENT_KEYWORD_MAP.get(intent, [])
                if any(kw in qa_normalized for kw in intent_kws):
                    intent_bonus = 0.15
                    break
            
            # Signal 4: direct token overlap bonus (penalize order-insensitive)
            direct_overlap = len(question_tokens & qa_tokens) / max(len(question_tokens), len(qa_tokens)) if (question_tokens and qa_tokens) else 0
            
            # Weighted combination
            if token_overlap >= 0.4:
                score = token_overlap * 0.5 + direct_overlap * 0.3 + seq_similarity * 0.2 + intent_bonus
            else:
                score = token_overlap * 0.4 + seq_similarity * 0.4 + direct_overlap * 0.1 + intent_bonus
            
            if score > best_score:
                best_score = score
                best_response = str(row['response']).strip()
                # Aggressively clean response - remove all labels
                best_response = re.sub(r'^\s*\d+\.\s*', '', best_response)
                best_response = re.sub(r'intent:\s*\w+\s*', '', best_response, flags=re.IGNORECASE)
                best_response = re.sub(r'question:\s*[^\n]+\s*', '', best_response, flags=re.IGNORECASE)
                best_response = re.sub(r'response:\s*', '', best_response, flags=re.IGNORECASE)
                best_response = best_response.strip()
        
        # Return if good enough match (lowered threshold to 0.25 due to multi-signal scoring)
        if best_score >= 0.25 and best_response:
            self.qa_cache[q_lower] = best_response
            return best_response
        
        return None



    def _get_high_nutrient_foods(self, nutrient: str, min_value: float = 10) -> str:
        """Extract high nutrient foods from food nutrition dataset"""
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None
        
        # Find nutrient column (case insensitive)
        nutrient_col = None
        for col in food_df.columns:
            if nutrient.lower() in col.lower():
                nutrient_col = col
                break
        
        if nutrient_col is None:
            return None
        
        # Find food name column
        food_col = None
        for col in ['food', 'Dish Name', 'Food Name', 'name']:
            if col in food_df.columns:
                food_col = col
                break
        if food_col is None:
            food_col = food_df.columns[0]
        
        # Filter and sort by nutrient content
        try:
            df_filtered = food_df[pd.to_numeric(food_df[nutrient_col], errors='coerce') >= min_value].copy()
            df_filtered[nutrient_col] = pd.to_numeric(df_filtered[nutrient_col], errors='coerce')
            df_sorted = df_filtered.sort_values(by=nutrient_col, ascending=False).head(15)
            
            if df_sorted.empty:
                return None
            
            # Build response
            foods = []
            for _, row in df_sorted.iterrows():
                food_name = row[food_col]
                nutrient_val = row[nutrient_col]
                if pd.notna(food_name) and pd.notna(nutrient_val):
                    foods.append(f"{food_name} ({nutrient_val}g)")
            
            if not foods:
                return None
            
            response = f"High {nutrient} foods (per 100g):\n\n"
            response += "\n".join([f"{i+1}. {food}" for i, food in enumerate(foods[:10])])
            response += f"\n\nTip: Aim for {min_value}g+ per serving for good {nutrient} intake."
            
            return response
        except Exception:
            return None

    def _get_low_calorie_foods(self) -> str:
        """Extract low calorie foods from food nutrition dataset"""
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None
        
        # Find calorie column
        cal_col = None
        for col in food_df.columns:
            if 'calorie' in col.lower() or 'kcal' in col.lower():
                cal_col = col
                break
        
        if cal_col is None:
            return None
        
        # Find food name column
        food_col = None
        for col in ['food', 'Dish Name', 'Food Name', 'name']:
            if col in food_df.columns:
                food_col = col
                break
        if food_col is None:
            food_col = food_df.columns[0]
        
        try:
            df_copy = food_df.copy()
            df_copy[cal_col] = pd.to_numeric(df_copy[cal_col], errors='coerce')
            df_sorted = df_copy[df_copy[cal_col] < 100].sort_values(by=cal_col).head(15)
            
            if df_sorted.empty:
                return None
            
            foods = []
            for _, row in df_sorted.iterrows():
                food_name = row[food_col]
                cal_val = row[cal_col]
                if pd.notna(food_name) and pd.notna(cal_val):
                    foods.append(f"{food_name} ({int(cal_val)} kcal)")
            
            if not foods:
                return None
            
            response = "Low calorie foods for weight loss (per 100g):\n\n"
            response += "\n".join([f"{i+1}. {food}" for i, food in enumerate(foods[:10])])
            response += "\n\nTip: Focus on vegetables, lean proteins, and avoid fried/processed foods."
            
            return response
        except Exception:
            return None

    def _get_healthy_foods(self) -> Optional[str]:
        """Get healthy, balanced foods using fuzzy logic inferred from dataset statistics"""
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None
        
        # Find columns
        cal_col = protein_col = fat_col = carb_col = fiber_col = food_col = None
        for col in food_df.columns:
            col_lower = col.lower()
            if 'calorie' in col_lower or 'kcal' in col_lower:
                cal_col = col
            elif 'protein' in col_lower:
                protein_col = col
            elif 'fat' in col_lower:
                fat_col = col
            elif 'carb' in col_lower:
                carb_col = col
            elif 'fiber' in col_lower or 'fibre' in col_lower:
                fiber_col = col
            elif col in ['food', 'Dish Name', 'Food Name', 'name']:
                food_col = col
        
        if not cal_col or not food_col:
            return None
        
        try:
            df = food_df.copy()
            df[cal_col] = pd.to_numeric(df[cal_col], errors='coerce')
            if protein_col:
                df[protein_col] = pd.to_numeric(df[protein_col], errors='coerce')
            if fat_col:
                df[fat_col] = pd.to_numeric(df[fat_col], errors='coerce')
            if fiber_col:
                df[fiber_col] = pd.to_numeric(df[fiber_col], errors='coerce')
            
            # FUZZY LOGIC: Infer healthy thresholds from dataset statistics
            cal_median = df[cal_col].median()
            cal_q25 = df[cal_col].quantile(0.25)
            cal_q75 = df[cal_col].quantile(0.75)
            
            protein_median = df[protein_col].median() if protein_col else 0
            protein_q75 = df[protein_col].quantile(0.75) if protein_col else 0
            
            fat_median = df[fat_col].median() if fat_col else 999
            fat_q25 = df[fat_col].quantile(0.25) if fat_col else 999
            
            # Fuzzy membership functions for "healthy"
            def calorie_health_score(cal):
                # Prefer moderate calories (around median, not too high)
                if cal < cal_q25:
                    return 0.7  # Low calories = moderately healthy
                elif cal <= cal_median:
                    return 1.0  # Moderate calories = very healthy
                elif cal <= cal_q75:
                    return 0.6  # Above median = less healthy
                else:
                    return 0.2  # High calories = unhealthy
            
            def protein_health_score(prot):
                # Higher protein = healthier
                if prot >= protein_q75:
                    return 1.0  # High protein = very healthy
                elif prot >= protein_median:
                    return 0.8  # Above median = healthy
                else:
                    return 0.4  # Low protein = less healthy
            
            def fat_health_score(fat_val):
                # Lower fat = healthier
                if fat_val <= fat_q25:
                    return 1.0  # Low fat = very healthy
                elif fat_val <= fat_median:
                    return 0.7  # Moderate fat = somewhat healthy
                else:
                    return 0.3  # High fat = unhealthy
            
            # Calculate fuzzy health score for each food
            df['cal_score'] = df[cal_col].apply(calorie_health_score)
            df['protein_score'] = df[protein_col].apply(protein_health_score) if protein_col else 0.5
            df['fat_score'] = df[fat_col].apply(fat_health_score) if fat_col else 0.5
            
            # Aggregate fuzzy scores (weighted average)
            df['health_score'] = (
                df['cal_score'] * 0.35 +  # Calories weight
                df['protein_score'] * 0.40 +  # Protein weight (most important)
                df['fat_score'] * 0.25  # Fat weight
            )
            
            # Bonus for fiber if available
            if fiber_col:
                fiber_median = df[fiber_col].median()
                df['health_score'] += df[fiber_col].apply(
                    lambda f: 0.1 if f > fiber_median else 0
                )
            
            # Filter: only foods with health_score > 0.6 (fuzzy threshold for "healthy")
            healthy_foods = df[df['health_score'] >= 0.6].nlargest(10, 'health_score')
            
            if healthy_foods.empty:
                return None
            
            # Infer health criteria explanation
            criteria = f"Based on dataset analysis:\n"
            criteria += f"• Moderate calories (around {cal_median:.0f} kcal or less)\n"
            if protein_col:
                criteria += f"• Good protein (≥{protein_median:.1f}g, ideally ≥{protein_q75:.1f}g)\n"
            if fat_col:
                criteria += f"• Lower fat (≤{fat_median:.1f}g, ideally ≤{fat_q25:.1f}g)\n"
            if fiber_col:
                criteria += f"• Higher fiber when available\n"
            
            lines = ["🥗 Healthy & Balanced Food Items:\n", criteria, ""]
            for i, (_, row) in enumerate(healthy_foods.iterrows(), 1):
                food_name = row[food_col]
                cal = int(row[cal_col]) if pd.notna(row[cal_col]) else 0
                protein = f", Protein: {row[protein_col]:.1f}g" if protein_col and pd.notna(row[protein_col]) else ""
                fat = f", Fat: {row[fat_col]:.1f}g" if fat_col and pd.notna(row[fat_col]) else ""
                carb = f", Carbs: {row[carb_col]:.1f}g" if carb_col and pd.notna(row[carb_col]) else ""
                health = f" [Health Score: {row['health_score']:.2f}]"
                lines.append(f"{i}. {food_name}")
                lines.append(f"   Calories: {cal} kcal{protein}{carb}{fat}{health}")
            
            lines.append("\n💡 Health scores calculated using fuzzy logic based on dataset statistics.")
            return "\n".join(lines)
        except Exception as e:
            print(f"Error in _get_healthy_foods: {e}")
            return None

    def _normalize_query(self, question: str) -> str:
        """Normalize query: unicode → ASCII, apply synonym map, fix typos via vocabulary.
        
        Handles:
        - Typos (protien → protein, excercise → exercise)
        - Abbreviations (cal → calories, kgs → kg)
        - Slang / informal (shed kilos → lose weight)
        - Reversed word order (muscle gain vs gain muscle)
        - Mixed scripts / accents
        """
        if not question:
            return question
        
        # 1. Unicode normalization (remove accents, normalize whitespace)
        normalized = unicodedata.normalize('NFKD', question)
        normalized = ''.join(c for c in normalized if not unicodedata.combining(c))
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        # 2. Apply phrase + word-level synonym map
        normalized = self._apply_synonym_map(normalized)
        
        # 3. Per-word vocabulary fuzzy correction (for residual typos not in synonym map)
        words = normalized.split()
        corrected_words = []
        for word in words:
            clean = re.sub(r'[^a-z0-9]', '', word.lower())
            if len(clean) <= 2 or clean in self.stop_words:
                corrected_words.append(word)
                continue
            if clean in self.vocabulary:
                corrected_words.append(word)
                continue
            # Fuzzy match against vocabulary (threshold=0.82 to avoid over-correction)
            match = self._fuzzy_match(clean, list(self.vocabulary), threshold=0.82)
            if match and abs(len(match) - len(clean)) <= 3:
                corrected_words.append(match)
            else:
                corrected_words.append(word)
        
        result = ' '.join(corrected_words)
        return result

    def load_all_datasets(self) -> None:
        try:
            base = Path(__file__).resolve().parent
            self.datasets["exercises"] = pd.read_csv(base / "exercises_enhanced.csv")
            self.datasets["food_nutrition"] = pd.read_csv(base / "Indian_Food_Nutrition_Enhanced.csv")
            self.datasets["diet_recommendations"] = pd.read_csv(base / "diet_recommendations_enhanced.csv")
            self.datasets["disease_food_nutrition"] = pd.read_csv(base / "real_disease_food_nutrition_enhanced.csv")
            self.datasets["yoga_poses"] = pd.read_csv(base / "yoga_poses_enhanced.csv")
            qa_frames: List[pd.DataFrame] = []
            for qa_path in [base / "fitness_qa_enhanced.csv", base / "fitness_related_questions.csv"]:
                if qa_path.exists():
                    try:
                        qa_frames.append(pd.read_csv(qa_path))
                    except Exception:
                        pass
            if qa_frames:
                qa_df = pd.concat(qa_frames, ignore_index=True)
                qa_df.columns = [str(c).strip().lower() for c in qa_df.columns]
                if "intent" not in qa_df.columns:
                    qa_df["intent"] = "general"
                if "question" not in qa_df.columns:
                    qa_df["question"] = ""
                if "response" not in qa_df.columns:
                    qa_df["response"] = ""
                qa_df = qa_df[["intent", "question", "response"]].dropna(subset=["question", "response"])
                qa_df["question"] = qa_df["question"].astype(str).str.strip()
                qa_df["response"] = qa_df["response"].astype(str).str.strip()
                qa_df = qa_df[(qa_df["question"] != "") & (qa_df["response"] != "")]
                qa_df = qa_df.drop_duplicates(subset=["question"], keep="first").reset_index(drop=True)
                self.datasets["fitness_qa"] = qa_df
            else:
                self.datasets["fitness_qa"] = pd.DataFrame(columns=["intent", "question", "response"])
            print(f"Loaded {len(self.datasets)} datasets")
        except Exception as e:
            print(f"Error loading datasets: {e}")
            self.datasets = {
                "exercises": pd.DataFrame(),
                "food_nutrition": pd.DataFrame(),
                "diet_recommendations": pd.DataFrame(),
                "disease_food_nutrition": pd.DataFrame(),
                "yoga_poses": pd.DataFrame(),
                "fitness_qa": pd.DataFrame(),
            }

    def build_dataset_metadata(self) -> None:
        self.dataset_metadata = {}
        for name, df in self.datasets.items():
            text_columns = [c for c in df.columns if df[c].dtype == "object"]
            numeric_columns = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
            self.dataset_metadata[name] = {
                "columns": list(df.columns),
                "text_columns": text_columns,
                "numeric_columns": numeric_columns,
                "num_rows": len(df),
            }

    def extract_query_intent(self, question: str) -> Dict[str, Any]:
        """Extract intent from question.
        
        Enhanced: applies synonym map first so 'excercise 4 chest' and
        'chest exercises' produce the same tokens and domain.
        Also handles fragmented / reversed grammar.
        """
        # Apply synonym map before any other processing
        q_syn = self._apply_synonym_map((question or "").strip().lower())
        q = q_syn
        
        # Extended stop words for exercise queries
        filler_words = {"focus", "focused", "targeting", "target", "work", "working", "train", "training",
                        "tell", "give", "show", "what", "which", "when", "where", "why", "how",
                        "please", "help", "need", "want", "like"}
        
        base_tokens = [
            t
            for t in re.findall(r"[a-z0-9_]+", q)
            if len(t) > 2 and t not in self.stop_words and t not in filler_words and not t.isdigit()
        ]
        token_set = set(base_tokens)
        for t in list(base_tokens):
            if t.endswith("s") and len(t) > 3:
                token_set.add(t[:-1])
        tokens = [t for t in token_set if t not in self.generic_query_tokens]

        operation = "search"
        if any(k in q for k in ["how many", "count", "number of"]):
            operation = "count"
        elif any(k in q for k in ["highest", "max", "maximum", "top"]):
            operation = "max"
        elif any(k in q for k in ["lowest", "min", "minimum"]):
            operation = "min"
        elif any(k in q for k in ["average", "mean", "avg"]):
            operation = "average"
        elif any(k in q for k in ["total", "sum"]):
            operation = "sum"

        numeric_filter = self._extract_numeric_filter(q)
        domain = self._infer_query_domain(q, tokens)
        
        # Augment domain detection with detected intents
        detected_intents = self._detect_intents_from_synonyms(q)
        if domain == "general" and detected_intents:
            intent_to_domain = {
                "weight_loss": "nutrition", "muscle_gain": "exercise",
                "bmi": "nutrition", "calories": "nutrition", "protein": "nutrition",
                "water": "nutrition", "macros": "nutrition", "exercise": "exercise",
                "yoga": "yoga", "nutrition": "nutrition", "health": "health",
                "sleep": "general", "supplements": "nutrition",
                "stamina": "exercise",
            }
            for intent in detected_intents:
                mapped = intent_to_domain.get(intent)
                if mapped and mapped != "general":
                    domain = mapped
                    break

        return {
            "question": question,
            "tokens": tokens,
            "operation": operation,
            "numeric_filter": numeric_filter,
            "domain": domain,
            "detected_intents": detected_intents,
        }

    def _infer_query_domain(self, q: str, tokens: List[str]) -> str:
        """Infer query domain with synonym-aware matching.
        Handles informal phrasings like 'belly fat workout' → 'exercise' domain."""
        joined = f"{q} {' '.join(tokens)}"
        
        # Apply synonym map for domain detection too
        joined_syn = self._apply_synonym_map(joined)
        
        # Check for disease/health conditions first (highest priority)
        health_kws = ["diabetes", "hypertension", "cholesterol", "disease", "condition", 
                      "avoid", "recommended for", "blood pressure", "blood sugar", "heart",
                      "thyroid", "kidney", "liver", "pcos", "arthritis", "osteoporosis"]
        if any(k in joined_syn for k in health_kws):
            return "health"
        
        # Nutrition domain
        nutrition_kws = ["calorie", "calories", "protein", "carb", "carbohydrate", "fat",
                         "fiber", "food", "nutrition", "meal", "vitamin", "mineral",
                         "sodium", "iron", "calcium", "zinc", "magnesium", "sugar",
                         "macros", "macro", "tdee", "bmr", "bmi", "water", "hydration"]
        if any(k in joined_syn for k in nutrition_kws):
            return "nutrition"
        
        # Yoga domain
        yoga_kws = ["yoga", "asana", "pose", "flexibility", "meditation", "pranayama",
                    "stretch", "stretching", "mindfulness", "breathing exercise"]
        if any(k in joined_syn for k in yoga_kws):
            return "yoga"
        
        # Exercise domain
        exercise_kws = ["exercise", "workout", "gym", "muscle", "training", "strength",
                        "cardio", "hiit", "aerobic", "weightlift", "calisthenics",
                        "bodyweight", "dumbbell", "barbell", "resistance", "push up",
                        "pull up", "squat", "deadlift", "bench", "bicep", "tricep",
                        "chest", "back", "shoulder", "leg", "core", "abs", "glute",
                        "cardio", "endurance", "stamina", "bulk", "cut", "toning"]
        if any(k in joined_syn for k in exercise_kws):
            return "exercise"
        
        # Diet domain
        diet_kws = ["diet", "weight loss", "weight gain", "plan", "meal plan",
                    "intermittent", "fasting", "keto", "vegan", "vegetarian", "paleo"]
        if any(k in joined_syn for k in diet_kws):
            return "diet"
        
        return "general"

    def _extract_numeric_filter(self, q: str) -> Optional[Tuple[str, float]]:
        gt_patterns = [r"more than\s+(\d+(\.\d+)?)", r"greater than\s+(\d+(\.\d+)?)", r"above\s+(\d+(\.\d+)?)", r">\s*(\d+(\.\d+)?)"]
        lt_patterns = [r"less than\s+(\d+(\.\d+)?)", r"below\s+(\d+(\.\d+)?)", r"under\s+(\d+(\.\d+)?)", r"<\s*(\d+(\.\d+)?)"]

        for pat in gt_patterns:
            m = re.search(pat, q)
            if m:
                return ("gt", float(m.group(1)))
        for pat in lt_patterns:
            m = re.search(pat, q)
            if m:
                return ("lt", float(m.group(1)))
        return None

    def _dataset_score(self, tokens: List[str], dataset_name: str) -> int:
        md = self.dataset_metadata.get(dataset_name, {})
        columns = [c.lower() for c in md.get("columns", [])]
        score = 0
        for token in tokens:
            for col in columns:
                if token in col:
                    score += 3

        df = self.datasets[dataset_name]
        if df.empty or not tokens:
            return score

        text_cols = md.get("text_columns", [])[:4]
        for col in text_cols:
            sample_values = df[col].dropna().astype(str).head(200).str.lower()
            for token in tokens:
                if sample_values.str.contains(re.escape(token), regex=True).any():
                    score += 2
        return score

    def _choose_candidate_datasets(self, tokens: List[str], domain: str = "general") -> List[str]:
        domain_bias = {
            "nutrition": {
                "food_nutrition": 4,
                "disease_food_nutrition": 2,
            },
            "exercise": {
                "exercises": 4,
            },
            "yoga": {
                "yoga_poses": 5,
            },
            "diet": {
                "diet_recommendations": 4,
                "food_nutrition": 1,
            },
            "health": {
                "disease_food_nutrition": 5,
                "food_nutrition": 1,
            },
        }

        scored: List[Tuple[str, int]] = []
        for name, df in self.datasets.items():
            if df.empty:
                continue
            score = self._dataset_score(tokens, name)
            score += domain_bias.get(domain, {}).get(name, 0)
            scored.append((name, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        if not scored:
            return []

        # For health domain, prioritize disease dataset
        if domain == "health":
            names = [n for n, _ in scored]
            if "disease_food_nutrition" in names:
                scored.sort(
                    key=lambda x: (
                        0 if x[0] == "disease_food_nutrition" else 1,
                        -x[1],
                    )
                )

        if domain == "nutrition":
            names = [n for n, _ in scored]
            if "food_nutrition" in names:
                scored.sort(
                    key=lambda x: (
                        0 if x[0] == "food_nutrition" else 1,
                        -x[1],
                    )
                )

        top_score = scored[0][1]
        if top_score <= 0:
            return [n for n, _ in scored]
        return [n for n, s in scored if s >= max(1, top_score - 2)]

    def _row_match_scores(self, df: pd.DataFrame, tokens: List[str]) -> pd.Series:
        if df.empty:
            return pd.Series(dtype=int)
        if not tokens:
            return pd.Series(np.zeros(len(df), dtype=int), index=df.index)

        text_df = df.fillna("").astype(str).apply(lambda col: col.str.lower())
        scores = pd.Series(np.zeros(len(df), dtype=int), index=df.index)
        
        # Body parts get higher priority
        body_parts = ['chest', 'back', 'leg', 'upper leg', 'lower leg', 'arm', 'upper arm', 'lower arm',
                      'shoulder', 'core', 'ab', 'bicep', 'tricep', 'calve', 'quad', 'hamstring', 'glute',
                      'waist', 'cardio', 'neck']
        
        # Exact token matching with priority weighting
        for token in tokens:
            is_body_part = any(bp in token or token in bp for bp in body_parts)
            weight = 3 if is_body_part else 1
            
            token_hit = text_df.apply(lambda col: col.str.contains(re.escape(token), regex=True), axis=0).any(axis=1)
            scores = scores + (token_hit.astype(int) * weight)
        
        # Fuzzy matching for tokens with no exact matches
        if scores.max() < 2:
            for token in tokens:
                is_body_part = any(bp in token or token in bp for bp in body_parts)
                weight = 2 if is_body_part else 1
                
                for col in text_df.columns:
                    for idx, cell_value in text_df[col].items():
                        if pd.notna(cell_value):
                            words = str(cell_value).split()
                            for word in words:
                                if len(word) > 3 and len(token) > 3:
                                    ratio = SequenceMatcher(None, token, word).ratio()
                                    if ratio >= 0.75:
                                        scores[idx] += weight
                                        break
        
        # Require at least 1 token match for valid results
        if scores.max() < 1:
            return pd.Series(dtype=int)
        
        return scores

    def _detect_target_numeric_column(self, question: str, dataset_name: str) -> Optional[str]:
        md = self.dataset_metadata.get(dataset_name, {})
        numeric_columns = md.get("numeric_columns", [])
        if not numeric_columns:
            return None

        q = question.lower()
        for col in numeric_columns:
            if col.lower() in q:
                return col

        tokens = [t for t in re.findall(r"[a-z0-9_]+", q) if len(t) > 2]
        for col in numeric_columns:
            cl = col.lower()
            if any(t in cl for t in tokens):
                return col

        return None

    def execute_dynamic_query(self, intent: Dict[str, Any]) -> str:
        question = intent["question"]
        tokens = intent["tokens"]
        operation = intent["operation"]
        numeric_filter = intent["numeric_filter"]
        domain = intent.get("domain", "general")

        candidate_datasets = self._choose_candidate_datasets(tokens, domain)
        if not candidate_datasets:
            return "No datasets are available right now."

        for dataset_name in candidate_datasets:
            df = self.datasets[dataset_name]
            if df.empty:
                continue

            # Special handling for disease dataset with avoid/consume queries
            if dataset_name == "disease_food_nutrition" and "Recommendation Type" in df.columns:
                q_lower = question.lower()
                if "avoid" in q_lower or "not eat" in q_lower or "should not" in q_lower:
                    df = df[df["Recommendation Type"].str.lower() == "avoid"].copy()
                elif "consume" in q_lower or "eat" in q_lower or "recommended" in q_lower or "good for" in q_lower:
                    df = df[df["Recommendation Type"].str.lower() == "consume"].copy()
                
                if df.empty:
                    continue

            target_col = self._detect_target_numeric_column(question, dataset_name)
            scores = self._row_match_scores(df, tokens)
            matched = df[scores > 0].copy()
            matched_scores = scores[scores > 0]

            if matched.empty:
                # For numeric operations/filters, operate directly on the dataset
                # when textual row matching is not available.
                if target_col and target_col in df.columns and pd.api.types.is_numeric_dtype(df[target_col]):
                    matched = df.copy()
                    matched["_match_score"] = 1
                else:
                    continue

            if not matched_scores.empty:
                matched = matched.assign(_match_score=matched_scores.loc[matched.index])
            if "_match_score" not in matched.columns:
                matched["_match_score"] = 1
            matched = matched.sort_values("_match_score", ascending=False)

            if numeric_filter and target_col and target_col in matched.columns and pd.api.types.is_numeric_dtype(matched[target_col]):
                op, value = numeric_filter
                if op == "gt":
                    matched = matched[matched[target_col] > value]
                else:
                    matched = matched[matched[target_col] < value]

            if matched.empty:
                continue

            if dataset_name == "exercises" and self._is_exercise_instruction_query(question, intent):
                instruction_answer = self._format_exercise_instructions_answer(matched, question)
                if instruction_answer:
                    return instruction_answer

            answer = self._format_answer(dataset_name, matched, operation, target_col)
            return answer

        rule_answer = self._rule_based_general_answer(question, intent)
        if rule_answer:
            return rule_answer

        dataset_list = ", ".join(
            f"{name} ({meta['num_rows']})" for name, meta in self.dataset_metadata.items()
        )
        return (
            "I don't have enough information to answer that question.\n\n"
            "I can help you with:\n"
            "- Specific food nutrition (e.g., 'calories in idli')\n"
            "- Exercise instructions (e.g., 'how to do squats')\n"
            "- Yoga poses (e.g., 'benefits of vajrasana')\n"
            "- BMI, calorie, water, and macro calculations\n"
            "- General fitness and nutrition guidance\n\n"
            "Try asking a more specific question!"
        )

    def _rule_based_general_answer(self, question: str, intent: Dict[str, Any]) -> Optional[str]:
        q = (question or "").lower()
        domain = intent.get("domain", "general")

        if any(k in q for k in ["what can i ask", "how can i ask", "question examples", "supported questions", "help"]):
            return self._dataset_question_guide()

        # NEW: Use inferred knowledge for intelligent responses
        if any(k in q for k in ["what do you know", "what have you learned", "show knowledge", "dataset insights"]):
            return self._show_inferred_knowledge()
        
        # Intelligent food recommendations based on inferred patterns
        if any(k in q for k in ["best foods", "good foods", "recommend foods", "food suggestions"]):
            return self._intelligent_food_recommendation(q)
        
        # Intelligent exercise recommendations
        if any(k in q for k in ["best exercises", "good exercises", "recommend exercises", "exercise suggestions"]):
            return self._intelligent_exercise_recommendation(q)
        
        # Walking/steps recommendations
        if any(k in q for k in ["steps", "walk", "walking", "daily walk", "how many steps", "steps per day"]):
            return self._steps_recommendation(q)

        # Calculators (BMI, calories, macros, water) should return numeric results when inputs are provided.
        
        # Water calculation - check first
        water_answer = self._rule_based_water_answer(q)
        if water_answer:
            return water_answer
        
        bmi_answer = self._rule_based_bmi_answer(q)
        if bmi_answer:
            return bmi_answer

        calories_answer = self._rule_based_calories_answer(q)
        if calories_answer:
            return calories_answer

        macro_answer = self._rule_based_macros_answer(q)
        if macro_answer:
            return macro_answer

        # Protein calculation with fuzzy matching
        protein_keywords = ["protein", "protien", "protin", "protine", "protain"]
        has_protein = any(k in q for k in protein_keywords)
        
        # Fuzzy weight matching (handles typos like "kgd", "kg.", "kgs")
        has_weight = re.search(r"(\d+(?:\.\d+)?)\s*kg[a-z.]*\b", q)
        
        # Check for protein-related questions (with or without weight)
        protein_questions = ["how much protein", "protein intake", "protein per day", "daily protein", 
                           "protein to consume", "protein consumption", "protein requirement", 
                           "protein needed", "protein need", "protein calcuate", "protein calculate",
                           "calculate protein", "calcul protein", "calc protein"]
        is_protein_question = any(pq in q for pq in protein_questions) or (has_protein and any(k in q for k in ["how much", "how many", "consume", "eat", "take", "need", "require", "day", "daily", "calculate", "calcuate"]))
        
        if has_protein and has_weight:
            weight_kg = float(has_weight.group(1))
            # Determine goal from query with fuzzy matching
            if any(k in q for k in ["lose", "loss", "fat loss", "cut", "cutting", "weight loss"]):
                goal = "weight loss"
                factor = 2.0
            elif any(k in q for k in ["gain", "muscle", "bulk", "build", "bulking", "muscle gain"]):
                goal = "muscle gain"
                factor = 1.8
            elif any(k in q for k in ["sedentary", "inactive", "no exercise"]):
                goal = "sedentary"
                factor = 0.9
            else:
                goal = "maintenance"
                factor = 1.4
            
            protein_g = weight_kg * factor
            return (
                f"💪 Daily Protein Calculation Result:\n\n"
                f"Weight: {weight_kg} kg\n"
                f"Goal: {goal.title()}\n"
                f"Protein Factor: {factor}g per kg\n\n"
                f"✅ Recommended Protein: {protein_g:.0f}g/day\n\n"
                f"💡 Tip: Spread protein across 3-4 meals for better absorption."
            )
        
        if is_protein_question:
            return (
                "💪 Daily Protein Calculation:\n\n"
                "Formula: Protein (g/day) = Body Weight (kg) × Protein Factor\n\n"
                "Protein Factors by Goal:\n\n"
                "• Weight Loss: 1.8-2.2g per kg (higher protein preserves muscle)\n"
                "• Muscle Gain: 1.6-2.0g per kg\n"
                "• Maintenance/General Fitness: 1.2-1.6g per kg\n"
                "• Sedentary: 0.8-1.0g per kg\n\n"
                "Example: 70kg person for muscle gain\n"
                "70kg × 1.8 = 126g protein/day\n\n"
                "💡 Tip: Spread protein across 3-4 meals for better absorption.\n\n"
                "Want me to calculate your specific protein target? Share your weight and goal!"
            )

        if any(k in q for k in ["fruit", "fruits"]) and any(k in q for k in ["weight loss", "lose weight", "fat loss"]):
            fruit_answer = self._get_weight_loss_fruits()
            if fruit_answer:
                return fruit_answer

        if any(k in q for k in ["calorie deficit", "fat loss", "weight loss"]):
            return (
                "🎯 Weight Loss Tips:\n\n"
                "For effective weight loss:\n"
                "- Maintain a moderate calorie deficit (300-500 kcal/day)\n"
                "- Eat high-protein meals to preserve muscle\n"
                "- Combine strength training with regular cardio\n"
                "- Stay consistent and patient\n\n"
                "Would you like me to calculate your calorie target?"
            )

        if any(k in q for k in ["muscle gain", "build muscle", "hypertrophy"]):
            return (
                "💪 Muscle Building Tips:\n\n"
                "For muscle gain:\n"
                "- Use progressive overload (gradually increase weight/reps)\n"
                "- Train each muscle 2-3 times per week\n"
                "- Consume 1.6-2.2g protein per kg body weight daily\n"
                "- Eat in a slight calorie surplus (200-300 kcal/day)\n"
                "- Get adequate sleep (7-9 hours)\n\n"
                "Need a personalized calorie or protein calculation?"
            )

        if any(k in q for k in ["workout plan", "workout routine", "exercise routine"]):
            return (
                "🏋️ Weekly Workout Structure:\n\n"
                "Balanced weekly plan:\n"
                "- 3-4 strength training sessions\n"
                "- 2-3 cardio sessions (20-30 min)\n"
                "- 1-2 active recovery days (walking, yoga)\n"
                "- Progressive increase in intensity\n\n"
                "Ask me about specific exercises for any muscle group!"
            )

        if any(k in q for k in [
            "how long should a workout be",
            "how long should i workout",
            "how long workout",
            "workout duration",
            "duration of workout",
            "how many minutes workout",
            "how much time workout",
            "workout time",
        ]):
            return (
                "A typical workout is 45-60 minutes. Quality matters more than duration.\n"
                "Even 30-minute focused sessions are effective, and very long workouts (2+ hours) are usually unnecessary for most people."
            )

        if any(k in q for k in ["exercise", "workout", "training", "gym"]) and domain == "exercise":
            # Skip generic response if specific body part is mentioned
            body_parts = ['chest', 'back', 'legs', 'upper legs', 'lower legs', 'arms', 'upper arms', 'lower arms', 'shoulders', 'core', 'abs', 'biceps', 'triceps', 'calves', 'quads', 'hamstrings']
            if any(part in q for part in body_parts):
                return None  # Let dataset query handle it
            
            return (
                "🏋️ Exercise Fundamentals:\n\n"
                "Base your workouts on these movement patterns:\n"
                "- Squat (legs, glutes)\n"
                "- Hinge (deadlifts, back)\n"
                "- Push (chest, shoulders, triceps)\n"
                "- Pull (back, biceps)\n"
                "- Core (planks, rotations)\n\n"
                "Track your progress and increase load gradually while maintaining proper form.\n\n"
                "Ask me about specific exercises from our database!"
            )

        if "fitness" in q:
            return (
                "🎯 General Fitness Approach:\n\n"
                "Key components of fitness:\n"
                "- 150+ minutes of weekly activity\n"
                "- 2-4 strength training sessions\n"
                "- Balanced nutrition with adequate protein\n"
                "- Consistent sleep (7-9 hours)\n"
                "- Progressive training over time\n\n"
                "What specific aspect would you like to focus on?"
            )

        # If user asks "calories / TDEE" without inputs, give guidance (not formulas-only).
        if any(k in q for k in ["calories", "kcal", "maintenance calories", "tdee", "bmr"]):
            return (
                "Source: rule_based\n"
                "To estimate daily calories (TDEE), I can calculate it if you share:\n"
                "- age, gender\n"
                "- height (cm), weight (kg)\n"
                "- activity level (sedentary / light / moderate / very active)\n"
                "If you want weight loss, I’ll usually set ~300–500 kcal/day below maintenance; for muscle gain, ~200–300 kcal/day above."
            )

        if any(k in q for k in ["food", "foods", "nutrition", "healthy eating", "diet"]):
            return (
                "Prioritize whole foods: lean protein, vegetables, fruits, whole grains, legumes, nuts/seeds, "
                "and adequate hydration. Limit ultra-processed foods and sugary drinks."
            )

        if any(k in q for k in ["health", "wellness", "healthy lifestyle", "preventive health"]):
            return (
                "Health basics: regular activity, balanced nutrition, 7-9 hours sleep, stress management, "
                "and routine medical checkups."
            )

        return None

    def _show_inferred_knowledge(self) -> str:
        """Show what the chatbot has learned from datasets"""
        if not self.inferred_knowledge:
            return "I haven't inferred any knowledge yet from the datasets."
        
        lines = ["🧠 Knowledge Inferred from Datasets:\n"]
        
        # Nutrition knowledge
        if 'nutrition' in self.inferred_knowledge:
            nutr = self.inferred_knowledge['nutrition']
            lines.append("📊 Nutrition Patterns:")
            for nutrient, stats in list(nutr.items())[:5]:
                if isinstance(stats, dict) and 'median' in stats:
                    lines.append(f"  • {nutrient}: median={stats['median']:.1f}, range=[{stats['q25']:.1f}-{stats['q75']:.1f}]")
            lines.append("")
        
        # Exercise knowledge
        if 'exercises' in self.inferred_knowledge:
            ex = self.inferred_knowledge['exercises']
            if 'popular_targets' in ex:
                lines.append("💪 Popular Exercise Targets:")
                for target, count in list(ex['popular_targets'].items())[:5]:
                    lines.append(f"  • {target}: {count} exercises")
                lines.append("")
        
        # Health knowledge
        if 'health_conditions' in self.inferred_knowledge:
            health = self.inferred_knowledge['health_conditions']
            if 'conditions' in health:
                lines.append(f"🏥 Health Conditions Tracked: {len(health['conditions'])}")
                lines.append("")
        
        lines.append("💡 This knowledge helps me give you smarter, data-driven recommendations!")
        return "\n".join(lines)

    def _intelligent_food_recommendation(self, query: str) -> Optional[str]:
        """Use inferred nutrition patterns to recommend foods intelligently"""
        if 'nutrition' not in self.inferred_knowledge:
            return None
        
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None
        
        patterns = self.inferred_knowledge['nutrition']
        
        # Determine goal from query
        if any(k in query for k in ['weight loss', 'lose weight', 'cut', 'diet']):
            goal = "weight_loss"
            criteria = "low calories, high protein"
        elif any(k in query for k in ['muscle', 'gain', 'bulk', 'protein']):
            goal = "muscle_gain"
            criteria = "high protein, moderate calories"
        elif any(k in query for k in ['energy', 'carbs', 'endurance']):
            goal = "energy"
            criteria = "good carbs, moderate calories"
        else:
            goal = "balanced"
            criteria = "balanced macros"
        
        # Use fuzzy logic with inferred thresholds
        try:
            df = food_df.copy()
            cal_col = 'Calories (kcal)' if 'Calories (kcal)' in df.columns else None
            protein_col = 'Protein (g)' if 'Protein (g)' in df.columns else None
            food_col = 'Dish Name' if 'Dish Name' in df.columns else df.columns[0]
            
            if not cal_col or not protein_col:
                return None
            
            df[cal_col] = pd.to_numeric(df[cal_col], errors='coerce')
            df[protein_col] = pd.to_numeric(df[protein_col], errors='coerce')
            
            cal_median = patterns.get(cal_col, {}).get('median', 150)
            protein_median = patterns.get(protein_col, {}).get('median', 5)
            
            # Score based on goal
            if goal == "weight_loss":
                df['score'] = (df[protein_col] / protein_median) * 2 - (df[cal_col] / cal_median)
            elif goal == "muscle_gain":
                df['score'] = (df[protein_col] / protein_median) * 3
            else:
                df['score'] = (df[protein_col] / protein_median) + (1 - abs(df[cal_col] - cal_median) / cal_median)
            
            top_foods = df.nlargest(8, 'score')
            
            lines = [f"🍽️ Intelligent Food Recommendations for {goal.replace('_', ' ').title()}:\n"]
            lines.append(f"Criteria: {criteria} (based on dataset analysis)\n")
            
            for i, (_, row) in enumerate(top_foods.iterrows(), 1):
                food = row[food_col]
                cal = int(row[cal_col]) if pd.notna(row[cal_col]) else 0
                prot = row[protein_col] if pd.notna(row[protein_col]) else 0
                lines.append(f"{i}. {food} - {cal} kcal, {prot:.1f}g protein")
            
            return "\n".join(lines)
        except Exception:
            return None

    def _get_weight_loss_fruits(self) -> Optional[str]:
        """Infer good fruit options for weight loss from food dataset (not hardcoded tips)."""
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None

        # Identify columns dynamically
        food_col = 'Dish Name' if 'Dish Name' in food_df.columns else food_df.columns[0]
        cal_col = next((c for c in food_df.columns if 'calorie' in c.lower() or 'kcal' in c.lower()), None)
        fiber_col = next((c for c in food_df.columns if 'fibre' in c.lower() or 'fiber' in c.lower()), None)
        sugar_col = next((c for c in food_df.columns if 'free sugar' in c.lower() or 'sugar' in c.lower()), None)
        prot_col = next((c for c in food_df.columns if 'protein' in c.lower()), None)
        weight_loss_flag_col = next((c for c in food_df.columns if c.lower() == 'suitable_for_weight_loss'), None)
        low_cal_flag_col = next((c for c in food_df.columns if c.lower() == 'is_low_calorie'), None)
        kw_col = 'search_keywords' if 'search_keywords' in food_df.columns else None

        if cal_col is None:
            return None

        df = food_df.copy()
        df[cal_col] = pd.to_numeric(df[cal_col], errors='coerce')
        if fiber_col:
            df[fiber_col] = pd.to_numeric(df[fiber_col], errors='coerce')
        if sugar_col:
            df[sugar_col] = pd.to_numeric(df[sugar_col], errors='coerce')
        if prot_col:
            df[prot_col] = pd.to_numeric(df[prot_col], errors='coerce')

        # Infer "fruit-like" rows from names + keywords
        fruit_regex = r"\b(?:fruit|apple|banana|orange|mango|papaya|guava|berry|grape|melon|pomegranate|pineapple|lemon)\b"
        mask_name = df[food_col].astype(str).str.contains(fruit_regex, case=False, na=False, regex=True)
        mask_kw = df[kw_col].astype(str).str.contains(r"\bfruit\b", case=False, na=False, regex=True) if kw_col else False
        mask = mask_name | mask_kw
        candidates = df[mask].copy()
        if candidates.empty:
            return None

        # Score using dataset fields
        cal_median = pd.to_numeric(df[cal_col], errors='coerce').dropna().median()
        if not np.isfinite(cal_median) or cal_median <= 0:
            cal_median = 150.0

        candidates['score'] = 0.0
        candidates['score'] += (1.0 - (candidates[cal_col].fillna(cal_median) / max(1.0, cal_median))).clip(-1.0, 1.0)
        if fiber_col:
            fiber_median = pd.to_numeric(df[fiber_col], errors='coerce').dropna().median()
            if np.isfinite(fiber_median) and fiber_median > 0:
                candidates['score'] += (candidates[fiber_col].fillna(0) / fiber_median).clip(0.0, 2.0) * 0.8
        if sugar_col:
            sugar_median = pd.to_numeric(df[sugar_col], errors='coerce').dropna().median()
            if np.isfinite(sugar_median) and sugar_median > 0:
                candidates['score'] -= (candidates[sugar_col].fillna(sugar_median) / sugar_median).clip(0.0, 2.0) * 0.4
        if prot_col:
            prot_median = pd.to_numeric(df[prot_col], errors='coerce').dropna().median()
            if np.isfinite(prot_median) and prot_median > 0:
                candidates['score'] += (candidates[prot_col].fillna(0) / prot_median).clip(0.0, 2.0) * 0.2
        if weight_loss_flag_col:
            candidates['score'] += candidates[weight_loss_flag_col].astype(str).str.lower().isin(['true', '1', 'yes']).astype(float) * 1.2
        if low_cal_flag_col:
            candidates['score'] += candidates[low_cal_flag_col].astype(str).str.lower().isin(['true', '1', 'yes']).astype(float) * 0.8

        top = candidates.sort_values(by='score', ascending=False).head(8)
        if top.empty:
            return None

        lines = ["Fruit options from dataset that are more weight-loss friendly:\n"]
        for i, (_, row) in enumerate(top.iterrows(), 1):
            name = str(row.get(food_col, 'Unknown')).strip()
            cal = row.get(cal_col, np.nan)
            fib = row.get(fiber_col, np.nan) if fiber_col else np.nan
            sug = row.get(sugar_col, np.nan) if sugar_col else np.nan
            meta = []
            if pd.notna(cal):
                meta.append(f"{int(round(float(cal)))} kcal")
            if pd.notna(fib):
                meta.append(f"{float(fib):.1f}g fiber")
            if pd.notna(sug):
                meta.append(f"{float(sug):.1f}g sugar")
            lines.append(f"{i}. {name}" + (f" ({', '.join(meta)})" if meta else ""))
        lines.append("\nTip: prefer lower-calorie, higher-fiber choices and portion control.")
        return "\n".join(lines)

    def _intelligent_exercise_recommendation(self, query: str) -> Optional[str]:
        """Use inferred exercise patterns to recommend exercises intelligently"""
        if 'exercises' not in self.inferred_knowledge:
            return None
        
        exercise_df = self.datasets.get("exercises")
        if exercise_df is None or exercise_df.empty:
            return None
        
        patterns = self.inferred_knowledge['exercises']
        
        # Determine target from query
        target = None
        if 'popular_targets' in patterns:
            for body_part in patterns['popular_targets'].keys():
                if body_part.lower() in query:
                    target = body_part
                    break
        
        # Determine equipment preference
        equipment = None
        if 'equipment_types' in patterns:
            for equip in patterns['equipment_types'].keys():
                if equip.lower() in query:
                    equipment = equip
                    break
        
        # Filter exercises
        df = exercise_df.copy()
        if target and 'target' in df.columns:
            df = df[df['target'].str.lower() == target.lower()]
        if equipment and 'equipment' in df.columns:
            df = df[df['equipment'].str.lower() == equipment.lower()]
        
        if df.empty:
            df = exercise_df.head(8)
        else:
            df = df.head(8)
        
        lines = ["💪 Intelligent Exercise Recommendations:\n"]
        if target:
            lines.append(f"Target: {target}")
        if equipment:
            lines.append(f"Equipment: {equipment}")
        lines.append("")
        
        for i, (_, row) in enumerate(df.iterrows(), 1):
            name = row.get('name', 'Unknown')
            tgt = row.get('target', 'N/A')
            equip = row.get('equipment', 'N/A')
            lines.append(f"{i}. {name} (Target: {tgt}, Equipment: {equip})")
        
        return "\n".join(lines)

    def _steps_recommendation(self, query: str) -> str:
        """Provide intelligent steps/walking recommendations"""
        q = query.lower()
        
        # Determine goal
        if any(k in q for k in ['weight loss', 'lose weight', 'fat loss']):
            goal = "weight_loss"
            steps = 10000
            desc = "Weight Loss"
        elif any(k in q for k in ['fitness', 'health', 'active']):
            goal = "fitness"
            steps = 8000
            desc = "General Fitness"
        elif any(k in q for k in ['maintain', 'maintenance']):
            goal = "maintenance"
            steps = 7000
            desc = "Maintenance"
        else:
            goal = "general"
            steps = 7000
            desc = "General Health"
        
        # Calculate distance and calories (approximate)
        distance_km = (steps * 0.762) / 1000  # Average step = 0.762m
        calories = steps * 0.04  # Approximate 0.04 cal per step
        time_min = steps / 100  # Average 100 steps per minute
        
        return (
            f"🚶 Daily Steps Recommendation for {desc}:\n\n"
            f"✅ Target Steps: {steps:,} steps/day\n"
            f"📏 Distance: ~{distance_km:.1f} km\n"
            f"⏱️ Time: ~{time_min:.0f} minutes\n"
            f"🔥 Calories Burned: ~{calories:.0f} kcal\n\n"
            f"📊 Step Goals by Activity Level:\n"
            f"  • Sedentary: 5,000 steps/day (basic health)\n"
            f"  • Lightly Active: 7,000 steps/day (general wellness)\n"
            f"  • Active: 10,000 steps/day (fitness & weight management)\n"
            f"  • Very Active: 12,000+ steps/day (athletic performance)\n\n"
            f"💡 Tips:\n"
            f"  • Break it up: 3 walks of {steps//3:,} steps each\n"
            f"  • Track progress with a pedometer or phone app\n"
            f"  • Take stairs, park farther, walk during calls\n"
            f"  • Consistency matters more than hitting exact numbers"
        )

    def _dataset_question_guide(self) -> str:
        lines = [
            "You can ask using these patterns (with real names from datasets):",
            "",
            "1) Exercises dataset",
            "Examples:",
            "- instructions to astride jumps",
            "- how to do barbell squat",
            "- exercises for chest with dumbbell",
            "- highest reps/time exercises (if numeric field available)",
            "",
            "2) Food nutrition dataset",
            "Examples:",
            "- calories in idli",
            "- protein in paneer",
            "- foods with more than 20 protein",
            "- highest fiber foods",
            "",
            "3) Diet recommendations dataset",
            "Examples:",
            "- diet recommendation for 30 year male weight 75kg height 175cm",
            "- plan for vegetarian with diabetes",
            "",
            "4) Disease-food nutrition dataset",
            "Examples:",
            "- foods recommended for diabetes",
            "- foods to avoid for hypertension",
            "- high protein foods for cholesterol",
            "",
            "5) Yoga poses dataset",
            "Examples:",
            "- benefits of vajrasana",
            "- contraindications of headstand",
            "- beginner yoga poses for flexibility",
            "",
            "Tips for best results: include exact food/exercise/pose name, include units (kg, cm, g, ml), and ask one clear intent per message.",
        ]
        return "\n".join(lines)

    def _parse_activity_level(self, q: str) -> str:
        ql = (q or "").lower()
        if any(k in ql for k in ["sedentary", "low activity", "desk job"]):
            return "sedentary"
        if any(k in ql for k in ["light", "lightly active", "walk", "walking"]):
            return "light"
        if any(k in ql for k in ["moderate", "moderately active", "active"]):
            return "moderate"
        if any(k in ql for k in ["very active", "highly active", "athlete", "intense"]):
            return "very active"
        return "moderate"

    def _parse_gender(self, q: str) -> Optional[str]:
        ql = (q or "").lower()
        if any(k in ql for k in ["female", "woman", "girl"]):
            return "female"
        if any(k in ql for k in ["male", "man", "boy"]):
            return "male"
        return None

    def _rule_based_calories_answer(self, q: str) -> Optional[str]:
        # Handles: "calories for 70kg 175cm age 25 male moderate", "tdee for 80kg 170cm", "total calories for 60kg"
        ql = (q or "").lower()
        if not any(k in ql for k in ["tdee", "bmr", "maintenance calories", "maintenance", "calories should i eat", "calories per day", "daily calories", "calculate calories", "calorie", "total calories"]):
            return None

        # Fuzzy weight and height matching
        weight_match = re.search(r"(\d+(?:\.\d+)?)\s*kg[a-z]?", ql)
        height_cm_match = re.search(r"(\d+(?:\.\d+)?)\s*cm[a-z]?", ql)
        age_match = re.search(r"(?:age\s*)?(\d{1,3})\s*(?:years|year|y)?\b", ql)
        
        # Check if this is asking for daily calorie needs (not food calories)
        is_daily_calorie_query = any(k in ql for k in ["total calories for", "calories for", "daily calories", "calories per day", "tdee", "bmr", "maintenance", "should i eat"])
        
        if not is_daily_calorie_query:
            return None

        if not weight_match or not height_cm_match:
            return (
                "I can calculate your daily calorie needs (TDEE). Please provide:\n"
                "- Weight (kg)\n"
                "- Height (cm)\n"
                "- Age (optional)\n"
                "- Gender (male/female, optional)\n"
                "- Activity level (sedentary/light/moderate/very active, optional)\n\n"
                "Example: 'calculate calories for 70kg 175cm age 25 male moderate'"
            )

        weight_kg = float(weight_match.group(1))
        height_cm = float(height_cm_match.group(1))
        age = int(age_match.group(1)) if age_match else None
        gender = self._parse_gender(ql)
        activity = self._parse_activity_level(ql)

        # Mifflin-St Jeor when age+gender available, else simple fallback
        if age is not None and gender in {"male", "female"}:
            if gender == "male":
                bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
            else:
                bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
        else:
            # fallback (rough): 24 kcal/kg/day
            bmr = weight_kg * 24.0

        if activity in ["sedentary", "low"]:
            mult = 1.2
        elif activity in ["light", "lightly active"]:
            mult = 1.375
        elif activity in ["moderate", "moderately active", "active"]:
            mult = 1.55
        else:
            mult = 1.725

        tdee = bmr * mult

        goal = "maintenance"
        if any(k in ql for k in ["lose", "loss", "fat loss", "cut"]):
            goal = "fat loss"
            target = max(1200.0, tdee - 400.0)
        elif any(k in ql for k in ["gain", "muscle", "bulk"]):
            goal = "muscle gain"
            target = min(4000.0, tdee + 250.0)
        else:
            target = tdee

        result = f"✅ Daily Calorie Calculation Result:\n\n"
        result += f"Weight: {weight_kg} kg\n"
        result += f"Height: {height_cm} cm\n"
        if age:
            result += f"Age: {age} years\n"
        if gender:
            result += f"Gender: {gender}\n"
        result += f"Activity Level: {activity}\n\n"
        result += f"BMR (Base Metabolic Rate): {bmr:.0f} kcal/day\n"
        result += f"TDEE (Total Daily Energy): {tdee:.0f} kcal/day\n\n"
        result += f"Recommended for {goal}: {target:.0f} kcal/day"
        
        return result

    def _rule_based_water_answer(self, q: str) -> Optional[str]:
        ql = (q or "").lower()
        if not any(k in ql for k in ["water", "hydration"]):
            return None
        
        # Try exact match first
        weight_match = re.search(r"(\d+(?:\.\d+)?)\s*kg", ql)
        
        # Try fuzzy match for typos like "kgd", "kgs", "kg."
        if not weight_match:
            weight_match = re.search(r"(\d+(?:\.\d+)?)\s*kg[a-z]?", ql)
        
        if not weight_match:
            return None
            
        weight_kg = float(weight_match.group(1))
        water_l = max(1.8, weight_kg * 0.033)
        return (
            f"✅ Water Intake Calculation Result:\n\n"
            f"Weight: {weight_kg} kg\n"
            f"Recommended Water Intake: {water_l:.1f} L/day ({water_l*1000:.0f} ml/day)\n\n"
            "💡 Note: Increase intake on hot days or during heavy exercise."
        )

    def _rule_based_macros_answer(self, q: str) -> Optional[str]:
        # Simple macro split based on goal and calories
        ql = (q or "").lower()
        if not any(k in ql for k in ["macros", "macro", "calculate macros", "macro split"]):
            return None
        cal_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:kcal|calories)\b", ql)
        if not cal_match:
            return (
                "I can calculate your macro split (protein, carbs, fat). Please provide your daily calorie target.\n"
                "Example: 'calculate macros for 2000 calories' or 'macros for 2000 calories fat loss'"
            )
        calories = float(cal_match.group(1))

        goal = "maintenance"
        if any(k in ql for k in ["lose", "loss", "fat loss", "cut"]):
            goal = "fat loss"
            p_pct, f_pct, c_pct = 0.30, 0.25, 0.45
        elif any(k in ql for k in ["gain", "muscle", "bulk"]):
            goal = "muscle gain"
            p_pct, f_pct, c_pct = 0.25, 0.25, 0.50
        else:
            p_pct, f_pct, c_pct = 0.25, 0.30, 0.45

        protein_g = (calories * p_pct) / 4.0
        carbs_g = (calories * c_pct) / 4.0
        fat_g = (calories * f_pct) / 9.0

        return (
            f"✅ Macro Split Calculation Result:\n\n"
            f"Daily Calories: {calories:.0f} kcal\n"
            f"Goal: {goal}\n\n"
            f"Protein: {protein_g:.0f}g/day ({p_pct*100:.0f}% of calories)\n"
            f"Carbs: {carbs_g:.0f}g/day ({c_pct*100:.0f}% of calories)\n"
            f"Fat: {fat_g:.0f}g/day ({f_pct*100:.0f}% of calories)"
        )

    def _rule_based_bmi_answer(self, q: str) -> Optional[str]:
        if "bmi" not in q:
            return None

        # Fuzzy weight and height matching
        weight_match = re.search(r"(\d+(?:\.\d+)?)\s*kg[a-z]?", q)
        height_m_match = re.search(r"(\d+(?:\.\d+)?)\s*m(?:eter|etre|)[a-z]?\b", q)
        height_cm_match = re.search(r"(\d+(?:\.\d+)?)\s*cm[a-z]?", q)

        if not weight_match:
            return (
                "I can calculate your BMI. Please provide your weight (kg) and height (cm).\n"
                "Example: 'calculate bmi for 70kg 175cm'"
            )

        weight = float(weight_match.group(1))
        height_m = None
        if height_m_match:
            height_m = float(height_m_match.group(1))
        elif height_cm_match:
            height_m = float(height_cm_match.group(1)) / 100.0

        if not height_m or height_m <= 0:
            return (
                f"I found your weight ({weight}kg) but need your height.\n"
                "Please provide height in cm or meters. Example: 'bmi for 70kg 175cm'"
            )

        bmi = weight / (height_m * height_m)
        if bmi < 18.5:
            category = "Underweight"
        elif bmi < 25:
            category = "Normal weight"
        elif bmi < 30:
            category = "Overweight"
        else:
            category = "Obesity"

        return (
            f"✅ BMI Calculation Result:\n\n"
            f"Weight: {weight} kg\n"
            f"Height: {height_m*100:.0f} cm\n"
            f"BMI: {bmi:.1f}\n"
            f"Category: {category}"
        )

    def _format_answer(
        self,
        dataset_name: str,
        matched: pd.DataFrame,
        operation: str,
        target_col: Optional[str],
    ) -> str:
        view = matched.drop(columns=["_match_score"], errors="ignore")

        if operation == "count":
            return f"Found {len(view)} results"

        if operation in {"max", "min", "average", "sum"} and target_col and target_col in view.columns:
            if not pd.api.types.is_numeric_dtype(view[target_col]):
                return f"Found {len(view)} results, but '{target_col}' is not numeric."

            values = view[target_col].dropna()
            if values.empty:
                return f"Found {len(view)} results, but no numeric values found in '{target_col}'."

            if operation == "max":
                idx = values.idxmax()
                row = view.loc[idx]
                if isinstance(row, pd.DataFrame):
                    row = row.iloc[0]
                return self._format_single_row(dataset_name, row, f"Highest {target_col}")
            if operation == "min":
                idx = values.idxmin()
                row = view.loc[idx]
                if isinstance(row, pd.DataFrame):
                    row = row.iloc[0]
                return self._format_single_row(dataset_name, row, f"Lowest {target_col}")
            if operation == "average":
                return f"Average {target_col}: {values.mean():.2f}"
            if operation == "sum":
                return f"Total {target_col}: {values.sum():.2f}"

        # Check if results have multiple categories (e.g., body parts, equipment)
        clarification = self._check_for_clarification_needed(view, dataset_name)
        if clarification:
            return clarification

        # Clean display - exclude debug columns
        top = view.head(5)
        exclude_cols = {'normalized', 'tokens', '_match_score'}
        cols = [c for c in top.columns if c not in exclude_cols][:6]
        
        lines = []
        for i, (_, row) in enumerate(top.iterrows(), start=1):
            lines.append(f"{i}.")
            for c in cols:
                val = row.get(c)
                if pd.notna(val):
                    lines.append(f"   {c}: {val}")
            lines.append("")
        return "\n".join(lines).strip()

    def _check_for_clarification_needed(self, df: pd.DataFrame, dataset_name: str) -> Optional[str]:
        """Check if user query is too broad and needs clarification"""
        if df.empty or len(df) < 10:
            return None
        
        # For exercises, check if multiple body parts or equipment types
        if dataset_name == "exercises":
            if 'bodyPart' in df.columns:
                body_parts = df['bodyPart'].value_counts()
                if len(body_parts) >= 3:
                    lines = [
                        f"Found {len(df)} exercises across multiple categories.\n",
                        "Here are a few examples:\n"
                    ]
                    
                    # Show 3 sample exercises
                    sample = df.head(3)
                    for i, (_, row) in enumerate(sample.iterrows(), 1):
                        name = row.get('name', 'Unknown')
                        target = row.get('target', 'N/A')
                        equip = row.get('equipment', 'N/A')
                        lines.append(f"{i}. {name} (Target: {target}, Equipment: {equip})")
                    
                    lines.extend([
                        "\n👉 For more specific results, please specify:\n",
                        "🏋️ Body Parts:"
                    ])
                    for part, count in body_parts.head(5).items():
                        lines.append(f"  • {part} ({count} exercises)")
                    
                    if 'equipment' in df.columns:
                        equipment = df['equipment'].value_counts()
                        if len(equipment) >= 3:
                            lines.append("\n🏋️ Equipment:")
                            for equip, count in equipment.head(5).items():
                                lines.append(f"  • {equip} ({count} exercises)")
                    
                    lines.append("\n💡 Example: 'exercises for upper legs with body weight'")
                    return "\n".join(lines)
        
        # For foods, check if multiple categories
        if dataset_name == "food_nutrition":
            if len(df) > 20:
                # Show 3 sample foods first
                lines = [f"Found {len(df)} food items.\n", "Here are a few examples:\n"]
                
                sample = df.head(3)
                food_col = 'Dish Name' if 'Dish Name' in df.columns else df.columns[0]
                cal_col = 'Calories (kcal)' if 'Calories (kcal)' in df.columns else None
                protein_col = 'Protein (g)' if 'Protein (g)' in df.columns else None
                
                for i, (_, row) in enumerate(sample.iterrows(), 1):
                    food = row.get(food_col, 'Unknown')
                    cal = f", {int(row[cal_col])} kcal" if cal_col and pd.notna(row.get(cal_col)) else ""
                    prot = f", {row[protein_col]:.1f}g protein" if protein_col and pd.notna(row.get(protein_col)) else ""
                    lines.append(f"{i}. {food}{cal}{prot}")
                
                # Check calorie distribution
                if cal_col:
                    cals = pd.to_numeric(df[cal_col], errors='coerce').dropna()
                    low_cal = len(cals[cals < cals.quantile(0.33)])
                    med_cal = len(cals[(cals >= cals.quantile(0.33)) & (cals < cals.quantile(0.67))])
                    high_cal = len(cals[cals >= cals.quantile(0.67)])
                    
                    if low_cal > 5 and med_cal > 5 and high_cal > 5:
                        lines.extend([
                            "\n👉 For more specific results, please specify:\n",
                            f"  • Low calorie (<{cals.quantile(0.33):.0f} kcal): {low_cal} items",
                            f"  • Moderate calorie ({cals.quantile(0.33):.0f}-{cals.quantile(0.67):.0f} kcal): {med_cal} items",
                            f"  • High calorie (>{cals.quantile(0.67):.0f} kcal): {high_cal} items",
                            "\n💡 Example: 'low calorie foods' or 'high protein foods'"
                        ])
                        return "\n".join(lines)
        
        return None

    def _is_exercise_instruction_query(self, question: str, intent: Dict[str, Any]) -> bool:
        q = (question or "").lower()
        asks_instruction = any(
            k in q for k in ["instruction", "instructions", "how to", "how do", "steps", "form", "technique", "how do i do", "how do i", "perform", "guide", "teach", "show me", "demonstrate"]
        )
        if not asks_instruction:
            return False
        domain = intent.get("domain", "general")
        if domain == "exercise":
            return True
        # Check if question contains exercise-related words
        exercise_words = ["exercise", "workout", "jump", "squat", "lunge", "press", "curl", "plank", "stretch", "circles", "push", "pull", "lift", "raise", "row", "crunch", "dip", "fly", "pushup", "pullup", "situp"]
        return any(k in q for k in exercise_words)

    def _format_exercise_instructions_answer(self, matched: pd.DataFrame, question: str) -> Optional[str]:
        if matched.empty:
            return None

        view = matched.drop(columns=["_match_score"], errors="ignore")
        q = (question or "").lower()

        # Extract exercise name from question (remove instruction keywords)
        exercise_query = q
        for keyword in ['instructions', 'instruction', 'how to do', 'how do i do', 'how to', 'steps for', 'guide for', 'teach me']:
            exercise_query = exercise_query.replace(keyword, '')
        exercise_query = exercise_query.strip()

        # Prefer exact/near-exact name matches from the user's question
        row = None
        if "name" in view.columns:
            best_match_idx = None
            best_score = 0
            
            for idx, r in view.iterrows():
                name = str(r.get("name", "")).lower()
                if not name:
                    continue
                
                # Exact match gets highest priority
                if name == exercise_query:
                    row = r
                    break
                
                # Check if query is in name (e.g., "pullup" in "band assisted pull-up")
                if exercise_query in name or name in exercise_query:
                    # Prefer shorter names (simpler variations)
                    score = 100 - len(name)
                    if score > best_score:
                        best_score = score
                        best_match_idx = idx
            
            # Use best match or top scored row
            if row is None:
                if best_match_idx is not None:
                    row = view.loc[best_match_idx]
                else:
                    row = view.iloc[0]
        else:
            row = view.iloc[0]

        instr_cols = [c for c in view.columns if str(c).lower().startswith("instructions/")]
        def _instr_order(col: str) -> int:
            m = re.search(r"/(\d+)$", str(col))
            return int(m.group(1)) if m else 9999
        instr_cols = sorted(instr_cols, key=_instr_order)

        steps: List[str] = []
        for c in instr_cols:
            v = row.get(c)
            if pd.notna(v) and str(v).strip():
                steps.append(str(v).strip())

        if not steps:
            return None

        lines = [
            f"Exercise: {row.get('name', 'Unknown')}",
            f"Target: {row.get('target', 'N/A')}",
            f"Equipment: {row.get('equipment', 'N/A')}",
            "",
            "Instructions:",
        ]
        for i, step in enumerate(steps, start=1):
            lines.append(f"{i}. {step}")

        gif = row.get("gifUrl")
        if pd.notna(gif) and str(gif).strip():
            lines.extend(["", f"Demo GIF: {gif}"])

        return "\n".join(lines)

    def _format_single_row(self, dataset_name: str, row: pd.Series, title: str) -> str:
        lines = [title, ""]
        for c, v in row.items():
            if c == "_match_score":
                continue
            if pd.notna(v):
                lines.append(f"{c}: {v}")
        return "\n".join(lines)

    def answer_question(self, question: str) -> str:
        """Main entry point. Handles typos, unstructured grammar, synonym variants.
        
        Pipeline:
        1. Normalize / fix typos / apply synonym map
        2. Check if clarification is needed (vague query, missing inputs)
        3. Detect intents from normalized text
        4. Try rule-based calculators (BMI, calories, protein, water, macros)
        5. Check FAQ with multi-signal fuzzy matching
        6. Query relevant dataset(s)
        7. Fall back to guided clarification
        """
        if not self.datasets:
            return "Knowledge base is not available right now."
        
        # Step 1: Normalize query (typo fix + synonym map)
        normalized_question = self._normalize_query(question)
        
        intent = self.extract_query_intent(normalized_question)
        
        # Step 2: Check if we need more info from the user before answering
        clarification = self._should_ask_clarification(normalized_question, intent)
        if clarification:
            return clarification
        
        # Step 3: Check if asking about specific food nutrition - handle directly
        if self._is_specific_food_query(normalized_question):
            food_answer = self._get_specific_food_nutrition(normalized_question)
            if food_answer:
                return food_answer
        
        # Check for healthy food query
        q_lower = normalized_question.lower()
        if any(k in q_lower for k in ['healthy food', 'healthy foods', 'healthy items', 'balanced food', 'nutritious food']):
            healthy_answer = self._get_healthy_foods()
            if healthy_answer:
                return healthy_answer
        
        # PRIORITY: If explicitly asking for exercises (not just general advice), query dataset first
        if self._is_exercise_list_query(normalized_question, intent):
            result = self.execute_dynamic_query(intent)
            if result and "I don't have enough" not in result:
                return result
        
        # Check if this is an exercise instruction query - prioritize over FAQ
        if self._is_exercise_instruction_query(normalized_question, intent):
            result = self.execute_dynamic_query(intent)
            if result and "Found 0 results" not in result and "I don't have enough" not in result:
                return result
        
        # IMPORTANT: Try rule-based answers FIRST for calculation queries (before FAQ)
        q_lower = normalized_question.lower()
        is_calculation_query = any(k in q_lower for k in ['calculate', 'calculation', 'formula', 'compute'])
        detected_intents = intent.get("detected_intents", [])
        asks_food_list = any(k in q_lower for k in [
            "low calorie foods", "high protein foods", "foods for", "best foods",
            "foods to eat", "food items", "list of foods", "which foods"
        ])
        is_general_guidance_query = bool(detected_intents) and any(i in detected_intents for i in [
            "weight_loss", "muscle_gain", "nutrition", "health", "stamina", "sleep"
        ]) and not asks_food_list

        if is_general_guidance_query:
            rule_answer = self._rule_based_general_answer(normalized_question, intent)
            if rule_answer:
                return rule_answer
            inferred_answer = self._answer_from_inferred_qa(normalized_question)
            if inferred_answer:
                return inferred_answer
        
        if is_calculation_query or self._should_prefer_rule_based(normalized_question, intent):
            rule_answer = self._rule_based_general_answer(normalized_question, intent)
            if rule_answer:
                return rule_answer
        
        # Check FAQ for general questions
        faq_answer = self._check_faq(normalized_question.lower())
        
        # If FAQ answer exists, intelligently append relevant dataset results
        if faq_answer:
            # Confidence check: if the answer seems unrelated, don't show it
            confidence = self._compute_fuzzy_confidence(normalized_question, faq_answer)
            enriched_data = self._enrich_with_dataset(q_lower, faq_answer)
            if enriched_data:
                return f"{faq_answer}\n\n{enriched_data}"
            return faq_answer

        inferred_answer = self._answer_from_inferred_qa(normalized_question)
        if inferred_answer:
            return inferred_answer
        
        # Fall back to dataset query
        result = self.execute_dynamic_query(intent)
        
        # If dataset query also failed, give a smart guided response based on detected intents
        if "I don't have enough information" in result:
            detected_intents = intent.get("detected_intents", [])
            if detected_intents:
                return self._guided_fallback(normalized_question, detected_intents)
        
        return result

    def _guided_fallback(self, question: str, detected_intents: List[str]) -> str:
        """Provide a helpful guided response when no answer found, based on detected intents."""
        lines = ["I couldn't find a precise answer for that, but here's how I can help:\n"]
        
        intent_guides = {
            "weight_loss": ("🎯 Weight Loss", 
                           "Try: 'weight loss foods', 'calorie deficit plan', or 'exercises for fat loss'"),
            "muscle_gain": ("💪 Muscle Gain",
                           "Try: 'chest exercises', 'protein for muscle gain', or 'workout plan for muscle building'"),
            "bmi": ("📊 BMI",
                   "Try: 'calculate bmi for 70kg 175cm'"),
            "calories": ("🔥 Calories",
                        "Try: 'calories for 70kg 175cm 25 age male moderate activity'"),
            "protein": ("🥩 Protein",
                       "Try: 'how much protein for 70kg muscle gain'"),
            "water": ("💧 Water",
                     "Try: 'water intake for 70kg'"),
            "exercise": ("🏋️ Exercise",
                        "Try: 'exercises for chest', 'back exercises with dumbbells'"),
            "yoga": ("🧘 Yoga",
                    "Try: 'beginner yoga poses', 'benefits of downward dog'"),
            "nutrition": ("🥗 Nutrition",
                         "Try: 'high protein foods', 'healthy foods list'"),
            "health": ("🏥 Health Conditions",
                      "Try: 'foods to avoid for diabetes', 'diet for hypertension'"),
        }
        
        shown = 0
        for intent in detected_intents[:3]:
            if intent in intent_guides:
                title, suggestion = intent_guides[intent]
                lines.append(f"{title}: {suggestion}")
                shown += 1
        
        if shown == 0:
            lines.append("Ask about: exercises, food nutrition, yoga poses, BMI, calories, protein, or specific health conditions.")
        
        lines.append("\n💡 Tip: Be specific! E.g., instead of 'exercises' try 'chest exercises with bodyweight'")
        return "\n".join(lines)
    
    def _enrich_with_dataset(self, question: str, faq_response: str) -> Optional[str]:
        """Intelligently enrich FAQ response with relevant dataset information using fuzzy keyword extraction"""
        
        # Extract keywords from both question and FAQ response
        combined_text = f"{question} {faq_response}".lower()
        
        # Healthy foods
        if any(k in question for k in ['healthy food', 'healthy foods', 'healthy items', 'balanced food', 'nutritious food']):
            return self._get_healthy_foods()
        
        # Weight loss foods
        if any(k in question for k in ['foods to consume for weight loss', 'foods for weight loss', 'weight loss foods']):
            return self._get_weight_loss_foods()
        
        # High protein foods
        if any(k in question for k in ['high protein', 'protein rich', 'protein foods']):
            return self._get_high_nutrient_foods("protein", min_value=15)
        
        # Low calorie foods
        if any(k in question for k in ['low calorie', 'least calorie', 'lowest calorie']):
            return self._get_low_calorie_foods()
        
        # Exercise enrichment - extract exercise names from FAQ response
        if any(k in question for k in ['exercise', 'exercises', 'workout', 'build muscle', 'muscle gain']):
            # Extract exercise names mentioned in the FAQ response
            exercise_keywords = ['squat', 'deadlift', 'bench press', 'pull-up', 'pullup', 'row', 'overhead press', 
                               'push-up', 'pushup', 'lunge', 'plank', 'dip', 'curl', 'press']
            
            found_exercises = []
            for keyword in exercise_keywords:
                if keyword in faq_response.lower():
                    found_exercises.append(keyword)
            
            # Query exercise dataset for these exercises
            if found_exercises:
                exercise_df = self.datasets.get("exercises")
                if exercise_df is not None and not exercise_df.empty:
                    matches = []
                    for exercise_name in found_exercises[:3]:  # Limit to 3 exercises
                        # Fuzzy search in exercise dataset
                        if 'name' in exercise_df.columns:
                            mask = exercise_df['name'].str.lower().str.contains(exercise_name, na=False)
                            exercise_matches = exercise_df[mask]
                            if not exercise_matches.empty:
                                matches.append(exercise_matches.iloc[0])
                    
                    if matches:
                        lines = ["\n📋 Specific Exercises from Database:\n"]
                        for i, ex in enumerate(matches, 1):
                            name = ex.get('name', 'Unknown')
                            target = ex.get('target', 'N/A')
                            equipment = ex.get('equipment', 'N/A')
                            lines.append(f"{i}. {name}")
                            lines.append(f"   Target: {target}, Equipment: {equipment}")
                        return "\n".join(lines)
        
        return None
    
    def _get_weight_loss_foods(self) -> Optional[str]:
        """Get foods ideal for weight loss: low calorie, high protein, high fiber"""
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None
        
        # Find relevant columns
        cal_col = None
        protein_col = None
        fiber_col = None
        food_col = None
        
        for col in food_df.columns:
            col_lower = col.lower()
            if 'calorie' in col_lower or 'kcal' in col_lower:
                cal_col = col
            elif 'protein' in col_lower:
                protein_col = col
            elif 'fiber' in col_lower or 'fibre' in col_lower:
                fiber_col = col
            elif col in ['food', 'Dish Name', 'Food Name', 'name']:
                food_col = col
        
        if not cal_col or not food_col:
            return None
        
        try:
            df = food_df.copy()
            df[cal_col] = pd.to_numeric(df[cal_col], errors='coerce')
            if protein_col:
                df[protein_col] = pd.to_numeric(df[protein_col], errors='coerce')
            if fiber_col:
                df[fiber_col] = pd.to_numeric(df[fiber_col], errors='coerce')
            
            # Filter: calories < 200, protein > 5 (if available)
            filtered = df[df[cal_col] < 200].copy()
            if protein_col:
                filtered = filtered[filtered[protein_col] > 5]
            
            # Score: lower calories + higher protein + higher fiber = better
            filtered['score'] = 0
            if protein_col:
                filtered['score'] += filtered[protein_col] * 2  # Protein is important
            if fiber_col:
                filtered['score'] += filtered[fiber_col] * 1.5  # Fiber keeps you full
            filtered['score'] -= filtered[cal_col] * 0.1  # Lower calories is better
            
            top_foods = filtered.nlargest(10, 'score')
            
            if top_foods.empty:
                return None
            
            lines = ["📋 Top foods for weight loss (low calorie, high protein/fiber):\n"]
            for i, (_, row) in enumerate(top_foods.iterrows(), 1):
                food_name = row[food_col]
                cal = int(row[cal_col]) if pd.notna(row[cal_col]) else 0
                protein = f", {row[protein_col]:.1f}g protein" if protein_col and pd.notna(row[protein_col]) else ""
                fiber = f", {row[fiber_col]:.1f}g fiber" if fiber_col and pd.notna(row[fiber_col]) else ""
                lines.append(f"{i}. {food_name} - {cal} kcal{protein}{fiber}")
            
            return "\n".join(lines)
        except Exception:
            return None

    def _get_specific_food_nutrition(self, question: str) -> Optional[str]:
        """Get nutrition info for a specific food item using fuzzy grammar parsing"""
        food_df = self.datasets.get("food_nutrition")
        if food_df is None or food_df.empty:
            return None
        
        # Extract food name from question with fuzzy grammar handling
        q = question.lower()
        
        # Remove common filler words and extract meaningful tokens
        filler_words = ['the', 'a', 'an', 'is', 'are', 'what', 'how', 'much', 'many', 'tell', 'me', 'about', 'give', 'show']
        nutrient_words = ['calorie', 'calories', 'protein', 'nutrition', 'carb', 'carbs', 'fat', 'fats', 'fiber', 'fibre', 'iron', 'calcium', 'sodium', 'vitamin']
        
        # Tokenize and clean
        words = re.findall(r'\b\w+\b', q)
        meaningful_words = [w for w in words if w not in filler_words and w not in nutrient_words and len(w) > 2]
        
        # Try different extraction patterns (unstructured grammar)
        food_keyword = None
        
        # Pattern 1: "in X" or "of X"
        if ' in ' in q:
            food_keyword = q.split(' in ')[-1].strip()
        elif ' of ' in q:
            food_keyword = q.split(' of ')[-1].strip()
        # Pattern 2: "X calories" or "X protein"
        elif meaningful_words:
            # Take the first meaningful word that's not a nutrient
            for word in meaningful_words:
                if word not in nutrient_words:
                    food_keyword = word
                    break
        
        # Fallback: join all meaningful words
        if not food_keyword and meaningful_words:
            food_keyword = ' '.join(meaningful_words[:2])  # Take first 2 words
        
        # Clean food keyword
        if food_keyword:
            food_keyword = re.sub(r'[^a-z\s]', '', food_keyword).strip()
        
        # Handle plural to singular
        if food_keyword and food_keyword.endswith('s') and len(food_keyword) > 3:
            food_keyword_singular = food_keyword[:-1]
        else:
            food_keyword_singular = food_keyword
        
        if not food_keyword or len(food_keyword) < 3:
            return None
        
        # Find food name column
        food_col = None
        for col in ['food', 'Dish Name', 'Food Name', 'name']:
            if col in food_df.columns:
                food_col = col
                break
        if food_col is None:
            return None
        
        # Search for matching foods - try both singular and plural
        # Phase 1: Exact and typo matching (strict)
        # First try: exact match
        matches = food_df[food_df[food_col].str.lower() == food_keyword_singular]
        
        # Second try: food name starts with keyword (singular)
        if matches.empty:
            matches = food_df[food_df[food_col].str.lower().str.startswith(food_keyword_singular, na=False)]
        
        # Third try: food name contains keyword as whole word (singular)
        if matches.empty:
            pattern = r'\b' + re.escape(food_keyword_singular) + r'\b'
            matches = food_df[food_df[food_col].str.contains(pattern, case=False, na=False, regex=True)]
        
        # Fourth try: original keyword
        if matches.empty and food_keyword != food_keyword_singular:
            pattern = r'\b' + re.escape(food_keyword) + r'\b'
            matches = food_df[food_df[food_col].str.contains(pattern, case=False, na=False, regex=True)]
        
        # Fifth try: typo correction with strict threshold (85%+)
        if matches.empty:
            best_match_idx = None
            best_score = 0.85
            
            for idx, row in food_df.iterrows():
                food_name = str(row[food_col]).lower()
                score = SequenceMatcher(None, food_keyword_singular, food_name).ratio()
                
                if score > best_score:
                    best_score = score
                    best_match_idx = idx
            
            if best_match_idx is not None:
                matches = food_df.loc[[best_match_idx]]
        
        # Phase 2: Related items fallback (if no exact/typo match found)
        if matches.empty:
            # Look for related foods with lower threshold (60%+)
            related_matches = []
            
            for idx, row in food_df.iterrows():
                food_name = str(row[food_col]).lower()
                
                # Check if any word in food name is similar to keyword
                words = food_name.split()
                max_word_score = 0
                for word in words:
                    if len(word) > 2:
                        score = SequenceMatcher(None, food_keyword_singular, word).ratio()
                        max_word_score = max(max_word_score, score)
                
                # Also check overall similarity
                overall_score = SequenceMatcher(None, food_keyword_singular, food_name).ratio()
                final_score = max(max_word_score, overall_score)
                
                if final_score >= 0.6:
                    related_matches.append((idx, final_score))
            
            # Sort by score and take top matches
            if related_matches:
                related_matches.sort(key=lambda x: x[1], reverse=True)
                top_indices = [idx for idx, _ in related_matches[:3]]
                matches = food_df.loc[top_indices]
        
        if matches.empty:
            return None
        
        # Get top match(es)
        if len(matches) == 1:
            row = matches.iloc[0]
            food_name = row[food_col]
            
            # Build nutrition response
            response = f"Nutrition for {food_name} (per 100g):\n\n"
            
            # Add available nutrition info
            for col in row.index:
                if col != food_col and pd.notna(row[col]):
                    response += f"{col}: {row[col]}\n"
            
            return response
        else:
            # Multiple matches found - show all
            response = f"Found {len(matches)} related items:\n\n"
            
            for i, (_, row) in enumerate(matches.iterrows(), 1):
                food_name = row[food_col]
                response += f"{i}. {food_name}\n"
                
                # Add key nutrition info
                for col in row.index:
                    if col != food_col and pd.notna(row[col]):
                        response += f"   {col}: {row[col]}\n"
                response += "\n"
            
            return response.strip()

    def _is_specific_food_query(self, question: str) -> bool:
        """Check if asking about specific food nutrition"""
        q = question.lower()
        
        # Exclude exercise instruction queries
        if any(k in q for k in ["instruction", "how to", "how do", "steps to", "guide", "teach", "show me", "demonstrate"]):
            return False
        
        # Exclude queries asking for lists of foods (high protein, low calorie, etc.)
        list_indicators = ['high protein', 'protein rich', 'low calorie', 'high fiber', 'foods with', 'foods high in', 'best foods for']
        if any(indicator in q for indicator in list_indicators):
            return False
        
        # Pattern: "calories/protein/nutrition in [food]" or "[food] calories/protein"
        patterns = [
            'calorie', 'protein', 'nutrition', 'carb', 'fat', 'fiber', 'iron', 'calcium'
        ]
        has_nutrient = any(p in q for p in patterns)
        has_in = ' in ' in q or ' of ' in q
        # If has nutrient word + "in/of" + another word, it's likely a food query
        return has_nutrient and (has_in or len(q.split()) <= 4)

    def _is_exercise_list_query(self, question: str, intent: Dict[str, Any]) -> bool:
        """Check if user is explicitly asking for a list of exercises"""
        q = question.lower()
        
        # Must contain exercise-related words
        exercise_words = ['exercise', 'exercises', 'workout', 'workouts']
        has_exercise_word = any(word in q for word in exercise_words)
        
        if not has_exercise_word:
            return False
        
        # Asking for exercises FOR something (muscle, chest, etc.)
        if ' for ' in q and any(k in q for k in ['muscle', 'building', 'chest', 'back', 'legs', 'arms', 'strength']):
            return True
        
        # Asking for "best exercises" or "good exercises"
        if any(k in q for k in ['best exercise', 'good exercise', 'top exercise', 'exercise to']):
            return True
        
        return False

    def _should_prefer_rule_based(self, question: str, intent: Dict[str, Any]) -> bool:
        """Determine if rule-based logic should be preferred over FAQ/dataset search.
        Enhanced: applies synonym normalization first for typo tolerance."""
        q_raw = (question or "").lower()
        # Apply synonym map so 'protien 70kgs daily' maps correctly
        q = self._apply_synonym_map(q_raw)
        
        if self._is_exercise_instruction_query(question, intent):
            return False
        
        # Numeric inputs present → prefer calculators
        has_weight = re.search(r"\d+\s*kg", q)
        has_height = re.search(r"\d+\s*cm", q)
        has_calories = re.search(r"\d+\s*(?:kcal|calories)", q)
        
        if "bmi" in q and (has_weight or has_height):
            return True
        if any(k in q for k in ["calories", "tdee", "bmr"]) and (has_weight or has_height):
            return True
        if "water" in q and has_weight:
            return True
        
        # Protein calculation — broad synonym coverage
        protein_keywords = ["protein", "protien", "protin", "protine", "protain", "proteen"]
        has_protein = any(k in q for k in protein_keywords)
        daily_keywords = ["per day", "daily", "in a day", "each day", "every day", 
                          "to consume", "should i consume", "how much", "need", "require", "intake"]
        asks_daily_protein = has_protein and any(k in q for k in daily_keywords)
        
        if asks_daily_protein:
            return True
        if has_protein and has_weight:
            return True
        if any(k in q for k in ["macro", "macros"]) and has_calories:
            return True
        if any(k in q for k in ["calculate", "computation", "formula", "calc"]):
            return True

        guidance_phrases = [
            "tips", "how to", "should i", "routine", "plan", "beginner", "general",
            "build muscle", "muscle gain", "weight loss", "healthy lifestyle"
        ]
        if any(p in q for p in guidance_phrases) and not (has_weight or has_height or has_calories):
            return True

        tokens = intent.get("tokens", [])
        if len(tokens) <= 1 and intent.get("operation") == "search":
            return True

        return False


chatbot_instance: Optional[FitnessChatbot] = None


def get_chatbot() -> FitnessChatbot:
    global chatbot_instance
    if chatbot_instance is None:
        chatbot_instance = FitnessChatbot()
    return chatbot_instance


def answer_fitness_question(question: str) -> str:
    bot = get_chatbot()
    return bot.answer_question(question)
