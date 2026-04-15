#!/usr/bin/env python3
"""Smoke-test Crawl4AI on a single URL (e.g. a GitHub repo homepage).

Install (use a venv — pulls Playwright/Chromium):

  pip install -r pipeline/requirements-crawl4ai.txt
  crawl4ai-setup

  # if setup misses browsers:
  python -m playwright install chromium

Run:

  python3 pipeline/crawl4ai_try_repo.py https://github.com/octocat/Hello-World

Notes:
  - This does not plug into pipeline/runner.py; it is for manual experiments.
  - GitHub may throttle or show interstitials; if results are thin, try again or use a raw README URL.
"""
from __future__ import annotations

import argparse
import asyncio
import sys


def _markdown_text(result: object) -> str:
    md = getattr(result, "markdown", None)
    if md is None:
        return ""
    if isinstance(md, str):
        return md
    for attr in ("fit_markdown", "raw_markdown"):
        chunk = getattr(md, attr, None)
        if isinstance(chunk, str) and chunk.strip():
            return chunk
    return str(md)


async def _run(url: str, *, preview_chars: int) -> int:
    try:
        from crawl4ai import AsyncWebCrawler
    except ImportError:
        print(
            "Missing crawl4ai. Install with:\n"
            "  pip install -r pipeline/requirements-crawl4ai.txt\n"
            "  crawl4ai-setup",
            file=sys.stderr,
        )
        return 1

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url)

    text = _markdown_text(result)
    ok = getattr(result, "success", None)
    err = getattr(result, "error_message", None) or getattr(result, "error", None)

    print(f"URL: {url}")
    if ok is not None:
        print(f"success: {ok}")
    if err:
        print(f"error: {err}")
    print(f"markdown_chars: {len(text)}")

    if not text.strip():
        print("\n(no markdown — check error above or try another URL)")
        return 0

    preview = text[:preview_chars]
    if len(text) > preview_chars:
        preview += "…"
    print("\n--- preview ---\n")
    print(preview)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl one URL with Crawl4AI (e.g. GitHub repo page).")
    parser.add_argument(
        "url",
        nargs="?",
        default="https://github.com/octocat/Hello-World",
        help="Page to crawl (default: small public repo)",
    )
    parser.add_argument(
        "--preview-chars",
        type=int,
        default=1600,
        help="How many characters of markdown to print (default: 1600)",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args.url, preview_chars=args.preview_chars)))


if __name__ == "__main__":
    main()
