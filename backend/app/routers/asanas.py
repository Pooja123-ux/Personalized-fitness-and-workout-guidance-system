from fastapi import APIRouter, Query
import pandas as pd
import os

router = APIRouter()

# Load the yoga asanas dataset
csv_path = os.path.join(os.path.dirname(__file__), 'final_asan1_1.csv')
df = pd.read_csv(csv_path)

@router.get("/")
async def get_asanas(
    level: str = Query(None, description="Filter by level (e.g., Beginner, Intermediate, Advanced)"),
    search: str = Query(None, description="Search by asana name")
):
    """
    Get yoga asanas, optionally filtered by level or searched by name.
    """
    filtered_df = df.copy()

    if level:
        filtered_df = filtered_df[filtered_df['Level'].str.lower() == level.lower()]

    if search:
        filtered_df = filtered_df[filtered_df['AName'].str.lower().str.contains(search.lower())]

    # Convert to list of dicts
    asanas = filtered_df.to_dict('records')

    return {"asanas": asanas, "count": len(asanas)}

@router.get("/{aid}")
async def get_asana_by_id(aid: int):
    """
    Get a specific asana by AID.
    """
    asana = df[df['AID'] == aid]
    if asana.empty:
        return {"error": "Asana not found"}

    return {"asana": asana.to_dict('records')[0]}
