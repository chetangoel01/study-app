from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_KNOWLEDGE_BASE_PATH = REPO_ROOT / "knowledge-base.json"
DEFAULT_OUTPUT_PATH = REPO_ROOT / "docs" / "knowledge-graph.md"
DEFAULT_FOCUS_TOPIC_LABEL = "Arrays"


def load_knowledge_base(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_graph_markdown(
    knowledge_base: dict,
    focus_topic_label: str | None = DEFAULT_FOCUS_TOPIC_LABEL,
) -> str:
    bucket_lookup = _bucket_lookup(knowledge_base)
    topic_lookup = {topic["id"]: topic for topic in knowledge_base["topics"]}
    topic_lookup_by_ontology_id = {
        topic["id"].split("topic:", 1)[-1]: topic
        for topic in knowledge_base["topics"]
    }
    topic_lookup_by_label = {
        topic["label"].casefold(): topic
        for topic in knowledge_base["topics"]
    }
    stats = knowledge_base["stats"]
    edge_types = Counter(edge["type"] for edge in knowledge_base["topic_edges"])
    focus_topic = None
    if focus_topic_label:
        focus_topic = topic_lookup_by_label.get(focus_topic_label.casefold())

    lines = [
        "# Knowledge Graph",
        "",
        "Generated from `knowledge-base.json`.",
        "",
        "## Snapshot",
        "",
        f"- Topics: `{stats['total_topics']}`",
        f"- Topic edges: `{stats['total_topic_edges']}`",
        f"- Planning coverage: `{stats['covered_planning_topics']}/{stats['total_planning_topics']}`",
        f"- Missing refs: `{stats['missing_topic_references']}`",
        f"- Ambiguous refs: `{stats['ambiguous_topic_references']}`",
        f"- Dropped prerequisite cycles: `{stats['dropped_prerequisite_cycles']}`",
        f"- Edge mix: `prerequisite={edge_types['prerequisite']}`, `related={edge_types['related']}`, `extends={edge_types['extends']}`, `variant-of={edge_types['variant-of']}`",
        "",
        "## Bucket Overview",
        "",
        "```mermaid",
        _bucket_overview_mermaid(knowledge_base, bucket_lookup),
        "```",
        "",
        "## Prerequisite DAG",
        "",
        "```mermaid",
        _prerequisite_mermaid(knowledge_base, bucket_lookup, topic_lookup, topic_lookup_by_ontology_id),
        "```",
        "",
    ]

    if focus_topic:
        lines.extend(
            [
                "## Focus Topic Review",
                "",
                *build_focus_topic_section(knowledge_base, focus_topic),
                "",
            ]
        )

    lines.extend(
        [
        "## Bucket Legend",
        "",
        ]
    )

    for bucket_id in _sorted_bucket_ids(bucket_lookup):
        bucket = bucket_lookup[bucket_id]
        topic_labels = [
            topic_lookup_by_ontology_id[topic_id]["label"]
            for topic_id in bucket["topic_ids"]
            if topic_id in topic_lookup_by_ontology_id
        ]
        lines.extend(
            [
                f"### {bucket['label']}",
                "",
                f"- Topics: `{len(bucket['topic_ids'])}`",
                f"- Assigned chunks: `{bucket['chunk_count']}`",
                f"- Topics in bucket: {', '.join(sorted(topic_labels))}",
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def write_graph_markdown(
    knowledge_base_path: Path,
    output_path: Path,
    focus_topic_label: str | None = DEFAULT_FOCUS_TOPIC_LABEL,
) -> None:
    knowledge_base = load_knowledge_base(knowledge_base_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        build_graph_markdown(knowledge_base, focus_topic_label=focus_topic_label),
        encoding="utf-8",
    )


def build_focus_topic_section(knowledge_base: dict, focus_topic: dict) -> list[str]:
    topic_lookup = {topic["id"]: topic for topic in knowledge_base["topics"]}
    prerequisite_edges = [edge for edge in knowledge_base["topic_edges"] if edge["type"] == "prerequisite"]
    parents = sorted(
        [topic_lookup[edge["from"]] for edge in prerequisite_edges if edge["to"] == focus_topic["id"]],
        key=lambda topic: topic["label"].casefold(),
    )
    children = sorted(
        [topic_lookup[edge["to"]] for edge in prerequisite_edges if edge["from"] == focus_topic["id"]],
        key=lambda topic: topic["label"].casefold(),
    )
    lesson = focus_topic.get("lesson", {})
    patterns = lesson.get("patterns", [])
    practice_items = lesson.get("practice_items", [])
    practice_mix = Counter(item.get("kind", "exercise") for item in practice_items)
    references = lesson.get("references", [])

    lines = [
        f"### {focus_topic['label']}",
        "",
        f"- Bucket: `{focus_topic.get('bucket_label', '')}`",
        f"- Prerequisites: {_format_topic_labels(parents)}",
        f"- Unlocks: {_format_topic_labels(children)}",
        f"- Related topics: {_format_label_list(focus_topic.get('related_topics', []))}",
        "",
        "```mermaid",
        _focused_topic_mermaid(focus_topic, parents, children),
        "```",
        "",
        "#### Lesson Snapshot",
        "",
        f"- Subtopics: `{len(lesson.get('subtopics', []))}`",
        f"- Patterns / frameworks: `{len(patterns)}`",
        f"- Practice mix: `{', '.join(f'{kind}={count}' for kind, count in sorted(practice_mix.items())) or 'none'}`",
        f"- References: `{len(references)}`",
        "",
        "#### Introduction",
        "",
        lesson.get("introduction_markdown", "_Missing introduction._"),
        "",
        "#### How To Study",
        "",
        lesson.get("study_markdown", "_Missing study guidance._"),
        "",
        "#### Key Topics",
        "",
    ]

    for subtopic in lesson.get("subtopics", []):
        lines.append(f"- {subtopic['title']}")

    if patterns:
        lines.extend(["", "#### Patterns and Frameworks", ""])
        for pattern in patterns:
            lines.append(f"- {pattern['name']}: {pattern['summary_markdown']}")

    if practice_items:
        lines.extend(["", "#### Practice", ""])
        for item in practice_items:
            lines.append(f"- `{item['kind']}` / `{item['difficulty']}`: {item['title']}")

    if references:
        lines.extend(["", "#### References", ""])
        for reference in references:
            lines.append(f"- `{reference['kind']}`: [{reference['label']}]({reference['url']})")

    return lines


def _bucket_lookup(knowledge_base: dict) -> dict[str, dict]:
    chunk_counts = knowledge_base["bucket_diagnostics"]["bucket_chunk_counts"]
    lookup = {}
    for bucket in knowledge_base["curriculum_buckets"]:
        lookup[bucket["bucket_id"]] = {
            "bucket_id": bucket["bucket_id"],
            "label": bucket["label"],
            "summary": bucket["summary"],
            "topic_ids": list(bucket.get("topic_ids", [])),
            "chunk_count": int(chunk_counts.get(bucket["bucket_id"], 0)),
        }
    return lookup


def _bucket_overview_mermaid(knowledge_base: dict, bucket_lookup: dict[str, dict]) -> str:
    prerequisite_counts = Counter()
    topic_lookup = {topic["id"]: topic for topic in knowledge_base["topics"]}

    for edge in knowledge_base["topic_edges"]:
        if edge["type"] != "prerequisite":
            continue
        from_bucket = topic_lookup[edge["from"]]["bucket_id"]
        to_bucket = topic_lookup[edge["to"]]["bucket_id"]
        prerequisite_counts[(from_bucket, to_bucket)] += 1

    lines = ["flowchart LR"]
    for bucket_id in _sorted_bucket_ids(bucket_lookup):
        bucket = bucket_lookup[bucket_id]
        node_id = _node_id("bucket", bucket_id)
        label = f"{bucket['label']}<br/>{len(bucket['topic_ids'])} topics / {bucket['chunk_count']} chunks"
        lines.append(f'  {node_id}["{_escape_label(label)}"]')

    for (from_bucket, to_bucket), count in sorted(
        prerequisite_counts.items(),
        key=lambda item: (bucket_lookup[item[0][0]]["label"], bucket_lookup[item[0][1]]["label"]),
    ):
        from_node = _node_id("bucket", from_bucket)
        to_node = _node_id("bucket", to_bucket)
        lines.append(f"  {from_node} -->|{count}| {to_node}")

    return "\n".join(lines)


def _prerequisite_mermaid(
    knowledge_base: dict,
    bucket_lookup: dict[str, dict],
    topic_lookup: dict[str, dict],
    topic_lookup_by_ontology_id: dict[str, dict],
) -> str:
    prerequisite_edges = [edge for edge in knowledge_base["topic_edges"] if edge["type"] == "prerequisite"]
    incoming = Counter(edge["to"] for edge in prerequisite_edges)

    lines = ["flowchart TB"]
    root_ids = []
    for bucket_id in _sorted_bucket_ids(bucket_lookup):
        bucket = bucket_lookup[bucket_id]
        lines.append(f'  subgraph {_node_id("bucket", bucket_id)}["{_escape_label(bucket["label"])}"]')
        bucket_topics = [
            topic_lookup_by_ontology_id[topic_id]
            for topic_id in bucket["topic_ids"]
            if topic_id in topic_lookup_by_ontology_id
        ]
        for topic in sorted(bucket_topics, key=lambda item: item["label"].casefold()):
            node_id = _node_id("topic", topic["id"])
            label = topic["label"]
            lines.append(f'    {node_id}["{_escape_label(label)}"]')
            if incoming[topic["id"]] == 0:
                root_ids.append(node_id)
        lines.append("  end")

    for edge in sorted(prerequisite_edges, key=lambda item: (topic_lookup[item["from"]]["label"], topic_lookup[item["to"]]["label"])):
        lines.append(
            f'  {_node_id("topic", edge["from"])} --> {_node_id("topic", edge["to"])}'
        )

    if root_ids:
        lines.append("  classDef root fill:#d7f0ff,stroke:#1d4ed8,color:#0f172a;")
        lines.append(f"  class {','.join(sorted(root_ids))} root;")

    return "\n".join(lines)


def _sorted_bucket_ids(bucket_lookup: dict[str, dict]) -> list[str]:
    return sorted(bucket_lookup, key=lambda bucket_id: bucket_lookup[bucket_id]["label"].casefold())


def _node_id(prefix: str, raw_id: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_]", "_", raw_id)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return f"{prefix}_{normalized}"


def _escape_label(label: str) -> str:
    return str(label).replace('"', '\\"')


def _focused_topic_mermaid(focus_topic: dict, parents: list[dict], children: list[dict]) -> str:
    lines = ["flowchart LR"]
    focus_node = _node_id("focus", focus_topic["id"])
    lines.append(f'  {focus_node}["{_escape_label(focus_topic["label"])}"]')

    for parent in parents:
        parent_node = _node_id("focus", parent["id"])
        lines.append(f'  {parent_node}["{_escape_label(parent["label"])}"]')
        lines.append(f"  {parent_node} --> {focus_node}")

    for child in children:
        child_node = _node_id("focus", child["id"])
        lines.append(f'  {child_node}["{_escape_label(child["label"])}"]')
        lines.append(f"  {focus_node} --> {child_node}")

    for related_label in focus_topic.get("related_topics", [])[:4]:
        related_node = _node_id("focus_related", related_label)
        lines.append(f'  {related_node}["{_escape_label(related_label)}"]')
        lines.append(f"  {focus_node} -. related .-> {related_node}")

    lines.append("  classDef focus fill:#fde68a,stroke:#b45309,color:#1f2937;")
    lines.append(f"  class {focus_node} focus;")
    return "\n".join(lines)


def _format_label_list(labels: list[str]) -> str:
    if not labels:
        return "_none_"
    return ", ".join(sorted(labels))


def _format_topic_labels(topics: list[dict]) -> str:
    if not topics:
        return "_none_"
    return ", ".join(topic["label"] for topic in topics)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Mermaid views for the generated knowledge graph.")
    parser.add_argument(
        "--knowledge-base",
        type=Path,
        default=DEFAULT_KNOWLEDGE_BASE_PATH,
        help="Path to knowledge-base.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Path to the generated Markdown file",
    )
    parser.add_argument(
        "--focus-topic",
        default=DEFAULT_FOCUS_TOPIC_LABEL,
        help="Optional topic label to include as a focused review section",
    )
    args = parser.parse_args()
    write_graph_markdown(
        args.knowledge_base,
        args.output,
        focus_topic_label=args.focus_topic,
    )
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
