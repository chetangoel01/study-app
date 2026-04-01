from __future__ import annotations

import hashlib
import json
import time

from cache import cache_get, cache_set
from config import BUCKET_EVIDENCE_CHAR_BUDGET, BUCKET_TOPIC_CACHE_KEY_VERSION, BUCKET_TOPIC_CHUNK_LIMIT, PROCESSOR_MODEL
from curriculum_ontology import CURRICULUM_ONTOLOGY
from llm_client import complete_prompt
from progress import progress_bar, progress_write
from topic_names import normalize_topic_name, slugify_topic_name
from topic_reference import build_reference_index, resolve_reference_label

_VALID_RELATIONS = {"extends", "variant-of", "related"}
_ONTOLOGY_TOPICS_BY_ID = {topic["id"]: topic for topic in CURRICULUM_ONTOLOGY["topics"]}
_ONTOLOGY_REFERENCE_INDEX = build_reference_index(
    [
        {
            "id": topic["id"],
            "label": topic["label"],
            "aliases": list(topic.get("aliases", [])),
        }
        for topic in CURRICULUM_ONTOLOGY["topics"]
    ]
)
_ALLOWED_REFERENCE_LABELS = sorted(topic["label"] for topic in CURRICULUM_ONTOLOGY["topics"])
_OUTLINE_DEFAULT_SUBTOPICS = 4


def synthesize_bucket_topics(buckets: list[dict]) -> list[dict]:
    cache_keys = [_bucket_cache_key(bucket) for bucket in buckets]
    cached_payloads = [cache_get(cache_key, namespace="bucket_topic") for cache_key in cache_keys]
    cached_count = sum(1 for item in cached_payloads if isinstance(item, list))
    progress_write(
        f"[BUCKETS] {cached_count}/{len(buckets)} curriculum buckets cached; "
        f"{len(buckets) - cached_count} to generate with {PROCESSOR_MODEL}"
    )

    topics = []
    bar = progress_bar(total=len(buckets), desc="Synthesize buckets", unit="bucket")
    for index, (bucket, cached) in enumerate(zip(buckets, cached_payloads, strict=True), start=1):
        if isinstance(cached, list):
            topics.extend(cached)
            bar.update(1)
            continue

        progress_write(f"[BUCKETS {index}/{len(buckets)}] Generating {bucket['label']}")
        started_at = time.monotonic()
        bucket_topics = _synthesize_bucket(bucket)
        elapsed = time.monotonic() - started_at
        progress_write(
            f"[BUCKETS {index}/{len(buckets)}] Finished {bucket['label']} "
            f"with {len(bucket_topics)} topic blueprints in {elapsed:.1f}s"
        )
        topics.extend(bucket_topics)
        bar.update(1)
    bar.close()
    return topics


def build_bucket_evidence_index(buckets: list[dict]) -> dict[str, dict]:
    bucket_index = {}
    for bucket in buckets:
        evidence = _select_bucket_evidence(bucket)
        bucket_index[bucket["bucket_id"]] = {
            "bucket": bucket,
            "evidence": evidence,
        }
    return bucket_index


def _synthesize_bucket(bucket: dict) -> list[dict]:
    cache_key = _bucket_cache_key(bucket)
    cached = cache_get(cache_key, namespace="bucket_topic")
    if isinstance(cached, list):
        return cached

    evidence = _select_bucket_evidence(bucket)
    prompt = _bucket_prompt(bucket, evidence)
    payload = _bucket_payload(prompt, bucket["label"])

    payload_topics = payload.get("topics")
    if not isinstance(payload_topics, list):
        raise RuntimeError(f"Bucket synthesis returned invalid payload for {bucket['label']}")

    normalized_topics = _normalize_bucket_topics(bucket, evidence, payload_topics)
    cache_set(cache_key, normalized_topics, namespace="bucket_topic")
    return normalized_topics


