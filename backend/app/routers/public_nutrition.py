"""
Public nutrition endpoints for testing without authentication
"""

from fastapi import APIRouter
from .nutrition import (
    get_daily_nutrition, 
    get_nutrition_summary, 
    get_weekly_nutrition,
    get_nutrition_targets,
    nutrition_data,
    calculate_macros_from_calories
)
from datetime import date

router = APIRouter()

@router.get("/daily/{target_date}")
async def get_public_daily_nutrition(target_date: date):
    """Public endpoint for daily nutrition (no auth required)"""
    # Create a mock user object
    class MockUser:
        id = "public_user"
    
    mock_user = MockUser()
    return await get_daily_nutrition(target_date, mock_user)

@router.get("/summary")
async def get_public_nutrition_summary():
    """Public endpoint for nutrition summary (no auth required)"""
    # Create a mock user object
    class MockUser:
        id = "public_user"
    
    mock_user = MockUser()
    return await get_nutrition_summary(mock_user)

@router.get("/weekly")
async def get_public_weekly_nutrition():
    """Public endpoint for weekly nutrition (no auth required)"""
    # Create a mock user object
    class MockUser:
        id = "public_user"
    
    mock_user = MockUser()
    return await get_weekly_nutrition(mock_user)

@router.get("/targets")
async def get_public_nutrition_targets():
    """Public endpoint for nutrition targets (no auth required)"""
    # Create a mock user object
    class MockUser:
        id = "public_user"
    
    mock_user = MockUser()
    return await get_nutrition_targets(mock_user)
