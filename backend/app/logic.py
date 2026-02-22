import os
import re
from typing import Dict, List, Optional
from pathlib import Path
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors

# ================= FILE PATHS =================
BASE_DIR = os.path.dirname(__file__)
FOOD_DATASET_PATH = os.path.join(BASE_DIR, "Indian_Food_Nutrition_Processed.csv")
EXERCISE_DATASET_PATH = os.path.join(BASE_DIR, "exercises.csv")
DISEASE_DATASET_PATH = os.path.join(BASE_DIR, "real_disease_food_nutrition_dataset.csv")
DIET_REC_DATASET_PATH = os.path.join(BASE_DIR, "diet_recommendations_dataset.csv")
CSV_PATH = Path(__file__).resolve().parent / "Indian_Food_Nutrition_Processed.csv"
NUTRITION_DATASET_PATH = os.path.join(BASE_DIR, "real_disease_food_nutrition_dataset.csv")

# =========================================================
# ================= FOOD DATA =============================
# =========================================================
try:
    df_food = pd.read_csv(FOOD_DATASET_PATH)
    df_food = df_food.rename(columns={
        "dish name": "food",
        "calories (kcal)": "calories",
        "protein (g)": "protein",
        "carbohydrates (g)": "carbs",
        "fats (g)": "fat"
    })
except Exception:
    df_food = pd.DataFrame({
        "food": ["idli", "dosa", "chapati", "rice", "dal"],
        "calories": [130, 168, 120, 130, 116],
        "protein": [5, 4, 4, 2, 9],
        "carbs": [28, 25, 20, 28, 20],
        "fat": [1, 6, 2, 0, 1]
    })

df_food.columns = df_food.columns.str.strip().str.lower()
for col in ["food", "calories", "protein", "carbs", "fat"]:
    if col not in df_food.columns:
        df_food[col] = 0

df_food.fillna(0, inplace=True)  # type: ignore
df_food["food"] = df_food["food"].astype(str)

def load_foods(path: Path) -> pd.DataFrame:
    """Load and merge multiple nutrition datasets for comprehensive food recommendations."""
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")
    
    # Load primary Indian Food dataset
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    rename_map = {}
    if "dish name" in df.columns:
        rename_map["dish name"] = "food"
    if "calories (kcal)" in df.columns:
        rename_map["calories (kcal)"] = "calories"
    if "protein (g)" in df.columns:
        rename_map["protein (g)"] = "protein"
    if "carbohydrates (g)" in df.columns:
        rename_map["carbohydrates (g)"] = "carbs"
    if "fats (g)" in df.columns:
        rename_map["fats (g)"] = "fat"
    df = df.rename(columns=rename_map)
    
    # Ensure required columns
    if "food" not in df.columns:
        raise ValueError("Required column 'food' not found in CSV")
    if "calories" not in df.columns:
        for col in ["cal", "kcal"]:
            if col in df.columns:
                df = df.rename(columns={col: "calories"})
                break
    
    df["food"] = df["food"].astype(str).str.strip()
    df["calories"] = pd.to_numeric(df.get("calories", 0), errors="coerce").fillna(0)  # type: ignore
    df["protein"] = pd.to_numeric(df.get("protein", 0), errors="coerce").fillna(0)  # type: ignore
    df["carbs"] = pd.to_numeric(df.get("carbs", 0), errors="coerce").fillna(0)  # type: ignore
    df["fat"] = pd.to_numeric(df.get("fat", 0), errors="coerce").fillna(0)  # type: ignore
    
    # Load and merge disease nutrition dataset if available
    try:
        df_disease_nutrition = pd.read_csv(NUTRITION_DATASET_PATH)
        df_disease_nutrition.columns = [c.strip().lower() for c in df_disease_nutrition.columns]
        
        # Standardize disease dataset columns
        disease_rename = {}
        if "food item" in df_disease_nutrition.columns:
            disease_rename["food item"] = "food"
        if "calories" in df_disease_nutrition.columns:
            pass  # Already named correctly
        if "protein (g)" in df_disease_nutrition.columns:
            disease_rename["protein (g)"] = "protein"
        if "fat (g)" in df_disease_nutrition.columns:
            disease_rename["fat (g)"] = "fat"
        if "carbs (g)" in df_disease_nutrition.columns:
            disease_rename["carbs (g)"] = "carbs"
        
        df_disease_nutrition = df_disease_nutrition.rename(columns=disease_rename)
        
        # Clean food names
        df_disease_nutrition["food"] = df_disease_nutrition["food"].astype(str).str.strip()
        df_disease_nutrition["calories"] = pd.to_numeric(df_disease_nutrition.get("calories", 0), errors="coerce").fillna(0)  # type: ignore
        df_disease_nutrition["protein"] = pd.to_numeric(df_disease_nutrition.get("protein", 0), errors="coerce").fillna(0)  # type: ignore
        df_disease_nutrition["carbs"] = pd.to_numeric(df_disease_nutrition.get("carbs", 0), errors="coerce").fillna(0)  # type: ignore
        df_disease_nutrition["fat"] = pd.to_numeric(df_disease_nutrition.get("fat", 0), errors="coerce").fillna(0)  # type: ignore
        
        # Select only required columns for merging
        merge_cols = ["food", "calories", "protein", "carbs", "fat"]
        df_disease_nutrition = df_disease_nutrition[[col for col in merge_cols if col in df_disease_nutrition.columns]]
        
        # NOTE: We skip merging nutrition values from the disease dataset because they are often inaccurate
        # and poison the recommendation engine with fake high-protein foods.
        # We only use the Indian Food dataset for primary nutrition.
        print(f"✓ Primary nutrition dataset loaded: {len(df)} unique foods available")
    except Exception as e:
        print(f"⚠ Disease nutrition dataset error: {e}")
    
    return df

def find_similar_foods(df, user_foods):
    """Find foods in df that contain any of the user_foods keywords."""
    similar = []
    for uf in user_foods:
        uf_lower = uf.lower().strip()
        if uf_lower:
            mask = df["food"].str.lower().str.contains(uf_lower, na=False)
            similar.extend(df[mask]["food"].tolist())
    return list(set(similar))

def parse_meal_preferences(text: Optional[str]) -> List[str]:
    if not text:
        return []
    s = str(text).lower()
    for marker in ["breakfast", "lunch", "dinner", "snack", "snacks", "meal"]:
        s = s.replace(marker, " ")
    for sep in ["|", "/", ";", "&", "+"]:
        s = s.replace(sep, ",")
    tokens: List[str] = []
    for chunk in s.split(","):
        for raw in chunk.strip().split():
            t = raw.strip(" ,.;:-_()[]{}")
            if len(t) >= 3:
                tokens.append(t)
    seen = set()
    out: List[str] = []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out

