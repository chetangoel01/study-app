from __future__ import annotations

import importlib.util
import json
import os
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def main() -> None:
    _validate_env()

    from cache import cache_get, cache_set
    from bucket_builder import build_curriculum_buckets
    from bucket_synthesizer import synthesize_bucket_topics
    from chunker import chunk_document
    from config import CACHE_DIR, CACHE_VERSION, OUTPUT_PATH, REPO_ROOT, SCRAPE_CACHE_KEY_VERSION
    from edge_builder import build_topic_edges
    from planning_graph import build_planning_graph
    from progress import progress
    from scraper import scrape_url
    from topic_lesson_synthesizer import synthesize_topic_lessons
    from topic_validator import canonicalize_topics, validate_topic_lessons
    from url_classifier import classify

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    modules = _load_modules(REPO_ROOT / "study-app" / "build_study_data.py")
    flattened, unique_entries = _flatten_resources(modules)
    audit_path = OUTPUT_PATH.with_name("crawl-audit.json")

    print(
        f"[PIPELINE] Starting: {len(flattened)} resources, "
        f"{len(unique_entries)} unique URLs"
    )
    print("[STAGE 1] Scraping and normalizing resources")

    collected_resources = []
    for index, (url, entry) in enumerate(unique_entries.items(), start=1):
        if entry["resource"].get("sourcePath"):
            collected = _collect_local_export_resource(entry)
            print(
                f"[{index:>2}/{len(unique_entries)}] {entry['module_id']} / {entry['resource']['label']} "
                f"[local_export] {collected['status'].upper()}"
            )
        else:
            cache_key = f"{SCRAPE_CACHE_KEY_VERSION}:{url}"
            cached = cache_get(cache_key, namespace="scrape")
            if isinstance(cached, dict) and cached.get("status") != "failed":
                collected = cached
                print(f"[{index:>2}/{len(unique_entries)}] {entry['module_id']} / {entry['resource']['label']} [{classify(url).value}] [CACHED]")
            else:
                scrape_result = scrape_url(url)
                collected = {
                    "module_id": entry["module_id"],
                    "module_title": entry["module_title"],
                    "module_phase": entry["module_phase"],
                    "label": entry["resource"]["label"],
                    "resource_url": url,
                    "resource_type": classify(url).value,
                    "resolved_url": scrape_result.resolved_url,
                    "title": scrape_result.title,
                    "description": scrape_result.og_description,
                    "status": scrape_result.status,
                    "error": scrape_result.error,
                    "segments": scrape_result.segments,
                }
                if scrape_result.status != "failed":
                    cache_set(cache_key, collected, namespace="scrape")
                print(
                    f"[{index:>2}/{len(unique_entries)}] {entry['module_id']} / {entry['resource']['label']} "
                    f"[{classify(url).value}] {scrape_result.status.upper()}"
                )
        collected_resources.append(collected)

    crawl_audit = _build_crawl_audit(collected_resources)
    audit_path.write_text(json.dumps(crawl_audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        "[STAGE 1] Status summary: "
        + ", ".join(f"{status}={count}" for status, count in crawl_audit["status_counts"].items())
    )
    print(
        f"[STAGE 1] Wrote crawl-audit.json with "
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

    print(f"[STAGE 4] Synthesizing topic blueprints from {len(buckets)} curriculum buckets")
    synthesized_topics = synthesize_bucket_topics(buckets)
    topics, topic_validation = canonicalize_topics(synthesized_topics)
    topics_with_lessons, lesson_synthesis = synthesize_topic_lessons(topics, buckets)
    bucket_source_urls = {bucket["bucket_id"]: list(bucket.get("source_urls", [])) for bucket in buckets}
    bucket_module_ids = {bucket["bucket_id"]: list(bucket.get("module_ids", [])) for bucket in buckets}
    for topic in topics_with_lessons:
        if not topic.get("source_urls"):
            topic["source_urls"] = list(bucket_source_urls.get(topic["bucket_id"], []))
        if not topic.get("module_ids"):
            topic["module_ids"] = list(bucket_module_ids.get(topic["bucket_id"], []))
    topics, lesson_validation = validate_topic_lessons(topics_with_lessons)
    topic_edges, edge_validation = build_topic_edges(topics, include_diagnostics=True)
    planning_graph = build_planning_graph(topics)
    print(
        f"[STAGE 4] Synthesized {len(synthesized_topics)} topic blueprints, "
        f"merged {topic_validation['merged_topic_count']} duplicates, "
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

    payload = {
        "version": CACHE_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total_modules": len(modules),
            "total_resources": len(flattened),
            "total_source_docs": len(sources),
            "total_chunks": len(chunks),
            "total_curriculum_buckets": len(buckets),
            "curriculum_buckets_with_evidence": buckets_with_evidence,
            "assigned_chunks": bucket_diagnostics["assigned_chunks"],
            "unassigned_chunks": bucket_diagnostics["unassigned_chunks"],
            "total_synthesized_topics": len(synthesized_topics),
            "total_topics": len(topics),
            "total_topic_edges": len(topic_edges),
            "total_topic_lessons": lesson_validation["validated_topic_count"],
            "total_planning_topics": planning_graph["planning_validation"]["total_planning_topics"],
            "covered_planning_topics": planning_graph["planning_validation"]["covered_planning_topics"],
            "total_planning_edges": planning_graph["planning_validation"]["total_planning_edges"],
            "merged_topics": topic_validation["merged_topic_count"],
            "pruned_aliases": topic_validation["pruned_alias_count"],
            "missing_topic_references": edge_validation["missing_reference_count"],
            "ambiguous_topic_references": edge_validation["ambiguous_reference_count"],
            "dropped_prerequisite_cycles": edge_validation["dropped_prerequisite_cycle_count"],
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
        "topic_validation": {
            **topic_validation,
            **lesson_synthesis,
            **lesson_validation,
            **edge_validation,
        },
        "bucket_diagnostics": bucket_diagnostics,
        "planning_validation": planning_graph["planning_validation"],
    }

    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    size_kb = max(1, OUTPUT_PATH.stat().st_size // 1024)
    print(
        f"[DONE] {len(topics)} topics, {len(topic_edges)} edges. "
        f"Wrote knowledge-base.json ({size_kb} KB)"
    )


def _validate_env() -> None:
    from config import LLM_API_KEY

    if not LLM_API_KEY:
        raise RuntimeError("LLM_API_KEY or OPENROUTER_API_KEY is required")


def _load_modules(build_study_data_path: Path) -> list[dict]:
    spec = importlib.util.spec_from_file_location("build_study_data", build_study_data_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load study-app/build_study_data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    public_modules = list(module.MODULES)
    pipeline_only_modules = list(getattr(module, "PIPELINE_ONLY_MODULES", []))
    dynamic_pipeline_loader = getattr(module, "load_dynamic_pipeline_only_modules", None)
    if callable(dynamic_pipeline_loader):
        pipeline_only_modules.extend(dynamic_pipeline_loader())
    return public_modules + pipeline_only_modules


def _flatten_resources(modules: list[dict]) -> tuple[list[dict], OrderedDict[str, dict]]:
    flattened = []
    unique_entries: OrderedDict[str, dict] = OrderedDict()

    for module in modules:
        for resource in module["resources"]:
            entry = {
                "module_id": module["id"],
                "module_title": module["title"],
                "module_phase": module["phase"],
                "resource": resource,
            }
            flattened.append(entry)
            unique_entries.setdefault(resource["url"], entry)

    return flattened, unique_entries


def _collect_local_export_resource(entry: dict) -> dict:
    resource = entry["resource"]
    source_path = Path(str(resource.get("sourcePath") or "")).expanduser()
    if not source_path.exists():
        return {
            "module_id": entry["module_id"],
            "module_title": entry["module_title"],
            "module_phase": entry["module_phase"],
            "label": resource["label"],
            "resource_url": resource["url"],
            "resource_type": "local_export",
            "resolved_url": resource["url"],
            "title": "",
            "description": "",
            "status": "failed",
            "error": f"Local source file not found: {source_path}",
            "segments": [],
        }

    payload = json.loads(source_path.read_text(encoding="utf-8"))
    content = payload.get("content") or {}
    item = payload.get("item") or {}
    chapter_title = str(payload.get("chapterTitle") or "").strip()
    title = str(content.get("title") or item.get("title") or resource["label"]).strip()
    text = str(content.get("textContent") or "").strip()

    if not text:
        return {
            "module_id": entry["module_id"],
            "module_title": entry["module_title"],
            "module_phase": entry["module_phase"],
            "label": resource["label"],
            "resource_url": resource["url"],
            "resource_type": "local_export",
            "resolved_url": resource["url"],
            "title": title,
            "description": "",
            "status": "fallback",
            "error": None,
            "segments": [],
        }

    return {
        "module_id": entry["module_id"],
        "module_title": entry["module_title"],
        "module_phase": entry["module_phase"],
        "label": resource["label"],
        "resource_url": resource["url"],
        "resource_type": "local_export",
        "resolved_url": resource["url"],
        "title": title,
        "description": chapter_title,
        "status": "ok",
        "error": None,
        "segments": [
            {
                "segment_id": f"local-export:{item.get('id') or title}",
                "kind": f"leetcode_{content.get('kind') or 'export'}",
                "source_url": resource["url"],
                "title": title,
                "heading_path": [part for part in [chapter_title, title] if part],
                "text": text,
            }
        ],
    }


def _build_sources(collected_resources: list[dict]) -> list[dict]:
    sources = []
    for resource in collected_resources:
        segments = resource.get("segments") or []
        for index, segment in enumerate(segments, start=1):
            if not _include_source_segment(resource, segment):
                continue
            text = str(segment.get("text") or "").strip()
            if not text:
                continue
            document_id = _document_id(resource["resource_url"], segment.get("source_url", resource["resource_url"]), index)
            sources.append(
                {
                    "document_id": document_id,
                    "module_id": resource["module_id"],
                    "module_title": resource["module_title"],
                    "module_phase": resource["module_phase"],
                    "resource_label": resource["label"],
                    "resource_url": resource["resource_url"],
                    "resource_type": resource["resource_type"],
                    "status": resource["status"],
                    "source_url": str(segment.get("source_url") or resource["resolved_url"] or resource["resource_url"]),
                    "resolved_url": resource["resolved_url"] or resource["resource_url"],
                    "kind": str(segment.get("kind") or "resource_segment"),
                    "title": str(resource.get("label") or segment.get("title") or resource.get("title") or "").strip(),
                    "segment_title": str(segment.get("title") or resource.get("title") or resource.get("label") or "").strip(),
                    "heading_path": list(segment.get("heading_path") or [resource["label"]]),
                    "text": text,
                }
            )
    sources.sort(key=lambda source: (source["module_id"], source["resource_label"], source["source_url"], source["document_id"]))
    return sources


def _build_crawl_audit(collected_resources: list[dict]) -> dict:
    status_counts = Counter(str(resource.get("status") or "unknown") for resource in collected_resources)
    ordered_counts = {
        "ok": status_counts.get("ok", 0),
        "fallback": status_counts.get("fallback", 0),
        "failed": status_counts.get("failed", 0),
    }
    degraded_resources = [
        {
            "module_id": resource["module_id"],
            "module_title": resource["module_title"],
            "module_phase": resource["module_phase"],
            "label": resource["label"],
            "resource_url": resource["resource_url"],
            "resolved_url": resource.get("resolved_url") or resource["resource_url"],
            "resource_type": resource["resource_type"],
            "status": resource["status"],
            "error": resource.get("error"),
            "title": resource.get("title") or "",
        }
        for resource in collected_resources
        if resource.get("status") in {"fallback", "failed"}
    ]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_resources": len(collected_resources),
        "status_counts": ordered_counts,
        "degraded_resources": degraded_resources,
    }


def _include_source_segment(resource: dict, segment: dict) -> bool:
    if str(resource.get("status") or "") != "ok":
        return False
    if str(segment.get("kind") or "") == "fallback":
        return False

    resource_url = str(resource.get("resource_url") or "").casefold()
    source_url = str(segment.get("source_url") or resource.get("resolved_url") or resource.get("resource_url") or "").casefold()
    segment_title = str(segment.get("title") or resource.get("title") or resource.get("label") or "").casefold()

    if resource.get("resource_type") == "coursera":
        if "/reviews" in source_url:
            return False
        if "/lecture/" in resource_url and "/lecture/" not in source_url:
            return False
        if "/lecture/" in resource_url and "join for free" in segment_title:
            return False

    return True


def _document_id(resource_url: str, source_url: str, index: int) -> str:
    import hashlib

    digest = hashlib.sha1(f"{resource_url}:{source_url}:{index}".encode("utf-8")).hexdigest()[:12]
    return f"doc:{digest}"


def _summarize_buckets(buckets: list[dict]) -> list[dict]:
    summaries = []
    for bucket in buckets:
        topic_chunk_counts = {
            topic_id: len(bucket["topic_matches"].get(topic_id, []))
            for topic_id in bucket["topic_ids"]
        }
        summaries.append(
            {
                "bucket_id": bucket["bucket_id"],
                "label": bucket["label"],
                "summary": bucket["summary"],
                "topic_ids": list(bucket["topic_ids"]),
                "module_ids": list(bucket["module_ids"]),
                "source_urls": list(bucket["source_urls"]),
                "topic_chunk_counts": topic_chunk_counts,
                "general_chunk_count": len(bucket["general_chunks"]),
            }
        )
    return summaries


if __name__ == "__main__":
    main()
