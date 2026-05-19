import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, Integer, String
from sqlalchemy import text as sa_text

from app.database import Base


class ProcessingStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    error = "error"


class Song(Base):
    __tablename__ = "songs"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )
    original_name = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), index=True, nullable=True)

    bpm = Column(Float, nullable=True)
    key = Column(String(20), nullable=True)

    status = Column(
        SAEnum(ProcessingStatus),
        nullable=False,
        default=ProcessingStatus.pending,
    )
    error_msg = Column(String(1000), nullable=True)
    progress = Column(Integer, default=0, nullable=False)
    processing_time = Column(Integer, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=sa_text("NOW()"),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=sa_text("NOW()"),
        onupdate=datetime.utcnow,
    )

    vocals_path = Column(String(500), nullable=True)
    drums_path = Column(String(500), nullable=True)
    bass_path = Column(String(500), nullable=True)
    guitar_path = Column(String(500), nullable=True)
    piano_path = Column(String(500), nullable=True)
    other_path = Column(String(500), nullable=True)
    tempo_path = Column(String(500), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Song id={self.id} name='{self.original_name}'"
            f" status={self.status}>"
        )

    @property
    def stems_dict(self) -> dict:
        return {
            "vocals": self.vocals_path,
            "drums": self.drums_path,
            "bass": self.bass_path,
            "guitar": self.guitar_path,
            "piano": self.piano_path,
            "other": self.other_path,
            "tempo": self.tempo_path,
        }

    @property
    def all_stems_ready(self) -> bool:
        stems = self.stems_dict.copy()
        stems.pop("tempo", None)
        return all(stems.values())