def suggest_for_target(df: pd.DataFrame, meal_cal: float, topn: int = 10, user_foods: Optional[List[str]] = None, allergies: Optional[List[str]] = None, is_snack: bool = False, is_main_meal: bool = False, exclude_foods: Optional[List[str]] = None, bmi: Optional[float] = None, motive: Optional[str] = None, diet_type: Optional[str] = None, diseases: Optional[List[str]] = None, age: Optional[int] = None, gender: Optional[str] = None, boost_foods: Optional[List[str]] = None, penalty_foods: Optional[List[str]] = None):
    # compute serving size (grams) to meet meal_cal based on calories per 100g
    df2 = df.copy()
    # avoid zero calories: treat as unknown and use fallback density later
    df2["calories_per_100g"] = df2["calories"].astype(float)
    df2["score"] = 0.0 # Initialize score column

    # when calories_per_100g <=0, we'll set to fallback 200 kcal/100g
    df2["calories_per_100g"] = df2["calories_per_100g"].replace(0, pd.NA)
    fallback_density = 200.0

    if allergies:
        base = [a.lower().strip() for a in allergies]
        expanded = []
        for a in base:
            if a == "milk":
                expanded.extend(["milk","paneer","curd","yogurt","kheer","payasam","malai","cheese","butter","ghee","lassi"])
            elif a == "fish":
                expanded.extend(["fish","machli","seafood","prawn","shrimp","tuna","salmon"])
            elif a == "banana":
                expanded.extend(["banana","plantain"])
            elif a == "egg" or a == "eggs":
                expanded.extend(["egg","anda","omelette","omelet","scrambled","fried egg","boiled egg","poached"])
            elif a == "chicken":
                expanded.extend(["chicken","murgh"])
            elif a == "meat" or a == "mutton":
                expanded.extend(["meat","mutton","lamb","beef"])
            else:
                expanded.append(a)
        df2 = df2[~df2["food"].str.lower().apply(lambda f: any(a in f for a in expanded))]

    # Exclude already suggested foods
    if exclude_foods:
        exclude_lower = [f.lower() for f in exclude_foods]
        df2 = df2[~df2["food"].str.lower().isin(exclude_lower)]

    exclude_sweets = ["cake","pie","jam","pudding","sweet","murabba","pastry","tart","souffle","squash","crumb","upside down","cold","payasam","kheer","mousse","sorbet","cream","custard","jelly","snowball","ice cream","falooda","kulfi","rabri","halwa"]
    exclude_processed = ["sandwich","pasta","macaroni","noodles","burger","pizza","puffs","samosa"]
    exclude_beans = ["beans","bean","sem","phali","foogath","thoran","green beans","rajmah","rajma","lobia"]
    if is_main_meal or is_snack:
        df2 = df2[~df2["food"].str.lower().apply(lambda f: any(k in f for k in exclude_sweets))]
        df2 = df2[~df2["food"].str.lower().apply(lambda f: any(k in f for k in exclude_processed))]
        df2 = df2[~df2["food"].str.lower().apply(lambda f: any(k in f for k in exclude_beans))]

    # Prioritize user foods: filter to similar foods if found, else boost closest matches
    user_boost_applied = False
    if user_foods:
        similar_foods = find_similar_foods(df2, user_foods)
        # If motive is high protein, don't strictly filter if we don't have enough protein options
        is_high_protein_motive = motive and any(m in motive.lower() for m in ["gain", "loss", "muscle", "fat"])
        
        if similar_foods and not is_high_protein_motive:
            df2 = df2[df2["food"].isin(similar_foods)].copy()
            user_boost_applied = True
            df2["user_boost"] = 1  
        else:
            # For high protein motive, we use boosting instead of strict filtering
            user_foods_lower = [f.lower().strip() for f in user_foods if f.strip()]
            df2["user_boost"] = df2["food"].str.lower().apply(lambda f: max([1 if uf in f else 0 for uf in user_foods_lower]) if user_foods_lower else 0)
            user_boost_applied = True
    else:
        df2["user_boost"] = 0

    # Penalize non-meal items like chutneys, spices, powders for main meals
    non_meal_keywords = ["chutney", "spice", "powder", "blend", "masala", "sauce", "pickle", "jam", "jelly", "butter", "oil", "ghee", "murabba", "chutney"]
    def get_non_meal_penalty(name):
        name_lower = name.lower()
        if any(kw in name_lower for kw in non_meal_keywords):
            return 5000  # Large positive score is a penalty
        return 0
    df2["non_meal_penalty"] = df2["food"].apply(get_non_meal_penalty)

    # Additional boosts from disease consume list or KNN diet text extraction
    boost_lower = [b.lower() for b in (boost_foods or []) if b]
    penalty_lower = [p.lower() for p in (penalty_foods or []) if p]
    if boost_lower:
        df2["extra_boost"] = df2["food"].str.lower().apply(lambda f: 1 if any(b in f for b in boost_lower) else 0)
    else:
        df2["extra_boost"] = 0
    if penalty_lower:
        df2["extra_penalty"] = df2["food"].str.lower().apply(lambda f: 1 if any(p in f for p in penalty_lower) else 0)
    else:
        df2["extra_penalty"] = 0

    def compute_serving(cal_per_100):
        c = float(cal_per_100) if pd.notna(cal_per_100) else fallback_density
        serving = (meal_cal / c) * 100.0
        return serving

    df2["serving_g"] = df2["calories_per_100g"].apply(lambda c: compute_serving(c))

    # filter unrealistic serving sizes
    df2 = df2[(df2["serving_g"] >= 40) & (df2["serving_g"] <= 800)].copy() # Reduced max serving to 800g

    # Identify high protein foods (e.g., > 10g per 100g or specific keywords)
    df2["is_high_protein"] = df2["food"].str.lower().apply(lambda f: 1 if any(item in f for item in ["egg", "chicken", "fish", "mutton", "meat", "prawn", "shrimp", "paneer", "tofu", "soy", "dal", "lentil", "chana", "moong", "sprouts", "greek yogurt", "whey", "milk", "curd", "yogurt", "cheese", "besan", "gram flour", "rajma", "lobiya"]) else 0)
    df2["protein_per_100g"] = pd.to_numeric(df2.get("protein", pd.Series([0] * len(df2))), errors="coerce").fillna(0)
    df2["is_high_protein"] = ((df2["is_high_protein"] == 1) | (df2["protein_per_100g"] > 8.0)).astype(int) # Lowered threshold to 8g

    fruits = ["apple", "banana", "orange", "grape", "mango", "pineapple", "strawberry", "kiwi", "peach", "pear"]
    sweet_keywords = ["cake", "pie", "jam", "pudding", "sweet", "murabba", "pastry", "tart", "souffle", "squash", "crumb", "upside down", "cold", "sandwich", "payasam", "kheer", "mousse", "sorbet"]
    salad_keywords = ["salad", "raw", "fresh", "greens", "lettuce", "cucumber", "tomato", "carrot", "beetroot", "sprouts"]

    # Protein-to-calorie ratio boost
    df2["pro_cal_ratio"] = df2["protein_per_100g"] / (df2["calories_per_100g"] + 1)
    
    if is_main_meal:
        # Healthier scoring: STRONGLY prefer high protein, lower cal density, penalize fruits and sweets
        cal_density = df2["calories_per_100g"].fillna(fallback_density)
        protein = df2["protein_per_100g"]
        # Base health score
        df2["health_score"] = -cal_density * 0.05 - protein * 15.0  # MASSIVE protein multiplier
        # Additional boost for high-protein foods identified earlier
        df2["health_score"] -= df2["is_high_protein"] * 1000  # MASSIVE boost for protein sources
        # Boost for good protein/calorie ratio
        df2["health_score"] -= df2["pro_cal_ratio"] * 5000
        
        # Boost salads for balanced diet
        df2["salad_boost"] = df2["food"].str.lower().apply(lambda f: 1 if any(sal in f for sal in salad_keywords) else 0)
        df2["health_score"] -= df2["salad_boost"] * 200  
        
        df2["score"] = df2["health_score"] + (df2["serving_g"] - 250).abs() * 0.1 + df2["non_meal_penalty"]
        
        # If motive is muscle gain or weight loss, reduce user preference impact if the food is low protein
        if motive and any(m in motive.lower() for m in ["gain", "loss", "muscle", "fat"]):
            # Penalize low protein user preferences
            df2["user_pref_penalty"] = df2.apply(lambda r: 500 if (r["user_boost"] > 0 and r["protein_per_100g"] < 5) else 0, axis=1)
            df2["score"] += df2["user_pref_penalty"]
            
        df2["fruit_penalty"] = df2["food"].str.lower().apply(lambda f: 1 if any(fr in f.lower() for fr in fruits) else 0)
        df2["score"] += df2["fruit_penalty"] * 100
        df2["sweet_penalty"] = df2["food"].str.lower().apply(lambda f: 1 if any(sw in f.lower() for sw in sweet_keywords) else 0)
        df2["score"] += df2["sweet_penalty"] * 100
        # Apply disease-aware penalties (e.g., diabetes -> carb penalty stronger)
        if diseases:
            diseases_lower = [d.lower() for d in diseases]
            if any("diabetes" in d for d in diseases_lower):
                df2["score"] += df2.get("carbs", 0) * 0.5
    elif is_snack:
        # For snacks, boost staple snacks, fruits, and HIGH PROTEIN options
        snack_staples = ["sprouted moong","poha","upma","chana","idli","dosa"]
        df2["snack_boost"] = df2["food"].str.lower().apply(lambda f: 1 if any(st in f for st in snack_staples) else 0)
        df2["fruit_boost"] = df2["food"].str.lower().apply(lambda f: 1 if any(fr in f.lower() for fr in fruits) else 0)
        df2["salad_boost"] = df2["food"].str.lower().apply(lambda f: 1 if any(sal in f for sal in salad_keywords) else 0)
        # Boost protein snacks - MASSIVE BOOST
        protein = df2.get("protein", 0)
        df2["score"] = (df2["serving_g"] - 150).abs() * 0.01 + df2["non_meal_penalty"]
        df2["score"] -= df2["snack_boost"] * 100  
        df2["score"] -= df2["fruit_boost"] * 150  
        df2["score"] -= df2["salad_boost"] * 150   
        df2["score"] -= protein * 5.0  # Increased from 3.0
        df2["score"] -= df2["is_high_protein"] * 500  # Increased from 300
        df2["sweet_penalty"] = df2["food"].str.lower().apply(lambda f: 1 if any(sw in f.lower() for sw in sweet_keywords) else 0)
        df2["score"] += df2["sweet_penalty"] * 100
        if user_boost_applied:
            df2["score"] -= df2["user_boost"] * 1000  # stronger boost for closest matches
    else:
        # Default scoring: prefer servings near 220g, moderate calorie density, and HIGH PROTEIN
        protein = df2.get("protein", 0)
        df2["score"] = (df2["serving_g"] - 220).abs() + (df2["calories_per_100g"].fillna(fallback_density) - 200).abs() * 0.02 + df2["non_meal_penalty"]
        df2["score"] -= protein * 1.5  # Boost high protein foods
        if user_boost_applied:
            df2["score"] -= df2["user_boost"] * 1000  # stronger boost for closest matches

    # Apply generic boosts/penalties from consume/avoid and KNN text
    df2["score"] -= df2["extra_boost"] * 500
    df2["score"] += df2["extra_penalty"] * 500

    # Additional scoring based on user profile
    if motive:
        motive_lower = motive.lower()
        if "loss" in motive_lower or "lose" in motive_lower:
            df2["score"] -= df2["calories_per_100g"].fillna(fallback_density) * 0.05
        elif "gain" in motive_lower:
            df2["score"] += df2["calories_per_100g"].fillna(fallback_density) * 0.05

    if diseases:
        diseases_lower = [d.lower() for d in diseases]
        if any("diabetes" in d for d in diseases_lower):
            df2["score"] -= df2.get("carbs", 0) * 0.1
        if any("cholesterol" in d or "heart" in d for d in diseases_lower):
            df2["score"] -= df2.get("fat", 0) * 0.1

    if bmi and bmi > 25:
        df2["score"] -= df2["calories_per_100g"].fillna(fallback_density) * 0.03

    if age and age > 60:
        df2["score"] += df2.get("protein", 0) * 0.2 - df2.get("fat", 0) * 0.1

    if diet_type and diet_type.lower() == "vegetarian":
        df2["score"] += df2.get("protein", 0) * 0.1

    # Sort final results by score (lower is better) and protein content
    df2["protein_score"] = pd.to_numeric(df2.get("protein", pd.Series([0] * len(df2))), errors="coerce").astype(float) * -10.0 # Prioritize high protein in final sort
    df2 = df2.sort_values(by=["score", "protein_score", "serving_g"])

    if df2.empty:
        staples_main = ["idli","dosa","chapati","roti","rice","dal","sambar","curry","poha","upma","chicken","egg","paneer","fish","tofu","sprouts"]
        staples_snack = ["poha","sprouted moong","upma","chana","idli","dosa","eggs","nuts","yogurt"]
        target = staples_snack if is_snack else staples_main
        df_staples = df[df["food"].str.lower().apply(lambda f: any(st in f for st in target))].copy()
        df2 = df_staples if not df_staples.empty else df.copy()

    results = []
    for _, r in df2.head(topn).iterrows():
        cal100 = r.get("calories_per_100g")
        if pd.isna(cal100) or float(cal100) <= 0:
            cal100 = fallback_density
        
        # Recalculate serving but respect the max limit of 800g
        serving = round(float((meal_cal / cal100) * 100.0), 1)
        if serving > 800:
            serving = 800.0
            
        results.append({
            "food": r["food"],
            "calories_per_100g": round(float(cal100), 1),
            "serving_g": serving,
            "calories_serving": round(float(cal100) * serving / 100.0, 1),
            "protein_g": round(float(r.get("protein", 0)) * serving / 100.0, 1),
            "carbs_g": round(float(r.get("carbs", 0)) * serving / 100.0, 1),
            "fat_g": round(float(r.get("fat", 0)) * serving / 100.0, 1),
        })
    return results

