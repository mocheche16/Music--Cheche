"""
schemas.py — Schemas Pydantic para validación de request/response en FastAPI
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


# ──────────────────────────────────────────────────────────────────────────────
# Stems
# ──────────────────────────────────────────────────────────────────────────────

class StemsResponse(BaseModel):
    """URLs de acceso a los 6 stems vía el endpoint /stems/."""
    vocals: Optional[str] = None
    drums:  Optional[str] = None
    bass:   Optional[str] = None
    guitar: Optional[str] = None
    piano:  Optional[str] = None
    other:  Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Song
# ──────────────────────────────────────────────────────────────────────────────

class SongBase(BaseModel):
    original_name: str


class SongCreate(SongBase):
    original_path: str


class SongListItem(BaseModel):
    """Versión compacta de una canción para el catálogo/tabla."""
    model_config = ConfigDict(from_attributes=True)

    id:            int
    original_name: str
    bpm:           Optional[float] = None
    key:           Optional[str]   = None
    status:        str
    created_at:    datetime


class SongResponse(BaseModel):
    """Respuesta completa con metadatos + URLs de los 6 stems."""
    model_config = ConfigDict(from_attributes=True)

    id:            int
    original_name: str
    bpm:           Optional[float] = None
    key:           Optional[str]   = None
    status:        str
    error_msg:     Optional[str]   = None
    created_at:    datetime
    updated_at:    datetime
    stems:         Optional[StemsResponse] = None


class SongStatusResponse(BaseModel):
    """Respuesta rápida para polling de estado."""
    id:       int
    status:   str
    error_msg: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Upload
# ──────────────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """Respuesta inmediata al hacer POST /upload."""
    song_id: int
    message: str
    status:  str
