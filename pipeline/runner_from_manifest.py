from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def main() -> None:
    from bucket_builder import build_curriculum_buckets
    from bucket_synthesizer import synthesize_bucket_topics
    from chunker import chunk_document
    from config import CACHE_VERSION, OUTPUT_PATH, REPO_ROOT
    from edge_builder import build_topic_edges
    from planning_graph import build_planning_graph
    from progress import progress
    from runner import (
        _build_crawl_audit,
        _build_sources,
        _flatten_resources,
        _load_modules,
        _merge_topic_context,
        _summarize_buckets,
        _validate_env,
    )
    from topic_lesson_synthesizer import synthesize_topic_lessons
    from topic_validator import canonicalize_topics, validate_topic_lessons
    from url_classifier import classify

    parser = argparse.ArgumentParser(
        description="Run post-scrape pipeline stages from a scraped-manifest.json (no scraping)."
    )
    parser.add_argument(
        "--manifest",
        default=None,
        help="Path to scraped-manifest.json (default: auto-detect latest under knowledge-base/*/)",
    )
    parser.add_argument(
        "--out",
        default=str(OUTPUT_PATH),
        help="Output path for knowledge-base.json",
    )
    parser.add_argument(
        "--skip-llm",
        action="store_true",
        help="Run only source/chunk/bucket stages and skip topic synthesis.",
    )
    parser.add_argument(
        "--include-playwright-snapshots",
        action="store_true",
        help="Include playwright_snapshot_text items from manifest (off by default to reduce noise).",
    )
    args = parser.parse_args()

    manifest_path = _resolve_manifest_path(args.manifest)
    if not manifest_path.exists():
        raise RuntimeError(f"Manifest not found: {manifest_path}")
    if not args.skip_llm:
        _validate_env()

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path = out_path.with_name("crawl-audit.json")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = list(manifest.get("items") or [])
    if not items:
        raise RuntimeError(f"No items found in manifest: {manifest_path}")

    modules = _load_modules(REPO_ROOT / "study-app" / "build_study_data.py")
    flattened, unique_entries = _flatten_resources(modules)
    module_by_id = {module["id"]: module for module in modules}
    entry_by_url = {url: entry for url, entry in unique_entries.items()}

    print(
        f"[POST-SCRAPE] Starting from manifest: {manifest_path} "
        f"({len(items)} items)"
    )
    collected_resources, skipped = _collect_resources_from_manifest(
        items=items,
        entry_by_url=entry_by_url,
        module_by_id=module_by_id,
        manifest_dir=manifest_path.parent,
        include_playwright_snapshots=args.include_playwright_snapshots,
        classify_url=classify,
    )
    print(
        f"[POST-SCRAPE] Collected resources: {len(collected_resources)} "
        f"(skipped={skipped})"
    )

    crawl_audit = _build_crawl_audit(collected_resources)
    audit_path.write_text(
        json.dumps(crawl_audit, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        "[POST-SCRAPE] Status summary: "
        + ", ".join(
            f"{status}={count}"
            for status, count in crawl_audit["status_counts"].items()
        )
    )
    print(
        f"[POST-SCRAPE] Wrote crawl-audit.json with "
        f"{len(crawl_audit['degraded_resources'])} fallback/failed resources"
    )

    print(f"[STAGE 2] Building source docs from {len(collected_resources)} collected resources")
    sources = _build_sources(collected_resources)
    print(f"[STAGE 2] Chunking {len(sources)} source docs")
    chunks = []
    for source in progress(sources, total=len(sources), desc="Chunk sources", unit="doc"):
        chunks.extend(chunk_document(source))
    print(f"[STAGE 2] Built {len(sources)} source docs and {len(chunks)} chunks")

    print(f"[STAGE 3] Assigning {len(chunks)} chunks to curriculum buckets")
    buckets, bucket_diagnostics = build_curriculum_buckets(chunks)
    buckets_with_evidence = sum(
        1
        for bucket in buckets
        if bucket["general_chunks"] or any(bucket["topic_matches"].get(topic_id) for topic_id in bucket["topic_ids"])
    )
    print(
        f"[STAGE 3] Built {len(buckets)} curriculum buckets; "
        f"{buckets_with_evidence} have evidence, "
        f"{bucket_diagnostics['assigned_chunks']}/{bucket_diagnostics['total_chunks']} chunks assigned"
    )

    topics = []
    topic_edges = []
    topic_validation: dict = {
        "input_topic_count": 0,
        "output_topic_count": 0,
        "validated_topic_count": 0,
        "invalid_topic_count": 0,
        "invalid_topics": [],
        "merged_topic_count": 0,
        "pruned_alias_count": 0,
        "pruned_aliases": [],
        "cached_topic_lessons": 0,
        "generated_topic_lessons": 0,
        "missing_reference_count": 0,
        "missing_references": [],
        "missing_reference_labels": [],
        "missing_reference_counts": {},
        "ambiguous_reference_count": 0,
        "ambiguous_references": [],
        "ambiguous_reference_labels": [],
        "ambiguous_reference_counts": {},
        "dropped_prerequisite_cycle_count": 0,
        "dropped_prerequisite_cycles": [],
        "duplicate_groups": [],
    }
    planning_graph = {
        "planning_topics": [],
        "planning_topic_edges": [],
        "planning_mappings": [],
        "planning_validation": {
            "ontology_version": 2,
            "total_planning_topics": 0,
            "covered_planning_topics": 0,
            "uncovered_planning_topics": 0,
            "mapped_synthesized_topics": 0,
            "unmapped_synthesized_topics": 0,
            "total_planning_edges": 0,
            "unmapped_terms": [],
        },
    }

    if not args.skip_llm:
        print(f"[STAGE 4] Synthesizing topic blueprints from {len(buckets)} curriculum buckets")
        synthesized_topics = synthesize_bucket_topics(buckets)
        topics, canonical_diag = canonicalize_topics(synthesized_topics)
        topics_with_lessons, lesson_synthesis = synthesize_topic_lessons(topics, buckets)
        bucket_source_urls = {bucket["bucket_id"]: list(bucket.get("source_urls", [])) for bucket in buckets}
        bucket_module_ids = {bucket["bucket_id"]: list(bucket.get("module_ids", [])) for bucket in buckets}
        for topic in topics_with_lessons:
            _merge_topic_context(topic, bucket_source_urls=bucket_source_urls, bucket_module_ids=bucket_module_ids)
        topics, lesson_validation = validate_topic_lessons(topics_with_lessons)
        topic_edges, edge_validation = build_topic_edges(topics, include_diagnostics=True)
        planning_graph = build_planning_graph(topics)
        topic_validation = {
            **canonical_diag,
            **lesson_synthesis,
            **lesson_validation,
            **edge_validation,
        }
        print(
            f"[STAGE 4] Synthesized {len(synthesized_topics)} topic blueprints, "
            f"merged {canonical_diag['merged_topic_count']} duplicates, "
            f"kept {len(topics)} canonical topics"
        )
        print(
            f"[STAGE 4] Built {lesson_validation['validated_topic_count']} structured lessons; "
            f"cached={lesson_synthesis['cached_topic_lessons']}, "
            f"generated={lesson_synthesis['generated_topic_lessons']}"
        )
        print(
            f"[STAGE 4] Built {len(topic_edges)} edges; "
            f"missing refs={edge_validation['missing_reference_count']}, "
            f"ambiguous refs={edge_validation['ambiguous_reference_count']}, "
            f"dropped prerequisite cycles={edge_validation['dropped_prerequisite_cycle_count']}"
        )
        print(
            f"[STAGE 4] Planning layer covers "
            f"{planning_graph['planning_validation']['covered_planning_topics']}/"
            f"{planning_graph['planning_validation']['total_planning_topics']} ontology topics "
            f"with {planning_graph['planning_validation']['total_planning_edges']} curated edges"
        )
    else:
        print("[STAGE 4] Skipped (--skip-llm)")

    payload = {
        "version": CACHE_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total_modules": len(modules),
            "total_resources": len(collected_resources),
            "total_curriculum_resources": len(flattened),
            "total_manifest_items": len(items),
            "skipped_manifest_items": skipped,
            "total_source_docs": len(sources),
            "total_chunks": len(chunks),
            "total_curriculum_buckets": len(buckets),
            "curriculum_buckets_with_evidence": buckets_with_evidence,
            "assigned_chunks": bucket_diagnostics["assigned_chunks"],
            "unassigned_chunks": bucket_diagnostics["unassigned_chunks"],
            "total_synthesized_topics": topic_validation.get("input_topic_count", 0),
            "total_topics": len(topics),
            "total_topic_edges": len(topic_edges),
            "total_topic_lessons": topic_validation.get("validated_topic_count", 0),
            "total_planning_topics": planning_graph["planning_validation"]["total_planning_topics"],
            "covered_planning_topics": planning_graph["planning_validation"]["covered_planning_topics"],
            "total_planning_edges": planning_graph["planning_validation"]["total_planning_edges"],
            "merged_topics": topic_validation.get("merged_topic_count", 0),
            "pruned_aliases": topic_validation.get("pruned_alias_count", 0),
            "missing_topic_references": topic_validation.get("missing_reference_count", 0),
            "ambiguous_topic_references": topic_validation.get("ambiguous_reference_count", 0),
            "dropped_prerequisite_cycles": topic_validation.get("dropped_prerequisite_cycle_count", 0),
        },
        "crawl_audit": crawl_audit,
        "sources": sources,
        "chunks": chunks,
        "curriculum_buckets": _summarize_buckets(buckets),
        "topics": topics,
        "topic_edges": topic_edges,
        "planning_topics": planning_graph["planning_topics"],
        "planning_topic_edges": planning_graph["planning_topic_edges"],
        "planning_mappings": planning_graph["planning_mappings"],
        "topic_validation": topic_validation,
        "bucket_diagnostics": bucket_diagnostics,
        "planning_validation": planning_graph["planning_validation"],
    }

    out_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    size_kb = max(1, out_path.stat().st_size // 1024)
    print(
        f"[DONE] {len(topics)} topics, {len(topic_edges)} edges. "
        f"Wrote {out_path} ({size_kb} KB)"
    )


def _collect_resources_from_manifest(
    *,
    items: list[dict],
    entry_by_url: dict[str, dict],
    module_by_id: dict[str, dict],
    manifest_dir: Path,
    include_playwright_snapshots: bool,
    classify_url,
) -> tuple[list[dict], int]:
    collected: list[dict] = []
    skipped = 0

    for item in items:
        kind = str(item.get("kind") or "")
        if kind == "playwright_snapshot_text" and not include_playwright_snapshots:
            skipped += 1
            continue

        module_id = str(item.get("module_id") or "").strip()
        resource_url = str(item.get("url") or "").strip()

        if not module_id and kind == "playwright_snapshot_text":
            module_id = _infer_module_id_from_snapshot(item)

        if not module_id and resource_url:
            entry = entry_by_url.get(resource_url)
            if entry:
                module_id = entry["module_id"]

        if not module_id or module_id not in module_by_id:
            skipped += 1
            continue

        module = module_by_id[module_id]
        label = str(item.get("label") or resource_url or kind or "scraped_item").strip()
        status = _normalize_status(str(item.get("status") or "ok").strip())
        error = str(item.get("error") or "").strip() or None

        content_path_raw = item.get("content_path")
        content_path = _resolve_content_path(content_path_raw, manifest_dir=manifest_dir)
        text = ""
        if status == "ok" and content_path and content_path.exists():
            text = content_path.read_text(encoding="utf-8", errors="replace").strip()
            if not text:
                status = "failed"
                error = "empty content"
        elif status == "ok":
            status = "failed"
            error = "missing content_path"

        source_url = _source_url_from_item(item, default_url=resource_url)
        resource_type = _resource_type_from_item(item, resource_url, classify_url)
        segment_kind = str(kind or "resource_segment")
        segment_title = _segment_title_from_item(item, label)
        heading_path = _heading_path_from_item(item, label)

        segments = []
        if status == "ok":
            segments.append(
                {
                    "segment_id": f"manifest:{item.get('source','unknown')}:{item.get('kind','item')}:{label}",
                    "kind": segment_kind,
                    "source_url": source_url,
                    "title": segment_title,
                    "heading_path": heading_path,
                    "text": text,
                }
            )

        collected.append(
            {
                "module_id": module_id,
                "module_title": module["title"],
                "module_phase": module["phase"],
                "label": label,
                "resource_url": resource_url or source_url,
                "resource_type": resource_type,
                "resolved_url": resource_url or source_url,
                "title": segment_title,
                "description": "",
                "status": status,
                "error": error,
                "segments": segments,
            }
        )

    return collected, skipped


def _normalize_status(status: str) -> str:
    lowered = status.casefold()
    if lowered == "ok":
        return "ok"
    if lowered == "fallback":
        return "fallback"
    if lowered == "failed":
        return "failed"
    if lowered in {"no_transcript", "empty", "interrupted"}:
        return "failed"
    return "failed"


def _resource_type_from_item(item: dict, resource_url: str, classify_url) -> str:
    raw = str(item.get("url_type") or "").strip()
    if raw == "app_snapshot":
        return "local_export"
    if raw and raw != "app_snapshot":
        return raw
    if resource_url:
        return classify_url(resource_url).value
    kind = str(item.get("kind") or "")
    if kind == "playwright_snapshot_text":
        return "local_export"
    return "article"


def _segment_title_from_item(item: dict, fallback: str) -> str:
    meta = item.get("meta")
    if isinstance(meta, dict):
        relpath = str(meta.get("repo_file_relpath") or "").strip()
        if relpath:
            return relpath
    return fallback


def _heading_path_from_item(item: dict, fallback: str) -> list[str]:
    meta = item.get("meta")
    if isinstance(meta, dict):
        relpath = str(meta.get("repo_file_relpath") or "").strip()
        if relpath:
            parts = [part for part in relpath.split("/") if part]
            if parts:
                return parts
    return [fallback]


def _source_url_from_item(item: dict, *, default_url: str) -> str:
    source_url = default_url
    meta = item.get("meta")
    kind = str(item.get("kind") or "")
    if kind == "repo_markdown" and isinstance(meta, dict):
        relpath = str(meta.get("repo_file_relpath") or "").strip()
        if default_url and relpath:
            source_url = f"{default_url}#file:{relpath}"
    return source_url or "local://unknown"


def _resolve_content_path(content_path_raw: object, *, manifest_dir: Path) -> Path | None:
    if not content_path_raw:
        return None
    content_path = Path(str(content_path_raw)).expanduser()
    if not content_path.is_absolute():
        content_path = manifest_dir / content_path
    return content_path.resolve()


def _infer_module_id_from_snapshot(item: dict) -> str:
    meta = item.get("meta")
    if isinstance(meta, dict):
        module_slug = str(meta.get("module_slug") or "").strip()
        if module_slug:
            return module_slug

    url = str(item.get("url") or "").strip()
    if url:
        match = re.search(r"/module/([^/?#]+)", url)
        if match:
            return match.group(1)
    return ""


def _resolve_manifest_path(manifest_arg: str | None) -> Path:
    if manifest_arg:
        return Path(manifest_arg).expanduser().resolve()

    kb_root = Path("knowledge-base")
    if not kb_root.exists():
        raise RuntimeError(
            "No --manifest provided and knowledge-base/ does not exist. "
            "Pass --manifest explicitly."
        )

    candidates = sorted(kb_root.glob("*/scraped-manifest.json"), key=lambda path: path.parent.name)
    if not candidates:
        raise RuntimeError(
            "No --manifest provided and no scraped-manifest.json found under knowledge-base/*/. "
            "Pass --manifest explicitly."
        )

    selected = candidates[-1].resolve()
    print(f"[POST-SCRAPE] Auto-selected manifest: {selected}")
    return selected


if __name__ == "__main__":
    main()
