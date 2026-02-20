from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Optional
import pandas as pd
import os
from ..deps import get_current_user
import re

router = APIRouter()

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "exercises.csv")
df = pd.read_csv(CSV_PATH)
df.columns = [c.strip() for c in df.columns]

def _norm(s: str) -> str:
    return "".join(ch.lower() if ch.isalnum() or ch.isspace() else " " for ch in str(s)).strip()

def _extract_exercise_type(name: str) -> Dict[str, any]:
    """Extract exercise type and characteristics from name"""
    name_lower = name.lower()
    
    exercise_type = "strength"
    if any(keyword in name_lower for keyword in ['jump', 'run', 'jog', 'sprint', 'step', 'cardio']):
        exercise_type = "cardio"
    elif any(keyword in name_lower for keyword in ['stretch', 'mobility']):
        exercise_type = "flexibility"
    elif any(keyword in name_lower for keyword in ['plank', 'hold']):
        exercise_type = "isometric"
    
    # Primary muscle groups
    muscle_groups = []
    if any(keyword in name_lower for keyword in ['squat', 'lunge', 'leg']):
        muscle_groups.append('legs')
    if any(keyword in name_lower for keyword in ['push', 'press', 'chest']):
        muscle_groups.append('chest')
    if any(keyword in name_lower for keyword in ['pull', 'row', 'back']):
        muscle_groups.append('back')
    if any(keyword in name_lower for keyword in ['shoulder']):
        muscle_groups.append('shoulders')
    if any(keyword in name_lower for keyword in ['core', 'abs', 'sit']):
        muscle_groups.append('core')
    
    return {
        "type": exercise_type,
        "muscle_groups": muscle_groups,
        "equipment_needed": 'body weight' not in name_lower
    }

@router.get("/instructions")
def get_instructions(name: str = Query(...), user=Depends(get_current_user)) -> Dict[str, object]:
    n = _norm(name)
    m = df[df["name"].apply(lambda x: _norm(x) == n)]
    if m.empty:
        m = df[df["name"].apply(lambda x: n in _norm(x))]
    if m.empty:
        return {"name": name, "gifUrl": "", "instructions": []}
    r = m.iloc[0]
    instr_cols = [c for c in df.columns if c.startswith("instructions/")]
    instructions: List[str] = []
    for c in instr_cols:
        v = str(r.get(c) or "").strip()
        if v:
            instructions.append(v)
    
    # Add exercise metadata
    exercise_info = _extract_exercise_type(str(r.get("name") or name))
    
    return {
        "name": str(r.get("name") or name),
        "gifUrl": str(r.get("gifUrl") or ""),
        "instructions": instructions,
        "bodyPart": str(r.get("bodyPart") or ""),
        "equipment": str(r.get("equipment") or ""),
        "target": str(r.get("target") or ""),
        "secondaryMuscles": [str(r.get(col) or "") for col in df.columns if col.startswith("secondaryMuscles/") if str(r.get(col) or "")],
        "exercise_type": exercise_info["type"],
        "muscle_groups": exercise_info["muscle_groups"],
        "equipment_needed": exercise_info["equipment_needed"]
    }

@router.get("/search")
def search_exercises(q: str = Query(...), limit: int = Query(10), user=Depends(get_current_user)) -> Dict[str, List[Dict]]:
    """Search exercises by name, body part, or muscle group"""
    query = _norm(q)
    
    # Search in exercise names
    name_matches = df[df["name"].apply(lambda x: query in _norm(x))]
    
    # Search in body parts
    bodypart_matches = df[df["bodyPart"].apply(lambda x: query in _norm(str(x)))]
    
    # Search in target muscles
    target_matches = df[df["target"].apply(lambda x: query in _norm(str(x)))]
    
    # Combine and deduplicate
    all_matches = pd.concat([name_matches, bodypart_matches, target_matches]).drop_duplicates()
    
    results = []
    for _, row in all_matches.head(limit).iterrows():
        exercise_info = _extract_exercise_type(str(row.get("name")))
        results.append({
            "name": str(row.get("name")),
            "gifUrl": str(row.get("gifUrl", "")),
            "bodyPart": str(row.get("bodyPart", "")),
            "target": str(row.get("target", "")),
            "equipment": str(row.get("equipment", "")),
            "exercise_type": exercise_info["type"],
            "muscle_groups": exercise_info["muscle_groups"]
        })
    
    return {"exercises": results}

@router.get("/pose-hints/{exercise_name}")
def get_pose_hints(exercise_name: str, user=Depends(get_current_user)):
    """Get pose-specific hints and common mistakes for an exercise"""
    name_lower = exercise_name.lower()
    
    # Exercise-specific pose hints
    pose_hints = {
        "squat": {
            "key_points": [
                "Keep chest up and back straight",
                "Knees should track over toes",
                "Go to parallel or lower",
                "Drive through heels"
            ],
            "common_mistakes": [
                "Knees caving inward",
                "Leaning too far forward",
                "Not going deep enough",
                "Heels lifting off ground"
            ],
            "voice_cues": [
                "Chest up",
                "Sit back",
                "Knees out",
                "Drive up"
            ]
        },
        "push": {
            "key_points": [
                "Keep body in straight line",
                "Lower chest to ground",
                "Full range of motion",
                "Control the movement"
            ],
            "common_mistakes": [
                "Hips sagging or piking",
                "Not going low enough",
                "Flaring elbows",
                "Rushing the movement"
            ],
            "voice_cues": [
                "Straight line",
                "Lower down",
                "Push up",
                "Control"
            ]
        },
        "plank": {
            "key_points": [
                "Keep body straight",
                "Engage core",
                "Shoulders over wrists",
                "Neutral spine"
            ],
            "common_mistakes": [
                "Hips sagging",
                "Hips too high",
                "Head dropping",
                "Shoulders shrugging"
            ],
            "voice_cues": [
                "Engage core",
                "Straight line",
                "Hold steady",
                "Breathe"
            ]
        }
    }
    
    # Find matching exercise type
    hints = {"key_points": [], "common_mistakes": [], "voice_cues": []}
    for key, value in pose_hints.items():
        if key in name_lower:
            hints = value
            break
    
    return {
        "exercise_name": exercise_name,
        "pose_hints": hints,
        "difficulty": "beginner" if any(word in name_lower for word in ['basic', 'beginner']) else "intermediate"
    }