# ================= DISEASE DATA =================
try:
    df_disease = pd.read_csv(DISEASE_DATASET_PATH)
    df_disease.columns = df_disease.columns.str.strip().str.lower()
    df_disease.fillna("", inplace=True)  # type: ignore
    df_disease["food item"] = df_disease["food item"].astype(str)
    df_disease["disease"] = df_disease["disease"].astype(str)
    df_disease["recommendation type"] = df_disease["recommendation type"].astype(str)
except Exception:
    df_disease = pd.DataFrame({
        "disease": ["diabetes"],
        "food item": ["carrots"],
        "recommendation type": ["consume"],
        "calories": [134],
        "protein (g)": [6.5],
        "fat (g)": [6.8],
        "carbs (g)": [14.3],
        "fiber (g)": [4.9],
        "vitamin c (mg)": [63.4],
        "calcium (mg)": [222.1]
    })
    df_disease = pd.DataFrame({
        "disease": ["diabetes"],
        "food item": ["carrots"],
        "recommendation type": ["consume"],
        "calories": [134],
        "protein (g)": [6.5],
        "fat (g)": [6.8],
        "carbs (g)": [14.3],
        "fiber (g)": [4.9],
        "vitamin c (mg)": [63.4],
        "calcium (mg)": [222.1]
    })

# ================= FOOD HELPERS =================
FOOD_ALTERNATIVES = {
    "dosa": ["ragi dosa", "oats dosa"],
    "rice": ["brown rice", "millets"],
    "chapati": ["multigrain chapati"]
}

def kcal_per_100g(food: str) -> float:
    row = df_food[df_food["food"].str.lower() == (food or "").lower()]
    return float(row.iloc[0]["calories"]) if not row.empty else 0.0

def healthy_alternatives(food: str) -> List[str]:
    return FOOD_ALTERNATIVES.get((food or "").lower(), [])

def get_disease_recommendations(diseases: List[str]) -> Dict[str, List[str]]:
    """Get consume and avoid lists for given diseases."""
    consume = []
    avoid = []
    for disease in diseases:
        disease_lower = disease.lower()
        # Find matching diseases (case-insensitive partial match)
        matching_rows = df_disease[df_disease["disease"].str.lower().str.contains(disease_lower, na=False)]
        for _, row in matching_rows.iterrows():
            food = row["food item"].strip()
            rec_type = row["recommendation type"].strip().lower()
            if rec_type == "consume" and food not in consume:
                consume.append(food)
            elif rec_type == "avoid" and food not in avoid:
                avoid.append(food)
    return {"consume": consume, "avoid": avoid}

# Load diet recommendation dataset and initialize KNN model
try:
    df_diet_rec = pd.read_csv(DIET_REC_DATASET_PATH)
    df_diet_rec.columns = df_diet_rec.columns.str.strip().str.lower()
    df_diet_rec.fillna("", inplace=True)

    # Prepare features for KNN
    feature_cols = ["age", "weight_kg", "height_cm", "bmi", "gender", "activity_level", "goal", "diet_type", "health_conditions"]
    df_diet_rec_features = df_diet_rec[feature_cols].copy()

    # Encode categorical columns
    encoders = {}
    for col in ["gender", "activity_level", "goal", "diet_type", "health_conditions"]:
        if col in df_diet_rec_features.columns:
            from sklearn.preprocessing import LabelEncoder
            encoder = LabelEncoder()
            df_diet_rec_features[col] = encoder.fit_transform(df_diet_rec_features[col].astype(str).fillna('').astype(str))
            encoders[col] = encoder

    # Scale features
    diet_rec_scaler = StandardScaler()
    scaled_features = diet_rec_scaler.fit_transform(df_diet_rec_features)

    # Fit KNN
    diet_rec_knn = NearestNeighbors(n_neighbors=5)
    diet_rec_knn.fit(scaled_features)

