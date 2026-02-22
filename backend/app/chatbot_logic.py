"""
Dataset-first fitness chatbot logic.
Answers are generated from available datasets using keyword and column matching.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path

import numpy as np
import pandas as pd


class FitnessChatbot:
    def __init__(self, use_llama: bool = False, ollama_url: str = "http://localhost:11434"):
        self.use_llama = use_llama
        self.ollama_url = ollama_url

        self.datasets: Dict[str, pd.DataFrame] = {}
        self.dataset_metadata: Dict[str, Dict[str, Any]] = {}
        self.stop_words = {
            "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "at", "is", "are",
            "was", "were", "be", "being", "been", "with", "about", "show", "tell", "give",
            "what", "which", "who", "whom", "where", "when", "why", "how", "me", "my", "i",
            "you", "we", "they", "it", "this", "that", "these", "those", "please", "can",
            "could", "would", "should", "do", "does", "did", "any", "all", "from", "by",
            "into", "than", "then", "also", "have", "has", "had"
            , "less", "more", "above", "below", "under", "over", "highest", "lowest", "maximum", "minimum"
        }
        self.generic_query_tokens = {
            "exercise", "exercises", "workout", "workouts", "fitness", "food", "foods",
            "nutrition", "diet", "yoga", "pose", "poses", "best", "good"
        }

        self.load_all_datasets()
        self.build_dataset_metadata()

    def load_all_datasets(self) -> None:
        try:
            base = Path(__file__).resolve().parent
            self.datasets["exercises"] = pd.read_csv(base / "exercises.csv")
            self.datasets["food_nutrition"] = pd.read_csv(base / "Indian_Food_Nutrition_Processed.csv")
            self.datasets["diet_recommendations"] = pd.read_csv(base / "diet_recommendations_dataset.csv")
            self.datasets["disease_food_nutrition"] = pd.read_csv(base / "real_disease_food_nutrition_dataset.csv")
            self.datasets["yoga_poses"] = pd.read_csv(base / "final_asan1_1.csv")
            print(f"Loaded {len(self.datasets)} datasets")
        except Exception as e:
            print(f"Error loading datasets: {e}")
            self.datasets = {
                "exercises": pd.DataFrame(),
                "food_nutrition": pd.DataFrame(),
                "diet_recommendations": pd.DataFrame(),
                "disease_food_nutrition": pd.DataFrame(),
                "yoga_poses": pd.DataFrame(),
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
        q = (question or "").strip().lower()
        base_tokens = [
            t
            for t in re.findall(r"[a-z0-9_]+", q)
            if len(t) > 2 and t not in self.stop_words and not t.isdigit()
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

        return {
            "question": question,
            "tokens": tokens,
            "operation": operation,
            "numeric_filter": numeric_filter,
            "domain": domain,
        }

    def _infer_query_domain(self, q: str, tokens: List[str]) -> str:
        joined = f"{q} {' '.join(tokens)}"
        if any(k in joined for k in ["calorie", "protein", "carb", "fat", "fiber", "food", "nutrition", "meal", "vitamin"]):
            return "nutrition"
        if any(k in joined for k in ["yoga", "asana", "pose", "flexibility", "meditation"]):
            return "yoga"
        if any(k in joined for k in ["exercise", "workout", "gym", "muscle", "training", "strength", "cardio"]):
            return "exercise"
        if any(k in joined for k in ["diet", "weight loss", "weight gain", "plan"]):
            return "diet"
        if any(k in joined for k in ["disease", "diabetes", "hypertension", "cholesterol", "condition"]):
            return "health"
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
                "disease_food_nutrition": 4,
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
        for token in tokens:
            token_hit = text_df.apply(lambda col: col.str.contains(re.escape(token), regex=True), axis=0).any(axis=1)
            scores = scores + token_hit.astype(int)
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

            answer = self._format_answer(dataset_name, matched, operation, target_col)
            return answer

        rule_answer = self._rule_based_general_answer(question, intent)
        if rule_answer:
            return rule_answer

        dataset_list = ", ".join(
            f"{name} ({meta['num_rows']})" for name, meta in self.dataset_metadata.items()
        )
        return (
            f"I could not find a strong keyword match for: '{question}'.\n"
            f"Available datasets: {dataset_list}.\n"
            "Try including specific keywords such as exercise names, food names, nutrients, disease names, or yoga pose names."
        )

    def _rule_based_general_answer(self, question: str, intent: Dict[str, Any]) -> Optional[str]:
        q = (question or "").lower()
        domain = intent.get("domain", "general")

        bmi_answer = self._rule_based_bmi_answer(q)
        if bmi_answer:
            return bmi_answer

        if any(k in q for k in ["calorie deficit", "fat loss", "weight loss"]):
            return (
                "Source: rule_based\n"
                "For weight loss, keep a moderate calorie deficit (about 300-500 kcal/day), "
                "eat high-protein meals, and combine strength training with regular cardio."
            )

        if any(k in q for k in ["muscle gain", "build muscle", "hypertrophy"]):
            return (
                "Source: rule_based\n"
                "For muscle gain, use progressive overload, train each muscle 2-3 times/week, "
                "and consume enough protein (roughly 1.6-2.2 g/kg body weight/day)."
            )

        if any(k in q for k in ["workout plan", "workout routine", "exercise routine"]):
            return (
                "Source: rule_based\n"
                "Simple weekly structure: 3-4 strength sessions, 2-3 cardio sessions, "
                "1-2 lighter recovery days, and gradual progression in reps/weight."
            )

        if any(k in q for k in ["exercise", "workout", "training", "gym"]) and domain == "exercise":
            return (
                "Source: rule_based\n"
                "Base your workouts on compound patterns: squat, hinge, push, pull, and core. "
                "Track reps/sets and increase load gradually while maintaining form."
            )

        if "fitness" in q:
            return (
                "Source: rule_based\n"
                "General fitness approach: 150+ minutes of weekly activity, 2-4 strength sessions, "
                "balanced nutrition, consistent sleep, and progressive training over time."
            )

        if any(k in q for k in ["calories", "kcal", "maintenance calories", "tdee"]):
            return (
                "Source: rule_based\n"
                "Calorie targets: maintain near maintenance kcal, lose weight at ~300-500 kcal below maintenance, "
                "and gain muscle at ~200-300 kcal above maintenance."
            )

        if any(k in q for k in ["food", "foods", "nutrition", "healthy eating", "diet"]):
            return (
                "Source: rule_based\n"
                "Prioritize whole foods: lean protein, vegetables, fruits, whole grains, legumes, nuts/seeds, "
                "and adequate hydration. Limit ultra-processed foods and sugary drinks."
            )

        if any(k in q for k in ["health", "wellness", "healthy lifestyle", "preventive health"]):
            return (
                "Source: rule_based\n"
                "Health basics: regular activity, balanced nutrition, 7-9 hours sleep, stress management, "
                "and routine medical checkups."
            )

        return None

    def _rule_based_bmi_answer(self, q: str) -> Optional[str]:
        if "bmi" not in q:
            return None

        weight_match = re.search(r"(\d+(?:\.\d+)?)\s*kg", q)
        height_m_match = re.search(r"(\d+(?:\.\d+)?)\s*m(?:eter|etre|)\b", q)
        height_cm_match = re.search(r"(\d+(?:\.\d+)?)\s*cm", q)

        if not weight_match:
            return (
                "Source: rule_based\n"
                "BMI formula: BMI = weight(kg) / (height in meters)^2. "
                "Share your weight (kg) and height (cm or m) and I can calculate it."
            )

        weight = float(weight_match.group(1))
        height_m = None
        if height_m_match:
            height_m = float(height_m_match.group(1))
        elif height_cm_match:
            height_m = float(height_cm_match.group(1)) / 100.0

        if not height_m or height_m <= 0:
            return (
                "Source: rule_based\n"
                "I found your weight but not height. "
                "Provide height in cm or meters to calculate BMI."
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
            "Source: rule_based\n"
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
            return f"Source: {dataset_name}\nMatch count: {len(view)}"

        if operation in {"max", "min", "average", "sum"} and target_col and target_col in view.columns:
            if not pd.api.types.is_numeric_dtype(view[target_col]):
                return f"Source: {dataset_name}\nMatched {len(view)} rows, but '{target_col}' is not numeric."

            values = view[target_col].dropna()
            if values.empty:
                return f"Source: {dataset_name}\nMatched {len(view)} rows, but no numeric values found in '{target_col}'."

            if operation == "max":
                idx = values.idxmax()
                row = view.loc[idx]
                return self._format_single_row(dataset_name, row, f"Highest {target_col}")
            if operation == "min":
                idx = values.idxmin()
                row = view.loc[idx]
                return self._format_single_row(dataset_name, row, f"Lowest {target_col}")
            if operation == "average":
                return f"Source: {dataset_name}\nAverage {target_col}: {values.mean():.2f} (from {len(values)} rows)"
            if operation == "sum":
                return f"Source: {dataset_name}\nTotal {target_col}: {values.sum():.2f} (from {len(values)} rows)"

        top = view.head(5)
        cols = [c for c in top.columns if c != "_match_score"][:6]
        lines = [f"Source: {dataset_name}", f"Matched rows: {len(view)}", ""]
        for i, (_, row) in enumerate(top.iterrows(), start=1):
            lines.append(f"{i}.")
            for c in cols:
                val = row.get(c)
                if pd.notna(val):
                    lines.append(f"   {c}: {val}")
            lines.append("")
        return "\n".join(lines).strip()

    def _format_single_row(self, dataset_name: str, row: pd.Series, title: str) -> str:
        lines = [f"Source: {dataset_name}", title, ""]
        for c, v in row.items():
            if c == "_match_score":
                continue
            if pd.notna(v):
                lines.append(f"{c}: {v}")
        return "\n".join(lines)

    def answer_question(self, question: str) -> str:
        if not self.datasets:
            return "Knowledge base is not available right now."
        intent = self.extract_query_intent(question)
        if self._should_prefer_rule_based(question, intent):
            rule_answer = self._rule_based_general_answer(question, intent)
            if rule_answer:
                return rule_answer
        return self.execute_dynamic_query(intent)

    def _should_prefer_rule_based(self, question: str, intent: Dict[str, Any]) -> bool:
        q = (question or "").lower()
        if "bmi" in q:
            return True

        guidance_phrases = [
            "tips", "how to", "should i", "routine", "plan", "beginner", "general",
            "build muscle", "muscle gain", "weight loss", "calories should i eat",
            "healthy lifestyle"
        ]
        if any(p in q for p in guidance_phrases):
            return True

        # If query has very few specific tokens, prefer rule-based guidance.
        tokens = intent.get("tokens", [])
        if len(tokens) <= 1 and intent.get("operation") == "search":
            return True

        return False


chatbot_instance: Optional[FitnessChatbot] = None


def get_chatbot(use_llama: bool = False, ollama_url: str = "http://localhost:11434") -> FitnessChatbot:
    global chatbot_instance
    if chatbot_instance is None:
        chatbot_instance = FitnessChatbot(use_llama=use_llama, ollama_url=ollama_url)
    return chatbot_instance


def answer_fitness_question(question: str, use_llama: bool = False, ollama_url: str = "http://localhost:11434") -> str:
    bot = get_chatbot(use_llama=use_llama, ollama_url=ollama_url)
    return bot.answer_question(question)
