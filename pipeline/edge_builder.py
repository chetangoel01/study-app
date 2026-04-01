from __future__ import annotations

from collections import defaultdict

from topic_reference import build_reference_index, resolve_reference_topic, summarize_reference_issues


def build_topic_edges(
    topics: list[dict],
    *,
    include_diagnostics: bool = False,
) -> list[dict] | tuple[list[dict], dict]:
    reference_index = build_reference_index(topics)
    edge_map = {}
    diagnostics = {
        "missing_references": [],
        "ambiguous_references": [],
        "dropped_prerequisite_cycles": [],
    }
    prerequisite_candidates = []

    for topic in topics:
        for connection in topic.get("connections", []):
            if connection.get("relation") == "prerequisite":
                continue
            target, resolution, match_kind = resolve_reference_topic(
                reference_index,
                connection["label"],
                current_topic_id=topic["id"],
            )
            if not target:
                _record_reference_issue(
                    diagnostics,
                    resolution=resolution,
                    topic=topic,
                    label=connection["label"],
                    reference_kind="connection",
                    relation=connection.get("relation"),
                    match_kind=match_kind,
                )
                continue
            if connection["relation"] == "related":
                ordered = sorted([topic, target], key=lambda item: item["id"])
                _store_edge(
                    edge_map,
                    {
                        "from": ordered[0]["id"],
                        "to": ordered[1]["id"],
                        "type": "related",
                        "rationale": "",
                    },
                )
                continue
            _store_edge(
                edge_map,
                {
                    "from": topic["id"],
                    "to": target["id"],
                    "type": connection["relation"],
                    "rationale": connection.get("rationale", ""),
                },
            )

        for label in topic.get("prerequisites", []):
            target, resolution, match_kind = resolve_reference_topic(
                reference_index,
                label,
                current_topic_id=topic["id"],
            )
            if not target:
                _record_reference_issue(
                    diagnostics,
                    resolution=resolution,
                    topic=topic,
                    label=label,
                    reference_kind="prerequisite",
                    match_kind=match_kind,
                )
                continue
            prerequisite_candidates.append(
                {
                    "from_topic": target,
                    "to_topic": topic,
                    "label": label,
                    "reference_kind": "prerequisite",
                    "rationale": "",
                }
            )

        for label in topic.get("related_topics", []):
            target, resolution, match_kind = resolve_reference_topic(
                reference_index,
                label,
                current_topic_id=topic["id"],
            )
            if not target:
                _record_reference_issue(
                    diagnostics,
                    resolution=resolution,
                    topic=topic,
                    label=label,
                    reference_kind="related",
                    match_kind=match_kind,
                )
                continue
            ordered = tuple(sorted([topic["id"], target["id"]]))
            _store_edge(
                edge_map,
                {
                    "from": ordered[0],
                    "to": ordered[1],
                    "type": "related",
                    "rationale": "",
                },
            )

    prerequisite_graph = defaultdict(set)
    for candidate in sorted(prerequisite_candidates, key=_prerequisite_sort_key):
        edge = {
            "from": candidate["from_topic"]["id"],
            "to": candidate["to_topic"]["id"],
            "type": "prerequisite",
            "rationale": candidate["rationale"],
        }
        key = (edge["from"], edge["to"], edge["type"])
        if key in edge_map:
            if edge["rationale"] and not edge_map[key]["rationale"]:
                edge_map[key]["rationale"] = edge["rationale"]
            prerequisite_graph[edge["from"]].add(edge["to"])
            continue

        cycle_path = _find_path(prerequisite_graph, edge["to"], edge["from"])
        if cycle_path:
            diagnostics["dropped_prerequisite_cycles"].append(
                {
                    "from": edge["from"],
                    "to": edge["to"],
                    "from_label": candidate["from_topic"]["label"],
                    "to_label": candidate["to_topic"]["label"],
                    "label": candidate["label"],
                    "reference_kind": candidate["reference_kind"],
                    "cycle_path": [
                        _path_step(node_id=node_id, topics=topics)
                        for node_id in [*cycle_path, edge["to"]]
                    ],
                }
            )
            continue

        _store_edge(edge_map, edge)
        prerequisite_graph[edge["from"]].add(edge["to"])

    edges = sorted(edge_map.values(), key=lambda edge: (edge["type"], edge["from"], edge["to"]))
    diagnostics = _finalize_diagnostics(diagnostics)
    if include_diagnostics:
        return edges, diagnostics
    return edges

def _store_edge(edge_map: dict[tuple[str, str, str], dict], edge: dict) -> None:
    key = (edge["from"], edge["to"], edge["type"])
    existing = edge_map.get(key)
    if existing is None:
        edge_map[key] = edge
        return
    if edge["rationale"] and not existing["rationale"]:
        existing["rationale"] = edge["rationale"]


def _record_reference_issue(
    diagnostics: dict,
    *,
    resolution: str,
    topic: dict,
    label: str,
    reference_kind: str,
    relation: str | None = None,
    match_kind: str | None = None,
) -> None:
    issue = {
        "topic_id": topic["id"],
        "topic_label": topic["label"],
        "reference_kind": reference_kind,
        "label": str(label).strip(),
    }
    if relation:
        issue["relation"] = relation
    if match_kind:
        issue["match_kind"] = match_kind
    diagnostics[f"{resolution}_references"].append(issue)


def _prerequisite_sort_key(candidate: dict) -> tuple:
    return (
        0 if candidate["reference_kind"] == "prerequisite" else 1,
        candidate["to_topic"]["label"].casefold(),
        candidate["from_topic"]["label"].casefold(),
        str(candidate["label"]).casefold(),
    )


def _find_path(adjacency: dict[str, set[str]], start: str, goal: str) -> list[str] | None:
    if start == goal:
        return [goal]

    queue = [(start, [start])]
    seen = {start}
    while queue:
        node_id, path = queue.pop(0)
        for neighbor in sorted(adjacency.get(node_id, set())):
            if neighbor == goal:
                return [*path, neighbor]
            if neighbor in seen:
                continue
            seen.add(neighbor)
            queue.append((neighbor, [*path, neighbor]))
    return None


def _path_step(*, node_id: str, topics: list[dict]) -> dict:
    for topic in topics:
        if topic["id"] == node_id:
            return {"id": node_id, "label": topic["label"]}
    return {"id": node_id, "label": node_id}


def _finalize_diagnostics(diagnostics: dict) -> dict:
    missing_references = diagnostics["missing_references"]
    ambiguous_references = diagnostics["ambiguous_references"]
    dropped_cycles = diagnostics["dropped_prerequisite_cycles"]

    return {
        "missing_references": missing_references,
        "missing_reference_count": len(missing_references),
        "missing_reference_counts": _count_reference_kinds(missing_references),
        "missing_reference_labels": summarize_reference_issues(missing_references),
        "ambiguous_references": ambiguous_references,
        "ambiguous_reference_count": len(ambiguous_references),
        "ambiguous_reference_counts": _count_reference_kinds(ambiguous_references),
        "ambiguous_reference_labels": summarize_reference_issues(ambiguous_references),
        "dropped_prerequisite_cycles": dropped_cycles,
        "dropped_prerequisite_cycle_count": len(dropped_cycles),
    }


def _count_reference_kinds(issues: list[dict]) -> dict[str, int]:
    counts = {"connection": 0, "prerequisite": 0, "related": 0}
    for issue in issues:
        kind = str(issue.get("reference_kind") or "")
        counts[kind] = counts.get(kind, 0) + 1
    return counts
