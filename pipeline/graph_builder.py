from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from itertools import combinations


def build_knowledge_graph(modules: dict[str, dict]) -> dict:
    concept_nodes: dict[str, dict] = {}
    resource_nodes: list[dict] = []
    covers_edges: list[dict] = []
    resource_concepts: dict[str, set[str]] = {}
    concept_to_resources: dict[str, set[str]] = defaultdict(set)
    pair_overlap_counts: dict[tuple[str, str], int] = defaultdict(int)

    for module_id, module_data in modules.items():
        for resource in module_data.get("resources", []):
            resource_id = _resource_id(module_id, resource)
            concept_ids = []
            concepts = _clean_concepts(resource.get("concepts", []))

            resource_nodes.append(
                {
                    "id": resource_id,
                    "kind": "resource",
                    "label": resource["label"],
                    "description": str(resource.get("summary", "")).strip(),
                    "modules": [module_id],
                    "frequency": 1,
                    "module_id": module_id,
                    "url": resource["url"],
                    "resource_type": resource.get("type"),
                    "difficulty": resource.get("difficulty"),
                }
            )

            for concept in concepts:
                concept_id = _concept_id(concept)
                concept_ids.append(concept_id)

                node = concept_nodes.setdefault(
                    concept_id,
                    {
                        "id": concept_id,
                        "kind": "concept",
                        "label": concept,
                        "description": "",
                        "modules": set(),
                        "frequency": 0,
                    },
                )
                node["modules"].add(module_id)
                node["frequency"] += 1
                concept_to_resources[concept_id].add(resource_id)

                covers_edges.append(
                    {
                        "from": resource_id,
                        "to": concept_id,
                        "type": "covers",
                        "weight": 1.0,
                    }
                )

            resource_concepts[resource_id] = set(concept_ids)

            for left_id, right_id in combinations(sorted(set(concept_ids)), 2):
                pair_overlap_counts[(left_id, right_id)] += 1

    for concept_id, node in concept_nodes.items():
        modules_list = sorted(node["modules"])
        node["modules"] = modules_list
        node["description"] = (
            f"Covered in {len(concept_to_resources[concept_id])} resources across {len(modules_list)} modules."
        )

    related_resource_edges = _build_related_resource_edges(resource_concepts)
    related_concept_edges = _build_related_concept_edges(concept_nodes, pair_overlap_counts)

    nodes = sorted(resource_nodes, key=lambda node: (node["kind"], node["label"].lower(), node["id"]))
    nodes.extend(sorted(concept_nodes.values(), key=lambda node: (node["kind"], node["label"].lower(), node["id"])))

    edges = covers_edges + related_resource_edges + related_concept_edges
    edges.sort(key=lambda edge: (edge["type"], edge["from"], edge["to"]))

    return {"nodes": nodes, "edges": edges}


def _build_related_resource_edges(resource_concepts: dict[str, set[str]]) -> list[dict]:
    resource_ids = sorted(resource_concepts)
    edges = []

    for left_id, right_id in combinations(resource_ids, 2):
        left_concepts = resource_concepts[left_id]
        right_concepts = resource_concepts[right_id]
        if not left_concepts or not right_concepts:
            continue

        shared = left_concepts & right_concepts
        if not shared:
            continue

        union = left_concepts | right_concepts
        weight = round(len(shared) / len(union), 3)
        edges.append(
            {
                "from": left_id,
                "to": right_id,
                "type": "related-resource",
                "weight": weight,
                "shared_concepts": len(shared),
            }
        )

    return edges


def _build_related_concept_edges(concept_nodes: dict[str, dict], pair_overlap_counts: dict[tuple[str, str], int]) -> list[dict]:
    edges = []

    for (left_id, right_id), overlap_count in sorted(pair_overlap_counts.items()):
        left_frequency = concept_nodes[left_id]["frequency"]
        right_frequency = concept_nodes[right_id]["frequency"]
        if overlap_count <= 0 or left_frequency <= 0 or right_frequency <= 0:
            continue

        weight = round(overlap_count / max(left_frequency, right_frequency), 3)
        edges.append(
            {
                "from": left_id,
                "to": right_id,
                "type": "related-concept",
                "weight": weight,
                "shared_resources": overlap_count,
            }
        )

    return edges


def _clean_concepts(values: list[str]) -> list[str]:
    seen = set()
    cleaned = []
    for value in values:
        concept = re.sub(r"\s+", " ", str(value).strip())
        if not concept:
            continue
        key = concept.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(concept)
    return cleaned


def _concept_id(concept: str) -> str:
    return f"concept:{_slug(concept)}"


def _resource_id(module_id: str, resource: dict) -> str:
    url_hash = hashlib.sha1(str(resource["url"]).encode("utf-8")).hexdigest()[:10]
    label_slug = _slug(str(resource["label"]))
    return f"resource:{module_id}:{label_slug}:{url_hash}"


def _slug(value: str) -> str:
    value = value.casefold().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-") or "item"
