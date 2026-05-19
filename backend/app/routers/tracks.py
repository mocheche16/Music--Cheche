import hashlib
import io
import os
import time
import traceback
import zipfile
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.database import get_db
from app.exceptions import BadRequestError, NotFoundError
from app.models import ProcessingStatus
from app.processing import run_full_pipeline
from app.schemas import (
    PaginatedResponse,
    SongCreate,
    SongListItem,
    SongResponse,
    SongStatusResponse,
    StemsResponse,
    UploadResponse,
)

router = APIRouter()

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "uploads")).resolve()
STEMS_DIR = Path(os.getenv("STEMS_DIR", "stems")).resolve()
ALLOWED_EXT = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}
MAX_SIZE = 50 * 1024 * 1024

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
STEMS_DIR.mkdir(parents=True, exist_ok=True)

STEM_FIELD_MAP = {
    "vocals": "vocals_path",
    "drums": "drums_path",
    "bass": "bass_path",
    "guitar": "guitar_path",
    "piano": "piano_path",
    "other": "other_path",
}


def _process_song_background(song_id: int, file_path: str):
    from app.database import async_session as _session

    async def _run():
        async with _session() as db:
            try:
                await crud.set_processing(db, song_id)
                logger.info(f"[Pipeline] Iniciando procesamiento — Song ID: {song_id}")
                start_time = time.time()

                result = run_full_pipeline(
                    song_id=song_id,
                    file_path=file_path,
                    stems_base_dir=str(STEMS_DIR),
                    progress_callback=lambda p: None,
                )

                duration = int(time.time() - start_time)

                await crud.set_processing_time(db, song_id, duration)
                await crud.set_done(
                    db=db,
                    song_id=song_id,
                    bpm=result["bpm"],
                    key=result["key"],
                    stems=result["stems"],
                )
                logger.info(
                    f"[Pipeline] Song {song_id} completada — "
                    f"BPM={result['bpm']:.1f}, Key={result['key']}"
                )
            except Exception as exc:
                error_msg = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
                logger.error(f"[Pipeline] Error en Song {song_id}:\n{error_msg}")
                await crud.set_error(db, song_id, str(exc))

    import asyncio

    asyncio.run(_run())


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Subir archivo de audio e iniciar procesamiento",
)
async def upload_song(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXT:
        raise BadRequestError(
            f"Tipo de archivo no soportado: '{suffix}'. Usa: {ALLOWED_EXT}"
        )

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise BadRequestError("El archivo excede el límite de 50MB.")

    file_hash = hashlib.sha256(content).hexdigest()

    existing_song = await crud.get_song_by_hash(db, file_hash)
    if existing_song:
        logger.info(f"[Upload] Duplicado detectado (Hash: {file_hash[:10]}...)")
        return UploadResponse(
            song_id=existing_song.id,
            message="Este archivo ya fue procesado anteriormente.",
            status="done",
        )

    safe_name = Path(file.filename).name
    dest_path = UPLOADS_DIR / safe_name
    counter = 1
    while dest_path.exists():
        stem_part = Path(file.filename).stem
        dest_path = UPLOADS_DIR / f"{stem_part}_{counter}{suffix}"
        counter += 1

    import anyio
    await anyio.to_thread.run_sync(dest_path.write_bytes, content)

    logger.info(
        f"[Upload] Guardado: {dest_path} ({len(content) / 1024 / 1024:.1f} MB)"
    )

    song = await crud.create_song(
        db,
        SongCreate(
            original_name=file.filename,
            original_path=str(dest_path),
            file_hash=file_hash,
        ),
    )

    background_tasks.add_task(
        _process_song_background,
        song_id=song.id,
        file_path=str(dest_path),
    )

    return UploadResponse(
        song_id=song.id,
        message="Archivo recibido. Procesamiento iniciado.",
        status="pending",
    )


@router.get(
    "/tracks",
    response_model=PaginatedResponse,
    summary="Listar el catálogo de canciones",
)
async def list_tracks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    songs, total = await crud.get_all_songs(db, skip=skip, limit=limit)
    items = [SongListItem.model_validate(s) for s in songs]
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.delete(
    "/tracks/{song_id}",
    summary="Eliminar una canción y sus archivos físicos",
)
async def delete_track(
    song_id: int,
    db: AsyncSession = Depends(get_db),
):
    song = await crud.get_song(db, song_id)
    if not song:
        raise NotFoundError("Canción no encontrada")

    if song.original_path and Path(song.original_path).exists():
        try:
            Path(song.original_path).unlink()
        except Exception as e:
            logger.warning(f"[Delete] Error borrando original: {e}")

    for stem_path in song.stems_dict.values():
        if stem_path and Path(stem_path).exists():
            try:
                Path(stem_path).unlink()
            except Exception as e:
                logger.warning(f"[Delete] Error borrando stem: {e}")

    success = await crud.delete_song(db, song_id)
    if not success:
        raise BadRequestError("Error al eliminar registro de DB")

    return {"message": "Canción y archivos eliminados exitosamente"}


@router.get(
    "/tracks/{song_id}",
    response_model=SongResponse,
    summary="Obtener detalle de una canción",
)
async def get_track(
    song_id: int,
    db: AsyncSession = Depends(get_db),
):
    song = await crud.get_song(db, song_id)
    if not song:
        raise NotFoundError(f"Canción {song_id} no encontrada.")

    base = f"/stems/{song_id}"
    stems = None
    if song.status == ProcessingStatus.done:
        stems = StemsResponse(
            vocals=f"{base}/vocals" if song.vocals_path else None,
            drums=f"{base}/drums" if song.drums_path else None,
            bass=f"{base}/bass" if song.bass_path else None,
            guitar=f"{base}/guitar" if song.guitar_path else None,
            piano=f"{base}/piano" if song.piano_path else None,
            other=f"{base}/other" if song.other_path else None,
        )

    return SongResponse(
        id=song.id,
        original_name=song.original_name,
        bpm=song.bpm,
        key=song.key,
        status=song.status,
        error_msg=song.error_msg,
        progress=song.progress,
        processing_time=song.processing_time,
        created_at=song.created_at,
        updated_at=song.updated_at,
        stems=stems,
    )


@router.get(
    "/tracks/{song_id}/status",
    response_model=SongStatusResponse,
    summary="Consultar el estado del procesamiento",
)
async def get_track_status(
    song_id: int,
    db: AsyncSession = Depends(get_db),
):
    song = await crud.get_song(db, song_id)
    if not song:
        raise NotFoundError(f"Canción {song_id} no encontrada.")
    return SongStatusResponse(
        id=song.id,
        status=song.status,
        progress=song.progress,
        error_msg=song.error_msg,
    )


@router.get(
    "/stems/{song_id}/{stem_name}",
    summary="Servir un archivo WAV de stem",
)
async def serve_stem(
    song_id: int,
    stem_name: str,
    db: AsyncSession = Depends(get_db),
):
    if stem_name not in STEM_FIELD_MAP:
        raise BadRequestError(
            f"Stem inválido: '{stem_name}'. Opciones: {list(STEM_FIELD_MAP.keys())}"
        )

    song = await crud.get_song(db, song_id)
    if not song:
        raise NotFoundError(f"Canción {song_id} no encontrada.")
    if song.status != ProcessingStatus.done:
        raise BadRequestError(
            f"La canción no ha terminado de procesar. Estado: {song.status}"
        )

    field_name = STEM_FIELD_MAP[stem_name]
    file_path = getattr(song, field_name)

    if not file_path or not Path(file_path).exists():
        raise NotFoundError(f"Archivo de stem '{stem_name}' no encontrado en disco.")

    return FileResponse(
        path=file_path,
        media_type="audio/wav",
        filename=f"{song.original_name}_{stem_name}.wav",
        headers={"Accept-Ranges": "bytes"},
    )


@router.get(
    "/tracks/{song_id}/export-all",
    summary="Exportar todos los stems en un archivo ZIP (WAV o MP3)",
)
async def export_all_stems(
    song_id: int,
    format: str = "wav",
    db: AsyncSession = Depends(get_db),
):
    song = await crud.get_song(db, song_id)
    if not song or song.status != ProcessingStatus.done:
        raise NotFoundError("Canción no encontrada o no procesada")

    stem_labels = {
        "vocals": "Voces",
        "drums": "Bateria",
        "bass": "Bajo",
        "guitar": "Guitarra",
        "piano": "Piano",
        "other": "Otros",
    }

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for stem_key, label in stem_labels.items():
            path_str = getattr(song, f"{stem_key}_path", None)
            if not path_str:
                continue

            path = Path(path_str)
            if not path.exists():
                continue

            filename = f"{label}.{format}"

            if format.lower() == "mp3":
                try:
                    data, samplerate = sf.read(path)
                    mp3_io = io.BytesIO()
                    try:
                        sf.write(mp3_io, data, samplerate, format="MP3")
                        zip_file.writestr(filename, mp3_io.getvalue())
                    except Exception:
                        zip_file.write(path, arcname=f"{label}.wav")
                except Exception as e:
                    logger.warning(f"[Export] Error convirtiendo {stem_key}: {e}")
                    zip_file.write(path, arcname=f"{label}.wav")
            else:
                zip_file.write(path, arcname=filename)

    zip_buffer.seek(0)

    clean_name = "".join(
        c for c in song.original_name if c.isalnum() or c in (" ", "_", "-")
    ).strip()
    zip_filename = f"Stems_{clean_name}_{format.upper()}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )
