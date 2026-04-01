from __future__ import annotations

from copy import deepcopy

from topic_names import normalize_topic_name, slugify_topic_name
from topic_reference import build_reference_index, prune_topic_aliases, resolve_reference_label


def canonicalize_topics(topics: list[dict]) -> tuple[list[dict], dict]:
    grouped_topics: dict[str, list[dict]] = {}
    topic_order: list[str] = []

    for topic in topics:
        key = normalize_topic_name(topic.get("label", "")) or str(topic.get("id") or "")
        if key not in grouped_topics:
            grouped_topics[key] = []
            topic_order.append(key)
        grouped_topics[key].append(topic)

    canonical_topics = []
    duplicate_groups = []

    for key in topic_order:
        group = grouped_topics[key]
        merged_topic = _merge_topic_group(group)
        canonical_topics.append(merged_topic)
        if len(group) > 1:
            duplicate_groups.append(
                {
                    "normalized_label": key,
                    "canonical_topic_id": merged_topic["id"],
                    "canonical_label": merged_topic["label"],
                    "merged_topic_ids": [str(topic.get("id") or "") for topic in group],
                    "merged_labels": [str(topic.get("label") or "") for topic in group],
                }
            )

    canonical_topics, alias_diagnostics = prune_topic_aliases(canonical_topics)
    reference_index = build_reference_index(canonical_topics)
    rewritten_topics = [_rewrite_topic_references(topic, reference_index) for topic in canonical_topics]
    rewritten_topics.sort(key=lambda topic: (topic["label"].casefold(), topic["id"]))
    duplicate_groups.sort(key=lambda group: (group["canonical_label"].casefold(), group["canonical_topic_id"]))

    diagnostics = {
        "input_topic_count": len(topics),
        "output_topic_count": len(rewritten_topics),
        "merged_topic_count": len(topics) - len(rewritten_topics),
        "duplicate_groups": duplicate_groups,
        **alias_diagnostics,
    }
    return rewritten_topics, diagnostics


def validate_topic_lessons(topics: list[dict]) -> tuple[list[dict], dict]:
    validated_topics = []
    invalid_topics = []

    for topic in topics:
        rewritten = deepcopy(topic)
        lesson = _repair_topic_lesson(rewritten)
        rewritten["lesson"] = lesson
        errors = _lesson_errors(rewritten, lesson)
        if errors:
            invalid_topics.append(
                {
                    "topic_id": rewritten.get("id"),
                    "label": rewritten.get("label"),
                    "errors": errors,
                }
            )
            continue

        rewritten_lesson = deepcopy(lesson)
        rewritten_lesson["lesson_markdown"] = _assemble_lesson_markdown(rewritten["label"], rewritten_lesson)
        rewritten["lesson"] = rewritten_lesson
        rewritten["study_guide_markdown"] = rewritten_lesson["lesson_markdown"]
        rewritten["concepts"] = _merge_text_values(
            rewritten.get("concepts", []),
            [item.get("title", "") for item in rewritten_lesson.get("subtopics", [])],
            [item.get("name", "") for item in rewritten_lesson.get("patterns", [])],
        )[:20]
        validated_topics.append(rewritten)

    diagnostics = {
        "validated_topic_count": len(validated_topics),
        "invalid_topic_count": len(invalid_topics),
        "invalid_topics": invalid_topics,
    }

    if invalid_topics:
        formatted = "; ".join(
            f"{entry['label']}: {', '.join(entry['errors'])}"
            for entry in invalid_topics[:10]
        )
        raise RuntimeError(f"Topic lesson validation failed for {len(invalid_topics)} topic(s): {formatted}")

    return validated_topics, diagnostics


