"""
processing.py — Motor de análisis de audio y separación de stems

  analyze_audio()  → BPM + Key via Librosa
  separate_stems() → 6 WAV files via Demucs htdemucs_6s
"""
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Tuple

import librosa
import numpy as np

# ── Constantes ────────────────────────────────────────────────────────────────
DEMUCS_MODEL = "htdemucs_6s"

# Mapeo de número de clase de pitch (0-11) a nombre de nota
PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


# ──────────────────────────────────────────────────────────────────────────────
# Análisis de Audio con Librosa
# ──────────────────────────────────────────────────────────────────────────────

def _estimate_key(y: np.ndarray, sr: int) -> str:
    """
    Estima la tonalidad (Key) usando el perfil de Krumhansl-Schmuckler.
    Retorna strings como 'C major', 'A minor', 'F# major', etc.
    """
    # Chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)

    # Perfiles de tonalidad de Krumhansl-Schmuckler
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                               2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                               2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    # Correlación con cada tonalidad (12 mayores + 12 menores)
    best_corr  = -np.inf
    best_key   = "C major"

    for i in range(12):
        # Major
        corr_major = np.corrcoef(chroma_mean, np.roll(major_profile, i))[0, 1]
        if corr_major > best_corr:
            best_corr = corr_major
            best_key  = f"{PITCH_CLASSES[i]} major"

        # Minor
        corr_minor = np.corrcoef(chroma_mean, np.roll(minor_profile, i))[0, 1]
        if corr_minor > best_corr:
            best_corr = corr_minor
            best_key  = f"{PITCH_CLASSES[i]} minor"

    return best_key


def analyze_audio(file_path: str) -> Tuple[float, str]:
    """
    Analiza el archivo de audio y retorna (bpm, key).

    Args:
        file_path: Ruta absoluta al archivo MP3 o WAV.

    Returns:
        Tuple (bpm: float, key: str)
    """
    print(f"[Librosa] Cargando: {file_path}")

    # Cargar a mono, resamplear a 22050 Hz para análisis rápido
    y, sr = librosa.load(file_path, sr=22050, mono=True)

    # Detección de Tempo (BPM)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)

    # Estimación de Tonalidad
    key = _estimate_key(y, sr)

    print(f"[Librosa] BPM={bpm:.2f}  Key={key}")
    return bpm, key


# ──────────────────────────────────────────────────────────────────────────────
# Separación de Stems con Demucs
# ──────────────────────────────────────────────────────────────────────────────

def separate_stems(
    file_path: str,
    output_dir: str,
    song_id: int,
    progress_callback=None
) -> dict:
    """
    Ejecuta Demucs htdemucs_6s y retorna un dict con las 6 rutas de stems.
    Captura la salida en tiempo real para reportar el progreso.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"[Demucs] Iniciando separación de CALIDAD MÁXIMA (shifts=4)")
    print(f"[Demucs] Input:  {file_path}")

    # ── Construir comando Demucs ───────────────────────────────────────────────
    cmd = [
        sys.executable, "-m", "app.run_demucs",
        "-n", DEMUCS_MODEL,
        "--shifts", "4",
        "--out", str(output_path),
        str(file_path),
    ]

    # Detectar si hay GPU disponible
    try:
        import torch
        if not torch.cuda.is_available():
            cmd.extend(["--device", "cpu"])
        else:
            print(f"[Demucs] Usando GPU: {torch.cuda.get_device_name(0)}")
    except ImportError:
        cmd.extend(["--device", "cpu"])

    # ── Ejecutar Demucs con captura de progreso ───────────────────────────────
    # tqdm escribe en stderr por defecto. Redirigimos ambos a PIPE.
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        universal_newlines=True
    )

    # Regex para capturar el porcentaje: " 15%|"
    re_progress = re.compile(r"(\d+)%\|")
    
    # Lógica para progreso monotónico (evita que vuelva a 0 si hay varios shifts/ciclos)
    current_cycle = 0
    max_cycles = 4  # Coincide con --shifts 4
    last_percentage = 0

    while True:
        line = process.stdout.readline()
        if not line and process.poll() is not None:
            break
        
        if line:
            # Buscar porcentaje en la línea
            match = re_progress.search(line)
            if match and progress_callback:
                percentage = int(match.group(1))
                
                # Si el porcentaje baja de repente (ej: de 100 a 0), es un nuevo ciclo/shift
                if percentage < last_percentage and last_percentage > 90:
                    current_cycle = min(current_cycle + 1, max_cycles - 1)
                
                last_percentage = percentage
                
                # Calcular progreso global: cada ciclo es un 25% del total (si max_cycles=4)
                # El 5% inicial ya lo pusimos en run_full_pipeline, aquí mapeamos el 95% restante
                global_progress = 5 + int(((current_cycle * 100 + percentage) / (max_cycles * 100)) * 90)
                progress_callback(min(99, global_progress))
            
            # Print de depuración ocasional si no es la barra de progreso
            if "%|" not in line:
                print(f"[Demucs] {line.strip()}")

    if process.returncode != 0:
        raise RuntimeError(f"Demucs falló con código {process.returncode}.")

    # Al finalizar, forzar 100%
    if progress_callback:
        progress_callback(100)

    print("[Demucs] Separación completada.")

    # ── Localizar los archivos generados ──────────────────────────────────────
    input_stem = Path(file_path).stem
    stems_dir = output_path / DEMUCS_MODEL / input_stem

    if not stems_dir.exists():
        candidates = list(output_path.rglob(f"*{input_stem}*"))
        if candidates:
            stems_dir = candidates[0].parent
        else:
            raise RuntimeError(f"No se encontró el directorio de stems en {output_path}")

    expected_stems = ["vocals", "drums", "bass", "guitar", "piano", "other"]
    stems_paths: dict[str, str] = {}

    for stem_name in expected_stems:
        stem_file = stems_dir / f"{stem_name}.wav"
        if not stem_file.exists():
            raise RuntimeError(f"Stem faltante: {stem_file}")
        stems_paths[stem_name] = str(stem_file.resolve())

    return stems_paths


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline completo (usado por el background task de FastAPI)
# ──────────────────────────────────────────────────────────────────────────────

def run_full_pipeline(
    song_id: int,
    file_path: str,
    stems_base_dir: str,
    progress_callback=None
) -> dict:
    """
    Ejecuta analyze_audio + separate_stems y retorna todos los resultados.
    """
    bpm, key = analyze_audio(file_path)
    
    # Notificar inicio de Demucs (ej. 5%)
    if progress_callback:
        progress_callback(5)

    stems = separate_stems(
        file_path=file_path,
        output_dir=stems_base_dir,
        song_id=song_id,
        progress_callback=progress_callback
    )
    return {"bpm": bpm, "key": key, "stems": stems}
