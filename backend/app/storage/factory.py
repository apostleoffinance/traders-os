from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.storage.local import LocalStorage


@lru_cache(maxsize=1)
def get_storage():
    backend = settings.storage_backend.lower()
    if backend == "s3":
        from app.storage.s3 import S3Storage

        return S3Storage(
            bucket=settings.s3_bucket,
            region=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url or None,
            access_key=settings.s3_access_key_id or None,
            secret_key=settings.s3_secret_access_key or None,
        )
    return LocalStorage(settings.storage_local_path)
