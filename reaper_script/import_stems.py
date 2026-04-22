"""
import_stems.py — ReaScript Python para REAPER
======================================================
Importa los 6 stems de una canción procesada directamente en REAPER:
  1. Consulta la base de datos MySQL (misma DB que el backend FastAPI)
  2. Ajusta el BPM del proyecto
  3. Crea 6 tracks nombradas e importa los WAV al inicio de la línea de tiempo
  4. Mutea cualquier track de referencia pre-existente

INSTALACIÓN:
  1. Copia este archivo a:
     %APPDATA%\REAPER\Scripts\import_stems.py
  2. En REAPER: Actions → Show action list → New action → Load ReaScript
  3. Selecciona este archivo y asígnale un atajo de teclado (ej. Ctrl+Shift+I)
  4. Edita la sección CONFIGURACIÓN abajo con tus credenciales de MySQL

EJECUCIÓN:
  - Puedes editar SONG_ID al final del script para apuntar a una canción específica
  - O déjalo en None para auto-detectar la más reciente con status='done'
"""

# ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
# Ajusta estos valores para que coincidan con tu .env del backend

DB_CONFIG = {
    "host":     "localhost",
    "port":     3306,
    "user":     "root",
    "password": "root",
    "database": "music_hub",
    "charset":  "utf8mb4",
}

# None = auto-detectar la canción más reciente con status='done'
# int  = ID específico (ej. SONG_ID = 3)
SONG_ID = None

# ──────────────────────────────────────────────────────────────────────────────
# NOTA: El código a continuación usa las APIs de REAPER (RPR_*).
# Solo funcionará cuando se ejecuta DENTRO de REAPER como ReaScript.
# ──────────────────────────────────────────────────────────────────────────────

import sys
import os

# ── Importar pymysql (debe estar en el Python que REAPER usa) ─────────────────
try:
    import pymysql
except ImportError:
    # Intentar instalar en el contexto de REAPER
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "pymysql"], check=True)
    import pymysql


def get_song_data(song_id=None):
    """
    Consulta la DB y retorna los datos de la canción.

    Returns:
        dict con keys: id, original_name, bpm, key,
                       vocals_path, drums_path, bass_path,
                       guitar_path, piano_path, other_path
    """
    conn = pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)
    try:
        with conn.cursor() as cursor:
            if song_id is not None:
                sql = "SELECT * FROM songs WHERE id = %s AND status = 'done' LIMIT 1"
                cursor.execute(sql, (song_id,))
            else:
                sql = "SELECT * FROM songs WHERE status = 'done' ORDER BY created_at DESC LIMIT 1"
                cursor.execute(sql)

            row = cursor.fetchone()
            if not row:
                raise ValueError(
                    f"No se encontró ninguna canción con status='done'"
                    + (f" y ID={song_id}" if song_id else " en la base de datos.")
                )
            return row
    finally:
        conn.close()


