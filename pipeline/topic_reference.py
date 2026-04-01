from __future__ import annotations

import re
from collections import Counter, defaultdict
from copy import deepcopy

from topic_names import normalize_topic_name


def build_reference_index(topics: list[dict]) -> dict:
    topics_by_id = {topic["id"]: topic for topic in topics}
    labels_by_key = {}
    aliases_by_key = defaultdict(set)
    simplified_labels_by_key = defaultdict(set)
    simplified_aliases_by_key = defaultdict(set)

    for topic in topics:
        canonical_label = topic["label"]
        normalized_label = normalize_topic_name(canonical_label)
        if normalized_label:
            labels_by_key[normalized_label] = canonical_label
            simplified = simplify_topic_name(canonical_label)
            if simplified:
                simplified_labels_by_key[simplified].add(canonical_label)

        for alias in topic.get("aliases", []):
            normalized_alias = normalize_topic_name(alias)
            if not normalized_alias:
                continue
            aliases_by_key[normalized_alias].add(canonical_label)
            simplified = simplify_topic_name(alias)
            if simplified:
                simplified_aliases_by_key[simplified].add(canonical_label)

    return {
        "topics_by_id": topics_by_id,
        "topics_by_label": {topic["label"]: topic for topic in topics},
        "labels_by_key": labels_by_key,
        "aliases_by_key": aliases_by_key,
        "simplified_labels_by_key": simplified_labels_by_key,
        "simplified_aliases_by_key": simplified_aliases_by_key,
    }


def prune_topic_aliases(topics: list[dict]) -> tuple[list[dict], dict]:
    canonical_labels_by_key = {
        normalize_topic_name(topic["label"]): topic["label"]
        for topic in topics
        if normalize_topic_name(topic["label"])
    }
    alias_owners = defaultdict(set)

    for topic in topics:
        for alias in topic.get("aliases", []):
            normalized_alias = normalize_topic_name(alias)
            if normalized_alias:
                alias_owners[normalized_alias].add(topic["label"])

    pruned_topics = []
    pruned_aliases = []

    for topic in topics:
        rewritten = deepcopy(topic)
        kept_aliases = []
        seen = set()
        for alias in topic.get("aliases", []):
            normalized_alias = normalize_topic_name(alias)
            if not normalized_alias or normalized_alias in seen:
                continue
            seen.add(normalized_alias)

            if normalized_alias == normalize_topic_name(topic["label"]):
                continue

            canonical_owner = canonical_labels_by_key.get(normalized_alias)
            if canonical_owner and canonical_owner != topic["label"]:
                pruned_aliases.append(
                    {
                        "topic_id": topic["id"],
                        "topic_label": topic["label"],
                        "alias": alias,
                        "reason": "conflicts_with_canonical_label",
                        "canonical_owner": canonical_owner,
                    }
                )
                continue

            alias_owners_for_key = alias_owners.get(normalized_alias, set())
            if len(alias_owners_for_key) > 1:
                pruned_aliases.append(
                    {
                        "topic_id": topic["id"],
                        "topic_label": topic["label"],
                        "alias": alias,
                        "reason": "shared_alias",
                        "other_topics": sorted(owner for owner in alias_owners_for_key if owner != topic["label"]),
                    }
                )
                continue

            kept_aliases.append(alias)

        rewritten["aliases"] = kept_aliases
        pruned_topics.append(rewritten)

    diagnostics = {
        "pruned_alias_count": len(pruned_aliases),
        "pruned_aliases": pruned_aliases,
    }
    return pruned_topics, diagnostics


def resolve_reference_label(
    reference_index: dict,
    value: str,
    *,
    current_topic_id: str | None = None,
) -> tuple[str | None, str, str | None]:
    topic, status, match_kind = resolve_reference_topic(
        reference_index,
        value,
        current_topic_id=current_topic_id,
    )
    if not topic:
        return None, status, match_kind
    return topic["label"], status, match_kind


def resolve_reference_topic(
    reference_index: dict,
    value: str,
    *,
    current_topic_id: str | None = None,
) -> tuple[dict | None, str, str | None]:
    normalized_value = normalize_topic_name(value)
    if not normalized_value:
        return None, "missing", None

    exact_label = reference_index["labels_by_key"].get(normalized_value)
    if exact_label:
        topic = reference_index["topics_by_label"][exact_label]
        if topic["id"] != current_topic_id:
            return topic, "resolved", "exact_label"

    exact_alias_candidates = _candidate_topics(
        reference_index,
        reference_index["aliases_by_key"].get(normalized_value, set()),
        current_topic_id=current_topic_id,
    )
    if len(exact_alias_candidates) == 1:
        return exact_alias_candidates[0], "resolved", "exact_alias"
    if len(exact_alias_candidates) > 1:
        return None, "ambiguous", "exact_alias"

    simplified_value = simplify_topic_name(value)
    if simplified_value:
        simplified_label_candidates = _candidate_topics(
            reference_index,
            reference_index["simplified_labels_by_key"].get(simplified_value, set()),
            current_topic_id=current_topic_id,
        )
        if len(simplified_label_candidates) == 1:
            return simplified_label_candidates[0], "resolved", "simplified_label"
        if len(simplified_label_candidates) > 1:
            return None, "ambiguous", "simplified_label"

        simplified_alias_candidates = _candidate_topics(
            reference_index,
            reference_index["simplified_aliases_by_key"].get(simplified_value, set()),
            current_topic_id=current_topic_id,
        )
        if len(simplified_alias_candidates) == 1:
            return simplified_alias_candidates[0], "resolved", "simplified_alias"
        if len(simplified_alias_candidates) > 1:
            return None, "ambiguous", "simplified_alias"

    return None, "missing", None


def summarize_reference_issues(issues: list[dict], *, top_n: int = 25) -> list[dict]:
    counts = Counter(issue.get("label", "") for issue in issues if str(issue.get("label", "")).strip())
    return [
        {"label": label, "count": count}
        for label, count in counts.most_common(top_n)
    ]


def simplify_topic_name(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    without_parentheticals = re.sub(r"\([^)]*\)", " ", raw)
    normalized = normalize_topic_name(without_parentheticals)
    if not normalized:
        return ""
    tokens = [_singularize_token(token) for token in normalized.split()]
    return " ".join(token for token in tokens if token)


def _candidate_topics(
    reference_index: dict,
    labels: set[str],
    *,
    current_topic_id: str | None,
) -> list[dict]:
    topics = [
        reference_index["topics_by_label"][label]
        for label in sorted(labels)
        if reference_index["topics_by_label"][label]["id"] != current_topic_id
    ]
    return topics


def _singularize_token(token: str) -> str:
    if len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:
        return f"{token[:-3]}y"
    if token.endswith("sses"):
        return token
    if token.endswith("ses") and token[:-2].endswith(("o", "x", "z")):
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token
