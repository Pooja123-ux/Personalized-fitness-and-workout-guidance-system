from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db
from ..schemas import UserCreate, Token, LoginRequest
from ..models import User
from ..auth_utils import hash_password, verify_password, create_token
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/signup", response_model=Token)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user account.
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        created_at=datetime.utcnow()
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create user")

    token = create_token(str(user.email))
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return access token.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Email not found")

    if not verify_password(payload.password, str(user.password_hash)):
        raise HTTPException(status_code=401, detail="Incorrect password")

    token = create_token(str(user.email))
    return {"access_token": token, "token_type": "bearer"}
