from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

# -------------------- USERS --------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("Profile", back_populates="user", uselist=False)
    progress = relationship("Progress", back_populates="user")
    reports = relationship("Report", back_populates="user")
    diet_recommendations = relationship("DietRecommendation", back_populates="user")
    workout_recommendations = relationship("WorkoutRecommendation", back_populates="user")


# -------------------- PROFILE --------------------

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(50), nullable=False)

    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)

    lifestyle_level = Column(String(30), nullable=False)
    diet_type = Column(String(50))
    water_consumption_l = Column(Float, default=0)

    # new: area user wants to target for workouts (e.g., upper body, legs, core)
    target_area = Column(String(100))

    junk_food_consumption = Column(String(20))
    healthy_food_consumption = Column(String(20))

    # Meal-wise fields
    breakfast = Column(Text)
    lunch = Column(Text)
    snacks = Column(Text)
    dinner = Column(Text)

    motive = Column(String(50))
    duration_weeks = Column(Integer)

    food_allergies = Column(Text)
    health_diseases = Column(Text)

    bmi = Column(Float)
    bmi_category = Column(String(50))

    user = relationship("User", back_populates="profile")


# -------------------- PROGRESS --------------------

class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    month = Column(String(20), nullable=False)
    weight_kg = Column(Float, nullable=False)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="progress")


# -------------------- REPORTS --------------------

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    filename = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False)
    summary = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reports")


# -------------------- WORKOUT & YOGA --------------------

class WorkoutRecommendation(Base):
    __tablename__ = "workout_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    title = Column(String(100), nullable=False)
    type = Column(String(20))  # workout / yoga
    level = Column(String(20))  # beginner / intermediate / advanced
    steps = Column(Text)  # step-by-step instructions
    image_url = Column(String(500))  # cartoon image
    video_url = Column(String(500))  # YouTube link

    user = relationship("User", back_populates="workout_recommendations")


# -------------------- DIET RECOMMENDATIONS --------------------

class DietRecommendation(Base):
    __tablename__ = "diet_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    morning = Column(Text)
    breakfast = Column(Text)
    lunch = Column(Text)
    snacks = Column(Text)
    dinner = Column(Text)
    evening = Column(Text)
    water_l = Column(Float, default=0)

    user = relationship("User", back_populates="diet_recommendations")