except Exception:
    df_diet_rec = pd.DataFrame()
    diet_rec_scaler = None
    diet_rec_knn = None
    encoders = {}

def get_diet_recommendation_text(user_data: Optional[Dict]) -> str:
    """Get diet recommendation text based on closest match in dataset using KNN."""
    if not user_data or df_diet_rec.empty or diet_rec_scaler is None or diet_rec_knn is None:
        return ""

    # Prepare user features
    age = user_data.get("age", 30)
    weight_kg = user_data.get("weight_kg", 70)
    height_cm = user_data.get("height_cm", 170)
    bmi = compute_bmi(height_cm, weight_kg)
    gender = user_data.get("gender", "male")
    activity_level = user_data.get("lifestyle_level", user_data.get("lifestyle", "sedentary"))
    goal = user_data.get("motive", "fitness")
    diet_type = user_data.get("diet_type", "vegetarian")
    health_conditions = user_data.get("diseases", user_data.get("health_diseases", ""))

    # Encode categoricals (handle unseen labels)
    user_encoded = []
    for col in ["gender", "activity_level", "goal", "diet_type", "health_conditions"]:
        encoder = encoders.get(col)
        if encoder:
            try:
                encoded = encoder.transform([str(user_data.get(col, ""))])[0]
            except:
                # If unseen, use most frequent
                encoded = encoder.transform([encoder.classes_[0]])[0]  # type: ignore
            user_encoded.append(encoded)
        else:
            user_encoded.append(0)  # fallback

    user_features = [age, weight_kg, height_cm, bmi] + user_encoded
    user_scaled = diet_rec_scaler.transform([user_features])

    # Find nearest neighbor
    distances, indices = diet_rec_knn.kneighbors(user_scaled)
    nearest_idx = indices[0][0]
    recommendation = df_diet_rec.iloc[nearest_idx]["diet_recommendation"]
    return str(recommendation).strip()

def _extract_foods_from_text(text: Optional[str], df: pd.DataFrame) -> List[str]:
    if not text:
        return []
    t = text.lower()
    foods = []
    try:
        for name in df["food"].astype(str).str.lower().unique():
            if name and name in t:
                foods.append(name)
    except Exception:
        pass
    return list(dict.fromkeys(foods))[:20]

def filter_foods_by_diseases(food_df: pd.DataFrame, diseases: List[str], diet_type: str) -> pd.DataFrame:
    """Filter foods based on diseases and diet type, using disease recommendations as boosts not hard filters."""
    filtered = food_df.copy()

    # Apply diet type filter: ONLY exclude non-veg foods for vegetarians
    if diet_type and diet_type.lower() == "vegetarian":
        # Exclude non-vegetarian foods for strict vegetarians
        filtered = filtered[~filtered["food"].str.contains("chicken|fish|egg|meat|mutton|prawn|shrimp", case=False)]
    # For non-vegetarian users, allow all foods including eggs, chicken, fish, meat for high protein intake

    if not diseases:
        return filtered.reset_index(drop=True)

    # Note: Disease recommendations are applied as BOOSTS in suggest_for_target, not as hard filters here
    # This allows user preferences to take priority over generic disease recommendations
    # The suggest_for_target function will penalize foods to avoid and boost foods to consume
    
    return filtered.reset_index(drop=True)

# =========================================================
# ================= BMI ==================================
# =========================================================
def compute_bmi(height_cm: float, weight_kg: float) -> float:
    h = height_cm / 100
    return round(weight_kg / (h * h), 2)

def bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "underweight"
    if bmi < 25:
        return "healthy"
    if bmi < 30:
        return "overweight"
    return "obese"

# =========================================================
# ================= ML DIET MODEL =========================
# =========================================================
NUTRIENTS = ["calories", "protein", "carbs", "fat"]
scaler = StandardScaler()
scaled_foods = scaler.fit_transform(df_food[NUTRIENTS])
knn = NearestNeighbors(n_neighbors=10)
knn.fit(scaled_foods)

def target_nutrition(bmi: float, motive: str):
    motive = motive.lower()
    if "loss" in motive:
        return [350, 25, 35, 8] # Increased protein from 18 to 25, lowered carbs
    if "gain" in motive:
        return [550, 35, 60, 15] # Increased protein from 25 to 35
    return [450, 30, 50, 12] # Increased protein from 22 to 30


def daily_calorie_target(weight_kg: float, height_cm: float, lifestyle: str = "sedentary", motive: str = "fitness", age: Optional[int] = None, gender: Optional[str] = None) -> float:
    """Estimate daily calorie target using Harris-Benedict formula with activity multipliers and motive adjustment.

    - Uses Harris-Benedict formula for BMR when age and gender available
    - Falls back to simple weight-based maintenance (weight_kg * 24)
    - Applies activity multiplier from lifestyle
    - Applies motive adjustment: lose -> -500, gain -> +300
    """
    try:
        # Harris-Benedict formula for BMR
        if age and gender:
            age_val = float(age)
            gender_str = str(gender).lower()
            if gender_str in ["male", "m"]:
                bmr = 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age_val)
            else:  # female or any other
                bmr = 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age_val)
            maintenance = max(bmr, weight_kg * 20)  # ensure reasonable floor
        else:
            # Fallback to simple weight-based maintenance
            maintenance = float(weight_kg) * 24.0
    except Exception:
        maintenance = 1700.0

    lvl = (lifestyle or "").lower()
    if lvl in ["sedentary", "low"]:
        multiplier = 1.2
    elif lvl in ["lightly active", "moderate", "active"]:
        multiplier = 1.45
    elif lvl in ["very active", "highly active"]:
        multiplier = 1.6
    else:
        multiplier = 1.45  # default

    daily = maintenance * multiplier
    m = (motive or "").lower()
    if "loss" in m or "lose" in m or "fat" in m:
        daily -= 500
    elif "gain" in m or "build" in m or "muscle" in m:
        daily += 300

    # reasonable bounds
    if daily < 1200:
        daily = 1200
    if daily > 4000:
        daily = 4000
    return round(daily, 2)

def daily_protein_target(weight_kg: float, motive: str = "fitness", lifestyle: str = "sedentary", age: Optional[int] = None) -> float:
    """Calculate recommended daily protein intake in grams using evidence-based formula.
    
    Formula: Daily Protein (g) = Body Weight (kg) × Protein Factor
    
    Protein Factors:
    - Sedentary / Minimal activity: 0.8 g/kg
    - Light exercise (2–3 days/week): 1.0–1.2 g/kg
    - Moderate exercise (4–5 days/week): 1.2–1.5 g/kg
    - Heavy training / Athletes: 1.6–2.2 g/kg
    - Muscle gain: 1.6–2.0 g/kg
    - Fat loss: 1.8–2.2 g/kg
    """
    try:
        weight_val = float(weight_kg)
    except Exception:
        weight_val = 70.0
    
    m = (motive or "").lower()
    l = (lifestyle or "").lower()
    
    # Select protein factor based on goal first (takes priority), then lifestyle
    if "loss" in m or "lose" in m or "fat" in m:
        # Fat loss: 1.8–2.2 g/kg (use 2.0 as midpoint)
        protein_factor = 2.0
    elif "gain" in m or "build" in m or "muscle" in m:
        # Muscle gain: 1.6–2.0 g/kg (use 1.8 as midpoint)
        protein_factor = 1.8
    elif l in ["very active", "highly active"]:
        # Heavy training / Athletes: 1.6–2.2 g/kg (use 1.9 as midpoint)
        protein_factor = 1.9
    elif l in ["moderate", "active"]:
        # Moderate exercise (4–5 days/week): 1.2–1.5 g/kg (use 1.35 as midpoint)
        protein_factor = 1.35
    elif l in ["lightly active", "light"]:
        # Light exercise (2–3 days/week): 1.0–1.2 g/kg (use 1.1 as midpoint)
        protein_factor = 1.1
    else:
        # Sedentary / Minimal activity: 0.8 g/kg
        protein_factor = 0.8
    
    # Adjustment for older adults (60+): minimum 1.0 g/kg to prevent muscle loss
    if age and age >= 60:
        protein_factor = max(protein_factor, 1.0)
    
    daily_protein = weight_val * protein_factor
    
    # Reasonable bounds (50–200g for most people)
    if daily_protein < 50:
        daily_protein = 50
    if daily_protein > 200:
        daily_protein = 200
    
    return round(daily_protein, 1)

