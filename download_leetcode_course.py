#!/usr/bin/env python3
"""Download a purchased LeetCode Explore course for personal offline review.

The Explore pages are mostly a JavaScript shell, so this exporter uses the same
GraphQL endpoints the LeetCode frontend uses instead of trying to scrape the
rendered DOM.

Workflow:
1. Export your authenticated LeetCode cookies from Arc/Chromium to a local file.
2. Run this script against the course root URL.
3. Review the saved manifest, chapter JSON, and item JSON under
   ``course_exports/``.

This is intended for personal study and import into this repo. Do not commit
your cookie export or redistribute the downloaded course content.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from http.cookiejar import Cookie, CookieJar, MozillaCookieJar
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import HTTPCookieProcessor, Request, build_opener

DEFAULT_ROOT_URL = (
    "https://leetcode.com/explore/interview/card/"
    "leetcodes-interview-crash-course-data-structures-and-algorithms/"
)
DEFAULT_OUTPUT_DIR = Path("course_exports/leetcode-crash-course")
GRAPHQL_URL = "https://leetcode.com/graphql/"
REQUEST_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

GET_CARD_DETAIL_QUERY = """
query GetCardDetail($cardSlug: String!) {
  card(cardSlug: $cardSlug) {
    id
    title
    slug
    description
    introduction
    introText
    paidOnly
    published
    isPreview
  }
  isCurrentUserAuthenticated
}
"""

GET_CHAPTERS_WITH_ITEMS_QUERY = """
query GetChaptersWithItems($cardSlug: String!) {
  chapters(cardSlug: $cardSlug) {
    id
    title
    slug
    isLocked
    paidOnly
    descriptionText
    items {
      id
      title
      type
      info
      paidOnly
      isLocked
      chapterId
      isEligibleForCompletion
      hasAppliedTimeTravelTicket
      completedWithTimeTravelTicket
      prerequisites {
        id
        chapterId
      }
      question {
        title
        titleSlug
      }
      article {
        id
        title
      }
      htmlArticle {
        id
      }
      video {
        id
      }
      webPage {
        id
      }
    }
  }
}
"""

GET_ARTICLE_QUERY = """
query GetArticle($articleId: String!) {
  article(id: $articleId) {
    id
    title
    body
  }
}
"""

GET_HTML_ARTICLE_QUERY = """
query GetHtmlArticle($htmlArticleId: String!) {
  htmlArticle(id: $htmlArticleId) {
    id
    html
    originalLink
    editLink
  }
}
"""

GET_VIDEO_QUERY = """
query GetVideo($videoId: String!) {
  video(id: $videoId) {
    id
    html
    content
    editLink
  }
}
"""

GET_WEB_PAGE_QUERY = """
query GetWebPage($webPageId: String!) {
  webPage(id: $webPageId) {
    id
    html
    editLink
  }
}
"""

GET_QUESTION_QUERY = """
query GetQuestion($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    questionTitle
    content
    translatedContent
    hints
    solution {
      title
      content
      canSeeDetail
      paidOnly
      titleSlug
      hasVideoSolution
      paidOnlyVideo
      rating {
        average
      }
    }
  }
  isCurrentUserAuthenticated
}
"""


@dataclass(frozen=True)
class ItemFetchPlan:
    kind: str
    operation_name: str
    query: str
    variable_name: str
    variable_value: str


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"noscript", "script", "style"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"noscript", "script", "style"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        cleaned = normalize_space(data)
        if cleaned:
            self.parts.append(cleaned)

    @property
    def text(self) -> str:
        return normalize_space(" ".join(self.parts))


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def slugify(text: str, fallback: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", text.strip().lower()).strip("-")
    return slug or fallback


def strip_html(value: str | None) -> str:
    if not value:
        return ""
    parser = TextExtractor()
    parser.feed(value)
    return parser.text


def parse_card_slug(root_url: str) -> str:
    parsed = urlparse(root_url)
    parts = [part for part in parsed.path.split("/") if part]
    if "card" in parts:
        index = parts.index("card")
        if index + 1 < len(parts):
            return parts[index + 1]
    if parts:
        return parts[-1]
    raise ValueError(f"Could not determine card slug from URL: {root_url}")


def build_cookie(name: str, value: str, domain: str, path: str = "/", secure: bool = True) -> Cookie:
    return Cookie(
        version=0,
        name=name,
        value=value,
        port=None,
        port_specified=False,
        domain=domain,
        domain_specified=True,
        domain_initial_dot=domain.startswith("."),
        path=path or "/",
        path_specified=True,
        secure=secure,
        expires=None,
        discard=True,
        comment=None,
        comment_url=None,
        rest={},
        rfc2109=False,
    )


def load_cookies(cookie_path: Path) -> CookieJar:
    raw = cookie_path.read_text(encoding="utf-8").strip()
    if not raw:
        raise ValueError(f"Cookie file is empty: {cookie_path}")

    if raw.startswith("[") or raw.startswith("{"):
        return load_json_cookies(raw)
    first_line = raw.splitlines()[0]
    if raw.startswith("# Netscape HTTP Cookie File") or "\t" in first_line:
        jar = MozillaCookieJar(str(cookie_path))
        jar.load(ignore_discard=True, ignore_expires=True)
        return jar
    return load_cookie_header(raw)


def load_json_cookies(raw: str) -> CookieJar:
    parsed = json.loads(raw)
    cookies = parsed["cookies"] if isinstance(parsed, dict) and "cookies" in parsed else parsed
    if not isinstance(cookies, list):
        raise ValueError("Expected a JSON array of cookie objects.")

    jar = CookieJar()
    for item in cookies:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        value = item.get("value")
        domain = item.get("domain") or ".leetcode.com"
        path = item.get("path") or "/"
        secure = bool(item.get("secure", True))
        if not name or value is None:
            continue
        jar.set_cookie(build_cookie(name, value, domain, path=path, secure=secure))
    return jar


def load_cookie_header(raw: str) -> CookieJar:
    header = raw
    if header.lower().startswith("cookie:"):
        header = header.split(":", 1)[1].strip()

    jar = CookieJar()
    for part in header.split(";"):
        if "=" not in part:
            continue
        name, value = part.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        jar.set_cookie(build_cookie(name, value, ".leetcode.com"))
    return jar


def graphql_request(opener, referer: str, operation_name: str, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps(
        {
            "operationName": operation_name,
            "variables": variables,
            "query": query,
        }
    ).encode("utf-8")

    request = Request(
        GRAPHQL_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Origin": "https://leetcode.com",
            "Referer": referer,
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )

    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT) as response:
            body = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GraphQL request failed for {operation_name}: HTTP {exc.code} {body}") from exc

    data = json.loads(body)
    errors = data.get("errors")
    if errors:
        raise RuntimeError(f"GraphQL request failed for {operation_name}: {json.dumps(errors)}")
    return data["data"]


def item_fetch_plan(item: dict[str, Any]) -> ItemFetchPlan | None:
    article = item.get("article")
    html_article = item.get("htmlArticle")
    video = item.get("video")
    web_page = item.get("webPage")
    question = item.get("question")

    if article and article.get("id"):
        return ItemFetchPlan("article", "GetArticle", GET_ARTICLE_QUERY, "articleId", article["id"])
    if html_article and html_article.get("id"):
        return ItemFetchPlan(
            "htmlArticle",
            "GetHtmlArticle",
            GET_HTML_ARTICLE_QUERY,
            "htmlArticleId",
            html_article["id"],
        )
    if video and video.get("id"):
        return ItemFetchPlan("video", "GetVideo", GET_VIDEO_QUERY, "videoId", video["id"])
    if web_page and web_page.get("id"):
        return ItemFetchPlan("webPage", "GetWebPage", GET_WEB_PAGE_QUERY, "webPageId", web_page["id"])
    if question and question.get("titleSlug"):
        return ItemFetchPlan("question", "GetQuestion", GET_QUESTION_QUERY, "titleSlug", question["titleSlug"])
    return None


def summarize_item_payload(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    if kind == "article":
        article = payload["article"]
        return {
            "title": article.get("title") or "",
            "rawContent": article.get("body") or "",
            "textContent": strip_html(article.get("body")),
            "extra": {},
        }
    if kind == "htmlArticle":
        article = payload["htmlArticle"]
        return {
            "title": "",
            "rawContent": article.get("html") or "",
            "textContent": strip_html(article.get("html")),
            "extra": {
                "originalLink": article.get("originalLink"),
                "editLink": article.get("editLink"),
            },
        }
    if kind == "video":
        video = payload["video"]
        raw = video.get("content") or video.get("html") or ""
        return {
            "title": "",
            "rawContent": raw,
            "textContent": strip_html(raw),
            "extra": {
                "html": video.get("html"),
                "editLink": video.get("editLink"),
            },
        }
    if kind == "webPage":
        web_page = payload["webPage"]
        raw = web_page.get("html") or ""
        return {
            "title": "",
            "rawContent": raw,
            "textContent": strip_html(raw),
            "extra": {
                "editLink": web_page.get("editLink"),
            },
        }
    if kind == "question":
        question = payload["question"]
        solution = question.get("solution") or {}
        raw_parts = [
            question.get("content") or "",
            question.get("translatedContent") or "",
            solution.get("content") or "",
        ]
        text_parts = [
            strip_html(question.get("content")),
            strip_html(question.get("translatedContent")),
            strip_html(solution.get("content")),
            " ".join(question.get("hints") or []),
        ]
        return {
            "title": question.get("questionTitle") or "",
            "rawContent": "\n\n".join(part for part in raw_parts if part),
            "textContent": normalize_space(" ".join(part for part in text_parts if part)),
            "extra": {
                "questionId": question.get("questionId"),
                "questionFrontendId": question.get("questionFrontendId"),
                "hints": question.get("hints") or [],
                "solution": solution,
            },
        }
    raise ValueError(f"Unsupported item kind: {kind}")


def build_opener_with_cookies(cookie_path: Path):
    cookies = load_cookies(cookie_path)
    return build_opener(HTTPCookieProcessor(cookies))


def export_course(root_url: str, cookie_path: Path, output_dir: Path, delay: float) -> dict[str, Any]:
    card_slug = parse_card_slug(root_url)
    opener = build_opener_with_cookies(cookie_path)

    card_data = graphql_request(
        opener,
        referer=root_url,
        operation_name="GetCardDetail",
        query=GET_CARD_DETAIL_QUERY,
        variables={"cardSlug": card_slug},
    )
    if delay > 0:
        time.sleep(delay)

    chapters_data = graphql_request(
        opener,
        referer=root_url,
        operation_name="GetChaptersWithItems",
        query=GET_CHAPTERS_WITH_ITEMS_QUERY,
        variables={"cardSlug": card_slug},
    )

    card = card_data["card"]
    chapters = chapters_data["chapters"]
    if not card_data.get("isCurrentUserAuthenticated", False):
        raise RuntimeError("LeetCode did not recognize the session. Re-export your cookies and try again.")

    chapters_dir = output_dir / "chapters"
    items_dir = output_dir / "items"
    chapters_dir.mkdir(parents=True, exist_ok=True)
    items_dir.mkdir(parents=True, exist_ok=True)

    manifest_chapters: list[dict[str, Any]] = []
    total_items = 0

    for chapter_index, chapter in enumerate(chapters, start=1):
        chapter_slug = chapter.get("slug") or chapter.get("id") or str(chapter_index)
        chapter_file = chapters_dir / f"{chapter_index:02d}-{slugify(chapter_slug, str(chapter_index))}.json"
        manifest_items: list[dict[str, Any]] = []

        for item_index, item in enumerate(chapter.get("items") or [], start=1):
            total_items += 1
            print(
                f"[chapter {chapter_index}/{len(chapters)} item {item_index}/{len(chapter.get('items') or [])}] "
                f"{item.get('title', '<untitled>')}"
            )

            plan = item_fetch_plan(item)
            fetch_result: dict[str, Any] = {
                "kind": None,
                "operationName": None,
                "sourceId": None,
                "status": "skipped",
                "rawData": None,
                "rawContent": "",
                "textContent": "",
                "extra": {},
            }

            if plan is not None:
                payload = graphql_request(
                    opener,
                    referer=root_url,
                    operation_name=plan.operation_name,
                    query=plan.query,
                    variables={plan.variable_name: plan.variable_value},
                )
                summary = summarize_item_payload(plan.kind, payload)
                fetch_result = {
                    "kind": plan.kind,
                    "operationName": plan.operation_name,
                    "sourceId": plan.variable_value,
                    "status": "ok",
                    "rawData": payload,
                    "rawContent": summary["rawContent"],
                    "textContent": summary["textContent"],
                    "extra": summary["extra"],
                }

            item_slug = slugify(item.get("title") or item.get("id") or f"item-{total_items}", f"item-{total_items}")
            item_file = items_dir / f"{total_items:03d}-{item_slug}.json"
            item_payload = {
                "courseSlug": card_slug,
                "chapterId": chapter.get("id"),
                "chapterTitle": chapter.get("title"),
                "itemOrder": item_index,
                "item": item,
                "content": fetch_result,
            }
            item_file.write_text(json.dumps(item_payload, indent=2), encoding="utf-8")

            manifest_items.append(
                {
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "type": item.get("type"),
                    "contentKind": fetch_result["kind"],
                    "status": fetch_result["status"],
                    "path": item_file.relative_to(output_dir).as_posix(),
                    "textLength": len(fetch_result["textContent"]),
                }
            )

            if delay > 0:
                time.sleep(delay)

        chapter_payload = {
            "courseSlug": card_slug,
            "chapterOrder": chapter_index,
            "chapter": chapter,
            "items": manifest_items,
        }
        chapter_file.write_text(json.dumps(chapter_payload, indent=2), encoding="utf-8")
        manifest_chapters.append(
            {
                "id": chapter.get("id"),
                "title": chapter.get("title"),
                "slug": chapter.get("slug"),
                "path": chapter_file.relative_to(output_dir).as_posix(),
                "itemCount": len(manifest_items),
                "items": manifest_items,
            }
        )

    return {
        "source": "LeetCode Explore",
        "rootUrl": root_url,
        "courseSlug": card_slug,
        "cookieSource": str(cookie_path),
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "course": {
            "id": card.get("id"),
            "title": card.get("title"),
            "slug": card.get("slug"),
            "description": card.get("description"),
            "descriptionText": strip_html(card.get("description")),
            "introduction": card.get("introduction"),
            "introText": card.get("introText"),
            "paidOnly": card.get("paidOnly"),
            "published": card.get("published"),
            "isPreview": card.get("isPreview"),
        },
        "chapterCount": len(manifest_chapters),
        "itemCount": total_items,
        "chapters": manifest_chapters,
        "nextStep": (
            "Review the exported chapter and item JSON under course_exports/, then "
            "convert the parts you want into MODULES entries inside build_study_data.py."
        ),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cookies",
        required=True,
        type=Path,
        help=(
            "Path to a LeetCode cookie export. Supported formats: Netscape cookies.txt, "
            "JSON cookie export, or a file containing a raw Cookie header."
        ),
    )
    parser.add_argument(
        "--root-url",
        default=DEFAULT_ROOT_URL,
        help="LeetCode course root URL to export.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory where chapter and item exports should be written.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.25,
        help="Seconds to sleep between GraphQL requests.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cookie_path = args.cookies.expanduser().resolve()
    if not cookie_path.exists():
        raise FileNotFoundError(f"Cookie file not found: {cookie_path}")

    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = export_course(
        root_url=args.root_url,
        cookie_path=cookie_path,
        output_dir=output_dir,
        delay=args.delay,
    )
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\nSaved {manifest['chapterCount']} chapters and {manifest['itemCount']} items to {output_dir}")
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
