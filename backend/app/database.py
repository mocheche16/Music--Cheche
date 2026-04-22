"""
database.py — Conexión a MySQL con SQLAlchemy
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

# ── Construir URL de conexión ──────────────────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
DB_NAME = os.getenv("DB_NAME", "music_hub")

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    "?charset=utf8mb4"
)

# ── Engine & Session ───────────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # Valida conexión antes de usar
    pool_recycle=3600,         # Recicla conexiones cada hora
    echo=False,                # True para ver SQL en consola (debug)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Base declarativa ───────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency Injection para FastAPI ─────────────────────────────────────────
def get_db():
    """Generador de sesión DB para usar con Depends() en FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Crea todas las tablas si no existen. Llamar al iniciar la app."""
    from app.models import Song  # noqa: F401 — importar para registrar el modelo
    Base.metadata.create_all(bind=engine)
