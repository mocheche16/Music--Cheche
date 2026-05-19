import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from loguru import logger

load_dotenv()

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logger.remove()
logger.add(
    sys.stdout,
    format=(
        "<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    ),
    level=os.getenv("LOG_LEVEL", "INFO"),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Inicializando base de datos...")
    try:
        from app.database import init_db as _init_db
        await _init_db()
        logger.info("Base de datos lista.")
    except Exception as exc:
        logger.error(f"Error de DB: {exc}")
        logger.warning("Verifica que PostgreSQL está corriendo y las credenciales en .env.")
    yield
    logger.info("Servidor detenido.")


app = FastAPI(
    title="Music Hub API",
    description="Hub de Análisis y Separación Musical — FastAPI + Demucs + Librosa",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:5173"),
        "http://localhost:3000",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)


@app.exception_handler(Exception)
async def global_exc_handler(request, exc):
    from app.middleware import global_exception_handler
    return await global_exception_handler(request, exc)


from app.routers.tracks import router as tracks_router

app.include_router(tracks_router, tags=["tracks"])

logger.info("Music Hub API iniciada")


@app.get("/", tags=["health"])
async def root():
    return {
        "status": "ok",
        "message": "Music Hub API está corriendo",
        "version": "1.1.0",
    }


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))

    print(f"\n Music Hub API arrancando en http://{host}:{port}")
    print(f"   Docs: http://localhost:{port}/docs\n")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        reload_dirs=["app"],
    )
