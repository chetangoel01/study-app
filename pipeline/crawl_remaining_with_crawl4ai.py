#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
import time
from collections import Counter, OrderedDict
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parent.parent
BUILD_STUDY_DATA = REPO_ROOT / "build_study_data.py"

# pipeline/ is not a package; add it for local imports.
PIPELINE_DIR = REPO_ROOT / "pipeline"
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from config import pipeline_url_excluded_from_stage1_seeds  # type: ignore
from url_classifier import UrlType, classify  # type: ignore


def _load_modules() -> list[dict]:
    spec = importlib.util.spec_from_file_location("build_study_data", BUILD_STUDY_DATA)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {BUILD_STUDY_DATA}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    public = list(module.MODULES)
    pipeline_only = list(getattr(module, "PIPELINE_ONLY_MODULES", []))
    dynamic_loader = getattr(module, "load_dynamic_pipeline_only_modules", None)
    if callable(dynamic_loader):
        pipeline_only.extend(dynamic_loader())
    return public + pipeline_only


def _stable_slug(url: str) -> str:
    host = urlparse(url).netloc.lower() or "unknown"
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    return f"{host}__{digest}"


def _remaining_urls() -> list[dict]:
    # Dedupe by URL in curriculum order.
    unique: OrderedDict[str, dict] = OrderedDict()
    for mod in _load_modules():
        for r in mod.get("resources") or []:
            url = str(r.get("url") or "").strip()
            if not url or url in unique:
                continue
            unique[url] = {
                "url": url,
                "module_id": mod.get("id"),
                "phase": mod.get("phase"),
                "label": r.get("label"),
                "sourcePath": r.get("sourcePath"),
            }

    remaining: list[dict] = []
    for url, entry in unique.items():
        if entry.get("sourcePath"):
            continue
        if pipeline_url_excluded_from_stage1_seeds(url):
            continue

        t = classify(url)
        if t in {UrlType.GITHUB_REPO, UrlType.YOUTUBE_VIDEO}:
            continue

        remaining.append({**entry, "url_type": t.value, "host": urlparse(url).netloc.lower()})
    return remaining


@dataclass
class CrawlOutcome:
    url: str
    url_type: str
    status: str
    markdown_chars: int
    error: str | None = None
    output_md: str | None = None


async def _crawl_one(url: str, *, timeout_s: int) -> tuple[str, str | None]:
    # Keep imports inside async so users can install crawl4ai separately.
    from crawl4ai import AsyncWebCrawler  # type: ignore

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url)

    md = getattr(result, "markdown", None)
    if isinstance(md, str):
        return md, None

    for attr in ("fit_markdown", "raw_markdown"):
        chunk = getattr(md, attr, None) if md is not None else None
        if isinstance(chunk, str) and chunk.strip():
            return chunk, None

    err = getattr(result, "error_message", None) or getattr(result, "error", None)
    return str(md or ""), str(err) if err else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl remaining (non-repo, non-youtube-video) URLs with Crawl4AI.")
    parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "output" / "crawl4ai-remaining"),
        help="Output directory (default: output/crawl4ai-remaining/)",
    )
    parser.add_argument("--max-urls", type=int, default=0, help="Limit run size (0 = all).")
    parser.add_argument("--timeout-s", type=int, default=90, help="Per-URL timeout (best-effort).")
    parser.add_argument("--sleep-s", type=float, default=0.0, help="Sleep between URLs.")
    parser.add_argument("--clean", action="store_true", help="Delete existing output dir before crawling.")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip URLs that already have a per-URL metadata JSON in the output folder.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out).resolve()
    if args.clean and out_dir.exists():
        import shutil

        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "md").mkdir(parents=True, exist_ok=True)

    remaining = _remaining_urls()
    if args.max_urls and args.max_urls > 0:
        remaining = remaining[: args.max_urls]

    by_type = Counter(r["url_type"] for r in remaining)
    print(f"Remaining URLs to crawl: {len(remaining)}")
    print("By type:", dict(sorted(by_type.items())))
    print("Output:", out_dir)

    try:
        import asyncio
    except Exception as exc:
        raise RuntimeError("asyncio required") from exc

    outcomes: list[dict] = []
    ok = 0
    skipped = 0

    for idx, item in enumerate(remaining, start=1):
        url = item["url"]
        url_type = item["url_type"]
        slug = _stable_slug(url)
        md_path = out_dir / "md" / f"{slug}.md"
        meta_path = out_dir / "md" / f"{slug}.json"

        if args.skip_existing and meta_path.exists():
            try:
                prev = json.loads(meta_path.read_text(encoding="utf-8"))
                outcomes.append(prev)
                if prev.get("status") == "ok":
                    ok += 1
                skipped += 1
                print(f"[{idx:>3}/{len(remaining)}] SKIP {url_type:<10} {url}")
                continue
            except Exception:
                # Fall through to re-crawl if the file is unreadable.
                pass

        print(f"[{idx:>3}/{len(remaining)}] {url_type:<14} {url}")
        started = time.time()

        try:
            md, err = asyncio.run(_crawl_one(url, timeout_s=args.timeout_s))
            md = (md or "").strip()
            if md:
                md_path.write_text(md + "\n", encoding="utf-8")
            meta = {
                **item,
                "status": "ok" if md else "empty",
                "error": err,
                "markdown_chars": len(md),
                "md_file": str(md_path.relative_to(out_dir)) if md else None,
                "elapsed_s": round(time.time() - started, 2),
            }
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            outcomes.append(meta)
            if md:
                ok += 1
        except ImportError:
            raise SystemExit(
                "crawl4ai is not installed in this environment.\n"
                "Install:\n"
                "  pip install -r pipeline/requirements-crawl4ai.txt\n"
                "  crawl4ai-setup\n"
            )
        except Exception as exc:
            meta = {
                **item,
                "status": "failed",
                "error": f"{type(exc).__name__}: {exc}",
                "markdown_chars": 0,
                "md_file": None,
                "elapsed_s": round(time.time() - started, 2),
            }
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            outcomes.append(meta)

        if args.sleep_s:
            time.sleep(args.sleep_s)

    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(outcomes),
        "ok": ok,
        "skipped_existing": skipped,
        "out_dir": str(out_dir),
        "items": outcomes,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Done. ok={ok}/{len(outcomes)}")
    print("Manifest:", out_dir / "manifest.json")


if __name__ == "__main__":
    main()

