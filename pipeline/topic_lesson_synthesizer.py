from __future__ import annotations

import hashlib
import json
import time

from bucket_synthesizer import build_bucket_evidence_index
from cache import cache_get, cache_set
from config import PROCESSOR_MODEL, TOPIC_LESSON_CACHE_KEY_VERSION
from llm_client import complete_prompt
from progress import progress_bar, progress_write

_ALLOWED_PATTERN_KINDS = {"pattern", "framework", "heuristic", "tradeoff"}
_ALLOWED_PRACTICE_KINDS = {"problem", "exercise", "drill", "checklist"}
_ALLOWED_DIFFICULTIES = {"intro", "core", "stretch"}


def synthesize_topic_lessons(topics: list[dict], buckets: list[dict]) -> tuple[list[dict], dict]:
    bucket_evidence_index = build_bucket_evidence_index(buckets)
    cache_keys = [_topic_lesson_cache_key(topic, bucket_evidence_index) for topic in topics]
    cached_payloads = [cache_get(cache_key, namespace="topic_lesson") for cache_key in cache_keys]
    cached_count = sum(1 for item in cached_payloads if isinstance(item, dict))
    progress_write(
        f"[LESSONS] {cached_count}/{len(topics)} topic lessons cached; "
        f"{len(topics) - cached_count} to generate with {PROCESSOR_MODEL}"
    )

    hydrated_topics = []
    bar = progress_bar(total=len(topics), desc="Synthesize lessons", unit="topic")
    for index, (topic, cache_key, cached) in enumerate(zip(topics, cache_keys, cached_payloads, strict=True), start=1):
        if isinstance(cached, dict):
            hydrated_topics.append({**topic, "lesson": cached})
            bar.update(1)
            continue

        progress_write(f"[LESSONS {index}/{len(topics)}] Generating {topic['label']}")
        started_at = time.monotonic()
        lesson = _synthesize_topic_lesson(topic, bucket_evidence_index)
        elapsed = time.monotonic() - started_at
        cache_set(cache_key, lesson, namespace="topic_lesson")
        hydrated_topics.append({**topic, "lesson": lesson})
        progress_write(
            f"[LESSONS {index}/{len(topics)}] Finished {topic['label']} in {elapsed:.1f}s"
        )
        bar.update(1)
    bar.close()

    diagnostics = {
        "cached_topic_lessons": cached_count,
        "generated_topic_lessons": len(topics) - cached_count,
    }
    return hydrated_topics, diagnostics


def _synthesize_topic_lesson(topic: dict, bucket_evidence_index: dict[str, dict]) -> dict:
    bucket_entry = bucket_evidence_index[topic["bucket_id"]]
    evidence = _topic_evidence(topic, bucket_entry)
    prompt = _topic_lesson_prompt(topic, evidence, bucket_entry["bucket"])
    payload = _topic_lesson_payload(prompt, topic["label"])
    lesson = _normalize_lesson_payload(payload, topic, evidence)
    return lesson


def _topic_evidence(topic: dict, bucket_entry: dict) -> dict:
    bucket = bucket_entry["bucket"]
    evidence = bucket_entry["evidence"]
    planning_topic_id = str(topic.get("planning_topic_id") or topic["id"].split("topic:", 1)[-1])
    direct_matches = list(evidence["topic_evidence"].get(planning_topic_id, []))
    shared_chunks = list(evidence["general_chunks"])
    sibling_labels = [
        sibling["label"]
        for sibling in bucket["topics"]
        if sibling["id"] != planning_topic_id
    ]
    return {
        "direct_matches": direct_matches,
        "shared_chunks": shared_chunks,
        "sibling_labels": sibling_labels,
    }


