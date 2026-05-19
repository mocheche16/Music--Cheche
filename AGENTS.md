# Music Hub — AGENTS.md

## Descripción
Music Hub es una aplicación full-stack para separación de stems musicales usando IA (Demucs). Consta de un backend FastAPI (Python) y un frontend React + TypeScript + Vite.

## Stack
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Demucs, Librosa
- **Frontend**: React 18, TypeScript, Vite, CSS Modules, Web Audio API
- **Infra**: Docker, GitHub Actions, Vercel (frontend), Render (backend)

## Comandos útiles

### Backend
```bash
cd backend
python -m venv venv
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python -m app.main
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
```

### Docker
```bash
cd backend
docker-compose up --build
```

## Convenciones
- **Backend**: async/await, SQLAlchemy 2.0 select pattern, Pydantic v2
- **Frontend**: TypeScript estricto, CSS Modules, hooks personalizados
- **Commits**: Conventional Commits (feat:, fix:, docs:, refactor:, chore:)
- **Tests**: pytest (backend), Vitest + React Testing Library (frontend)

## Estructura
```
backend/app/          # FastAPI aplicación
  ├── config.py       # Pydantic Settings
  ├── database.py     # Async SQLAlchemy + PostgreSQL
  ├── models.py       # ORM models
  ├── schemas.py      # Pydantic schemas
  ├── crud.py         # Async CRUD operations
  ├── processing.py   # Demucs + Librosa pipeline
  ├── middleware.py    # Error handling
  └── routers/        # API endpoints
frontend/src/         # React aplicación
  ├── types.ts        # TypeScript types
  ├── api/client.ts   # Axios API client
  ├── hooks/          # Custom hooks
  └── components/     # React components + CSS Modules
```
