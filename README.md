<div align="center">
  <h1>🎛️ Music Hub</h1>
  <p><strong>Hub de Análisis y Separación Musical con IA</strong></p>

  <p>
    <a href="#features">Características</a> •
    <a href="#tech-stack">Stack</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#architecture">Arquitectura</a> •
    <a href="#deployment">Deploy</a> •
    <a href="#api">API</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Python-3.12+-blue?logo=python" alt="Python">
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React">
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" alt="FastAPI">
    <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/Demucs-4.0-FF6F00?logo=meta" alt="Demucs">
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  </p>
</div>

---

**Music Hub** es una aplicación full-stack profesional que convierte cualquier canción en **6 stems individuales** (voces, batería, bajo, guitarra, piano, otros) usando el modelo de IA [Demucs](https://github.com/facebookresearch/demucs) de Meta. Incluye un **mixer multicanal** en el navegador con visualización en tiempo real, control de tono y velocidad, y exportación en WAV/MP3.

---

## ✨ Características

| | Funcionalidad | Detalle |
|---|---|---|
| 🎤 | **Separación IA 6 stems** | Demucs `htdemucs_6s` con calidad `--shifts 4` |
| 🎵 | **Análisis automático** | Detección de BPM y tonalidad (Krumhansl-Schmuckler) |
| 🎛️ | **Mixer multicanal** | 6 canales sincronizados con VU meter y ecualizador visual |
| ⌨️ | **Atajos de teclado** | Espacio (Play/Pause), ←/→ (seek), Escape (cerrar) |
| 🎚️ | **Pitch & Speed** | Ajuste de tono (±12 semitonos) y velocidad (0.5x–1.5x) |
| 📦 | **Exportación** | Stems individuales WAV o ZIP completo (WAV/MP3) |
| 🎯 | **Metrónomo** | Stem tempo sincronizado con el BPM detectado |
| 📱 | **Responsive** | Diseño adaptable para escritorio y móvil |
| 🔄 | **Persistente** | Mini reproductor que sigue sonando mientras navegas |
| 🗑️ | **Gestión** | Catálogo con estado, progreso en tiempo real y eliminación |

## 🛠️ Stack Tecnológico

### Backend
| Tecnología | Uso |
|---|---|
| **FastAPI** | Framework REST asíncrono |
| **SQLAlchemy 2.0** | ORM asíncrono con PostgreSQL |
| **Demucs 4.0** | Separación de stems con IA (Meta) |
| **Librosa** | Análisis de audio (BPM, tonalidad) |
| **AsyncPG** | Driver PostgreSQL asíncrono |
| **Docker** | Contenedorización |

### Frontend
| Tecnología | Uso |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Tipado estático |
| **Vite 6** | Build tool y dev server |
| **CSS Modules** | Estilos encapsulados por componente |
| **Web Audio API** | Motor de audio multicanal |

## 🚀 Quick Start

### Prerrequisitos
- Python 3.12+
- Node.js 20+
- PostgreSQL 16 (o Docker)
- GPU NVIDIA con CUDA (opcional, acelera Demucs 10x)

### 1. Clonar e instalar backend

```bash
git clone https://github.com/mocheche16/Music--Cheche.git
cd Music--Cheche/backend

python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1

# Instalar PyTorch (según tu hardware)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121  # GPU
# o
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu     # CPU

pip install -r requirements.txt
```

### 2. Configurar base de datos

```bash
# Opción A: Usando Docker
docker-compose up -d db

# Opción B: PostgreSQL local
createdb music_hub
```

### 3. Iniciar backend

```bash
python -m app.main
# http://localhost:8000/docs
```

### 4. Iniciar frontend

```bash
cd ../frontend
npm install
npm run dev
# http://localhost:5173
```

### 5. ¡A usar!

1. Sube un archivo MP3/WAV/FLAC/OGG
2. Espera el procesamiento (5–30 min en CPU, 1–3 min en GPU)
3. Abre el mixer y ¡empieza a practicar!

## 🏗️ Arquitectura

```
Cliente (React)          Servidor (FastAPI)           Base de Datos
     │                        │                           │
     │  POST /upload ──────►  │  Guarda archivo          │
     │  (drag & drop)         │  Crea registro ─────────► │ songs
     │                        │                           │
     │  ← 202 Accepted ─────  │                           │
     │                        │                           │
     │  GET /status ────────► │  Lee estado ────────────► │
     │  (polling cada 2s)     │                           │
     │  ◄── {processing} ──  │                           │
     │                        │  ┌───────────────────┐    │
     │                        │  │ Background Task   │    │
     │                        │  │ ┌───────────────┐ │    │
     │                        │  │ │ Librosa (BPM) │ │    │
     │                        │  │ └───────┬───────┘ │    │
     │                        │  │         ▼         │    │
     │                        │  │ ┌───────────────┐ │    │
     │                        │  │ │ Demucs (IA)   │ │    │
     │                        │  │ └───────┬───────┘ │    │
     │                        │  └─────────┼─────────┘    │
     │                        │            ▼              │
     │  GET /stems/{id}/  ──► │  Stem files (WAV)         │
     │  ◄── WAV stream ─────  │                           │
```

### Flujo de datos

1. **Upload** → El archivo se guarda en `uploads/` con hash SHA-256 para deduplicación
2. **Análisis** → Librosa detecta BPM y tonalidad
3. **Separación** → Demucs genera 6 stems WAV en `stems/htdemucs_6s/{song}/`
4. **Metrónomo** → Se genera un stem tempo sincronizado con el BPM
5. **Mixer** → El frontend descarga los 6 stems como buffers de Web Audio API
6. **Reproducción** → 6 `AudioBufferSourceNode` sincronizados con controls de volumen, mute, solo

## 📡 API

### Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/upload` | Subir archivo de audio (multipart) |
| `GET` | `/tracks` | Listar canciones (paginado) |
| `GET` | `/tracks/{id}` | Detalle de canción + URLs de stems |
| `GET` | `/tracks/{id}/status` | Estado del procesamiento (polling) |
| `DELETE` | `/tracks/{id}` | Eliminar canción + archivos |
| `GET` | `/stems/{id}/{stem}` | Descargar stem individual (WAV) |
| `GET` | `/tracks/{id}/export-all` | Exportar ZIP con todos los stems |
| `GET` | `/docs` | Documentación Swagger |
| `GET` | `/health` | Health check |

### Stems disponibles

| Stem | Archivo | Color |
|---|---|---|
| Voces | `vocals.wav` | 🔴 `#ff6b9d` |
| Batería | `drums.wav` | 🟠 `#ff9a3c` |
| Bajo | `bass.wav` | 🟢 `#4ade80` |
| Guitarra | `guitar.wav` | 🔵 `#60a5fa` |
| Piano | `piano.wav` | 🟣 `#c084fc` |
| Otros | `other.wav` | ⚪ `#94a3b8` |

## 🌐 Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
npx vercel --prod
```

Configurar variables de entorno en Vercel:
- `VITE_API_URL`: URL del backend en producción

### Backend → Render

1. Conectar repositorio a [Render](https://render.com)
2. Crear **Web Service** usando `backend/Dockerfile`
3. Configurar variables de entorno (PostgreSQL URL, etc.)
4. Crear base de datos PostgreSQL (Render PostgreSQL o Neon)

### Docker (producción)

```bash
cd backend
docker-compose -f docker-compose.yml up --build -d
```

## 🧪 Testing

### Backend
```bash
cd backend
pip install pytest httpx
pytest -v
```

### Frontend
```bash
cd frontend
npm install --save-dev vitest @testing-library/react
npm test
```

## 📁 Estructura del Proyecto

```
Music Cheche/
├── backend/
│   ├── app/
│   │   ├── main.py          # Entry point FastAPI
│   │   ├── config.py         # Pydantic Settings
│   │   ├── database.py       # Async SQLAlchemy + PostgreSQL
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── crud.py           # Async CRUD operations
│   │   ├── processing.py     # Demucs + Librosa pipeline
│   │   ├── run_demucs.py     # Monkey-patch para Windows
│   │   ├── middleware.py      # Error handling global
│   │   └── routers/
│   │       └── tracks.py     # API endpoints
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # Entry point React
│   │   ├── App.tsx           # Componente raíz
│   │   ├── types.ts          # Tipos TypeScript
│   │   ├── api/client.ts     # Axios API client
│   │   ├── hooks/
│   │   │   └── useAudioEngine.ts  # Web Audio API engine
│   │   ├── components/
│   │   │   ├── Catalog.tsx         # Catálogo de canciones
│   │   │   ├── MixerDashboard.tsx   # Mixer multicanal
│   │   │   ├── ChannelStrip.tsx     # Canal individual
│   │   │   ├── UploadZone.tsx       # Drag & drop upload
│   │   │   ├── MiniPlayer.tsx       # Reproductor persistente
│   │   │   ├── WaveVisualizer.tsx   # Visualizador de frecuencia
│   │   │   └── ErrorBoundary.tsx    # Manejo de errores
│   │   └── index.css         # Design system global
│   ├── vercel.json
│   ├── vite.config.ts
│   └── package.json
├── .github/workflows/
│   ├── ci.yml               # CI pipeline
│   └── deploy.yml           # Deploy automático
├── AGENTS.md
├── CONTRIBUTING.md
└── LICENSE
```

## 📄 Licencia

**MIT** — ver [LICENSE](LICENSE) para más detalles.

---

<div align="center">
  <p>Hecho con 🎵 por <a href="https://github.com/mocheche16">Mocheche</a></p>
</div>
