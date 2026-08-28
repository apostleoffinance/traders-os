"""Compact JSON schema text for LLM prompts."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel


def json_schema_for_prompt(schema: type[BaseModel]) -> str:
    """Return a JSON-schema snippet models can follow (enums, required fields, types)."""
    raw: dict[str, Any] = schema.model_json_schema(mode="serialization")
    compact = _compact_schema(raw)
    return json.dumps(compact, indent=2, sort_keys=True)


def _compact_schema(node: dict[str, Any]) -> dict[str, Any]:
    """Drop noisy keys; inline simple $defs for readability."""
    defs = node.pop("$defs", None) or {}
    out = _resolve_refs(node, defs)
    if isinstance(out, dict) and "properties" in out:
        props = out["properties"]
        if isinstance(props, dict):
            out["properties"] = {k: _resolve_refs(v, defs) if isinstance(v, dict) else v for k, v in props.items()}
    return out


def _resolve_refs(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, list):
        return [_resolve_refs(item, defs) for item in node]
    if not isinstance(node, dict):
        return node
    if "$ref" in node:
        ref = node["$ref"]
        if ref.startswith("#/$defs/"):
            key = ref.split("/")[-1]
            target = defs.get(key, {})
            return _resolve_refs(dict(target), defs)
    return {k: _resolve_refs(v, defs) for k, v in node.items() if k not in {"$defs", "title"}}
