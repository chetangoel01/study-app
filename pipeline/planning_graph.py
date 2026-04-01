from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy

from curriculum_ontology import CURRICULUM_ONTOLOGY
from topic_reference import build_reference_index, resolve_reference_label


def load_curriculum_ontology(ontology: dict | None = None) -> dict:
    data = deepcopy(ontology or CURRICULUM_ONTOLOGY)
    topics = data.get("topics")
    if not isinstance(topics, list) or not topics:
        raise RuntimeError("Curriculum ontology must contain a non-empty topics list")

    topic_ids = set()
    for topic in topics:
        topic_id = str(topic.get("id") or "").strip()
        if not topic_id:
            raise RuntimeError("Curriculum ontology topics must include an id")
        if topic_id in topic_ids:
            raise RuntimeError(f"Duplicate curriculum topic id: {topic_id}")
        topic_ids.add(topic_id)

    for topic in topics:
        for prerequisite_id in topic.get("prerequisites", []):
            if prerequisite_id not in topic_ids:
                raise RuntimeError(
                    f"Curriculum topic {topic['id']} references missing prerequisite {prerequisite_id}"
                )

    _ensure_acyclic_prerequisites(topics)
    return data


def build_planning_graph(topics: list[dict], ontology: dict | None = None) -> dict:
    ontology_data = load_curriculum_ontology(ontology)
    ontology_topics = ontology_data["topics"]
    ontology_lookup = {topic["id"]: topic for topic in ontology_topics}
    ontology_reference_topics = [
        {
            "id": f"planning:{topic['id']}",
            "label": topic["label"],
            "aliases": list(topic.get("aliases", [])),
        }
        for topic in ontology_topics
    ]
    reference_index = build_reference_index(ontology_reference_topics)

    mappings = []
    coverage = {
        topic["id"]: {
            "mapped_topic_ids": [],
            "module_ids": set(),
            "source_urls": set(),
            "coverage_score": 0,
            "matched_terms": [],
        }
        for topic in ontology_topics
    }
    unmapped_terms = Counter()

    for topic in topics:
        mapping = _map_synthesized_topic(topic, reference_index)
        mappings.append(mapping)
        for planning_topic_id, details in mapping["matched_topics"].items():
            entry = coverage[planning_topic_id]
            entry["mapped_topic_ids"].append(topic["id"])
            entry["module_ids"].update(topic.get("module_ids", []))
            entry["source_urls"].update(topic.get("source_urls", []))
            entry["coverage_score"] += details["score"]
            entry["matched_terms"].extend(details["terms"])
        for term in mapping["unmapped_terms"]:
            unmapped_terms[term] += 1

    planning_topics = []
    for topic in ontology_topics:
        topic_coverage = coverage[topic["id"]]
        planning_topics.append(
            {
                "id": f"planning:{topic['id']}",
                "planning_topic_id": topic["id"],
                "label": topic["label"],
                "aliases": list(topic.get("aliases", [])),
                "category": topic.get("category", ""),
                "covered": bool(topic_coverage["mapped_topic_ids"]),
                "mapped_topic_ids": sorted(set(topic_coverage["mapped_topic_ids"])),
                "module_ids": sorted(topic_coverage["module_ids"]),
                "source_urls": sorted(topic_coverage["source_urls"]),
                "coverage_score": topic_coverage["coverage_score"],
                "matched_terms": _top_terms(topic_coverage["matched_terms"]),
            }
        )

    planning_edges = []
    for topic in ontology_topics:
        for prerequisite_id in topic.get("prerequisites", []):
            planning_edges.append(
                {
                    "from": f"planning:{prerequisite_id}",
                    "to": f"planning:{topic['id']}",
                    "type": "prerequisite",
                    "rationale": "curated_curriculum_ontology",
                }
            )

    covered_topics = [topic for topic in planning_topics if topic["covered"]]
    validation = {
        "ontology_version": ontology_data.get("version", 1),
        "total_planning_topics": len(planning_topics),
        "covered_planning_topics": len(covered_topics),
        "uncovered_planning_topics": len(planning_topics) - len(covered_topics),
        "mapped_synthesized_topics": sum(1 for mapping in mappings if mapping["planning_topic_ids"]),
        "unmapped_synthesized_topics": sum(1 for mapping in mappings if not mapping["planning_topic_ids"]),
        "total_planning_edges": len(planning_edges),
        "unmapped_terms": [
            {"label": label, "count": count}
            for label, count in unmapped_terms.most_common(25)
        ],
    }

    return {
        "planning_topics": planning_topics,
        "planning_topic_edges": planning_edges,
        "planning_mappings": mappings,
        "planning_validation": validation,
    }


