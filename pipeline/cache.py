from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from config import CACHE_DIR, CACHE_VERSION


def cache_get(key: str, namespace: str = "resource") -> dict | list | None:
    path = _cache_path(namespace, key)
    if not path.exists():
        return None

    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    if entry.get("key") != key:
        return None
    if entry.get("namespace") != namespace:
        return None
    if entry.get("pipeline_version") != CACHE_VERSION:
        return None

    return entry.get("data")


def cache_set(key: str, data: dict | list, namespace: str = "resource") -> None:
    path = _cache_path(namespace, key)
    tmp_path = path.with_name(f"{path.name}.tmp")
    entry = {
        "key": key,
        "namespace": namespace,
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "pipeline_version": CACHE_VERSION,
        "data": data,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def _cache_path(namespace: str, key: str) -> Path:
    digest = hashlib.sha256(f"{namespace}:{key}".encode("utf-8")).hexdigest()
    return CACHE_DIR / namespace / f"{digest}.json"
