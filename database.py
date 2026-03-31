"""Database engine and session wiring for SQLAlchemy."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# ---------------------------
# SQLAlchemy Base + Config
# ---------------------------
# Base class used by all ORM models in models.py
Base = declarative_base()
load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback DB for local development if env is missing.
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./interview_bot.db"

# SQLAlchemy requires 'postgresql://' but many platforms (Render, Heroku) provide 'postgres://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Engine handles low-level DB connections.
# For SQLite, check_same_thread=False is needed. For Postgres, it is not.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

# ---------------------------
# Session Dependency
# ---------------------------
# SessionLocal is injected in routes using Depends(get_db).
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
def get_db():
    """Provide one DB session per request and close safely."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
