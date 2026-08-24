"""Object storage: local + S3 missing-key mapping."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from app.storage.s3 import S3Storage


def test_s3_get_maps_missing_key_to_file_not_found():
    storage = S3Storage(
        bucket="test-bucket",
        region="auto",
        endpoint_url="https://example.r2.cloudflarestorage.com",
        access_key="ak",
        secret_key="sk",
    )
    client = MagicMock()
    err = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Not found"}},
        "GetObject",
    )
    client.get_object.side_effect = err
    storage.__dict__["client"] = client
    with pytest.raises(FileNotFoundError):
        storage.get("user/trade/entry-abc")
