"""
routers/tracks.py — Endpoints REST de la API
"""
import os
import traceback
from pathlib import Path
from typing import List

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, HTTPException,
    UploadFile, status
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models import ProcessingStatus
from app.processing import run_full_pipeline
from app.schemas import (
    SongListItem, SongResponse, SongStatusResponse,
    SongCreate, StemsResponse, UploadResponse
)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "uploads")).resolve()
STEMS_DIR   = Path(os.getenv("STEMS_DIR",   "stems")).resolve()
ALLOWED_EXT = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
STEMS_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────────────────────────
# Background Task — Pipeline de procesamiento
# ──────────────────────────────────────────────────────────────────────────────

def _process_song_background(song_id: int, file_path: str):
    """
    Tarea en segundo plano: corre Librosa + Demucs y actualiza la DB.
    Se ejecuta en un hilo separado (FastAPI BackgroundTasks).
    """
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        crud.set_processing(db, song_id)
        print(f"\n{'='*60}")
        print(f"[Pipeline] Iniciando procesamiento — Song ID: {song_id}")
        print(f"{'='*60}")

        result = run_full_pipeline(
            song_id=song_id,
            file_path=file_path,
            stems_base_dir=str(STEMS_DIR),
        )

        crud.set_done(
            db=db,
            song_id=song_id,
            bpm=result["bpm"],
            key=result["key"],
            stems=result["stems"],
        )
        print(f"[Pipeline] ✅ Song {song_id} completada — BPM={result['bpm']:.1f}, Key={result['key']}")

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        print(f"[Pipeline] ❌ Error en Song {song_id}:\n{error_msg}")
        crud.set_error(db, song_id, str(exc))
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────────────────
# POST /upload
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Subir archivo de audio e iniciar procesamiento",
)
async def upload_song(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Acepta un archivo MP3/WAV, lo guarda en disco, crea el registro en DB
    con status=pending y lanza el pipeline de procesamiento en segundo plano.
    Retorna inmediatamente con el song_id para hacer polling de estado.
    """
    # Validar extensión
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no soportado: '{suffix}'. Usa: {ALLOWED_EXT}",
        )

    # Guardar archivo en disco
    safe_name = Path(file.filename).name
    dest_path = UPLOADS_DIR / safe_name

    # Evitar colisiones de nombre
    counter = 1
    while dest_path.exists():
        stem_part = Path(file.filename).stem
        dest_path = UPLOADS_DIR / f"{stem_part}_{counter}{suffix}"
        counter += 1

    content = await file.read()
    dest_path.write_bytes(content)
    print(f"[Upload] Guardado: {dest_path} ({len(content)/1024/1024:.1f} MB)")

    # Crear registro en DB
    song = crud.create_song(db, SongCreate(
        original_name=file.filename,
        original_path=str(dest_path),
    ))

    # Lanzar pipeline en background
    background_tasks.add_task(
        _process_song_background,
        song_id=song.id,
        file_path=str(dest_path),
    )

    return UploadResponse(
        song_id=song.id,
        message="Archivo recibido. Procesamiento iniciado en segundo plano.",
        status="pending",
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /tracks
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/tracks",
    response_model=List[SongListItem],
    summary="Listar el catálogo de canciones",
)
def list_tracks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Retorna todas las canciones del catálogo, ordenadas por fecha descendente."""
    return crud.get_all_songs(db, skip=skip, limit=limit)


# ──────────────────────────────────────────────────────────────────────────────
# GET /tracks/{id}
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/tracks/{song_id}",
    response_model=SongResponse,
    summary="Obtener detalle de una canción",
)
def get_track(song_id: int, db: Session = Depends(get_db)):
    """Retorna los metadatos completos + URLs de los 6 stems."""
    song = crud.get_song(db, song_id)
    if not song:
        raise HTTPException(status_code=404, detail=f"Canción {song_id} no encontrada.")

    # Construir URLs de stems (apuntan al endpoint /stems/)
    base = f"/stems/{song_id}"
    stems = None
    if song.status == ProcessingStatus.done:
        stems = StemsResponse(
            vocals=f"{base}/vocals" if song.vocals_path else None,
            drums =f"{base}/drums"  if song.drums_path  else None,
            bass  =f"{base}/bass"   if song.bass_path   else None,
            guitar=f"{base}/guitar" if song.guitar_path else None,
            piano =f"{base}/piano"  if song.piano_path  else None,
            other =f"{base}/other"  if song.other_path  else None,
        )

    return SongResponse(
        id=song.id,
        original_name=song.original_name,
        bpm=song.bpm,
        key=song.key,
        status=song.status,
        error_msg=song.error_msg,
        created_at=song.created_at,
        updated_at=song.updated_at,
        stems=stems,
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /tracks/{id}/status  (polling de estado)
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/tracks/{song_id}/status",
    response_model=SongStatusResponse,
    summary="Consultar el estado del procesamiento",
)
def get_track_status(song_id: int, db: Session = Depends(get_db)):
    """Endpoint ligero para hacer polling mientras Demucs procesa."""
    song = crud.get_song(db, song_id)
    if not song:
        raise HTTPException(status_code=404, detail=f"Canción {song_id} no encontrada.")
    return SongStatusResponse(id=song.id, status=song.status, error_msg=song.error_msg)


# ──────────────────────────────────────────────────────────────────────────────
# GET /stems/{song_id}/{stem_name}  (streaming de archivos WAV)
# ──────────────────────────────────────────────────────────────────────────────

STEM_FIELD_MAP = {
    "vocals": "vocals_path",
    "drums":  "drums_path",
    "bass":   "bass_path",
    "guitar": "guitar_path",
    "piano":  "piano_path",
    "other":  "other_path",
}

@router.get(
    "/stems/{song_id}/{stem_name}",
    summary="Servir un archivo WAV de stem para el reproductor web",
)
def serve_stem(song_id: int, stem_name: str, db: Session = Depends(get_db)):
    """
    Retorna el archivo WAV del stem solicitado para que el browser
    lo cargue via Web Audio API.
    """
    if stem_name not in STEM_FIELD_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Stem inválido: '{stem_name}'. Opciones: {list(STEM_FIELD_MAP.keys())}",
        )

    song = crud.get_song(db, song_id)
    if not song:
        raise HTTPException(status_code=404, detail=f"Canción {song_id} no encontrada.")
    if song.status != ProcessingStatus.done:
        raise HTTPException(
            status_code=409,
            detail=f"La canción no ha terminado de procesar. Estado: {song.status}",
        )

    field_name = STEM_FIELD_MAP[stem_name]
    file_path  = getattr(song, field_name)

    if not file_path or not Path(file_path).exists():
        raise HTTPException(
            status_code=404,
            detail=f"Archivo de stem '{stem_name}' no encontrado en disco.",
        )

    return FileResponse(
        path=file_path,
        media_type="audio/wav",
        filename=f"{song.original_name}_{stem_name}.wav",
        headers={"Accept-Ranges": "bytes"},
    )
