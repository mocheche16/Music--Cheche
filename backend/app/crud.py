"""
crud.py — Operaciones CRUD sobre la tabla songs
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import Song, ProcessingStatus
from app.schemas import SongCreate


# ──────────────────────────────────────────────────────────────────────────────
# CREATE
# ──────────────────────────────────────────────────────────────────────────────

def create_song(db: Session, data: SongCreate) -> Song:
    """Inserta un nuevo registro de canción con status=pending."""
    song = Song(
        original_name=data.original_name,
        original_path=data.original_path,
        status=ProcessingStatus.pending,
    )
    db.add(song)
    db.commit()
    db.refresh(song)
    return song


# ──────────────────────────────────────────────────────────────────────────────
# READ
# ──────────────────────────────────────────────────────────────────────────────

def get_song(db: Session, song_id: int) -> Optional[Song]:
    """Obtiene una canción por ID."""
    return db.query(Song).filter(Song.id == song_id).first()


def get_all_songs(db: Session, skip: int = 0, limit: int = 100) -> List[Song]:
    """Lista todas las canciones ordenadas por fecha de creación descendente."""
    return (
        db.query(Song)
        .order_by(Song.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_latest_done_song(db: Session) -> Optional[Song]:
    """Obtiene la canción más reciente con status=done (para ReaScript)."""
    return (
        db.query(Song)
        .filter(Song.status == ProcessingStatus.done)
        .order_by(Song.created_at.desc())
        .first()
    )


# ──────────────────────────────────────────────────────────────────────────────
# UPDATE — Estado del procesamiento
# ──────────────────────────────────────────────────────────────────────────────

def set_processing(db: Session, song_id: int) -> Optional[Song]:
    """Marca la canción como 'processing'."""
    song = get_song(db, song_id)
    if song:
        song.status = ProcessingStatus.processing
        song.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(song)
    return song


def set_done(
    db: Session,
    song_id: int,
    bpm: float,
    key: str,
    stems: dict,
) -> Optional[Song]:
    """
    Actualiza la canción con los resultados del procesamiento.

    Args:
        stems: dict con keys vocals, drums, bass, guitar, piano, other
               y valores con las rutas absolutas a los .wav
    """
    song = get_song(db, song_id)
    if song:
        song.status      = ProcessingStatus.done
        song.bpm         = round(bpm, 2)
        song.key         = key
        song.vocals_path = stems.get("vocals")
        song.drums_path  = stems.get("drums")
        song.bass_path   = stems.get("bass")
        song.guitar_path = stems.get("guitar")
        song.piano_path  = stems.get("piano")
        song.other_path  = stems.get("other")
        song.updated_at  = datetime.utcnow()
        db.commit()
        db.refresh(song)
    return song


def set_error(db: Session, song_id: int, error_msg: str) -> Optional[Song]:
    """Marca la canción con status=error y guarda el mensaje."""
    song = get_song(db, song_id)
    if song:
        song.status    = ProcessingStatus.error
        song.error_msg = error_msg[:990]   # Truncar para no exceder VARCHAR(1000)
        song.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(song)
    return song


def set_progress(db: Session, song_id: int, progress: int) -> Optional[Song]:
    """Actualiza el porcentaje de progreso de la canción."""
    song = get_song(db, song_id)
    if song:
        song.progress = progress
        db.commit()
        db.refresh(song)
    return song

# ──────────────────────────────────────────────────────────────────────────────
# DELETE
# ──────────────────────────────────────────────────────────────────────────────

def delete_song(db: Session, song_id: int) -> bool:
    """Elimina la canción de la base de datos."""
    song = get_song(db, song_id)
    if song:
        db.delete(song)
        db.commit()
        return True
    return False