def _normalize_bucket_topics(bucket: dict, evidence: dict, payload_topics: list[dict]) -> list[dict]:
    topic_lookup = {topic["id"]: topic for topic in bucket["topics"]}
    by_id = {}

    for payload_topic in payload_topics:
        if not isinstance(payload_topic, dict):
            continue
        planning_topic_id = str(payload_topic.get("planning_topic_id") or "").strip()
        if planning_topic_id not in topic_lookup or planning_topic_id in by_id:
            continue

        ontology_topic = topic_lookup[planning_topic_id]
        aliases = _merge_aliases(
            _ONTOLOGY_TOPICS_BY_ID.get(planning_topic_id, {}).get("aliases", []),
            payload_topic.get("aliases"),
            label=ontology_topic["label"],
            limit=16,
        )
        concepts = _clean_list(payload_topic.get("concepts"), limit=20)
        lesson_outline = _clean_lesson_outline(
            payload_topic.get("lesson_outline"),
            ontology_topic=ontology_topic,
            concepts=concepts,
        )
        if not concepts:
            concepts = _outline_concepts(lesson_outline)

        prerequisites = _canonicalize_reference_list(
            payload_topic.get("prerequisites"),
            current_topic_id=planning_topic_id,
            limit=12,
        )
        related_topics = _canonicalize_reference_list(
            payload_topic.get("related_topics"),
            current_topic_id=planning_topic_id,
            limit=12,
        )
        connections = _clean_connections(
            payload_topic.get("connections"),
            current_topic_id=planning_topic_id,
        )
        confidence = _coerce_confidence(payload_topic.get("confidence"))

        direct_chunks = [entry["chunk"] for entry in evidence["topic_evidence"].get(planning_topic_id, [])]
        shared_chunks = list(evidence["general_chunks"])
        evidence_chunks = direct_chunks + shared_chunks
        evidence_chunk_ids = sorted({chunk["chunk_id"] for chunk in evidence_chunks})
        source_urls = sorted({chunk["source_url"] for chunk in evidence_chunks})
        module_ids = sorted({chunk["module_id"] for chunk in evidence_chunks})

        by_id[planning_topic_id] = {
            "id": f"topic:{slugify_topic_name(ontology_topic['label'])}",
            "planning_topic_id": planning_topic_id,
            "slug": slugify_topic_name(ontology_topic["label"]),
            "label": ontology_topic["label"],
            "aliases": aliases,
            "concepts": concepts,
            "prerequisites": prerequisites,
            "related_topics": related_topics,
            "connections": connections,
            "evidence_chunk_ids": evidence_chunk_ids,
            "source_urls": source_urls,
            "module_ids": module_ids,
            "confidence": confidence,
            "bucket_id": bucket["bucket_id"],
            "bucket_label": bucket["label"],
            "lesson_profile": dict(ontology_topic.get("lesson_profile") or {}),
            "lesson_outline": lesson_outline,
        }

    missing_ids = [topic_id for topic_id in topic_lookup if topic_id not in by_id]
    if missing_ids:
        raise RuntimeError(
            f"Bucket synthesis for {bucket['label']} omitted ontology topics: {', '.join(missing_ids)}"
        )

    return [by_id[topic["id"]] for topic in bucket["topics"]]


def _bucket_payload(prompt: str, bucket_label: str) -> dict:
    raw_text = complete_prompt(
        prompt,
        max_tokens=12000,
        response_format={"type": "json_object"},
        reasoning={"enabled": False},
    )
    try:
        return json.loads(_strip_markdown_fences(raw_text))
    except json.JSONDecodeError as exc:
        progress_write(
            f"[BUCKETS] Invalid JSON for {bucket_label}; attempting response repair "
            f"({exc.msg} at char {exc.pos})"
        )

    repaired_text = complete_prompt(
        _json_repair_prompt(raw_text),
        max_tokens=12000,
        response_format={"type": "json_object"},
        reasoning={"enabled": False},
    )
    try:
        return json.loads(_strip_markdown_fences(repaired_text))
    except json.JSONDecodeError as exc:
        progress_write(
            f"[BUCKETS] Repair failed for {bucket_label}; retrying full generation "
            f"({exc.msg} at char {exc.pos})"
        )

    retry_text = complete_prompt(
        _strict_json_prompt(prompt),
        max_tokens=12000,
        response_format={"type": "json_object"},
        reasoning={"enabled": False},
    )
    try:
        return json.loads(_strip_markdown_fences(retry_text))
    except json.JSONDecodeError as exc:
        excerpt = _strip_markdown_fences(retry_text)[:600]
        raise RuntimeError(
            f"Bucket synthesis returned invalid JSON for {bucket_label}: "
            f"{exc.msg} at char {exc.pos}. Response excerpt:\n{excerpt}"
        ) from exc