def import_to_reaper(song):
    """
    Importa los stems al proyecto actual de REAPER.

    Args:
        song: dict con datos de la canción obtenidos de get_song_data()
    """
    # ── Verificar que las APIs de REAPER están disponibles ────────────────────
    try:
        import reaper_python as RPR  # noqa: F401
        # En versiones modernas de REAPER, las funciones están en el namespace global
    except ImportError:
        pass  # Las funciones RPR_* están disponibles como globales en ReaScript

    song_name = song["original_name"].rsplit(".", 1)[0]  # Quitar extensión

    STEM_CONFIG = [
        ("vocals", song["vocals_path"], "Voces"),
        ("drums",  song["drums_path"],  "Batería"),
        ("bass",   song["bass_path"],   "Bajo"),
        ("guitar", song["guitar_path"], "Guitarra"),
        ("piano",  song["piano_path"],  "Piano"),
        ("other",  song["other_path"],  "Otros"),
    ]

    RPR_Undo_BeginBlock()  # noqa: F821 — función global de REAPER

    try:
        # ── 1. Ajustar BPM del proyecto ───────────────────────────────────────
        bpm = float(song["bpm"]) if song["bpm"] else 120.0
        RPR_SetCurrentBPM(0, bpm, True)  # noqa: F821
        print(f"[REAPER] BPM configurado: {bpm:.2f}")

        # ── 2. Mutear tracks de referencia pre-existentes ─────────────────────
        num_tracks = RPR_CountTracks(0)  # noqa: F821
        for i in range(num_tracks):
            track = RPR_GetTrack(0, i)  # noqa: F821
            RPR_SetMediaTrackInfo_Value(track, "B_MUTE", 1)  # noqa: F821
        print(f"[REAPER] {num_tracks} track(s) existente(s) muteada(s).")

        # ── 3. Importar los 6 stems ────────────────────────────────────────────
        for idx, (stem_key, file_path, instrument_name) in enumerate(STEM_CONFIG):
            if not file_path:
                print(f"[REAPER] ⚠️  Stem '{stem_key}' no tiene ruta. Saltando.")
                continue

            if not os.path.exists(file_path):
                print(f"[REAPER] ⚠️  Archivo no encontrado: {file_path}")
                continue

            # Insertar nueva track al final
            track_index = RPR_CountTracks(0)  # noqa: F821
            RPR_InsertTrackAtIndex(track_index, True)  # noqa: F821
            track = RPR_GetTrack(0, track_index)  # noqa: F821

            # Nombrar la track: "NombreCancion - Instrumento"
            track_name = f"{song_name} — {instrument_name}"
            RPR_GetSetMediaTrackInfo_String(  # noqa: F821
                track, "P_NAME", track_name, True
            )

            # Seleccionar sólo esta track para la inserción
            RPR_SetOnlyTrackSelected(track)  # noqa: F821

            # Insertar el archivo WAV en la posición 0:00
            item = RPR_InsertMedia(file_path, 0)  # noqa: F821

            # Asegurarse de que el item empieza en tiempo 0.0
            if item:
                RPR_SetMediaItemPosition(item, 0.0, False)  # noqa: F821

            print(f"[REAPER] ✅ Track {idx + 1}: '{track_name}' → {os.path.basename(file_path)}")

        # ── 4. Ajustar la vista para ver todas las tracks ─────────────────────
        RPR_TrackList_AdjustWindows(False)  # noqa: F821
        RPR_UpdateArrange()  # noqa: F821

        print(f"\n[REAPER] 🎉 Importación completada:")
        print(f"   Canción : {song['original_name']}")
        print(f"   BPM     : {bpm:.2f}")
        print(f"   Tonalidad: {song.get('key', 'N/A')}")
        print(f"   Stems   : {sum(1 for _, p, _ in STEM_CONFIG if p)} de 6")

        # Mostrar mensaje en REAPER
        RPR_MB(  # noqa: F821
            f"Importación exitosa!\n\n"
            f"Canción: {song['original_name']}\n"
            f"BPM: {bpm:.1f}   Tonalidad: {song.get('key', 'N/A')}\n\n"
            f"6 tracks creadas al inicio de la línea de tiempo.",
            "Music Hub — Import Stems",
            0,  # MB_OK
        )

    except Exception as exc:
        error_msg = f"Error durante la importación:\n{type(exc).__name__}: {exc}"
        print(f"[REAPER] ❌ {error_msg}")
        RPR_MB(error_msg, "Music Hub — Error", 0)  # noqa: F821
        raise

    finally:
        RPR_Undo_EndBlock(  # noqa: F821
            f"Music Hub: Importar stems de '{song.get('original_name', 'desconocida')}'",
            -1
        )


# ── Entry Point del ReaScript ─────────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("  Music Hub — Import Stems to REAPER")
    print("="*60)

    try:
        # Obtener datos de la canción
        print(f"[DB] Consultando canción{f' ID={SONG_ID}' if SONG_ID else ' más reciente'}...")
        song = get_song_data(SONG_ID)
        print(f"[DB] Canción encontrada: '{song['original_name']}' (ID={song['id']})")

        # Importar a REAPER
        import_to_reaper(song)

    except Exception as exc:
        print(f"[Error] {exc}")
        # RPR_MB puede no estar disponible si hay error de DB antes de entrar a REAPER
        try:
            RPR_MB(str(exc), "Music Hub — Error", 0)  # noqa: F821
        except Exception:
            pass


main()
