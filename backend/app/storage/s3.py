"""S3-compatible object storage. Used when STORAGE_BACKEND=s3.

Works with AWS S3 and S3-compatible providers (Cloudflare R2, MinIO, etc.).
"""

from __future__ import annotations

from functools import cached_property

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


class S3Storage:
    def __init__(
        self,
        bucket: str,
        region: str,
        endpoint_url: str | None,
        access_key: str | None,
        secret_key: str | None,
    ) -> None:
        if not bucket:
            raise ValueError("S3_BUCKET is required when STORAGE_BACKEND=s3")
        self.bucket = bucket
        self.region = region or "auto"
        self.endpoint_url = endpoint_url or None
        self.access_key = access_key or None
        self.secret_key = secret_key or None

    @cached_property
    def client(self):
        kwargs: dict = {
            "region_name": self.region,
            "config": Config(s3={"addressing_style": "path"}, signature_version="s3v4"),
        }
        if self.endpoint_url:
            kwargs["endpoint_url"] = self.endpoint_url
        if self.access_key and self.secret_key:
            kwargs["aws_access_key_id"] = self.access_key
            kwargs["aws_secret_access_key"] = self.secret_key
        return boto3.client("s3", **kwargs)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str) -> bytes:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=key)
            return obj["Body"].read()
        except ClientError as exc:
            code = (exc.response.get("Error") or {}).get("Code", "")
            if code in {"404", "NoSuchKey", "NotFound", "NoSuchBucket"}:
                raise FileNotFoundError(key) from exc
            raise

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            code = (exc.response.get("Error") or {}).get("Code", "")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return
            raise

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False
