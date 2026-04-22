# 🎛️ Music Hub — Hub de Análisis y Separación Musical

**Autor:** Mocheche

## 🚀 Nuevas Funcionalidades (Versión Pro)
- **Separación de 6 Stems:** Voces, Batería, Bajo, Guitarra, Piano y Otros.
- **Máxima Calidad de Audio:** Procesamiento con `--shifts 4` para una separación cristalina y sin artefactos.
- **Barra de Progreso Real:** Visualización en tiempo real del porcentaje de avance de la IA.
- **Audio Multitarea:** Sigue escuchando tus mezclas mientras navegas por el catálogo o subes nuevos archivos (Mini Reproductor).
- **Exportación Versátil:** Descarga stems individuales en WAV o paquetes completos en ZIP (WAV o MP3 convertido al vuelo).
- **Mixer Avanzado:** Control total de volumen, mute y solo con interfaz premium.

## Stack
- **Backend**: Python · FastAPI · Demucs (htdemucs_6s) · Librosa · Soundfile (MP3 Encoder)
- **Base de Datos**: MySQL + SQLAlchemy
- **Frontend**: React + Vite · Web Audio API
- **DAW**: REAPER (ReaScript Python)

---

## 📁 Estructura del Proyecto

```
Music Cheche/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── database.py      # SQLAlchemy + MySQL
│   │   ├── models.py        # Tabla songs (incluye progreso)
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── crud.py          # Operaciones DB
│   │   ├── processing.py    # Demucs (Shifts 4) + Librosa
│   │   └── routers/
│   │       └── tracks.py    # Endpoints ZIP, MP3 y Export
│   ├── uploads/             # Archivos subidos
│   ├── stems/               # Stems generados
│   ├── requirements.txt
│   └── .env                 # Configuración
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Lógica global de audio
│   │   ├── api/client.js
│   │   ├── components/
│   │   │   ├── MiniPlayer.jsx       # Reproductor persistente
│   │   │   ├── Catalog.jsx          # Con barra de progreso
│   │   │   ├── MixerDashboard.jsx   # Botones de exportación masiva
│   │   │   └── ...
│   ├── package.json
│   └── vite.config.js
└── reaper_script/
    └── import_stems.py      # Script para REAPER
```

---

## ⚙️ Configuración Inicial

### 1. MySQL — Crear la Base de Datos

Abre MySQL (XAMPP) y ejecuta:
```sql
CREATE DATABASE music_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Edita `backend/.env` con tus credenciales.

---

### 2. Backend — Python

```powershell
# Ir a la carpeta del backend
cd "d:\Desarrollo\Music Cheche\backend"

# Crear e instalar entorno
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar PyTorch y dependencias
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121  # O cpu si no tienes NVIDIA
pip install -r requirements.txt

# Arrancar el servidor
$env:PYTHONUTF8=1; python -m app.main
```

---

### 3. Frontend — React

```powershell
cd "d:\Desarrollo\Music Cheche\frontend"
npm install
npm run dev
```

---

## 🎮 Uso Avanzado

### Exportación
- **Individual:** En el mixer, haz clic en `⬇️ WAV` de cualquier canal.
- **Masiva (ZIP):** Usa los botones `📦 WAV` o `📦 MP3` en la cabecera del mixer para bajar todo el proyecto comprimido.

### Multitarea
- Puedes darle a **Reproducir** en el mixer y luego **Minimizar** (atrás).
- Aparecerá una barra inferior con el control de la música.
- Mientras suena, puedes ir a **Subir Canción** y cargar nuevos archivos sin interrupciones.

---

## 🔧 Troubleshooting

### Incompatibilidad `torchcodec` en Windows
El proyecto incluye un **monkey-patch automático** en `backend/app/run_demucs.py` que soluciona errores de carga de audio en Windows usando `soundfile` como backend alternativo. No necesitas instalar nada adicional.

### "Access denied for user 'root'"
- Verifica que MySQL está corriendo
- Revisa usuario/contraseña en `backend/.env`
- Ejecuta: `mysql -u root -p` para verificar acceso

### El procesamiento tarda demasiado
- Sin GPU: es normal que tarde 15-30 minutos
- Verifica con `python -c "import torch; print(torch.cuda.is_available())"`
- Si retorna `False`, no hay GPU disponible

### Error CORS en el frontend
- Verifica que el backend está corriendo en el puerto 8000
- Verifica que el frontend está en el puerto 5173
- Revisa `CORS_ORIGIN` en `backend/.env`
