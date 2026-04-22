"""
main.py — Entry point del servidor FastAPI

Inicializa la app, configura CORS, monta los routers y arranca Uvicorn.
"""
import os
import sys
from contextlib import asynccontextmanager

# Forzar UTF-8 en Windows para evitar UnicodeEncodeError con logs
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


# ── Lifespan: acciones al arrancar/cerrar la app ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al arrancar: crear tablas si no existen
    from app.database import init_db
    print("[Startup] Inicializando base de datos...")
    try:
        init_db()
        print("[Startup] ✅ Base de datos lista.")
    except Exception as exc:
        print(f"[Startup] ❌ Error de DB: {exc}")
        print("[Startup] ⚠️  Verifica que MySQL está corriendo y las credenciales en .env son correctas.")
    yield
    # Al cerrar: cleanup (si fuera necesario)
    print("[Shutdown] Servidor detenido.")


# ── FastAPI App ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Music Hub API",
    description="Hub de Análisis y Separación Musical — FastAPI + Demucs + Librosa",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
from app.routers.tracks import router as tracks_router  # noqa: E402

app.include_router(tracks_router, tags=["tracks"])


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "message": "Music Hub API está corriendo 🎵"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))

    print(f"\n🎵 Music Hub API arrancando en http://{host}:{port}")
    print(f"   Docs: http://localhost:{port}/docs\n")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        reload_dirs=["app"],
    )