def _topic_lesson_prompt(topic: dict, evidence: dict, bucket: dict) -> str:
    direct_blocks = []
    for index, match in enumerate(evidence["direct_matches"], start=1):
        chunk = match["chunk"]
        heading = " > ".join(chunk.get("heading_path") or [])
        direct_blocks.extend(
            [
                f"Direct evidence {index} | score={match['score']}",
                f"Chunk ID: {chunk['chunk_id']}",
                f"Module: {chunk.get('module_title') or chunk.get('module_id') or ''}",
                f"Resource label: {chunk.get('resource_label') or chunk['title']}",
                f"Source URL: {chunk['source_url']}",
                f"Heading: {heading}",
                chunk["text"][:1800],
                "",
            ]
        )

    shared_blocks = []
    for chunk in evidence["shared_chunks"]:
        heading = " > ".join(chunk.get("heading_path") or [])
        shared_blocks.extend(
            [
                f"Chunk ID: {chunk['chunk_id']}",
                f"Module: {chunk.get('module_title') or chunk.get('module_id') or ''}",
                f"Resource label: {chunk.get('resource_label') or chunk['title']}",
                f"Source URL: {chunk['source_url']}",
                f"Heading: {heading}",
                chunk["text"][:1400],
                "",
            ]
        )

    lesson_profile = dict(topic.get("lesson_profile") or {})
    outline = dict(topic.get("lesson_outline") or {})

    return f"""Return JSON only with this schema:
{{
  "introduction_lines": ["2-8 markdown lines"],
  "study_lines": ["3-10 markdown lines"],
  "subtopics": [
    {{
      "title": "required",
      "summary_lines": ["1-5 markdown lines"],
      "bullets": ["2-5 concise bullets"]
    }}
  ],
  "patterns": [
    {{
      "name": "required",
      "kind": "pattern | framework | heuristic | tradeoff",
      "summary_lines": ["1-4 markdown lines"],
      "signals": ["0-5 concise strings"]
    }}
  ],
  "common_pitfalls": ["0-8 concise strings"],
  "practice_items": [
    {{
      "kind": "problem | exercise | drill | checklist",
      "title": "required",
      "prompt_lines": ["1-5 markdown lines"],
      "difficulty": "intro | core | stretch"
    }}
  ]
}}

Write one canonical lesson for this topic only. Do not include references or source URLs in the JSON.

Topic:
- label: {topic['label']}
- aliases: {json.dumps(topic.get('aliases', []), ensure_ascii=False)}
- bucket: {bucket['label']}
- bucket summary: {bucket['summary']}
- family/profile: {json.dumps(lesson_profile, ensure_ascii=False)}
- curated prerequisites: {json.dumps(topic.get('prerequisites', []), ensure_ascii=False)}
- adjacent related topics: {json.dumps(topic.get('related_topics', []), ensure_ascii=False)}
- sibling topics in the same bucket: {json.dumps(evidence['sibling_labels'], ensure_ascii=False)}
- lesson outline: {json.dumps(outline, ensure_ascii=False, indent=2)}

Rules:
- This is the final lesson page for the topic.
- introduction_lines should explain what the topic is and why it matters.
- study_lines should tell the learner how to approach the topic, what to implement, and what to review.
- Produce 3-8 subtopics that align with the lesson outline.
- patterns should follow the lesson profile emphasis. Use tradeoff/framework style entries for systems/design/interview/career topics.
- Common pitfalls should be concrete mistakes or misconceptions.
- The practice section must be actionable.
- If allow_problem_items is false in the lesson profile, do not emit any practice item with kind "problem".
- If allow_problem_items is true, include at least two "problem" items and at least one non-problem item.
- Keep every section scoped to {topic['label']}. Do not drift into sibling topics unless explicitly comparing boundaries.
- Prefer evidence assigned directly to this topic. Use shared bucket evidence only to fill context or contrast.
- Do not mention article names, course platforms, or source-specific framing.

Direct evidence:
{chr(10).join(direct_blocks) if direct_blocks else "No direct evidence. Infer carefully from the outline and shared bucket context."}

Shared bucket context:
{chr(10).join(shared_blocks) if shared_blocks else "No extra shared bucket context."}
"""


def _topic_lesson_payload(prompt: str, topic_label: str) -> dict:
    raw_text = complete_prompt(
        prompt,
        max_tokens=5000,
        response_format={"type": "json_object"},
        reasoning={"enabled": False},
    )
    try:
        return json.loads(_strip_markdown_fences(raw_text))
    except json.JSONDecodeError as exc:
        progress_write(
            f"[LESSONS] Invalid JSON for {topic_label}; attempting response repair "
            f"({exc.msg} at char {exc.pos})"
        )

    repaired_text = complete_prompt(
        _json_repair_prompt(raw_text),
        max_tokens=5000,
        response_format={"type": "json_object"},
        reasoning={"enabled": False},
    )
    try:
        return json.loads(_strip_markdown_fences(repaired_text))
    except json.JSONDecodeError as exc:
        progress_write(
            f"[LESSONS] Repair failed for {topic_label}; retrying full generation "
            f"({exc.msg} at char {exc.pos})"
        )

    retry_text = complete_prompt(
        _strict_json_prompt(prompt),
        max_tokens=5000,
        response_format={"type": "json_object"},
        reasoning={"enabled": False},
    )
    try:
        return json.loads(_strip_markdown_fences(retry_text))
    except json.JSONDecodeError as exc:
        excerpt = _strip_markdown_fences(retry_text)[:600]
        raise RuntimeError(
            f"Topic lesson synthesis returned invalid JSON for {topic_label}: "
            f"{exc.msg} at char {exc.pos}. Response excerpt:\n{excerpt}"
        ) from exc


def _normalize_lesson_payload(payload: dict, topic: dict, evidence: dict) -> dict:
    introduction_markdown = _markdown_block(payload.get("introduction_lines"), limit=48)
    study_markdown = _markdown_block(payload.get("study_lines"), limit=64)
    subtopics = _normalize_subtopics(payload.get("subtopics"))
    patterns = _normalize_patterns(payload.get("patterns"))
    common_pitfalls = _clean_list(payload.get("common_pitfalls"), limit=8)
    practice_items = _normalize_practice_items(
        payload.get("practice_items"),
        allow_problem_items=bool(topic.get("lesson_profile", {}).get("allow_problem_items")),
    )
    references = _derive_references(evidence)

    return {
        "introduction_markdown": introduction_markdown,
        "study_markdown": study_markdown,
        "subtopics": subtopics,
        "patterns": patterns,
        "common_pitfalls": common_pitfalls,
        "practice_items": practice_items,
        "references": references,
    }


