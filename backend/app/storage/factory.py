from __future__ import annotations

from functools import lru_cache
import logging

from app.core.config import settings
from app.storage.local import LocalStorage

log = logging.getLogger("traderos.storage")


@lru_cache(maxsize=1)
def get_storage():
    backend = settings.storage_backend.lower().strip()
    if backend == "db":
        log.info("storage backend=db (screenshot bytes in Postgres)")
        raise RuntimeError(
            "STORAGE_BACKEND=db stores files on trade_screenshots.file_data; "
            "object storage client is not used."
        )
    if backend == "s3":
        from app.storage.s3 import S3Storage

        if not settings.s3_bucket.strip():
            raise RuntimeError("STORAGE_BACKEND=s3 requires S3_BUCKET")
        log.info(
            "storage backend=s3 bucket=%s endpoint=%s",
            settings.s3_bucket,
            settings.s3_endpoint_url or "aws",
        )
        return S3Storage(
            bucket=settings.s3_bucket.strip(),
            region=settings.s3_region.strip() or "auto",
            endpoint_url=settings.s3_endpoint_url.strip() or None,
            access_key=settings.s3_access_key_id.strip() or None,
            secret_key=settings.s3_secret_access_key.strip() or None,
        )
    if not settings.is_dev and backend == "local":
        log.warning(
            "STORAGE_BACKEND=local in non-development env — screenshot files are "
            "ephemeral and will disappear on redeploy. Prefer STORAGE_BACKEND=db "
            "(Postgres) or STORAGE_BACKEND=s3 (R2/S3) for durable charts."
        )
    return LocalStorage(settings.storage_local_path)
