import gc
import os
import subprocess
import sys
from pathlib import Path
from typing import Tuple

import librosa
import numpy as np
import soundfile as sf

DEMUCS_MODEL = "htdemucs_6s"
PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _estimate_key(y: np.ndarray, sr: int) -> str:
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)

    major_profile = np.array(
        [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    )
    minor_profile = np.array(
        [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    )

    best_corr = -np.inf
    best_key = "C major"

    for i in range(12):
        corr_major = np.corrcoef(chroma_mean, np.roll(major_profile, i))[0, 1]
        if corr_major > best_corr:
            best_corr = corr_major
            best_key = f"{PITCH_CLASSES[i]} major"

        corr_minor = np.corrcoef(chroma_mean, np.roll(minor_profile, i))[0, 1]
        if corr_minor > best_corr:
            best_corr = corr_minor
            best_key = f"{PITCH_CLASSES[i]} minor"

    return best_key


def analyze_audio(file_path: str) -> Tuple[float, str]:
    print(f"[Librosa] Cargando: {file_path}")
    y, sr = librosa.load(file_path, sr=22050, mono=True)

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)

    key = _estimate_key(y, sr)
    print(f"[Librosa] BPM={bpm:.2f}  Key={key}")
    return bpm, key


def separate_stems(
    file_path: str,
    output_dir: str,
    song_id: int,
    progress_callback=None,
) -> dict:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"[Demucs] Iniciando separación (shifts=4)")
    print(f"[Demucs] Input:  {file_path}")

    cmd = [
        sys.executable,
        "-m",
        "app.run_demucs",
        "-n",
        DEMUCS_MODEL,
        "--shifts",
        "4",
        "--overlap",
        "0.25",
        "--out",
        str(output_path),
        str(file_path),
    ]

    try:
        import torch

        if torch.cuda.is_available():
            cmd.extend(["--device", "cuda"])
            print(f"[Demucs] Usando GPU: {torch.cuda.get_device_name(0)}")
        else:
            print("[Demucs] GPU no detectada. Usando CPU.")
            cmd.extend(["--device", "cpu"])
            cores = os.cpu_count() or 1
            cmd.extend(["--jobs", str(max(1, cores - 1))])
    except ImportError:
        print("[Demucs] Torch no disponible. Usando CPU.")
        cmd.extend(["--device", "cpu"])

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    current_cycle = 0
    max_cycles = 4
    last_percentage = 0

    while True:
        line = process.stdout.readline()
        if not line and process.poll() is not None:
            break
        if not line:
            continue

        if "Separated" in line:
            print(f"[Demucs] {line.strip()}")

        if "%|" in line:
            try:
                parts = line.split("%|")[0].strip().split()
                if parts:
                    clean_pct = parts[-1]
                    if clean_pct.isdigit():
                        val = int(clean_pct)
                        if val < last_percentage - 10:
                            current_cycle += 1
                        last_percentage = val
                        global_progress = int(
                            (current_cycle * 100 + val) / max_cycles
                        )
                        global_progress = min(99, global_progress)
                        if progress_callback:
                            progress_callback(global_progress)
            except Exception:
                pass

    process.wait()

    print("[Demucs] Limpiando recursos...")
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    gc.collect()

    if process.returncode != 0:
        raise Exception(f"Demucs falló con código {process.returncode}")

    if progress_callback:
        progress_callback(100)

    print("[Demucs] Separación completada.")

    input_stem = Path(file_path).stem
    stems_dir = output_path / DEMUCS_MODEL / input_stem

    if not stems_dir.exists():
        candidates = list(output_path.rglob(f"*{input_stem}*"))
        if candidates:
            stems_dir = candidates[0].parent
        else:
            raise RuntimeError(
                f"No se encontró el directorio de stems en {output_path}"
            )

    expected_stems = ["vocals", "drums", "bass", "guitar", "piano", "other"]
    stems_paths: dict[str, str] = {}

    for stem_name in expected_stems:
        stem_file = stems_dir / f"{stem_name}.wav"
        if not stem_file.exists():
            raise RuntimeError(f"Stem faltante: {stem_file}")
        stems_paths[stem_name] = str(stem_file.resolve())

    return stems_paths


def create_metronome_stem(
    file_path: str,
    bpm: float,
    stems_base_dir: str,
    output_filename: str = "tempo.wav",
) -> str:
    print(f"[Metronomo] Generando metrónomo con BPM={bpm:.1f}")

    y, sr = librosa.load(file_path, sr=22050, mono=True)
    duration_seconds = len(y) / sr
    print(f"[Metronomo] Duracion: {duration_seconds:.2f}s")

    beat_duration = 60.0 / bpm
    metronome_audio = np.zeros(len(y), dtype=np.float32)

    click_sr = 22050
    click_duration = 0.05
    click_samples = int(click_duration * click_sr)

    t_click = np.linspace(0, click_duration, click_samples, dtype=np.float32)

    click_normal = np.sin(2 * np.pi * 1000 * t_click)
    click_downbeat = np.sin(2 * np.pi * 800 * t_click)

    fade_samples = click_samples // 4
    fade_in = np.linspace(0, 1, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1, 0, fade_samples, dtype=np.float32)

    click_normal[:fade_samples] *= fade_in
    click_normal[-fade_samples:] *= fade_out
    click_downbeat[:fade_samples] *= fade_in
    click_downbeat[-fade_samples:] *= fade_out

    click_normal *= 0.3
    click_downbeat *= 0.4

    beat_samples = int(beat_duration * click_sr)

    for beat_idx in range(int(duration_seconds / beat_duration) + 1):
        sample_pos = int(beat_idx * beat_samples)
        if sample_pos + click_samples >= len(metronome_audio):
            break
        click = click_downbeat if beat_idx % 4 == 0 else click_normal
        metronome_audio[sample_pos : sample_pos + click_samples] += click

    max_val = np.max(np.abs(metronome_audio))
    if max_val > 0:
        metronome_audio = metronome_audio / max_val * 0.95

    output_path = Path(stems_base_dir) / output_filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sf.write(str(output_path), metronome_audio, click_sr)
    print(f"[Metronomo] Guardado: {output_path}")
    return str(output_path.resolve())


def run_full_pipeline(
    song_id: int,
    file_path: str,
    stems_base_dir: str,
    progress_callback=None,
) -> dict:
    bpm, key = analyze_audio(file_path)

    if progress_callback:
        progress_callback(5)

    stems = separate_stems(
        file_path=file_path,
        output_dir=stems_base_dir,
        song_id=song_id,
        progress_callback=progress_callback,
    )

    try:
        stems_dir = Path(stems["vocals"]).parent
        metronome_path = create_metronome_stem(
            file_path=file_path,
            bpm=bpm,
            stems_base_dir=str(stems_dir),
            output_filename="tempo.wav",
        )
        stems["tempo"] = metronome_path
        print(f"[Pipeline] Metronomo agregado exitosamente")
    except Exception as e:
        print(f"[Pipeline] No se pudo crear metronomo: {e}")
        stems["tempo"] = None

    return {"bpm": bpm, "key": key, "stems": stems}