def _merge_topic_group(group: list[dict]) -> dict:
    ranked_group = sorted(group, key=_topic_rank_key)
    primary = ranked_group[0]
    merged_topic = deepcopy(primary)

    merged_label = _clean_text(primary.get("label", "")) or str(primary.get("id") or "Topic")
    merged_topic["label"] = merged_label
    merged_topic["slug"] = slugify_topic_name(merged_label)
    merged_topic["id"] = f"topic:{merged_topic['slug']}"
    merged_topic["aliases"] = _merge_text_values(
        [topic.get("label", "") for topic in ranked_group],
        *[topic.get("aliases", []) for topic in ranked_group],
        exclude={merged_label},
    )
    merged_topic["concepts"] = _merge_text_values(*(topic.get("concepts", []) for topic in ranked_group))
    merged_topic["prerequisites"] = _merge_text_values(
        *(topic.get("prerequisites", []) for topic in ranked_group)
    )
    merged_topic["related_topics"] = _merge_text_values(
        *(topic.get("related_topics", []) for topic in ranked_group)
    )
    merged_topic["connections"] = _merge_connections(*(topic.get("connections", []) for topic in ranked_group))
    merged_topic["evidence_chunk_ids"] = sorted(
        {
            str(chunk_id)
            for topic in ranked_group
            for chunk_id in topic.get("evidence_chunk_ids", [])
            if str(chunk_id).strip()
        }
    )
    merged_topic["source_urls"] = sorted(
        {
            str(source_url)
            for topic in ranked_group
            for source_url in topic.get("source_urls", [])
            if str(source_url).strip()
        }
    )
    merged_topic["module_ids"] = sorted(
        {
            str(module_id)
            for topic in ranked_group
            for module_id in topic.get("module_ids", [])
            if str(module_id).strip()
        }
    )
    merged_topic["confidence"] = max(_topic_confidence(topic) for topic in ranked_group)
    merged_topic["study_guide_markdown"] = _best_study_guide(ranked_group)

    return merged_topic


def _rewrite_topic_references(topic: dict, reference_index: dict) -> dict:
    rewritten = deepcopy(topic)
    current_label = rewritten["label"]
    current_terms = {
        normalize_topic_name(value)
        for value in [rewritten["label"], *rewritten.get("aliases", [])]
        if normalize_topic_name(value)
    }
    rewritten["prerequisites"] = _rewrite_label_list(
        rewritten.get("prerequisites", []),
        current_label=current_label,
        current_topic_id=rewritten["id"],
        current_terms=current_terms,
        reference_index=reference_index,
    )
    rewritten["related_topics"] = _rewrite_label_list(
        rewritten.get("related_topics", []),
        current_label=current_label,
        current_topic_id=rewritten["id"],
        current_terms=current_terms,
        reference_index=reference_index,
    )

    rewritten_connections = []
    seen = set()
    for connection in rewritten.get("connections", []):
        if not isinstance(connection, dict):
            continue
        label = _clean_text(connection.get("label", ""))
        if not label:
            continue
        canonical_label = _canonical_reference_label(
            label,
            current_label=current_label,
            current_topic_id=rewritten["id"],
            current_terms=current_terms,
            reference_index=reference_index,
        )
        if canonical_label is None:
            continue
        relation = str(connection.get("relation") or "").strip()
        rationale = str(connection.get("rationale") or "").strip()
        key = (normalize_topic_name(canonical_label), relation)
        if key in seen:
            continue
        seen.add(key)
        rewritten_connections.append(
            {
                "label": canonical_label,
                "relation": relation,
                "rationale": rationale,
            }
        )

    rewritten["connections"] = rewritten_connections
    return rewritten

def _rewrite_label_list(
    values: list[str],
    *,
    current_label: str,
    current_topic_id: str,
    current_terms: set[str],
    reference_index: dict,
) -> list[str]:
    rewritten = []
    seen = set()
    for value in values:
        canonical_label = _canonical_reference_label(
            value,
            current_label=current_label,
            current_topic_id=current_topic_id,
            current_terms=current_terms,
            reference_index=reference_index,
        )
        if canonical_label is None:
            continue
        key = normalize_topic_name(canonical_label)
        if key in seen:
            continue
        seen.add(key)
        rewritten.append(canonical_label)
    return rewritten


def _canonical_reference_label(
    value: str,
    *,
    current_label: str,
    current_topic_id: str,
    current_terms: set[str],
    reference_index: dict,
) -> str | None:
    cleaned_value = _clean_text(value)
    normalized_value = normalize_topic_name(cleaned_value)
    if not normalized_value:
        return None
    if normalized_value in current_terms:
        return None
    canonical_label, _, _ = resolve_reference_label(
        reference_index,
        cleaned_value,
        current_topic_id=current_topic_id,
    )
    return canonical_label


