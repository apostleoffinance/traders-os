from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from json import dumps
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.core.config import settings

log = logging.getLogger("traderos.startup")


def _json_default(value: object) -> object:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


class DecimalJSONResponse(JSONResponse):
    def render(self, content: object) -> bytes:
        return dumps(content, default=_json_default, ensure_ascii=False).encode("utf-8")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    default_response_class=DecimalJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)

_DB_DOWN = (
    "Database is unreachable. Start Postgres with `docker compose up -d postgres`, "
    "then retry."
)


@app.exception_handler(OperationalError)
async def database_unreachable(_request: Request, _exc: OperationalError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": _DB_DOWN})


@app.exception_handler(Exception)
async def unhandled_error(_request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, (HTTPException, StarletteHTTPException, RequestValidationError)):
        raise exc
    if isinstance(exc, OperationalError):
        return JSONResponse(status_code=503, content={"detail": _DB_DOWN})
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


@app.on_event("startup")
def warn_ephemeral_storage() -> None:
    backend = settings.storage_backend.lower().strip()
    if backend == "local" and not settings.is_dev:
        log.critical(
            "STORAGE_BACKEND=local in production — chart uploads are stored on ephemeral "
            "disk and will disappear on redeploy. Set STORAGE_BACKEND=db (Postgres bytes) "
            "or STORAGE_BACKEND=s3 for durable screenshots."
        )
    elif backend == "db":
        log.info("storage backend=db — screenshot bytes stored in Postgres")


@app.get("/health")
def health() -> dict[str, str | bool]:
    backend = settings.storage_backend.lower().strip()
    return {
        "status": "ok",
        "service": settings.app_name,
        "storage_backend": backend,
        "storage_durable": backend in {"db", "s3"},
    }
