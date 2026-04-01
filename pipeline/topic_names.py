from __future__ import annotations

import re


def normalize_topic_name(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", str(value).casefold()).strip()
    return " ".join(normalized.split())


def slugify_topic_name(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value).casefold().strip())
    slug = re.sub(r"-{2,}", "-", slug)
    return slug.strip("-") or "topic"
