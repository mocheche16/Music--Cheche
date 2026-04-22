# 🎛️ Music Hub — Hub de Análisis y Separación Musical

## Stack
- **Backend**: Python · FastAPI · Demucs (htdemucs_6s) · Librosa
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
│   │   ├── models.py        # Tabla songs
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── crud.py          # Operaciones DB
│   │   ├── processing.py    # Demucs + Librosa
│   │   └── routers/
│   │       └── tracks.py    # Endpoints REST
│   ├── uploads/             # Archivos subidos
│   ├── stems/               # Stems generados
│   ├── requirements.txt
│   └── .env                 # Configuración (editar esto primero)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── api/client.js
│   │   ├── hooks/useAudioEngine.js
│   │   └── components/
│   │       ├── UploadZone.jsx
│   │       ├── Catalog.jsx
│   │       ├── ChannelStrip.jsx
│   │       └── MixerDashboard.jsx
│   ├── package.json
│   └── vite.config.js
└── reaper_script/
    └── import_stems.py      # Script para REAPER
```

---

## ⚙️ Configuración Inicial

### 1. MySQL — Crear la Base de Datos

Abre MySQL y ejecuta:
```sql
CREATE DATABASE music_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Edita `backend/.env` con tus credenciales:
```env
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=music_hub
```

---

### 2. Backend — Python

```powershell
# Ir a la carpeta del backend
cd "d:\Desarrollo\Music Cheche\backend"

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Instalar PyTorch PRIMERO (elige según tu hardware):

# ─── OPCIÓN A: Con GPU NVIDIA (CUDA 12.1) — recomendado ───────────────────
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# ─── OPCIÓN B: Solo CPU (más lento, ~15-30 min por canción) ───────────────
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Instalar el resto de dependencias
pip install -r requirements.txt

# Arrancar el servidor
python -m app.main
```

El servidor estará disponible en: http://localhost:8000
Documentación interactiva: http://localhost:8000/docs

---

### 3. Frontend — React

```powershell
# Abrir una nueva terminal
cd "d:\Desarrollo\Music Cheche\frontend"

# Instalar dependencias
npm install

# Arrancar en modo desarrollo
npm run dev
```

La app web estará en: http://localhost:5173

---

### 4. Demucs — Primera ejecución (descarga del modelo)

La primera vez que subas una canción, Demucs descargará automáticamente
el modelo `htdemucs_6s` (~1.5 GB). Asegúrate de tener conexión a internet.

---

## 🎮 Uso

### Flujo básico:
1. Abre http://localhost:5173
2. Haz clic en **"+ Subir Canción"**
3. Arrastra tu MP3/WAV al área de carga
4. Espera el procesamiento (5-30 min según GPU/CPU)
5. Haz clic en **"🎛️ Mixer"** en el catálogo
6. ¡Practica con los 6 stems sincronizados!

### API REST:
| Endpoint | Descripción |
|----------|-------------|
| `POST /upload` | Subir archivo de audio |
| `GET /tracks` | Listar catálogo |
| `GET /tracks/{id}` | Detalles + rutas de stems |
| `GET /tracks/{id}/status` | Polling de estado |
| `GET /stems/{id}/{stem}` | Streaming del WAV |

---

## 🎛️ REAPER — Importar Stems

1. Copia `reaper_script/import_stems.py` a `%APPDATA%\REAPER\Scripts\`
2. Edita las credenciales de MySQL al inicio del script
3. En REAPER: **Actions → Show action list → New action → Load ReaScript**
4. Selecciona el archivo y ejecuta (o asigna un atajo de teclado)

El script automáticamente:
- Detecta la canción más reciente procesada
- Ajusta el BPM del proyecto de REAPER
- Crea 6 tracks con los stems importados al inicio de la línea de tiempo
- Mutea cualquier track de referencia existente

---

## 🔧 Troubleshooting

### "No module named 'demucs'"
```powershell
# Asegúrate de que el entorno virtual está activado
.\venv\Scripts\Activate.ps1
pip install demucs
```

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