def filter_foods(diet_type: str, diseases: str):
    """Legacy function for backward compatibility. Use filter_foods_by_diseases for better disease handling."""
    diseases_list = [d.strip() for d in diseases.split(",") if d.strip()] if diseases else []
    return filter_foods_by_diseases(df_food, diseases_list, diet_type)

def ml_diet_recommendation(bmi: float, motive: str, diet_type: str, diseases: str, user_meals: Optional[Dict[str, str]] = None, daily_calories: Optional[float] = None, topn: int = 5):
    """
    Recommend foods for meals. Strategy:
    - Filter foods by diet_type and diseases using disease-specific recommendations
    - If user provided recent meals (breakfast/lunch/snacks/dinner), try to match them first
      (exact or token match) and use them when they pass filters.
    - Otherwise, compute a nutrient-based target and pick nearest healthy alternatives.
    - Personalize protein intake by prioritizing high-protein alternatives.
    """
    diseases_list = [d.strip() for d in diseases.split(",") if d.strip()] if diseases else []
    filtered = filter_foods_by_diseases(df_food, diseases_list, diet_type)
    if filtered.empty:
        return []

    meals = ["breakfast", "lunch", "snacks", "dinner"]
    diet = []
    alternatives = {}
    # compute per-meal calorie targets from daily_calories (fallback to target_nutrition*3)
    if daily_calories is None:
        # fallback: approximate daily from target_nutrition first element times 3
        daily_calories = (target_nutrition(bmi, motive)[0]) * 3

    meal_shares = {"breakfast": 0.25, "lunch": 0.35, "snacks": 0.15, "dinner": 0.25}
    meal_targets = {m: round(daily_calories * meal_shares.get(m, 0.25), 1) for m in meals}

    # helper to create output dict from a dataframe row
    def _row_to_item(row, meal_type, meal_target_cal):
        cal_per_100 = float(row.get("calories", 0) or 0)
        # If calories per 100g is missing/zero, use a reasonable fallback density (kcal per 100g)
        if cal_per_100 <= 0:
            # use an approximate average energy density (kcal per 100g) for cooked foods
            cal_per_100 = 200.0
        serving_g = round((meal_target_cal / cal_per_100) * 100.0, 1)
        return {
            "meal_type": meal_type,
            "food_name": str(row["food"]).title(),
            "calories": float(row.get("calories", 0) or 0),
            "protein_g": float(row.get("protein", 0) or 0),
            "carbs_g": float(row.get("carbs", 0) or 0),
            "fat_g": float(row.get("fat", 0) or 0),
            "meal_target_calories": meal_target_cal,
            "serving_g": serving_g
        }

    # build scaled matrix for filtered set
    try:
        scaled_filtered = scaler.transform(filtered[NUTRIENTS])
    except Exception:
        # fallback: use raw values if scaler fails
        scaled_filtered = filtered[NUTRIENTS].values

    # If user meals provided, try to match them first
    provided = user_meals or {}
    used_idx = set()

    for meal in meals:
        name = (provided.get(meal) or "").strip()
        chosen = None
        if name:
            name_l = name.lower()
            # exact / substring match in filtered
            mask = filtered[filtered["food"].str.lower().str.contains(name_l, na=False)]
            if not mask.empty:
                chosen = mask.iloc[0]
            else:
                # token match: any token in food name
                tokens = [t for t in name_l.split() if len(t) > 2]
                if tokens:
                    cand = filtered[filtered["food"].str.lower().apply(lambda f: any(t in f for t in tokens))]
                    if not cand.empty:
                        chosen = cand.iloc[0]

        if chosen is not None:
            diet.append(_row_to_item(chosen, meal, meal_targets.get(meal, 0)))
            # build alternatives list (include the chosen as first)
            alts = []
            # try to find other matches by substring/token
            mask = filtered[filtered["food"].str.lower().str.contains(name.lower(), na=False)]
            if not mask.empty:
                # Prioritize protein in matching alternatives too
                mask = mask.copy()
                mask["protein_val"] = pd.to_numeric(mask.get("protein", pd.Series([0] * len(mask))), errors="coerce").fillna(0)
                mask = mask.sort_values(by="protein_val", ascending=False)
                for _, r in mask.head(topn).iterrows():
                    cal100 = r.get("calories")
                    if pd.isna(cal100) or float(cal100) <= 0:
                        cal100 = 200.0
                    serving = round(float((meal_targets.get(meal, 0) / cal100) * 100.0), 1)
                    alts.append({
                        "food": r["food"],
                        "calories_per_100g": round(float(cal100), 1),
                        "serving_g": serving,
                        "calories_serving": round(float(cal100) * serving / 100.0, 1),
                    })
            alternatives[meal] = alts
            # try to note used index if possible
            try:
                if chosen.name is not None:
                    used_idx.add(int(str(chosen.name)))
            except Exception:
                pass
            continue

        # fallback: pick by nutrient target using nearest neighbors on filtered
        target = scaler.transform([target_nutrition(bmi, motive)])
        from sklearn.neighbors import NearestNeighbors
        nn = NearestNeighbors(n_neighbors=min(10, len(scaled_filtered)))
        nn.fit(scaled_filtered)
        dists, idxs = nn.kneighbors(target)
        pick = None
        for fid in idxs[0]:
            # map fid to filtered row
            try:
                row = filtered.iloc[int(fid)]
            except Exception:
                # if iloc fails because filtered is smaller, safeguard by index mod
                row = filtered.iloc[int(fid) % len(filtered)]
            # avoid duplicates across meals
            try:
                ridx = int(str(row.name)) if row.name is not None else None
            except Exception:
                ridx = None
            if ridx is not None and ridx in used_idx:
                continue
            pick = row
            if ridx is not None:
                used_idx.add(ridx)
            break

        if pick is not None:
            diet.append(_row_to_item(pick, meal, meal_targets.get(meal, 0)))
            # collect alternatives from the nearest neighbors list
            alts_rows = []
            for fid in idxs[0]:
                try:
                    row = filtered.iloc[int(fid)]
                except Exception:
                    row = filtered.iloc[int(fid) % len(filtered)]
                alts_rows.append(row)
            
            # Sort these nearest neighbors by protein content to provide better alternatives
            alts_df = pd.DataFrame(alts_rows)
            alts_df["protein_val"] = pd.to_numeric(alts_df.get("protein", pd.Series([0] * len(alts_df))), errors="coerce").fillna(0)
            alts_df = alts_df.sort_values(by="protein_val", ascending=False)

            alts = []
            for _, row in alts_df.head(topn).iterrows():
                cal100 = row.get("calories")
                if pd.isna(cal100) or float(cal100) <= 0:
                    cal100 = 200.0
                serving = round(float((meal_targets.get(meal, 0) / cal100) * 100.0), 1)
                alts.append({
                    "food": row["food"],
                    "calories_per_100g": round(float(cal100), 1),
                    "serving_g": serving,
                    "calories_serving": round(float(cal100) * serving / 100.0, 1),
                    "protein_g": round(float(row.get("protein", 0)) * serving / 100.0, 1)
                })
            alternatives[meal] = alts
        else:
            # final fallback: pick first available
            diet.append(_row_to_item(filtered.iloc[0], meal, meal_targets.get(meal, 0)))
            # fallback alternatives
            row = filtered.iloc[0]
            cal100 = row.get("calories")
            if pd.isna(cal100) or float(cal100) <= 0:
                cal100 = 200.0
            serving = round(float((meal_targets.get(meal, 0) / cal100) * 100.0), 1)
            alternatives[meal] = [{
                "food": row["food"],
                "calories_per_100g": round(float(cal100), 1),
                "serving_g": serving,
                "calories_serving": round(float(cal100) * serving / 100.0, 1),
            }]

    return diet, alternatives

# =========================================================
# ================= EXERCISES =============================
# =========================================================
try:
    df_ex = pd.read_csv(EXERCISE_DATASET_PATH)
except Exception:
    df_ex = pd.DataFrame({
        "exercise": ["pushup", "squat", "plank"],
        "duration_min": [10, 15, 5],
        "difficulty": ["beginner", "beginner", "intermediate"]
    })

df_ex.columns = df_ex.columns.str.strip().str.lower()