def _bucket_prompt(bucket: dict, evidence: dict) -> str:
    topic_specs = []
    for topic in bucket["topics"]:
        topic_specs.append(
            {
                "planning_topic_id": topic["id"],
                "label": topic["label"],
                "aliases": list(topic.get("aliases", [])),
                "curated_prerequisites": list(topic.get("prerequisites", [])),
                "lesson_profile": dict(topic.get("lesson_profile") or {}),
            }
        )

    evidence_blocks = []
    for topic in bucket["topics"]:
        topic_id = topic["id"]
        evidence_blocks.append(f"## Topic: {topic['label']} ({topic_id})")
        matches = evidence["topic_evidence"].get(topic_id, [])
        if not matches:
            evidence_blocks.append("No direct lexical evidence matched this topic.")
            continue
        for index, match in enumerate(matches, start=1):
            chunk = match["chunk"]
            heading = " > ".join(chunk.get("heading_path") or [])
            evidence_blocks.extend(
                [
                    f"Evidence {index} | score={match['score']}",
                    f"Chunk ID: {chunk['chunk_id']}",
                    f"Module: {chunk.get('module_title') or chunk.get('module_id') or ''}",
                    f"Resource label: {chunk.get('resource_label') or chunk['title']}",
                    f"Source URL: {chunk['source_url']}",
                    f"Heading: {heading}",
                    chunk["text"][:1800],
                    "",
                ]
            )

    general_blocks = []
    for chunk in evidence["general_chunks"]:
        heading = " > ".join(chunk.get("heading_path") or [])
        general_blocks.extend(
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

    return f"""Return JSON only with this schema:
{{
  "topics": [
    {{
      "planning_topic_id": "one of the allowed topic ids",
      "label": "must exactly equal the ontology label for that topic id",
      "aliases": ["1-12 alternate names"],
      "concepts": ["5-20 concepts"],
      "prerequisites": ["0-12 canonical topic labels"],
      "related_topics": ["0-12 canonical topic labels"],
      "connections": [
        {{
          "label": "canonical topic label",
          "relation": "extends | variant-of | related",
          "rationale": "short explanation"
        }}
      ],
      "lesson_outline": {{
        "subtopic_titles": ["3-8 lesson section titles"],
        "pattern_candidates": ["0-6 candidate patterns, frameworks, or trade-offs"],
        "practice_focus": ["2-6 practice focus areas"],
        "scope_notes": ["2-6 boundary or emphasis notes"]
      }},
      "confidence": 0.0
    }}
  ]
}}

You are creating graph-safe curriculum blueprints for one bucket. Do not write the final long lesson here.

Rules:
- Produce exactly one topic object for every ontology topic listed below.
- planning_topic_id must be copied exactly from the ontology.
- label must exactly match the ontology label for that planning_topic_id.
- Synthesize from all supplied evidence for the bucket. Separate nearby topics clearly even when sources blur them together.
- concepts should be durable search/discovery terms, not sentence fragments.
- lesson_outline should define the eventual lesson shape for this topic, not restate the ontology label.
- subtopic_titles should be specific enough that a full lesson could be written from them.
- practice_focus should describe what the final practice section should train.
- scope_notes should explicitly keep adjacent topics separated when the evidence overlaps.
- prerequisites, related_topics, and connections labels must use only canonical labels from the allowed reference catalog below.
- If no allowed ontology topic fits a possible reference, omit that reference instead of inventing a new label.
- connection relation must be one of {sorted(_VALID_RELATIONS)}.

Bucket:
- id: {bucket['bucket_id']}
- label: {bucket['label']}
- summary: {bucket['summary']}

Ontology topics in this bucket:
{json.dumps(topic_specs, ensure_ascii=False, indent=2)}

Allowed cross-topic reference labels:
{json.dumps(_ALLOWED_REFERENCE_LABELS, ensure_ascii=False, indent=2)}

Evidence grouped by ontology topic:
{chr(10).join(evidence_blocks)}

Bucket-shared evidence:
{chr(10).join(general_blocks) if general_blocks else "No extra shared evidence."}
"""


def _select_bucket_evidence(bucket: dict) -> dict:
    topic_evidence = {}
    total_chars = 0

    for topic in bucket["topics"]:
        selected = []
        for match in bucket["topic_matches"].get(topic["id"], []):
            chunk = match["chunk"]
            estimated_chars = len(chunk["text"][:1800])
            if selected and len(selected) >= BUCKET_TOPIC_CHUNK_LIMIT:
                break
            if total_chars + estimated_chars > BUCKET_EVIDENCE_CHAR_BUDGET and selected:
                break
            selected.append(match)
            total_chars += estimated_chars
        topic_evidence[topic["id"]] = selected

    general_chunks = []
    for chunk in bucket.get("general_chunks", []):
        estimated_chars = len(chunk["text"][:1400])
        if total_chars + estimated_chars > BUCKET_EVIDENCE_CHAR_BUDGET and general_chunks:
            break
        general_chunks.append(chunk)
        total_chars += estimated_chars

    return {
        "topic_evidence": topic_evidence,
        "general_chunks": general_chunks,
    }


def _bucket_cache_key(bucket: dict) -> str:
    parts = [bucket["bucket_id"]]
    for topic in bucket["topics"]:
        parts.append(topic["id"])
        for match in bucket["topic_matches"].get(topic["id"], []):
            parts.append(match["chunk"]["chunk_id"])
    for chunk in bucket.get("general_chunks", []):
        parts.append(chunk["chunk_id"])
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"{BUCKET_TOPIC_CACHE_KEY_VERSION}:{PROCESSOR_MODEL}:{digest}"


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


def _clean_connections(value: object, *, current_topic_id: str) -> list[dict]:
    if not isinstance(value, list):
        return []
    cleaned = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        relation = str(item.get("relation") or "").strip()
        rationale = str(item.get("rationale") or "").strip()
        if relation not in _VALID_RELATIONS:
            continue
        label = _canonicalize_reference_label(
            item.get("label"),
            current_topic_id=current_topic_id,
        )
        if not label:
            continue
        key = (label.casefold(), relation)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(
            {
                "label": label,
                "relation": relation,
                "rationale": rationale,
            }
        )
    return cleaned


def _clean_lesson_outline(value: object, *, ontology_topic: dict, concepts: list[str]) -> dict:
    outline = value if isinstance(value, dict) else {}
    subtopic_titles = _clean_list(outline.get("subtopic_titles"), limit=8)
    pattern_candidates = _clean_list(outline.get("pattern_candidates"), limit=6)
    practice_focus = _clean_list(outline.get("practice_focus"), limit=6)
    scope_notes = _clean_list(outline.get("scope_notes"), limit=6)

    if len(subtopic_titles) < 3:
        for concept in concepts:
            if concept not in subtopic_titles:
                subtopic_titles.append(concept)
            if len(subtopic_titles) >= _OUTLINE_DEFAULT_SUBTOPICS:
                break
    if len(subtopic_titles) < 3:
        subtopic_titles.extend(
            title
            for title in [
                f"{ontology_topic['label']} foundations",
                f"{ontology_topic['label']} core techniques",
                f"{ontology_topic['label']} practice strategy",
            ]
            if title not in subtopic_titles
        )

    if not practice_focus:
        practice_focus = [
            f"Explain the core ideas behind {ontology_topic['label']}.",
            f"Apply {ontology_topic['label']} in realistic scenarios.",
            f"Review edge cases and trade-offs for {ontology_topic['label']}.",
        ]

    if not scope_notes:
        scope_notes = [f"Keep the lesson tightly scoped to {ontology_topic['label']}."]

    return {
        "subtopic_titles": subtopic_titles[:8],
        "pattern_candidates": pattern_candidates,
        "practice_focus": practice_focus[:6],
        "scope_notes": scope_notes[:6],
    }


def _outline_concepts(lesson_outline: dict) -> list[str]:
    concepts = []
    for key in ("subtopic_titles", "pattern_candidates"):
        for value in lesson_outline.get(key, []):
            if value not in concepts:
                concepts.append(value)
    return concepts[:20]


def _merge_aliases(*value_lists: object, label: str, limit: int) -> list[str]:
    label_key = normalize_topic_name(label)
    merged = []
    seen = set()
    for value_list in value_lists:
        if not isinstance(value_list, list):
            continue
        for value in value_list:
            text = str(value).strip()
            key = normalize_topic_name(text)
            if not text or not key or key == label_key or key in seen:
                continue
            seen.add(key)
            merged.append(text)
            if len(merged) >= limit:
                return merged
    return merged


def _canonicalize_reference_list(
    value: object,
    *,
    current_topic_id: str,
    limit: int,
) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = []
    seen = set()
    for item in value:
        label = _canonicalize_reference_label(item, current_topic_id=current_topic_id)
        if not label:
            continue
        key = normalize_topic_name(label)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(label)
        if len(cleaned) >= limit:
            break
    return cleaned


def _canonicalize_reference_label(value: object, *, current_topic_id: str) -> str | None:
    cleaned = str(value or "").strip()
    if not cleaned:
        return None
    canonical_label, _, _ = resolve_reference_label(
        _ONTOLOGY_REFERENCE_INDEX,
        cleaned,
        current_topic_id=current_topic_id,
    )
    return canonical_label


def _coerce_confidence(value: object) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        confidence = 0.5
    return max(0.0, min(1.0, confidence))


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
