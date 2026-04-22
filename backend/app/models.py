"""
models.py — Modelos ORM para SQLAlchemy (tabla songs)
"""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum as SAEnum
)
from app.database import Base


class ProcessingStatus(str, enum.Enum):
    """Estados del pipeline de procesamiento de una canción."""
    pending    = "pending"      # Subida, en espera de procesamiento
    processing = "processing"   # Demucs/Librosa corriendo
    done       = "done"         # Completado con éxito
    error      = "error"        # Falló el procesamiento


class Song(Base):
    """
    Representa una canción procesada con sus metadatos y rutas de stems.
    """
    __tablename__ = "songs"

    # ── Identificación ─────────────────────────────────────────────────────────
    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    original_name = Column(String(255), nullable=False, comment="Nombre del archivo original")
    original_path = Column(String(500), nullable=False, comment="Ruta al archivo original subido")

    # ── Metadatos de Audio ─────────────────────────────────────────────────────
    bpm  = Column(Float,       nullable=True, comment="Tempo en BPM detectado por Librosa")
    key  = Column(String(20),  nullable=True, comment="Tonalidad estimada (ej. C# major)")

    # ── Estado y Timestamps ────────────────────────────────────────────────────
    status     = Column(
        SAEnum(ProcessingStatus),
        nullable=False,
        default=ProcessingStatus.pending,
        comment="Estado del pipeline de procesamiento"
    )
    error_msg  = Column(String(1000), nullable=True, comment="Mensaje de error si status=error")
    progress   = Column(Integer, default=0, nullable=False, comment="Porcentaje de progreso (0-100)")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # ── Rutas de los 6 Stems (htdemucs_6s) ────────────────────────────────────
    vocals_path = Column(String(500), nullable=True, comment="Ruta stem vocals.wav")
    drums_path  = Column(String(500), nullable=True, comment="Ruta stem drums.wav")
    bass_path   = Column(String(500), nullable=True, comment="Ruta stem bass.wav")
    guitar_path = Column(String(500), nullable=True, comment="Ruta stem guitar.wav")
    piano_path  = Column(String(500), nullable=True, comment="Ruta stem piano.wav")
    other_path  = Column(String(500), nullable=True, comment="Ruta stem other.wav")

    def __repr__(self) -> str:
        return f"<Song id={self.id} name='{self.original_name}' status={self.status}>"

    @property
    def stems_dict(self) -> dict:
        """Retorna un dict con los 6 stems y sus rutas."""
        return {
            "vocals": self.vocals_path,
            "drums":  self.drums_path,
            "bass":   self.bass_path,
            "guitar": self.guitar_path,
            "piano":  self.piano_path,
            "other":  self.other_path,
        }

    @property
    def all_stems_ready(self) -> bool:
        """True si todos los stems fueron generados."""
        return all(self.stems_dict.values())
