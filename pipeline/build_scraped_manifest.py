from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def host(url: str | None) -> str | None:
    if not url:
        return None
    try:
        return urlparse(url).netloc or None
    except Exception:
        return None


def read_text_len(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        return len(path.read_bytes())


def _normalize_ws(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    # collapse large horizontal whitespace but keep newlines
    s = re.sub(r"[ \t]+", " ", s)
    # strip trailing spaces
    s = "\n".join(line.rstrip() for line in s.split("\n"))
    # collapse too many blank lines
    s = re.sub(r"\n{4,}", "\n\n\n", s)
    return s.strip()


def extract_playwright_snapshot_text(yml_text: str) -> dict[str, Any]:
    """
    Best-effort extraction from playwright-cli page snapshots.
    We pull:
    - internal app routes in '/url: ...'
    - human-visible text fragments (paragraph/heading/button/link labels)
    """
    urls: list[str] = []
    visible: list[str] = []

    for raw in yml_text.splitlines():
        line = raw.strip()

        if line.startswith("- /url:"):
            urls.append(line.split(":", 1)[1].strip())
            continue

        # Examples:
        # - paragraph [ref=e603]: DSA & LeetCode · LeetCode Course
        # - generic [ref=e600]: "LeetCode Crash Course: Heaps"
        # - heading "Continue your journey" [level=2] [ref=e52]
        m_colon = re.match(r"^- (paragraph|generic)\b.*?:\s*(.*)$", line)
        if m_colon:
            txt = m_colon.group(2).strip()
            if txt:
                visible.append(txt)
            continue

        m_heading = re.match(r'^- heading\s+"(.*)"\s+\[level=', line)
        if m_heading:
            visible.append(m_heading.group(1))
            continue

        m_button = re.match(r'^- button\s+"(.*)"\s+\[ref=', line)
        if m_button:
            visible.append(m_button.group(1))
            continue

        m_link = re.match(r'^- link\s+"(.*)"\s+\[ref=', line)
        if m_link:
            visible.append(m_link.group(1))
            continue

    # De-dup while preserving order
    def dedup(xs: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for x in xs:
            if x in seen:
                continue
            seen.add(x)
            out.append(x)
        return out

    urls = dedup(urls)
    visible = dedup([v.strip("\"'") for v in visible if v.strip("\"'")])

    text = _normalize_ws("\n".join(visible))
    return {"urls": urls, "visible_text": text}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build unified scraped manifest for chunking/embedding.")
    parser.add_argument(
        "--kb-dir",
        default="knowledge-base/2026-04-13",
        help="Knowledge base date directory (default: knowledge-base/2026-04-13)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output manifest path (default: <kb-dir>/scraped-manifest.json)",
    )
    args = parser.parse_args()

    kb_dir = Path(args.kb_dir).resolve()
    out_path = Path(args.out).resolve() if args.out else (kb_dir / "scraped-manifest.json")

    output_dir = kb_dir / "output"
    crawl4ai_manifest = output_dir / "crawl4ai-remaining" / "manifest.json"
    yt_manifest = output_dir / "youtube-transcripts" / "manifest.json"
    repos_manifest = output_dir / "github-repo-markdown" / "manifest.json"
    playwright_dir = kb_dir / ".playwright-cli"

    missing = [p for p in [output_dir, crawl4ai_manifest, yt_manifest, repos_manifest] if not p.exists()]
    if missing:
        raise SystemExit("Missing required paths:\n" + "\n".join(f"- {p}" for p in missing))

    crawl4ai = load_json(crawl4ai_manifest)
    yt = load_json(yt_manifest)
    repos = load_json(repos_manifest)

    items: list[dict[str, Any]] = []

    # 1) crawl4ai markdown outputs (URL -> md file)
    crawl4ai_md_dir = output_dir / "crawl4ai-remaining"
    for it in crawl4ai.get("items", []):
        md_rel = it.get("md_file")
        md_path = (crawl4ai_md_dir / md_rel).resolve() if md_rel else None
        items.append(
            {
                "kind": "web_markdown",
                "source": "crawl4ai",
                "url": it.get("url"),
                "host": it.get("host") or host(it.get("url")),
                "url_type": it.get("url_type"),
                "phase": it.get("phase"),
                "module_id": it.get("module_id"),
                "label": it.get("label"),
                "status": it.get("status"),
                "error": it.get("error"),
                "content_path": str(md_path) if (md_path and md_path.exists()) else None,
                "content_format": "markdown",
                "content_chars": int(it.get("markdown_chars") or (read_text_len(md_path) if md_path and md_path.exists() else 0)),
                "meta": {
                    "elapsed_s": it.get("elapsed_s"),
                    "manifest_path": str(crawl4ai_manifest),
                },
            }
        )

    # 2) YouTube transcript outputs (URL -> .txt)
    yt_dir = output_dir / "youtube-transcripts"
    for it in yt.get("items", []):
        text_rel = it.get("text")
        text_path = (yt_dir / text_rel).resolve() if text_rel else None
        items.append(
            {
                "kind": "youtube_transcript",
                "source": "youtube-transcripts",
                "url": it.get("url"),
                "host": host(it.get("url")),
                "url_type": "youtube_video",
                "phase": it.get("phase"),
                "module_id": it.get("module_id"),
                "label": it.get("label"),
                "status": it.get("status"),
                "error": it.get("error"),
                "content_path": str(text_path) if (text_path and text_path.exists()) else None,
                "content_format": "text",
                "content_chars": int(it.get("chars") or (read_text_len(text_path) if text_path and text_path.exists() else 0)),
                "meta": {
                    "video_id": it.get("video_id"),
                    "items": it.get("items"),
                    "manifest_path": str(yt_manifest),
                },
            }
        )

    # 3) GitHub repo markdown exports (repo -> many .md files)
    repos_root = output_dir / "github-repo-markdown"
    repo_url_by_export_dir: dict[str, str] = {}
    for r in repos.get("repos", []):
        export_dir = r.get("export_dir")
        if export_dir:
            repo_url_by_export_dir[export_dir] = r.get("repo_url")

    for md_path in sorted(repos_root.rglob("*.md")):
        if md_path.name == "manifest.json":
            continue
        try:
            rel = md_path.relative_to(repos_root)
        except Exception:
            rel = md_path.name

        export_dir = rel.parts[0] if hasattr(rel, "parts") and rel.parts else None
        repo_url = repo_url_by_export_dir.get(export_dir) if export_dir else None
        items.append(
            {
                "kind": "repo_markdown",
                "source": "github-repo-markdown",
                "url": repo_url,
                "host": host(repo_url),
                "url_type": "github_repo",
                "phase": None,
                "module_id": None,
                "label": str(rel),
                "status": "ok",
                "error": None,
                "content_path": str(md_path.resolve()),
                "content_format": "markdown",
                "content_chars": read_text_len(md_path),
                "meta": {
                    "repo_export_dir": export_dir,
                    "repo_file_relpath": str(rel),
                    "manifest_path": str(repos_manifest),
                },
            }
        )

    # 4) Playwright snapshots (app pages) -> extracted text files for chunking
    playwright_extract_dir = kb_dir / "playwright-extract"
    playwright_extract_dir.mkdir(parents=True, exist_ok=True)

    if playwright_dir.exists():
        for yml_path in sorted(playwright_dir.glob("page-*.yml")):
            yml_text = yml_path.read_text(encoding="utf-8", errors="replace")
            extracted = extract_playwright_snapshot_text(yml_text)
            if not extracted["visible_text"]:
                continue

            out_txt = playwright_extract_dir / (yml_path.stem + ".txt")
            out_txt.write_text(extracted["visible_text"] + "\n", encoding="utf-8")

            # Choose a canonical "page url" = first interesting internal route if present
            internal_urls = [u for u in extracted["urls"] if u.startswith("/track/") or u.startswith("/curriculum") or u.startswith("/practice")]
            page_url = internal_urls[0] if internal_urls else (extracted["urls"][0] if extracted["urls"] else None)

            # Attempt to infer track/module from common routes:
            inferred = {}
            if page_url:
                m = re.search(r"/track/([^/]+)/module/([^/?#]+)", page_url)
                if m:
                    inferred["track_id"] = m.group(1)
                    inferred["module_slug"] = m.group(2)
                m2 = re.search(r"/track/([^/?#]+)", page_url)
                if m2 and "track_id" not in inferred:
                    inferred["track_id"] = m2.group(1)

            items.append(
                {
                    "kind": "playwright_snapshot_text",
                    "source": "playwright-cli",
                    "url": page_url,
                    "host": None,
                    "url_type": "app_snapshot",
                    "phase": None,
                    "module_id": None,
                    "label": yml_path.name,
                    "status": "ok",
                    "error": None,
                    "content_path": str(out_txt.resolve()),
                    "content_format": "text",
                    "content_chars": read_text_len(out_txt),
                    "meta": {
                        "snapshot_path": str(yml_path.resolve()),
                        "urls": extracted["urls"],
                        **inferred,
                    },
                }
            )

    # Rollup stats
    stats: dict[str, Any] = {
        "total_items": len(items),
        "by_kind": {},
        "by_source": {},
        "missing_content_path": 0,
    }
    for it in items:
        stats["by_kind"][it["kind"]] = stats["by_kind"].get(it["kind"], 0) + 1
        stats["by_source"][it["source"]] = stats["by_source"].get(it["source"], 0) + 1
        if not it.get("content_path"):
            stats["missing_content_path"] += 1

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kb_dir": str(kb_dir),
        "output_dir": str(output_dir),
        "stats": stats,
        "items": items,
    }

    dump_json(out_path, manifest)
    print(f"Wrote manifest: {out_path}")
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

