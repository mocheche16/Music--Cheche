from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProcessingStatus, Song
from app.schemas import SongCreate


async def create_song(db: AsyncSession, data: SongCreate) -> Song:
    song = Song(
        original_name=data.original_name,
        original_path=data.original_path,
        file_hash=data.file_hash,
        status=ProcessingStatus.pending,
    )
    db.add(song)
    await db.commit()
    await db.refresh(song)
    return song


async def get_song(db: AsyncSession, song_id: int) -> Song | None:
    result = await db.execute(select(Song).where(Song.id == song_id))
    return result.scalar_one_or_none()


async def get_song_by_hash(
    db: AsyncSession, file_hash: str
) -> Song | None:
    result = await db.execute(
        select(Song)
        .where(Song.file_hash == file_hash)
        .where(Song.status == ProcessingStatus.done)
    )
    return result.scalar_one_or_none()


async def get_all_songs(
    db: AsyncSession, skip: int = 0, limit: int = 100
) -> tuple[list[Song], int]:
    count_result = await db.execute(func.count(Song.id))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Song)
        .order_by(Song.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    songs = list(result.scalars().all())
    return songs, total


async def get_latest_done_song(db: AsyncSession) -> Song | None:
    result = await db.execute(
        select(Song)
        .where(Song.status == ProcessingStatus.done)
        .order_by(Song.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def set_processing(
    db: AsyncSession, song_id: int
) -> Song | None:
    song = await get_song(db, song_id)
    if song:
        song.status = ProcessingStatus.processing
        song.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(song)
    return song


async def set_done(
    db: AsyncSession,
    song_id: int,
    bpm: float,
    key: str,
    stems: dict,
) -> Song | None:
    song = await get_song(db, song_id)
    if song:
        song.status = ProcessingStatus.done
        song.bpm = round(bpm, 2)
        song.key = key
        song.vocals_path = stems.get("vocals")
        song.drums_path = stems.get("drums")
        song.bass_path = stems.get("bass")
        song.guitar_path = stems.get("guitar")
        song.piano_path = stems.get("piano")
        song.other_path = stems.get("other")
        song.tempo_path = stems.get("tempo")
        song.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(song)
    return song


async def set_error(
    db: AsyncSession, song_id: int, error_msg: str
) -> Song | None:
    song = await get_song(db, song_id)
    if song:
        song.status = ProcessingStatus.error
        song.error_msg = error_msg[:990]
        song.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(song)
    return song


async def set_progress(
    db: AsyncSession, song_id: int, progress: int
) -> Song | None:
    song = await get_song(db, song_id)
    if song:
        song.progress = progress
        await db.commit()
    return song


async def set_processing_time(
    db: AsyncSession, song_id: int, seconds: int
) -> Song | None:
    song = await get_song(db, song_id)
    if song:
        song.processing_time = seconds
        await db.commit()
    return song


async def delete_song(db: AsyncSession, song_id: int) -> bool:
    song = await get_song(db, song_id)
    if song:
        await db.delete(song)
        await db.commit()
        return True
    return False