LEVEL_COLUMN = None
for col in ["level", "difficulty", "intensity"]:
    if col in df_ex.columns:
        LEVEL_COLUMN = col
        break

if LEVEL_COLUMN is None:
    df_ex["level"] = "beginner"
    LEVEL_COLUMN = "level"

df_ex[LEVEL_COLUMN] = df_ex[LEVEL_COLUMN].astype(str).str.lower()

def normalize_level(level: str) -> str:
    if level in ["sedentary", "beginner"]:
        return "beginner"
    if level in ["moderate", "active"]:
        return "intermediate"
    return "advanced"

def get_exercises(level: str, target_count: int = 12, target_area: Optional[str] = None) -> List[Dict]:
    """Return a limited, diverse set of exercises for the user's level.

    Strategy:
    - Filter exercises by normalized level.
    - Prefer bodyweight / no-equipment exercises when available.
    - Select one exercise per body part where possible to cover major areas.
    - Fill remaining slots with other filtered exercises (deterministic order).
    """
    lvl = normalize_level(level)
    filtered = df_ex[df_ex[LEVEL_COLUMN] == lvl].copy()
    if filtered.empty:
        filtered = df_ex.copy()

    # prefer bodyweight / minimal equipment where available
    equip_col = None
    for c in ["equipment", "equip", "type"]:
        if c in filtered.columns:
            equip_col = c
            break

    if equip_col is not None:
        bw_mask = filtered[equip_col].fillna("").str.lower().str.contains("body weight|bodyweight|none|no equipment")
        pref = filtered[bw_mask]
        source = pref if not pref.empty else filtered
    else:
        source = filtered

    # prioritize exercises matching a user-specified target area, but keep diversity
    ta = (target_area or "").strip().lower() if target_area is not None else ""

    # small synonyms map for common high-level targets -> specific muscle targets
    TARGET_SYNONYMS = {
        "upper body": ["chest", "back", "shoulders", "biceps", "triceps"],
        "lower body": ["quads", "hamstrings", "glutes", "calves", "quadriceps"],
        "legs": ["quads", "hamstrings", "glutes", "calves", "quadriceps"],
        "core": ["abs", "obliques", "lower back", "core"],
        "full body": ["full body", "cardio", "whole body"]
    }

    selections: List[Dict] = []
    used_names = set()

    # build a deterministic list of source records
    all_recs = source.sort_values(by=[c for c in ["name", "id"] if c in source.columns]).to_dict(orient="records")

    preferred = []
    if ta:
        synonyms = TARGET_SYNONYMS.get(ta, [ta])
        for rec in all_recs:
            fields = " ".join([str(rec.get(k, "")) for k in ("target", "bodypart", "name")]).lower()
            if any(s in fields for s in synonyms):
                preferred.append(rec)

    # Add a few preferred items first (up to 25% or at least 1)
    max_pref = max(1, int(target_count * 0.25)) if ta else 0
    if preferred and max_pref > 0:
        # deterministic: sort preferred by name/id if available
        preferred = sorted(preferred, key=lambda r: (r.get("name") or "", r.get("id") or ""))
        for rec in preferred:
            name = (rec.get("name") or "").strip().lower()
            if name in used_names:
                continue
            selections.append(rec)
            used_names.add(name)
            if len(selections) >= max_pref:
                break

    # If bodypart column exists, try to pick one exercise per body part
    if "bodypart" in source.columns:
        parts = list(source["bodypart"].dropna().unique())
        for part in parts:
            part_ex = source[source["bodypart"] == part]
            if part_ex.empty:
                continue
            # deterministic pick: first occurrence sorted by name
            part_ex = part_ex.sort_values(by=[c for c in ["name", "id"] if c in part_ex.columns])
            rec = part_ex.iloc[0].to_dict()
            name = (rec.get("name") or "").strip().lower()
            if name in used_names:
                continue
            selections.append(rec)
            used_names.add(name)
            if len(selections) >= target_count:
                break

    # Fill remaining slots from source (deterministic order)
    if len(selections) < target_count:
        all_recs = source.sort_values(by=[c for c in ["name", "id"] if c in source.columns]).to_dict(orient="records")
        for rec in all_recs:
            name = (rec.get("name") or "").strip().lower()
            if name in used_names:
                continue
            selections.append(rec)
            used_names.add(name)
            if len(selections) >= target_count:
                break

    # helper to extract ordered instruction steps and secondary muscles
    def _assemble(rec: Dict) -> Dict:
        def _slugify(text: str) -> str:
            s = (text or "").strip().lower()
            s = re.sub(r"[^a-z0-9\s-]", "", s)
            s = re.sub(r"\s+", "-", s).strip("-")
            return s

        # collect instruction columns like 'instructions/0', 'instructions/1', ...
        steps: List[str] = []
        for k, v in rec.items():
            if isinstance(k, str) and k.startswith("instructions") and pd.notna(v) and str(v).strip():
                steps.append(str(v).strip())

        # collect secondary muscles columns like 'secondarymuscles/0' ...
        secondary: List[str] = []
        for k, v in rec.items():
            if isinstance(k, str) and k.startswith("secondarymuscles") and pd.notna(v) and str(v).strip():
                secondary.append(str(v).strip())

        # build external link to workoutguru exercises
        name_val = rec.get("name") or rec.get("exercise") or ""
        link = ""
        if name_val:
            link = f"https://workoutguru.fit/exercises/{_slugify(name_val)}/"
        # infer repetitions/sets when not explicit
        reps = ""
        if isinstance(rec.get("repetitions"), str) and rec.get("repetitions") and rec.get("repetitions").strip():
            reps = rec.get("repetitions").strip()
        elif pd.notna(rec.get("reps")) and str(rec.get("reps")).strip():
            reps = str(rec.get("reps")).strip()
        else:
            name_l = (rec.get("name") or "").strip().lower()
            body_l = (rec.get("bodypart") or "").strip().lower()
            target_l = (rec.get("target") or "").strip().lower()

            # heuristic defaults by exercise type and user level
            if "plank" in name_l or "hold" in name_l or "isometric" in name_l:
                if lvl == "beginner":
                    reps = "3x30s"
                elif lvl == "intermediate":
                    reps = "3x45s"
                else:
                    reps = "4x60s"
            elif "cardio" in body_l or "cardio" in target_l or any(k in name_l for k in ["run", "jog", "jump", "burpee", "sprint", "step"]):
                reps = "3x30s"
            else:
                if lvl == "beginner":
                    reps = "3x10"
                elif lvl == "intermediate":
                    reps = "4x10"
                else:
                    reps = "4x12"

        return {
            "id": rec.get("id") or rec.get("exercise") or "",
            "name": name_val,
            "body_part": rec.get("bodypart") or rec.get("body_part") or "",
            "equipment": rec.get("equipment") or "",
            "target": rec.get("target") or "",
            "secondary_muscles": secondary,
            "link": link,
            "steps": steps,
            "repetitions": reps,
            "gif_url": rec.get("gifUrl") or rec.get("gif_url") or ""
        }

    # If still empty (edge case), return a small default set
    if not selections:
        fallback = df_ex.head(min(target_count, len(df_ex))).to_dict(orient="records")
        return [_assemble(r) for r in fallback]

    return [_assemble(r) for r in selections[:target_count]]

# =========================================================
# ================= YOGA ================================
# =========================================================
try:
    YOGA_CSV_PATH = os.path.join(os.path.dirname(__file__), "final_asan1_1.csv")
    df_yoga = pd.read_csv(YOGA_CSV_PATH)
except Exception:
    df_yoga = pd.DataFrame({
        "AID": [1, 2],
        "AName": ["Tadasana", "Vajrasana"],
        "Description": ["Mountain pose standing tall", "Kneeling pose aiding digestion"],
        "You tube Vdo link": ["https://www.youtube.com/watch?v=dummy1", "https://www.youtube.com/watch?v=dummy2"],
        "Level": ["Beginner", "Beginner"]
    })

df_yoga.columns = [c.strip() for c in df_yoga.columns]

