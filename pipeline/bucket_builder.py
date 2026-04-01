from __future__ import annotations

from collections import defaultdict

from curriculum_ontology import CURRICULUM_BUCKETS, CURRICULUM_ONTOLOGY
from topic_names import normalize_topic_name
from topic_reference import simplify_topic_name

_HEADING_MATCH_WEIGHT = 8
_BODY_MATCH_WEIGHT = 3
_SIMPLIFIED_HEADING_MATCH_WEIGHT = 6
_SIMPLIFIED_BODY_MATCH_WEIGHT = 2
_FALLBACK_TOPIC_THRESHOLD = 4
_FALLBACK_TOPIC_MARGIN = 2
_MAX_CHUNK_TOPIC_MATCHES = 3
_BODY_SCAN_CHARS = 4500


def build_curriculum_buckets(
    chunks: list[dict],
    ontology: dict | None = None,
    bucket_defs: list[dict] | None = None,
) -> tuple[list[dict], dict]:
    ontology_data = ontology or CURRICULUM_ONTOLOGY
    buckets = bucket_defs or CURRICULUM_BUCKETS
    topics = ontology_data["topics"]
    topic_lookup = {topic["id"]: topic for topic in topics}
    bucket_lookup = {bucket["id"]: bucket for bucket in buckets}
    topic_to_bucket_id = {}
    module_to_bucket_ids = defaultdict(set)

    for bucket in buckets:
        for topic_id in bucket.get("topic_ids", []):
            topic_to_bucket_id[topic_id] = bucket["id"]
        for module_id in bucket.get("module_ids", []):
            module_to_bucket_ids[module_id].add(bucket["id"])

    matchers = {topic["id"]: _build_topic_matchers(topic) for topic in topics}
    bucket_state = {
        bucket["id"]: {
            "bucket_id": bucket["id"],
            "label": bucket["label"],
            "summary": bucket["summary"],
            "topic_ids": list(bucket.get("topic_ids", [])),
            "topics": [topic_lookup[topic_id] for topic_id in bucket.get("topic_ids", []) if topic_id in topic_lookup],
            "module_ids": list(bucket.get("module_ids", [])),
            "topic_matches": defaultdict(list),
            "general_chunks": [],
        }
        for bucket in buckets
    }

    assigned_chunk_ids = set()
    chunk_diagnostics = []

    for chunk in chunks:
        topic_scores = _score_chunk_against_topics(chunk, matchers)
        matched_topic_ids = _select_topic_ids(topic_scores)
        matched_bucket_ids = {
            topic_to_bucket_id[topic_id]
            for topic_id in matched_topic_ids
            if topic_id in topic_to_bucket_id
        }

        module_bucket_ids = module_to_bucket_ids.get(chunk["module_id"], set())
        if not matched_bucket_ids and module_bucket_ids:
            matched_bucket_ids = set(module_bucket_ids)

        if matched_bucket_ids:
            assigned_chunk_ids.add(chunk["chunk_id"])

        for topic_id in matched_topic_ids:
            bucket_id = topic_to_bucket_id.get(topic_id)
            if not bucket_id:
                continue
            bucket_state[bucket_id]["topic_matches"][topic_id].append(
                {
                    "chunk": chunk,
                    "score": topic_scores[topic_id],
                }
            )

        if not matched_topic_ids:
            for bucket_id in matched_bucket_ids:
                bucket_state[bucket_id]["general_chunks"].append(chunk)

        chunk_diagnostics.append(
            {
                "chunk_id": chunk["chunk_id"],
                "title": chunk["title"],
                "module_id": chunk["module_id"],
                "matched_topic_ids": matched_topic_ids,
                "matched_bucket_ids": sorted(matched_bucket_ids),
            }
        )

    built_buckets = []
    for bucket in buckets:
        state = bucket_state[bucket["id"]]
        topic_matches = {
            topic_id: sorted(matches, key=lambda item: (-item["score"], item["chunk"]["chunk_id"]))
            for topic_id, matches in state["topic_matches"].items()
        }
        source_urls = {
            match["chunk"]["source_url"]
            for matches in topic_matches.values()
            for match in matches
        }
        source_urls.update(chunk["source_url"] for chunk in state["general_chunks"])
        module_ids = {
            match["chunk"]["module_id"]
            for matches in topic_matches.values()
            for match in matches
        }
        module_ids.update(chunk["module_id"] for chunk in state["general_chunks"])

        built_buckets.append(
            {
                "bucket_id": state["bucket_id"],
                "label": state["label"],
                "summary": state["summary"],
                "topic_ids": state["topic_ids"],
                "topics": state["topics"],
                "module_ids": sorted(module_ids),
                "source_urls": sorted(source_urls),
                "topic_matches": topic_matches,
                "general_chunks": sorted(
                    state["general_chunks"],
                    key=lambda chunk: (chunk["module_id"], chunk["title"], chunk.get("ordinal", 0)),
                ),
            }
        )

    diagnostics = {
        "total_chunks": len(chunks),
        "assigned_chunks": len(assigned_chunk_ids),
        "unassigned_chunks": len(chunks) - len(assigned_chunk_ids),
        "bucket_chunk_counts": {
            bucket["bucket_id"]: sum(len(matches) for matches in bucket["topic_matches"].values()) + len(bucket["general_chunks"])
            for bucket in built_buckets
        },
        "chunk_diagnostics": chunk_diagnostics,
    }
    return built_buckets, diagnostics