def _map_synthesized_topic(topic: dict, reference_index: dict) -> dict:
    primary_matches, primary_unmapped = _match_terms(reference_index, _primary_weighted_terms(topic))
    evidence_matches, evidence_unmapped = _match_terms(reference_index, _evidence_weighted_terms(topic))
    selected_ids, selection_source = _select_planning_topic_ids(primary_matches, evidence_matches)
    selected_match_pool = primary_matches if selection_source == "primary" else evidence_matches
    filtered_matches = {
        planning_topic_id: selected_match_pool[planning_topic_id]
        for planning_topic_id in selected_ids
    }

    return {
        "topic_id": topic["id"],
        "topic_label": topic["label"],
        "planning_topic_ids": selected_ids,
        "selection_source": selection_source,
        "primary_match_topic_ids": sorted(primary_matches),
        "evidence_match_topic_ids": sorted(evidence_matches),
        "primary_matches": dict(primary_matches),
        "evidence_matches": dict(evidence_matches),
        "matched_topics": filtered_matches,
        "unmapped_terms": primary_unmapped + evidence_unmapped,
    }


def _primary_weighted_terms(topic: dict) -> list[tuple[str, int]]:
    weighted_terms = []
    weighted_terms.extend((topic["label"], 10) for _ in [0] if str(topic.get("label") or "").strip())
    weighted_terms.extend((alias, 8) for alias in topic.get("aliases", []) if str(alias).strip())
    return weighted_terms


def _evidence_weighted_terms(topic: dict) -> list[tuple[str, int]]:
    weighted_terms = []
    weighted_terms.extend((concept, 3) for concept in topic.get("concepts", []) if str(concept).strip())
    weighted_terms.extend((label, 3) for label in topic.get("prerequisites", []) if str(label).strip())
    weighted_terms.extend((label, 2) for label in topic.get("related_topics", []) if str(label).strip())
    weighted_terms.extend(
        (connection.get("label"), 3)
        for connection in topic.get("connections", [])
        if str(connection.get("label") or "").strip()
    )
    return weighted_terms


def _match_terms(reference_index: dict, weighted_terms: list[tuple[str, int]]) -> tuple[dict, list[str]]:
    matched_topics = defaultdict(lambda: {"score": 0, "terms": []})
    unmapped_terms = []

    for term, weight in weighted_terms:
        canonical_label, status, _ = resolve_reference_label(reference_index, term)
        if not canonical_label:
            if status == "missing":
                unmapped_terms.append(term)
            continue
        planning_topic_id = reference_index["topics_by_label"][canonical_label]["id"].split("planning:", 1)[-1]
        matched_topics[planning_topic_id]["score"] += weight
        matched_topics[planning_topic_id]["terms"].append(term)

    return dict(matched_topics), unmapped_terms


def _select_planning_topic_ids(
    primary_matches: dict,
    evidence_matches: dict,
) -> tuple[list[str], str]:
    primary_ids = _select_primary_topic_ids(primary_matches)
    if primary_ids:
        return primary_ids, "primary"

    fallback_ids = _select_clear_fallback_topic_ids(evidence_matches)
    if fallback_ids:
        return fallback_ids, "evidence"

    return [], "none"


def _select_primary_topic_ids(matches: dict, *, min_score: int = 8) -> list[str]:
    if not matches:
        return []

    ranked = sorted(
        matches.items(),
        key=lambda item: (-item[1]["score"], item[0]),
    )
    strong_ids = [planning_topic_id for planning_topic_id, details in ranked if details["score"] >= min_score]
    return strong_ids


def _select_clear_fallback_topic_ids(
    matches: dict,
    *,
    min_score: int = 6,
    min_margin: int = 3,
) -> list[str]:
    if not matches:
        return []

    ranked = sorted(
        matches.items(),
        key=lambda item: (-item[1]["score"], item[0]),
    )
    best_topic_id, best_details = ranked[0]
    if best_details["score"] < min_score:
        return []

    if len(ranked) > 1:
        second_score = ranked[1][1]["score"]
        if best_details["score"] - second_score < min_margin:
            return []

    return [best_topic_id]


def _top_terms(terms: list[str], *, limit: int = 8) -> list[str]:
    counts = Counter(str(term).strip() for term in terms if str(term).strip())
    return [label for label, _count in counts.most_common(limit)]


def _ensure_acyclic_prerequisites(topics: list[dict]) -> None:
    adjacency = {topic["id"]: list(topic.get("prerequisites", [])) for topic in topics}
    visiting = set()
    visited = set()

    def visit(topic_id: str) -> None:
        if topic_id in visited:
            return
        if topic_id in visiting:
            raise RuntimeError(f"Cycle detected in curriculum ontology at {topic_id}")
        visiting.add(topic_id)
        for prerequisite_id in adjacency.get(topic_id, []):
            visit(prerequisite_id)
        visiting.remove(topic_id)
        visited.add(topic_id)

    for topic_id in adjacency:
        visit(topic_id)