def get_yoga(level: str, target_area: Optional[str] = None, target_count: int = 8) -> List[Dict]:
    lvl = normalize_level(level)
    lvl_mask = df_yoga[df_yoga.get("Level", pd.Series([""] * len(df_yoga))).astype(str).str.lower() == lvl]
    source = lvl_mask if not lvl_mask.empty else df_yoga

    ta = (target_area or "").strip().lower() if target_area is not None else ""

    TARGET_SYNONYMS = {
        "upper body": ["shoulder", "upper back", "chest", "arms"],
        "lower body": ["legs", "hamstring", "quadricep", "glute", "calves"],
        "legs": ["legs", "hamstring", "quadricep", "glute", "calves"],
        "core": ["core", "abs", "abdomen", "oblique"],
        "back": ["back", "spine", "lower back"],
        "hips": ["hip", "groin", "pelvic"],
        "neck": ["neck", "cervical"],
        "shoulders": ["shoulder", "deltoid"],
        "chest": ["chest", "thoracic"],
    }

    records = source.to_dict(orient="records")

    preferred: List[Dict] = []
    if ta:
        syns = TARGET_SYNONYMS.get(ta, [ta])
        for r in records:
            hay = " ".join([str(r.get(k, "")) for k in ["AName", "Description", "Benefits"]]).lower()
            if any(s in hay for s in syns):
                preferred.append(r)

    def _assemble(r: Dict) -> Dict:
        return {
            "name": r.get("AName", ""),
            "description": r.get("Description", ""),
            "youtube_url": r.get("You tube Vdo link", ""),
            "level": str(r.get("Level", "")).lower()
        }

    out: List[Dict] = []
    if preferred:
        for r in preferred[:target_count]:
            out.append(_assemble(r))
    if len(out) < target_count:
        # fill deterministically by name
        for r in sorted(records, key=lambda x: (x.get("AName") or "")):
            if len(out) >= target_count:
                break
            item = _assemble(r)
            # avoid duplicates by name
            if any(i["name"].lower() == item["name"].lower() for i in out):
                continue
            out.append(item)
    return out[:target_count]

# =========================================================
# ================= MAIN RECOMMENDER ======================
# =========================================================
def generate_recommendations(user_data: Dict) -> Dict:
    bmi = compute_bmi(
        user_data.get("height_cm", 170),
        user_data.get("weight_kg", 70)
    )

    # compute daily calorie target and pass per-meal targets into diet recommender
    weight_kg_val = user_data.get("weight_kg", 70)
    height_cm_val = user_data.get("height_cm", 170)
    lifestyle_val = user_data.get("lifestyle_level", user_data.get("lifestyle", "sedentary"))
    age_val = user_data.get("age", None)
    gender_val = user_data.get("gender", None)
    daily_cal = daily_calorie_target(weight_kg_val, height_cm_val, lifestyle_val, user_data.get("motive", "fitness"), age_val, gender_val)
    daily_protein_g = daily_protein_target(weight_kg_val, user_data.get("motive", "fitness"), lifestyle_val, age_val)

    # Load and filter foods
    df = load_foods(CSV_PATH)
    print(f"DEBUG: Loaded foods columns: {df.columns.tolist()}")
    print(f"DEBUG: Protein max: {df['protein'].max()}")
    diseases_list = [d.strip() for d in user_data.get("diseases", "").split(",") if d.strip()] if user_data.get("diseases") else []
    allergies_list = [a.strip() for a in user_data.get("allergies", "").split(",") if a.strip()] if user_data.get("allergies") else []
    diet_type = user_data.get("diet_type", "vegetarian")
    filtered_df = filter_foods_by_diseases(df, diseases_list, diet_type)

    # Build boosts from disease recommendations and KNN diet text
    disease_recs = get_disease_recommendations(diseases_list) if diseases_list else {"consume": [], "avoid": []}
    diet_text = get_diet_recommendation_text(user_data)
    text_foods = _extract_foods_from_text(diet_text, df)
    boost_foods = list(dict.fromkeys((disease_recs.get("consume", []) or []) + text_foods))
    penalty_foods = disease_recs.get("avoid", []) or []

    # Compute meal targets
    meal_shares = {"breakfast": 0.25, "lunch": 0.35, "snacks": 0.15, "dinner": 0.25}
    meal_targets = {m: round(daily_cal * meal_shares.get(m, 0.25), 1) for m in ["breakfast", "lunch", "snacks", "dinner"]}

    diet = []
    diet_alternatives = {}
    used_foods = []
    debug_info = []
    for meal, cal in meal_targets.items():
        # Parse user-entered preferences more robustly
        raw_pref = user_data.get(meal, "") or ""
        user_foods = parse_meal_preferences(raw_pref)
        # If nothing from parse, fallback to comma split
        if not user_foods and raw_pref:
            user_foods = [x.strip() for x in raw_pref.split(",") if x.strip()]
        debug_info.append(f"Meal {meal}: raw='{raw_pref}' → parsed={user_foods}")
        suggestions = suggest_for_target(
            filtered_df,
            cal,
            topn=15, # Increased from 10 to 15 to provide more alternatives
            user_foods=user_foods,
            allergies=allergies_list,
            is_snack=(meal=="snacks"),
            is_main_meal=(meal in ["breakfast","lunch","dinner"]),
            exclude_foods=used_foods,
            bmi=bmi,
            motive=user_data.get("motive"),
            diet_type=diet_type,
            diseases=diseases_list,
            age=user_data.get("age"),
            gender=user_data.get("gender"),
            boost_foods=boost_foods,
            penalty_foods=penalty_foods
        )
        if suggestions:
            # Main recommendation: first suggestion
            s = suggestions[0]
            used_foods.append(s["food"])
            
            # Store alternatives (everything except the main choice)
            diet_alternatives[meal] = suggestions[1:]
            
            # Build meal components with salads and portions
            food_name = s["food"].title()
            salad_component = ""
            rice_portion = ""
            pro_tip = ""
            
            # Add salad component if this is a main meal and doesn't already include salad
            if meal in ["breakfast", "lunch", "dinner"]:
                food_lower = s["food"].lower()
                if not any(sal in food_lower for sal in ["salad", "raw", "fresh", "greens"]):
                    # Suggest complementary salad
                    salad_suggestions = {
                        "breakfast": "Green Salad with Cucumber & Tomato (100g)",
                        "lunch": "Mixed Green Salad with Carrots & Beetroot (100g)",
                        "dinner": "Fresh Vegetable Salad with Greens (100g)"
                    }
                    salad_component = salad_suggestions.get(meal, "Green Salad (100g)")
            
            # Add rice/curry guidance if applicable
            if meal in ["lunch", "dinner"]:
                food_lower = s["food"].lower()
                if any(r in food_lower for r in ["rice", "curry", "dal"]):
                    rice_portion = "Pair with moderate rice (150g) + curry/dal for balanced carbs + protein"
                    pro_tip = "💡 Pro Tip: Pair with moderate rice (150g) + curry/dal for balanced carbs + protein"
                elif any(p in food_lower for p in ["chicken", "fish", "egg", "meat"]):
                    rice_portion = "Add moderate rice/curry to reach target calories"
                    pro_tip = f"💡 Pro Tip: Start with {food_name} (main dish), add fresh salad side and moderate rice/curry to reach target calories"
            
            diet.append({
                "meal_type": meal,
                "food_name": food_name,
                "salad_component": salad_component,
                "rice_portion": rice_portion,
                "pro_tip": pro_tip,
                "calories": s["calories_per_100g"],
                "protein_g": s["protein_g"],
                "carbs_g": s["carbs_g"],
                "fat_g": s["fat_g"],
                "meal_target_calories": cal,
                "serving_g": s["serving_g"]
            })
            # Alternatives: all suggestions
            diet_alternatives[meal] = suggestions
            # Add to used foods to avoid repetition
            used_foods.append(s["food"])

    # Generate 7 complete alternative daily meal plans with high diversity
    def build_meal_plan(plan_num: int) -> list:
        """Build a complete daily meal plan using alternative options"""
        plan = []
        used_in_plan = []
        for meal, cal in meal_targets.items():
            # Get suggestions, excluding foods already used
            raw_pref = user_data.get(meal, "") or ""
            user_foods = parse_meal_preferences(raw_pref)
            if not user_foods and raw_pref:
                user_foods = [x.strip() for x in raw_pref.split(",") if x.strip()]
            
            suggestions = suggest_for_target(
                filtered_df,
                cal,
                topn=50,  # Get more diverse options
                user_foods=user_foods,
                allergies=allergies_list,
                is_snack=(meal=="snacks"),
                is_main_meal=(meal in ["breakfast","lunch","dinner"]),
                exclude_foods=used_foods + used_in_plan,
                bmi=bmi,
                motive=user_data.get("motive"),
                diet_type=diet_type,
                diseases=diseases_list,
                age=user_data.get("age"),
                gender=user_data.get("gender"),
                boost_foods=boost_foods,
                penalty_foods=penalty_foods
            )
            
            # Pick the nth suggestion for this plan - ensure good spread through options
            idx = (plan_num - 1 + (hash(meal) % 5)) % len(suggestions) if suggestions else 0
            if suggestions and idx < len(suggestions):
                s = suggestions[idx]
                food_name = s["food"].title()
                salad_component = ""
                rice_portion = ""
                pro_tip = ""
                
                if meal in ["breakfast", "lunch", "dinner"]:
                    food_lower = s["food"].lower()
                    if not any(sal in food_lower for sal in ["salad", "raw", "fresh", "greens"]):
                        salad_suggestions = {
                            "breakfast": "Green Salad with Cucumber & Tomato (100g)",
                            "lunch": "Mixed Green Salad with Carrots & Beetroot (100g)",
                            "dinner": "Fresh Vegetable Salad with Greens (100g)"
                        }
                        salad_component = salad_suggestions.get(meal, "Green Salad (100g)")
                
                if meal in ["lunch", "dinner"]:
                    food_lower = s["food"].lower()
                    if any(r in food_lower for r in ["rice", "curry", "dal"]):
                        rice_portion = "Pair with moderate rice (150g) + curry/dal for balanced carbs + protein"
                        pro_tip = "💡 Pro Tip: Pair with moderate rice (150g) + curry/dal for balanced carbs + protein"
                    elif any(p in food_lower for p in ["chicken", "fish", "egg", "meat"]):
                        rice_portion = "Add moderate rice/curry to reach target calories"
                        pro_tip = f"💡 Pro Tip: Start with {food_name} (main dish), add fresh salad side and moderate rice/curry to reach target calories"
                
                plan.append({
                    "meal_type": meal,
                    "food_name": food_name,
                    "salad_component": salad_component,
                    "rice_portion": rice_portion,
                    "pro_tip": pro_tip,
                    "calories": s["calories_per_100g"],
                    "protein_g": s["protein_g"],
                    "carbs_g": s["carbs_g"],
                    "fat_g": s["fat_g"],
                    "meal_target_calories": cal,
                    "serving_g": s["serving_g"]
                })
                used_in_plan.append(s["food"])
        return plan
    
    # Generate 7 additional complete meal plans (8 total options)
    alternative_plans = [build_meal_plan(i) for i in range(1, 8)]

    level = user_data.get("level", "beginner")

    # Build test output for display
    test_output = "User Meal Preferences:\n"
    for d in debug_info:
        test_output += d + "\n"
    
    test_output += f"\nDiseases: {diseases_list}\nAllergies: {allergies_list}\nMotive: {user_data.get('motive')}\n"
    test_output += f"Daily Calories: {daily_cal}\nRequired Protein: {daily_protein_g:.1f}g\n\n"

    # Calculate daily totals for each plan
    def calc_plan_totals(plan: list) -> dict:
        # Include estimated proteins from salads (avg 3-4g per 100g)
        total_cal = sum(m["calories_serving"] if "calories_serving" in m else m["calories"] * m["serving_g"] / 100 for m in plan)
        total_protein = sum(m["protein_g"] for m in plan)
        total_carbs = sum(m["carbs_g"] for m in plan)
        total_fat = sum(m["fat_g"] for m in plan)
        
        # Add estimated protein from salads (100g salad ~ 3g protein)
        for m in plan:
            if m.get("salad_component"):
                total_protein += 3.0  # Estimate ~3g protein per 100g salad
            if m.get("rice_portion"):
                # Add estimated protein from rice/curry (150g cooked rice ~ 5g protein, 100g dal ~ 8g protein)
                if "dal" in m["rice_portion"].lower():
                    total_protein += 8.0
                elif "rice" in m["rice_portion"].lower():
                    total_protein += 5.0
                else:
                    total_protein += 6.5  # Average of both
        
        return {
            "daily_calories": round(total_cal, 1),
            "daily_protein_g": round(total_protein, 1),
            "daily_carbs_g": round(total_carbs, 1),
            "daily_fat_g": round(total_fat, 1),
            "protein_met": total_protein >= daily_protein_g * 0.95
        }
    
    main_plan_totals = calc_plan_totals(diet)
    alternative_plans_with_totals = [
        {
            "plan_meals": plan,
            **calc_plan_totals(plan)
        }
        for plan in alternative_plans
    ]

    return {
        "bmi": bmi,
        "bmi_category": bmi_category(bmi),
        "daily_calories": daily_cal,
        "daily_protein_g": daily_protein_g,
        "water_l": user_data.get("water_consumption_l", 2.5),
        "diet": diet,
        "diet_totals": main_plan_totals,
        "diet_alternatives": diet_alternatives,
        "alternative_meal_plans": alternative_plans_with_totals,
        "workouts": get_exercises(level, target_count=12, target_area=user_data.get("target_area", "")),
        "yoga": get_yoga(level, target_area=user_data.get("target_area", "")),
        "diet_recommendation_text": get_diet_recommendation_text(user_data),
        "test_output": test_output
    }

