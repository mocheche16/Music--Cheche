import traceback

from fastapi import Request
from fastapi.responses import JSONResponse
from loguru import logger

from app.exceptions import AppException


async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled error on {} {}: {}\n{}",
        request.method,
        request.url.path,
        str(exc),
        traceback.format_exc(),
    )

    if isinstance(exc, AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error interno del servidor",
            "type": type(exc).__name__,
        },
    )