def _merge_connections(*connection_lists: list[dict]) -> list[dict]:
    merged = []
    positions = {}

    for connection_list in connection_lists:
        for connection in connection_list:
            if not isinstance(connection, dict):
                continue
            label = _clean_text(connection.get("label", ""))
            relation = str(connection.get("relation") or "").strip()
            rationale = str(connection.get("rationale") or "").strip()
            if not label or not relation:
                continue
            key = (normalize_topic_name(label), relation)
            if key in positions:
                existing = merged[positions[key]]
                if rationale and not existing["rationale"]:
                    existing["rationale"] = rationale
                continue
            positions[key] = len(merged)
            merged.append({"label": label, "relation": relation, "rationale": rationale})

    return merged


def _merge_text_values(*value_lists: list[str], exclude: set[str] | None = None) -> list[str]:
    excluded = {normalize_topic_name(value) for value in (exclude or set()) if _clean_text(value)}
    merged = []
    seen = set()

    for value_list in value_lists:
        for value in value_list:
            cleaned_value = _clean_text(value)
            normalized = normalize_topic_name(cleaned_value)
            if not cleaned_value or normalized in seen or normalized in excluded:
                continue
            seen.add(normalized)
            merged.append(cleaned_value)

    return merged


def _best_study_guide(topics: list[dict]) -> str:
    guides = [
        str(topic.get("study_guide_markdown") or "").strip()
        for topic in topics
        if str(topic.get("study_guide_markdown") or "").strip()
    ]
    if not guides:
        return ""
    return max(guides, key=len)


def _lesson_errors(topic: dict, lesson: dict | None) -> list[str]:
    if not isinstance(lesson, dict):
        return ["missing lesson payload"]

    errors = []
    introduction = str(lesson.get("introduction_markdown") or "").strip()
    study = str(lesson.get("study_markdown") or "").strip()
    subtopics = lesson.get("subtopics")
    patterns = lesson.get("patterns")
    common_pitfalls = lesson.get("common_pitfalls")
    practice_items = lesson.get("practice_items")
    references = lesson.get("references")

    if not introduction:
        errors.append("missing introduction_markdown")
    if not study:
        errors.append("missing study_markdown")
    if not isinstance(subtopics, list) or not 3 <= len(subtopics) <= 8:
        errors.append("subtopics must contain 3-8 entries")
    if not isinstance(practice_items, list) or not 3 <= len(practice_items) <= 8:
        errors.append("practice_items must contain 3-8 entries")
    if not isinstance(references, list) or not references:
        errors.append("references must contain at least one entry")
    if not isinstance(patterns, list):
        errors.append("patterns must be a list")
    if not isinstance(common_pitfalls, list):
        errors.append("common_pitfalls must be a list")

    lesson_profile = topic.get("lesson_profile") or {}
    practice_minimums = lesson_profile.get("practice_minimums") or {}
    allow_problem_items = bool(lesson_profile.get("allow_problem_items"))
    emphasis_sections = set(lesson_profile.get("emphasis_sections") or [])

    if isinstance(patterns, list) and emphasis_sections.intersection({"patterns", "frameworks", "tradeoffs"}) and not patterns:
        errors.append("patterns required by lesson profile")

    if isinstance(practice_items, list):
        practice_counts = {}
        for item in practice_items:
            kind = str(item.get("kind") or "").strip()
            practice_counts[kind] = practice_counts.get(kind, 0) + 1
        if not allow_problem_items and practice_counts.get("problem", 0):
            errors.append("problem practice items not allowed for this topic")
        for kind, minimum in practice_minimums.items():
            if kind == "total":
                if len(practice_items) < int(minimum):
                    errors.append(f"practice_items require at least {minimum} total entries")
                continue
            if practice_counts.get(kind, 0) < int(minimum):
                errors.append(f"practice_items require at least {minimum} {kind} entries")

    for item in subtopics or []:
        if not str(item.get("title") or "").strip():
            errors.append("subtopic missing title")
            break
        if not str(item.get("summary_markdown") or "").strip():
            errors.append("subtopic missing summary_markdown")
            break

    for item in patterns or []:
        if not str(item.get("name") or "").strip():
            errors.append("pattern missing name")
            break
        if not str(item.get("summary_markdown") or "").strip():
            errors.append("pattern missing summary_markdown")
            break

    for item in practice_items or []:
        if not str(item.get("title") or "").strip():
            errors.append("practice item missing title")
            break
        if not str(item.get("prompt_markdown") or "").strip():
            errors.append("practice item missing prompt_markdown")
            break

    for item in references or []:
        if not str(item.get("label") or "").strip() or not str(item.get("url") or "").strip():
            errors.append("reference missing label or url")
            break

    return errors


