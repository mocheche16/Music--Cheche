import sys
import torchaudio
import torch

# ── MONKEY PATCH PARA EVITAR torchcodec EN WINDOWS ─────────────────────────────
# En entornos recientes de PyTorch (2.11.0+) o sin compilación completa en Windows,
# torchaudio fuerza el uso de torchcodec, el cual suele fallar por falta de DLLs
# (FFmpeg / Visual C++ Redist). Este parche fuerza a torchaudio a usar 'soundfile'.

def custom_load(
    uri,
    frame_offset=0,
    num_frames=-1,
    normalize=True,
    channels_first=True,
    format=None,
    buffer_size=4096,
    backend=None,
):
    import soundfile as sf
    import torch
    data, sr = sf.read(
        file=uri,
        start=frame_offset,
        frames=num_frames if num_frames > 0 else -1,
        always_2d=True
    )
    tensor = torch.from_numpy(data).float()
    if channels_first:
        tensor = tensor.t()
    return tensor, sr


def custom_save(
    uri,
    src,
    sample_rate,
    channels_first=True,
    format=None,
    encoding=None,
    bits_per_sample=None,
    buffer_size=4096,
    backend=None,
    compression=None,
):
    import soundfile as sf
    data = src
    if channels_first:
        data = data.t()
    sf.write(uri, data.numpy(), sample_rate)

# Sobrescribir las funciones base de torchaudio
torchaudio.load = custom_load
torchaudio.save = custom_save

# ── EJECUCIÓN DE DEMUCS ────────────────────────────────────────────────────────
from demucs.separate import main

if __name__ == "__main__":
    # Al llamar a main(), Demucs usará nuestro torchaudio parcheado.
    main()
