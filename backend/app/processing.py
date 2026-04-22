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

def separate_stems(file_path: str, output_dir: str, song_id: int) -> dict:
    """
    Ejecuta Demucs htdemucs_6s y retorna un dict con las 6 rutas de stems.

    Args:
        file_path:  Ruta al archivo de audio original.
        output_dir: Directorio base donde Demucs guardará los stems.
        song_id:    ID de la canción (usado para construir la ruta de salida).

    Returns:
        dict con keys: vocals, drums, bass, guitar, piano, other
        Cada valor es la ruta absoluta al archivo .wav correspondiente.

    Raises:
        RuntimeError: Si Demucs falla o no genera los archivos esperados.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"[Demucs] Iniciando separación con modelo {DEMUCS_MODEL}")
    print(f"[Demucs] Input:  {file_path}")
    print(f"[Demucs] Output: {output_path}")

    # ── Construir comando Demucs ───────────────────────────────────────────────
    cmd = [
        sys.executable, "-m", "app.run_demucs",
        "-n", DEMUCS_MODEL,
        "--shifts", "2",
        "--out", str(output_path),
        str(file_path),
    ]

    # Detectar si hay GPU disponible
    try:
        import torch
        if not torch.cuda.is_available():
            print("[Demucs] GPU no detectada — usando CPU (esto puede tardar varios minutos)")
            cmd.extend(["--device", "cpu"])
        else:
            gpu_name = torch.cuda.get_device_name(0)
            print(f"[Demucs] GPU detectada: {gpu_name}")
    except ImportError:
        print("[Demucs] PyTorch no disponible — usando CPU")
        cmd.extend(["--device", "cpu"])

    # ── Ejecutar Demucs ────────────────────────────────────────────────────────
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        error_detail = result.stderr[-2000:] if result.stderr else "Sin detalles"
        raise RuntimeError(
            f"Demucs falló con código {result.returncode}.\n"
            f"STDERR: {error_detail}"
        )

    print("[Demucs] Separación completada.")

    # ── Localizar los archivos generados ──────────────────────────────────────
    # Demucs genera: {output_dir}/{model}/{track_name}/{stem}.wav
    input_stem = Path(file_path).stem   # nombre del archivo sin extensión

    stems_dir = output_path / DEMUCS_MODEL / input_stem

    if not stems_dir.exists():
        # Intento alternativo: buscar en subdirectorios
        candidates = list(output_path.rglob(f"*{input_stem}*"))
        if candidates:
            stems_dir = candidates[0].parent
        else:
            raise RuntimeError(
                f"No se encontró el directorio de stems en {output_path}. "
                f"Verifica que Demucs se ejecutó correctamente."
            )

    expected_stems = ["vocals", "drums", "bass", "guitar", "piano", "other"]
    stems_paths: dict[str, str] = {}

    for stem_name in expected_stems:
        stem_file = stems_dir / f"{stem_name}.wav"
        if not stem_file.exists():
            raise RuntimeError(
                f"Stem faltante: {stem_file}. "
                f"Verifica que el modelo {DEMUCS_MODEL} está correctamente instalado."
            )
        stems_paths[stem_name] = str(stem_file.resolve())
        print(f"[Demucs] ✓ {stem_name}: {stem_file}")

    return stems_paths


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline completo (usado por el background task de FastAPI)
# ──────────────────────────────────────────────────────────────────────────────

def run_full_pipeline(
    song_id: int,
    file_path: str,
    stems_base_dir: str,
) -> dict:
    """
    Ejecuta analyze_audio + separate_stems y retorna todos los resultados.

    Returns:
        {
          "bpm": float,
          "key": str,
          "stems": { "vocals": path, "drums": path, ... }
        }
    """
    bpm, key = analyze_audio(file_path)
    stems = separate_stems(
        file_path=file_path,
        output_dir=stems_base_dir,
        song_id=song_id,
    )
    return {"bpm": bpm, "key": key, "stems": stems}