def _build_topic_matchers(topic: dict) -> dict:
    exact_phrases = []
    simplified_phrases = []

    for raw in [topic["label"], *topic.get("aliases", [])]:
        normalized = normalize_topic_name(raw)
        simplified = simplify_topic_name(raw)
        if normalized:
            exact_phrases.append(normalized)
        if simplified:
            simplified_phrases.append(simplified)

    return {
        "exact": sorted(set(exact_phrases), key=lambda phrase: (-len(phrase.split()), phrase)),
        "simplified": sorted(set(simplified_phrases), key=lambda phrase: (-len(phrase.split()), phrase)),
    }


def _score_chunk_against_topics(chunk: dict, matchers: dict[str, dict]) -> dict[str, int]:
    heading_text = normalize_topic_name(
        " ".join(
            [
                str(chunk.get("title") or ""),
                str(chunk.get("segment_title") or ""),
                str(chunk.get("resource_label") or ""),
                *[str(part) for part in chunk.get("heading_path") or []],
            ]
        )
    )
    body_text = normalize_topic_name(str(chunk.get("text") or "")[:_BODY_SCAN_CHARS])

    scores = {}
    for topic_id, topic_matchers in matchers.items():
        score = 0
        for phrase in topic_matchers["exact"]:
            if _contains_phrase(heading_text, phrase):
                score = max(score, _HEADING_MATCH_WEIGHT + min(len(phrase.split()), 3))
            elif _contains_phrase(body_text, phrase):
                score = max(score, _BODY_MATCH_WEIGHT + min(len(phrase.split()), 2))
        for phrase in topic_matchers["simplified"]:
            if _contains_phrase(heading_text, phrase):
                score = max(score, _SIMPLIFIED_HEADING_MATCH_WEIGHT + min(len(phrase.split()), 2))
            elif _contains_phrase(body_text, phrase):
                score = max(score, _SIMPLIFIED_BODY_MATCH_WEIGHT + min(len(phrase.split()), 1))
        if score:
            scores[topic_id] = score
    return scores


def _select_topic_ids(scores: dict[str, int]) -> list[str]:
    if not scores:
        return []

    ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    strong_ids = [topic_id for topic_id, score in ranked if score >= _HEADING_MATCH_WEIGHT]
    if strong_ids:
        return strong_ids[:_MAX_CHUNK_TOPIC_MATCHES]

    top_score = ranked[0][1]
    if top_score < _FALLBACK_TOPIC_THRESHOLD:
        return []

    return [
        topic_id
        for topic_id, score in ranked
        if top_score - score <= _FALLBACK_TOPIC_MARGIN
    ][: _MAX_CHUNK_TOPIC_MATCHES]


def _contains_phrase(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    return f" {phrase} " in f" {text} "
