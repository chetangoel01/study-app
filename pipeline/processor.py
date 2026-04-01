from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

from config import PROCESSOR_MODEL
from llm_client import complete_prompt
from scraper import ScrapeResult
from url_classifier import UrlType

_VALID_DIFFICULTIES = {"easy", "medium", "hard"}
_VALID_TYPES = {"video", "article", "reference", "course", "platform", "pdf"}


def default_resource_type(url_type: UrlType) -> str:
    mapping = {
        UrlType.YOUTUBE_VIDEO: "video",
        UrlType.YOUTUBE_PLAYLIST: "video",
        UrlType.COURSERA: "course",
        UrlType.GITHUB_PDF: "pdf",
        UrlType.GITHUB_MARKDOWN: "reference",
        UrlType.GITHUB_REPO: "reference",
        UrlType.SHORTLINK: "article",
        UrlType.PLATFORM: "platform",
        UrlType.ARCHIVE: "article",
        UrlType.ARTICLE: "article",
    }
    return mapping[url_type]


def build_embed_url(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    query = parse_qs(parsed.query)

    if host in {"youtube.com", "www.youtube.com", "m.youtube.com"} and parsed.path == "/watch" and query.get("v"):
        video_id = query["v"][0]
        start = _parse_embed_start(query)
        embed_url = f"https://www.youtube.com/embed/{video_id}"
        if start:
            return f"{embed_url}?start={start}"
        return embed_url

    if host == "youtu.be" and parsed.path.strip("/"):
        video_id = parsed.path.strip("/")
        start = _parse_embed_start(query)
        embed_url = f"https://www.youtube.com/embed/{video_id}"
        if start:
            return f"{embed_url}?start={start}"
        return embed_url

    return None


def process_resource(
    scrape_result: ScrapeResult,
    label: str,
    module_title: str,
    module_summary: str,
) -> dict:
    if scrape_result.status == "failed":
        return {
            "label": label,
            "url": scrape_result.url,
            "type": default_resource_type(scrape_result.url_type),
            "difficulty": None,
            "summary": "",
            "key_points": [],
            "practice_questions": [],
            "concepts": [],
            "embed_url": build_embed_url(scrape_result.resolved_url or scrape_result.url),
            "scrape_status": "failed",
            "error": scrape_result.error,
        }

    content = scrape_result.content
    if scrape_result.status == "fallback":
        content = (
            f"Title: {scrape_result.title}\n"
            f"Description: {scrape_result.og_description}\n"
            "Note: full content unavailable, generate from title/URL/module context."
        )

    prompt = f"""Return JSON only with these fields:
- summary
- key_points
- practice_questions
- concepts
- difficulty
- type

Rules:
- summary: 2-3 sentences
- key_points: 3-5 bullet-style strings
- practice_questions: 2-3 question strings
- concepts: 3-8 computer science concept strings
- difficulty: one of easy, medium, hard
- type: one of video, article, reference, course, platform, pdf

Resource label: {label}
Resource url: {scrape_result.url}
Resource url_type: {scrape_result.url_type.value}
Module title: {module_title}
Module summary: {module_summary}

Content:
{content}
"""

    raw_text = complete_prompt(prompt, max_tokens=1400)
    payload = json.loads(_strip_markdown_fences(raw_text))

    summary = str(payload.get("summary", "")).strip()
    key_points = _clean_list(payload.get("key_points"), limit=5)
    practice_questions = _clean_list(payload.get("practice_questions"), limit=3)
    concepts = _clean_list(payload.get("concepts"), limit=8)
    difficulty = str(payload.get("difficulty", "medium")).strip().lower()
    resource_type = str(payload.get("type", default_resource_type(scrape_result.url_type))).strip().lower()

    if not summary:
        raise ValueError("Processor response missing summary")
    if difficulty not in _VALID_DIFFICULTIES:
        difficulty = "medium"
    if resource_type not in _VALID_TYPES:
        resource_type = default_resource_type(scrape_result.url_type)

    return {
        "label": label,
        "url": scrape_result.url,
        "type": resource_type,
        "difficulty": difficulty,
        "summary": summary,
        "key_points": key_points,
        "practice_questions": practice_questions,
        "concepts": concepts,
        "embed_url": build_embed_url(scrape_result.resolved_url or scrape_result.url),
        "scrape_status": scrape_result.status,
        "error": None,
    }


def _clean_list(value: object, limit: int) -> list[str]:
    if isinstance(value, list):
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return cleaned[:limit]
    return []


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_embed_start(query: dict[str, list[str]]) -> int:
    if query.get("t"):
        return _parse_seconds(query["t"][0])
    if query.get("start"):
        return _parse_seconds(query["start"][0])
    return 0


def _parse_seconds(value: str) -> int:
    value = value.strip().lower()
    if value.isdigit():
        return int(value)
    if value.endswith("s") and value[:-1].isdigit():
        return int(value[:-1])

    total = 0
    number = ""
    for char in value:
        if char.isdigit():
            number += char
            continue
        if not number:
            continue
        amount = int(number)
        if char == "h":
            total += amount * 3600
        elif char == "m":
            total += amount * 60
        elif char == "s":
            total += amount
        number = ""
    return total
