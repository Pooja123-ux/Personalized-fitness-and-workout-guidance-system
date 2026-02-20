import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator
from urllib.parse import quote_plus

load_dotenv()

DB_DRIVER = os.getenv("DB_DRIVER", "mysql").lower()
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD", ""))
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "fitness")

def _make_engine():
    if DB_DRIVER == "sqlite":
        os.makedirs("backend/storage", exist_ok=True)
        url = os.getenv("SQLITE_URL", "sqlite:///backend/storage/fitness.sqlite3")
        print("Using SQLite at", url)
        return create_engine(url, echo=True, connect_args={"check_same_thread": False})
    else:
        url = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        print("Using MySQL at", url)
        return create_engine(url, echo=True, pool_pre_ping=True)

engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db() -> Generator[Session, None, None]:
    global engine, SessionLocal
    try:
        db = SessionLocal()
    except Exception as e:
        # Fallback to SQLite if MySQL session creation fails
        print("Primary DB connection failed:", e)
        os.environ["DB_DRIVER"] = "sqlite"
        fallback_engine = create_engine(
            os.getenv("SQLITE_URL", "sqlite:///backend/storage/fitness.sqlite3"),
            echo=True,
            connect_args={"check_same_thread": False},
        )
        engine = fallback_engine
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=fallback_engine)
        db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
