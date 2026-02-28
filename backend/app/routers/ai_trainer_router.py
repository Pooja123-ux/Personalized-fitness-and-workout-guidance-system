from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import os
import shutil
from pathlib import Path
from ..ai_trainer import AITrainer

router = APIRouter(prefix="/ai-trainer", tags=["AI Trainer"])

# Initialize AI Trainer
EXERCISES_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exercises.csv")
trainer = AITrainer(EXERCISES_PATH)

@router.post("/analyze-gif")
async def analyze_gif(file: UploadFile = File(...)):
    """
    Analyze exercise from uploaded GIF
    - Detects exercise type from pose
    - Counts repetitions
    - Provides form feedback
    - Returns instructions from dataset
    """
    try:
        # Save uploaded file temporarily
        upload_dir = Path("temp_uploads")
        upload_dir.mkdir(exist_ok=True)
        
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process GIF
        result = trainer.process_gif(str(file_path))
        
        # Clean up
        os.remove(file_path)
        
        return JSONResponse(content={
            "success": True,
            "data": result
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/exercise-info/{exercise_name}")
async def get_exercise_info(exercise_name: str):
    """
    Get detailed exercise information from dataset
    - Instructions
    - Target muscles
    - Equipment needed
    - GIF URL
    """
    try:
        info = trainer.analyzer.get_exercise_info(exercise_name)
        
        if not info:
            raise HTTPException(status_code=404, detail="Exercise not found")
        
        return JSONResponse(content={
            "success": True,
            "data": info
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/exercises/search")
async def search_exercises(
    query: Optional[str] = None,
    body_part: Optional[str] = None,
    equipment: Optional[str] = None
):
    """
    Search exercises from dataset
    - Filter by body part
    - Filter by equipment
    - Search by name
    """
    try:
        df = trainer.analyzer.exercises_df
        
        if query:
            df = df[df['name'].str.contains(query, case=False, na=False)]
        
        if body_part:
            df = df[df['bodypart'].str.contains(body_part, case=False, na=False)]
        
        if equipment:
            df = df[df['equipment'].str.contains(equipment, case=False, na=False)]
        
        exercises = []
        for _, row in df.head(20).iterrows():
            exercises.append({
                "id": row.get('id', ''),
                "name": row.get('name', ''),
                "body_part": row.get('bodypart', ''),
                "equipment": row.get('equipment', ''),
                "target": row.get('target', ''),
                "gif_url": row.get('gifurl', '')
            })
        
        return JSONResponse(content={
            "success": True,
            "data": exercises,
            "count": len(exercises)
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/start-live-session")
async def start_live_session():
    """
    Start live video training session
    Note: This endpoint is for documentation only.
    Actual live session should be run from command line or desktop app.
    """
    return JSONResponse(content={
        "success": True,
        "message": "To start live session, run: python -m app.ai_trainer",
        "instructions": [
            "1. Ensure webcam is connected",
            "2. Run the AI trainer module",
            "3. Position yourself in frame",
            "4. Start exercising",
            "5. Press 'Q' to quit"
        ]
    })