def _repair_topic_lesson(topic: dict) -> dict | None:
    lesson = topic.get("lesson")
    if not isinstance(lesson, dict):
        return lesson

    rewritten = deepcopy(lesson)
    repaired_patterns = []
    for item in rewritten.get("patterns") or []:
        if not isinstance(item, dict):
            continue
        candidate = deepcopy(item)
        if not str(candidate.get("summary_markdown") or "").strip():
            candidate["summary_markdown"] = _fallback_pattern_summary(
                label=topic.get("label", "this topic"),
                name=str(candidate.get("name") or "").strip(),
                kind=str(candidate.get("kind") or "").strip(),
            )
        repaired_patterns.append(candidate)
    rewritten["patterns"] = repaired_patterns

    repaired_references = []
    for item in rewritten.get("references") or []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("url") or "").strip()
        url = str(item.get("url") or "").strip()
        kind = str(item.get("kind") or "").strip() or _fallback_reference_kind(url)
        if not label or not url:
            continue
        repaired_references.append({"label": label, "url": url, "kind": kind})
    if not repaired_references:
        repaired_references = _fallback_references(topic)
    rewritten["references"] = repaired_references[:12]
    return rewritten


def _fallback_pattern_summary(*, label: str, name: str, kind: str) -> str:
    if not name:
        return ""
    if kind == "tradeoff":
        return f"Use {name} to reason about trade-offs inside {label}."
    if kind == "framework":
        return f"Use {name} as a repeatable framework when working through {label}."
    if kind == "heuristic":
        return f"Use {name} as a quick heuristic when analyzing {label}."
    return f"Use {name} as a recurring pattern when studying or practicing {label}."


def _fallback_references(topic: dict) -> list[dict]:
    return [
        {
            "label": source_url,
            "url": source_url,
            "kind": _fallback_reference_kind(source_url),
        }
        for source_url in topic.get("source_urls", [])
        if str(source_url).strip()
    ]


def _fallback_reference_kind(source_url: str) -> str:
    lowered = str(source_url or "").casefold()
    if "leetcode" in lowered or "practice" in lowered or "problem" in lowered:
        return "practice"
    return "supporting"


def _assemble_lesson_markdown(label: str, lesson: dict) -> str:
    sections = [f"# {label}"]

    sections.append("## Introduction")
    sections.append(str(lesson.get("introduction_markdown") or "").strip())

    sections.append("## How to Study")
    sections.append(str(lesson.get("study_markdown") or "").strip())

    sections.append("## Key Topics")
    for subtopic in lesson.get("subtopics", []):
        sections.append(f"### {subtopic['title']}")
        sections.append(str(subtopic.get("summary_markdown") or "").strip())
        bullets = subtopic.get("bullets") or []
        if bullets:
            sections.extend(f"- {bullet}" for bullet in bullets)

    if lesson.get("patterns"):
        sections.append("## Patterns and Frameworks")
        for item in lesson["patterns"]:
            sections.append(f"### {item['name']}")
            sections.append(str(item.get("summary_markdown") or "").strip())
            signals = item.get("signals") or []
            if signals:
                sections.extend(f"- Signal: {signal}" for signal in signals)

    if lesson.get("common_pitfalls"):
        sections.append("## Common Pitfalls")
        sections.extend(f"- {pitfall}" for pitfall in lesson["common_pitfalls"])

    sections.append("## Practice")
    for item in lesson.get("practice_items", []):
        sections.append(f"### {item['title']} ({item['kind']}, {item['difficulty']})")
        sections.append(str(item.get("prompt_markdown") or "").strip())

    sections.append("## References")
    for item in lesson.get("references", []):
        sections.append(f"- [{item['label']}]({item['url']})")

    return "\n".join(part for part in sections if part).strip()


def _topic_rank_key(topic: dict) -> tuple:
    return (
        -len(topic.get("evidence_chunk_ids", [])),
        -len(topic.get("source_urls", [])),
        -_topic_confidence(topic),
        -len(str(topic.get("study_guide_markdown") or "")),
        _clean_text(topic.get("label", "")).casefold(),
        str(topic.get("id") or ""),
    )


def _topic_confidence(topic: dict) -> float:
    try:
        return float(topic.get("confidence", 0.0))
    except (TypeError, ValueError):
        return 0.0


def _clean_text(value: object) -> str:
    return " ".join(str(value or "").strip().split())