# =========================================================
# ================= ANSWER FROM DATASETS ==================
# =========================================================
def answer_from_datasets(message: Optional[str]) -> Dict[str, str]:
    """Answer questions based on available datasets (food nutrition, diseases, etc.)."""
    msg_lower = message.lower().strip() if message else ""

    # Check for food-related queries
    food_keywords = ["calories", "nutrition", "protein", "carbs", "fat", "kcal", "food", "eat", "meal"]
    if any(kw in msg_lower for kw in food_keywords):
        # Try to extract food name from message
        food_name = None
        for food in df_food["food"].str.lower().unique():
            if food in msg_lower:
                food_name = food
                break

        if food_name:
            row = df_food[df_food["food"].str.lower() == food_name]
            if not row.empty:
                r = row.iloc[0]
                cal = r.get("calories", 0)
                prot = r.get("protein", 0)
                carb = r.get("carbs", 0)
                fat = r.get("fat", 0)
                return {
                    "answer": f"{food_name.title()}: {cal} kcal, {prot}g protein, {carb}g carbs, {fat}g fat per 100g."
                }

    # Check for disease-related queries
    disease_keywords = ["diabetes", "cholesterol", "heart", "hypertension", "disease", "condition", "health"]
    if any(kw in msg_lower for kw in disease_keywords):
        diseases = [d for d in ["diabetes", "cholesterol", "heart"] if d in msg_lower]
        if diseases:
            recs = get_disease_recommendations(diseases)
            consume = recs.get("consume", [])
            avoid = recs.get("avoid", [])
            answer = f"For {', '.join(diseases)}: "
            if consume:
                answer += f"Recommended foods: {', '.join(consume)}. "
            if avoid:
                answer += f"Avoid: {', '.join(avoid)}."
            return {"answer": answer}

    # Check for exercise queries
    exercise_keywords = ["exercise", "workout", "fitness", "training", "gym"]
    if any(kw in msg_lower for kw in exercise_keywords):
        level = "beginner"  # default
        if "advanced" in msg_lower:
            level = "advanced"
        elif "intermediate" in msg_lower:
            level = "intermediate"

        exercises = get_exercises(level, target_count=3)
        if exercises:
            ex_list = [ex["name"] for ex in exercises[:3]]
            return {"answer": f"Recommended exercises for {level} level: {', '.join(ex_list)}."}

    # Check for yoga queries
    if "yoga" in msg_lower or "asan" in msg_lower:
        yoga = get_yoga("beginner", target_count=3)
        if yoga:
            y_list = [y["name"] for y in yoga[:3]]
            return {"answer": f"Recommended yoga poses: {', '.join(y_list)}."}

    # If no specific match, return None (will fall back to simple_health_ai)
    return {}

# =========================================================
# ================= PDF PLACEHOLDER =======================
# =========================================================
def analyze_medical_pdf(file_path: str) -> dict:
    return {"message": "PDF analysis not implemented"}
