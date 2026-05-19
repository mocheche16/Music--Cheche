from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StemsResponse(BaseModel):
    vocals: str | None = None
    drums: str | None = None
    bass: str | None = None
    guitar: str | None = None
    piano: str | None = None
    other: str | None = None
    tempo: str | None = None


class SongBase(BaseModel):
    original_name: str


class SongCreate(BaseModel):
    original_name: str
    original_path: str
    file_hash: str | None = None


class SongListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_name: str
    bpm: float | None = None
    key: str | None = None
    status: str
    progress: int = 0
    processing_time: int | None = None
    created_at: datetime


class SongResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_name: str
    bpm: float | None = None
    key: str | None = None
    status: str
    progress: int = 0
    error_msg: str | None = None
    processing_time: int | None = None
    created_at: datetime
    updated_at: datetime
    stems: StemsResponse | None = None


class SongStatusResponse(BaseModel):
    id: int
    status: str
    progress: int = 0
    processing_time: int | None = None
    error_msg: str | None = None


class UploadResponse(BaseModel):
    song_id: int
    message: str
    status: str


class PaginatedResponse(BaseModel):
    items: list[SongListItem]
    total: int
    skip: int
    limit: int