def _normalize_subtopics(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    subtopics = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        key = title.casefold()
        if not title or key in seen:
            continue
        seen.add(key)
        summary_markdown = _markdown_block(item.get("summary_lines"), limit=32)
        bullets = _clean_list(item.get("bullets"), limit=5)
        subtopics.append(
            {
                "title": title,
                "summary_markdown": summary_markdown,
                "bullets": bullets,
            }
        )
    return subtopics[:8]


def _normalize_patterns(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    patterns = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        key = name.casefold()
        kind = str(item.get("kind") or "").strip()
        if not name or key in seen or kind not in _ALLOWED_PATTERN_KINDS:
            continue
        seen.add(key)
        patterns.append(
            {
                "name": name,
                "kind": kind,
                "summary_markdown": _markdown_block(item.get("summary_lines"), limit=24),
                "signals": _clean_list(item.get("signals"), limit=5),
            }
        )
    return patterns[:8]


def _normalize_practice_items(value: object, *, allow_problem_items: bool) -> list[dict]:
    if not isinstance(value, list):
        return []
    items = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip()
        title = str(item.get("title") or "").strip()
        if kind not in _ALLOWED_PRACTICE_KINDS or not title:
            continue
        if not allow_problem_items and kind == "problem":
            continue
        key = (kind, title.casefold())
        if key in seen:
            continue
        seen.add(key)
        difficulty = str(item.get("difficulty") or "").strip()
        if difficulty not in _ALLOWED_DIFFICULTIES:
            difficulty = "core"
        items.append(
            {
                "kind": kind,
                "title": title,
                "prompt_markdown": _markdown_block(item.get("prompt_lines"), limit=32),
                "difficulty": difficulty,
            }
        )
    return items[:8]


def _derive_references(evidence: dict) -> list[dict]:
    references = {}

    def absorb(chunk: dict, kind: str) -> None:
        url = str(chunk.get("source_url") or "").strip()
        if not url:
            return
        label = str(chunk.get("resource_label") or chunk.get("title") or url).strip()
        existing = references.get(url)
        if existing is None:
            references[url] = {
                "label": label,
                "url": url,
                "kind": kind,
            }
            return
        rank = {"primary": 0, "practice": 1, "supporting": 2}
        if rank[kind] < rank[existing["kind"]]:
            existing["kind"] = kind
        if len(label) > len(existing["label"]):
            existing["label"] = label

    for match in evidence.get("direct_matches", []):
        chunk = match["chunk"]
        kind = "practice" if _is_practice_source(chunk) else "primary"
        absorb(chunk, kind)
    for chunk in evidence.get("shared_chunks", []):
        kind = "practice" if _is_practice_source(chunk) else "supporting"
        absorb(chunk, kind)

    rank = {"primary": 0, "practice": 1, "supporting": 2}
    return sorted(references.values(), key=lambda item: (rank[item["kind"]], item["label"].casefold(), item["url"]))[:12]


def _is_practice_source(chunk: dict) -> bool:
    module_id = str(chunk.get("module_id") or "")
    source_url = str(chunk.get("source_url") or "")
    label = str(chunk.get("resource_label") or chunk.get("title") or "")
    lowered = " ".join([module_id, source_url, label]).casefold()
    return "leetcode" in lowered or "problem" in lowered or "practice" in lowered


def _topic_lesson_cache_key(topic: dict, bucket_evidence_index: dict[str, dict]) -> str:
    evidence = _topic_evidence(topic, bucket_evidence_index[topic["bucket_id"]])
    parts = [
        topic["id"],
        json.dumps(topic.get("lesson_profile") or {}, sort_keys=True, ensure_ascii=False),
        json.dumps(topic.get("lesson_outline") or {}, sort_keys=True, ensure_ascii=False),
    ]
    for match in evidence["direct_matches"]:
        parts.append(match["chunk"]["chunk_id"])
    for chunk in evidence["shared_chunks"]:
        parts.append(chunk["chunk_id"])
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"{TOPIC_LESSON_CACHE_KEY_VERSION}:{PROCESSOR_MODEL}:{digest}"


def _clean_list(value: object, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = []
    seen = set()
    for item in value:
        text = str(item).strip()
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    return cleaned[:limit]


def _markdown_block(value: object, limit: int) -> str:
    return "\n".join(_clean_list(value, limit=limit)).strip()


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


def _json_repair_prompt(raw_text: str) -> str:
    return f"""Return valid JSON only.

Repair the following malformed JSON-like output without changing its meaning:
- preserve all keys and values
- escape all newlines inside JSON strings
- do not wrap the result in markdown fences

Malformed output:
{raw_text}
"""


def _strict_json_prompt(prompt: str) -> str:
    return f"""{prompt}

CRITICAL:
- Return strict JSON only.
- Ensure every string is fully quoted and escaped.
- Ensure all arrays and objects are fully closed.
- Do not include commentary before or after the JSON object.
"""
