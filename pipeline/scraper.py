from __future__ import annotations

import base64
import binascii
import io
import re
from collections import deque
from dataclasses import asdict, dataclass, field
from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qs, urljoin, urlparse

import requests
import trafilatura
from pypdf import PdfReader
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from config import (
    MAX_ARTICLE_CHARS,
    MAX_GITHUB_DOC_FILES,
    MAX_SITE_CRAWL_DEPTH,
    MAX_SITE_CRAWL_PAGES,
    MAX_TRANSCRIPT_CHARS,
    REQUEST_TIMEOUT,
)
from url_classifier import UrlType, classify

_GITHUB_API_HEADERS = {"Accept": "application/vnd.github+json"}
_HTTP_HEADERS = {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
}
_NON_HTML_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".css",
    ".js",
    ".mjs",
    ".map",
    ".json",
    ".xml",
    ".zip",
    ".gz",
    ".tar",
    ".tgz",
    ".mp3",
    ".mp4",
    ".mov",
    ".avi",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".pdf",
}
_DOC_KEYWORDS = (
    "algorithm",
    "api",
    "architecture",
    "basics",
    "concept",
    "course",
    "data-structure",
    "design",
    "doc",
    "guide",
    "handbook",
    "interview",
    "learn",
    "machine-learning",
    "notes",
    "overview",
    "pattern",
    "react",
    "reference",
    "system-design",
    "tutorial",
)
_DEPRIORITIZED_PATH_TOKENS = (
    "about",
    "account",
    "author",
    "blog/tag",
    "careers",
    "contact",
    "cookie",
    "login",
    "logout",
    "pricing",
    "privacy",
    "review",
    "reviews",
    "search",
    "signup",
    "subscribe",
    "tag/",
    "terms",
)
_SKIP_GITHUB_NAMES = {
    "changelog",
    "code_of_conduct",
    "contributing",
    "license",
    "security",
}
_TEXTUAL_GITHUB_EXTENSIONS = {".md", ".mdx", ".rst", ".txt"}
_BINARY_GITHUB_EXTENSIONS = {".pdf"}
_SKIP_MARKDOWN_CRAWL_DOMAINS = {"github.com", "www.github.com", "raw.githubusercontent.com"}


@dataclass
class ScrapeResult:
    url: str
    url_type: UrlType
    resolved_url: str
    content: str
    title: str
    og_description: str
    status: str
    error: str | None
    segments: list[dict] = field(default_factory=list)


@dataclass
class ScrapedSegment:
    segment_id: str
    kind: str
    source_url: str
    title: str
    heading_path: list[str]
    text: str
    links: list[str] = field(default_factory=list)


@dataclass
class PageSnapshot:
    url: str
    title: str
    description: str
    content: str


class _LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.links.append(value)
                break


def scrape_url(url: str) -> ScrapeResult:
    return _scrape_url(url, depth=0)


def _scrape_url(url: str, depth: int) -> ScrapeResult:
    try:
        url_type = classify(url)

        if url_type == UrlType.YOUTUBE_VIDEO:
            return _scrape_youtube_video(url)
        if url_type == UrlType.YOUTUBE_PLAYLIST:
            return _fallback_from_url(url, url_type)
        if url_type == UrlType.COURSERA:
            return _scrape_coursera(url)
        if url_type == UrlType.GITHUB_PDF:
            return _scrape_github_pdf(url)
        if url_type == UrlType.GITHUB_MARKDOWN:
            return _scrape_github_markdown(url)
        if url_type == UrlType.GITHUB_REPO:
            return _scrape_github_repo(url)
        if url_type == UrlType.SHORTLINK:
            return _scrape_shortlink(url, depth)
        if url_type == UrlType.PLATFORM:
            return _fallback_from_url(url, url_type)
        if url_type == UrlType.ARCHIVE:
            return _scrape_article_like(url, url_type, min_chars=100)
        return _scrape_article_like(url, url_type, min_chars=100)
    except Exception as exc:
        return ScrapeResult(
            url=url,
            url_type=classify(url),
            resolved_url=url,
            content="",
            title="",
            og_description="",
            status="failed",
            error=str(exc),
        )


def _scrape_youtube_video(url: str) -> ScrapeResult:
    video_id = _youtube_video_id(url)
    start_seconds = _youtube_start_seconds(url)

    try:
        transcript = _youtube_transcript(video_id)
        if start_seconds:
            transcript = _trim_transcript(transcript, start_seconds)
        content = " ".join(item.get("text", "").strip() for item in transcript).strip()
        content = content[:MAX_TRANSCRIPT_CHARS]
        return ScrapeResult(
            url=url,
            url_type=UrlType.YOUTUBE_VIDEO,
            resolved_url=url,
            content=content,
            title="",
            og_description="",
            status="ok",
            error=None,
            segments=[
                asdict(
                    ScrapedSegment(
                        segment_id=f"youtube:{video_id}",
                        kind="youtube_transcript",
                        source_url=url,
                        title="YouTube transcript",
                        heading_path=["Transcript"],
                        text=content,
                    )
                )
            ],
        )
    except Exception:
        return _fallback_from_url(url, UrlType.YOUTUBE_VIDEO, resolved_url=url)


def _scrape_article_like(url: str, url_type: UrlType, min_chars: int) -> ScrapeResult:
    response = _http_get(url, allow_redirects=True)
    response.raise_for_status()

    resolved_url = _normalize_crawl_url(response.url)
    title, description = _extract_html_metadata(response.text)
    if _should_fallback_article_url(url, resolved_url, title, url_type):
        return ScrapeResult(
            url=url,
            url_type=url_type,
            resolved_url=resolved_url,
            content="",
            title=title,
            og_description=description,
            status="fallback",
            error=None,
            segments=[],
        )
    pages = _crawl_site(resolved_url, response.text)
    content = _aggregate_pages(pages)

    if len(content) < min_chars:
        return ScrapeResult(
            url=url,
            url_type=url_type,
            resolved_url=resolved_url,
            content="",
            title=title,
            og_description=description,
            status="fallback",
            error=None,
            segments=[],
        )

    segments = [_segment_from_page(page) for page in pages if page.content]

    return ScrapeResult(
        url=url,
        url_type=url_type,
        resolved_url=resolved_url,
        content=_aggregate_pages(pages),
        title=title,
        og_description=description,
        status="ok",
        error=None,
        segments=segments,
    )


def _scrape_coursera(url: str) -> ScrapeResult:
    return _scrape_article_like(url, UrlType.COURSERA, min_chars=200)


def _should_fallback_article_url(requested_url: str, resolved_url: str, title: str, url_type: UrlType) -> bool:
    if url_type != UrlType.COURSERA:
        return False

    requested_path = urlparse(requested_url).path.casefold()
    resolved_path = urlparse(resolved_url).path.casefold()
    title_lower = title.casefold()

    if "/reviews" in resolved_path:
        return True
    if "/lecture/" in requested_path and "/lecture/" not in resolved_path:
        return True
    if "/lecture/" in requested_path and "join for free" in title_lower:
        return True

    return False


def _scrape_github_pdf(url: str) -> ScrapeResult:
    raw_url = _github_raw_url(url)
    response = _http_get(raw_url)
    response.raise_for_status()
    content = _pdf_text_from_bytes(response.content)
    if not content:
        return _fallback_from_url(url, UrlType.GITHUB_PDF)
    return ScrapeResult(
        url=url,
        url_type=UrlType.GITHUB_PDF,
        resolved_url=raw_url,
        content=content[:MAX_ARTICLE_CHARS],
        title=_path_tail(url),
        og_description="",
        status="ok",
        error=None,
        segments=[
            asdict(
                ScrapedSegment(
                    segment_id=f"pdf:{_stable_id(raw_url)}",
                    kind="github_pdf",
                    source_url=raw_url,
                    title=_path_tail(url),
                    heading_path=[_path_tail(url)],
                    text=content[:MAX_ARTICLE_CHARS],
                )
            )
        ],
    )


def _scrape_github_markdown(url: str) -> ScrapeResult:
    raw_url = _github_raw_url(url)
    response = _http_get(raw_url)
    response.raise_for_status()
    content = response.text.strip()
    markdown_segment = _markdown_segment(
        source_url=raw_url,
        title=_path_tail(url),
        heading_path=[_path_tail(url)],
        text=content[:MAX_ARTICLE_CHARS],
        base_link_url=url,
        link_source_text=content,
    )
    linked_segments = _crawl_markdown_link_segments(url, content)
    aggregated = _append_limited("", f"Repository file: {_path_tail(url)}\n{content}")
    aggregated = _append_segment_content(aggregated, linked_segments)
    return ScrapeResult(
        url=url,
        url_type=UrlType.GITHUB_MARKDOWN,
        resolved_url=raw_url,
        content=aggregated,
        title=_path_tail(url),
        og_description="",
        status="ok",
        error=None,
        segments=[markdown_segment, *linked_segments],
    )


def _scrape_github_repo(url: str) -> ScrapeResult:
    owner, repo = _github_repo_slug(url)
    repo_payload = _github_api_get(f"https://api.github.com/repos/{owner}/{repo}")
    default_branch = str(repo_payload.get("default_branch") or "main")
    tree_payload = _github_api_get(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
    )

    selected_paths = _select_github_doc_paths(tree_payload.get("tree", []))
    content, segments = _aggregate_github_repo_files(owner, repo, default_branch, selected_paths)

    if not content:
        readme_payload = _github_api_get(f"https://api.github.com/repos/{owner}/{repo}/readme")
        readme_content = _github_readme_content(readme_payload)
        if readme_content:
            readme_html_url = str(readme_payload.get("html_url") or url)
            markdown_segment = _markdown_segment(
                source_url=readme_html_url,
                title=str(readme_payload.get("path") or "README.md"),
                heading_path=[str(readme_payload.get("path") or "README.md")],
                text=readme_content[:MAX_ARTICLE_CHARS],
                base_link_url=readme_html_url,
                link_source_text=readme_content,
            )
            linked_segments = _crawl_markdown_link_segments(readme_html_url, readme_content)
            content = _append_limited(
                "",
                f"Repository file: {readme_payload.get('path', 'README.md')}\n{readme_content}",
            )
            content = _append_segment_content(content, linked_segments)
            segments = [markdown_segment, *linked_segments]

    if not content:
        return _fallback_from_url(url, UrlType.GITHUB_REPO)

    return ScrapeResult(
        url=url,
        url_type=UrlType.GITHUB_REPO,
        resolved_url=str(repo_payload.get("html_url") or url),
        content=content,
        title=str(repo_payload.get("full_name") or f"{owner}/{repo}"),
        og_description=str(repo_payload.get("description") or ""),
        status="ok",
        error=None,
        segments=segments,
    )


def _scrape_shortlink(url: str, depth: int) -> ScrapeResult:
    try:
        response = _http_get(url, allow_redirects=True)
        response.raise_for_status()
    except Exception:
        return _fallback_from_url(url, UrlType.SHORTLINK)

    resolved_url = response.url
    resolved_type = classify(resolved_url)
    title, description = _extract_html_metadata(response.text)
    if resolved_type == UrlType.PLATFORM:
        return ScrapeResult(
            url=url,
            url_type=resolved_type,
            resolved_url=resolved_url,
            content="",
            title=title,
            og_description=description,
            status="fallback",
            error=None,
            segments=[],
        )
    if depth >= 1:
        return ScrapeResult(
            url=url,
            url_type=resolved_type,
            resolved_url=resolved_url,
            content="",
            title=title,
            og_description=description,
            status="fallback",
            error=None,
            segments=[],
        )

    nested = _scrape_url(resolved_url, depth=depth + 1)
    if nested.status == "failed":
        return _fallback_from_url(
            url,
            resolved_type,
            resolved_url=resolved_url,
            title=title,
            description=description,
        )
    return ScrapeResult(
        url=url,
        url_type=nested.url_type,
        resolved_url=nested.resolved_url,
        content=nested.content,
        title=nested.title,
        og_description=nested.og_description,
        status=nested.status,
        error=nested.error,
        segments=nested.segments,
    )


def _crawl_site(start_url: str, start_html: str) -> list[PageSnapshot]:
    start_url = _normalize_crawl_url(start_url)
    allowed_host = urlparse(start_url).netloc.lower()
    queue = deque([(start_url, 0, start_html)])
    visited = set()
    queued = {start_url}
    snapshots: list[PageSnapshot] = []

    while queue and len(snapshots) < MAX_SITE_CRAWL_PAGES:
        current_url, depth, html_text = queue.popleft()
        visited.add(current_url)
        snapshot = _page_snapshot(current_url, html_text)
        if snapshot.content or snapshot.description:
            snapshots.append(snapshot)

        if depth >= MAX_SITE_CRAWL_DEPTH or len(snapshots) >= MAX_SITE_CRAWL_PAGES:
            continue

        for candidate_url in _extract_candidate_links(current_url, html_text, allowed_host):
            if candidate_url in visited or candidate_url in queued:
                continue

            try:
                response = _http_get(candidate_url, allow_redirects=True)
                response.raise_for_status()
            except Exception:
                continue

            resolved_url = _normalize_crawl_url(response.url)
            if urlparse(resolved_url).netloc.lower() != allowed_host:
                continue
            if resolved_url in visited or resolved_url in queued:
                continue
            if not _is_html_response(response):
                continue

            queued.add(candidate_url)
            queued.add(resolved_url)
            queue.append((resolved_url, depth + 1, response.text))

    return snapshots


def _page_snapshot(url: str, html_text: str) -> PageSnapshot:
    title, description = _extract_html_metadata(html_text)
    content = (trafilatura.extract(html_text) or "").strip()
    return PageSnapshot(url=url, title=title, description=description, content=content)


def _aggregate_pages(pages: list[PageSnapshot]) -> str:
    aggregated = ""
    for page in pages:
        body = page.content or page.description
        if not body:
            continue
        title_line = page.title or _path_tail(page.url) or page.url
        section = f"Source page: {page.url}\nTitle: {title_line}\n{body}"
        aggregated = _append_limited(aggregated, section)
        if len(aggregated) >= MAX_ARTICLE_CHARS:
            break
    return aggregated


def _aggregate_github_repo_files(owner: str, repo: str, branch: str, paths: list[str]) -> tuple[str, list[dict]]:
    aggregated = ""
    segments: list[dict] = []
    crawled_links: set[str] = set()
    for path in paths:
        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
        try:
            response = _http_get(raw_url)
            response.raise_for_status()
        except Exception:
            continue

        lower_path = path.lower()
        if lower_path.endswith(".pdf"):
            content = _pdf_text_from_bytes(response.content)
        else:
            content = response.text.strip()

        if not content:
            continue

        if lower_path.endswith(".pdf"):
            segments.append(
                asdict(
                    ScrapedSegment(
                        segment_id=f"github_file:{_stable_id(raw_url)}",
                        kind="github_pdf",
                        source_url=raw_url,
                        title=path,
                        heading_path=path.split("/"),
                        text=content[:MAX_ARTICLE_CHARS],
                    )
                )
            )
        else:
            html_url = f"https://github.com/{owner}/{repo}/blob/{branch}/{path}"
            segments.append(
                _markdown_segment(
                    source_url=raw_url,
                    title=path,
                    heading_path=path.split("/"),
                    text=content[:MAX_ARTICLE_CHARS],
                    base_link_url=html_url,
                    link_source_text=content,
                )
            )
            linked_segments = _crawl_markdown_link_segments(html_url, content, crawled_links)
            segments.extend(linked_segments)
        aggregated = _append_limited(aggregated, f"Repository file: {path}\n{content}")
        aggregated = _append_segment_content(aggregated, linked_segments if not lower_path.endswith(".pdf") else [])
        if len(aggregated) >= MAX_ARTICLE_CHARS:
            break
    return aggregated, segments


def _select_github_doc_paths(entries: list[dict]) -> list[str]:
    scored = []
    for entry in entries:
        if entry.get("type") != "blob":
            continue
        path = str(entry.get("path") or "")
        if not path:
            continue

        lower_path = path.lower()
        suffix = _path_suffix(lower_path)
        if suffix not in _TEXTUAL_GITHUB_EXTENSIONS | _BINARY_GITHUB_EXTENSIONS:
            continue

        stem = lower_path.rsplit("/", 1)[-1].split(".", 1)[0]
        if stem in _SKIP_GITHUB_NAMES:
            continue

        score = 0
        if lower_path.startswith("readme."):
            score += 100
        if "/readme." in lower_path:
            score += 80
        if lower_path.startswith("docs/") or "/docs/" in lower_path:
            score += 50
        for keyword in _DOC_KEYWORDS:
            if keyword in lower_path:
                score += 15
        if suffix == ".pdf":
            score += 5
        score -= lower_path.count("/")

        scored.append((score, len(lower_path), path))

    scored.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [path for _, _, path in scored[:MAX_GITHUB_DOC_FILES]]


def _extract_candidate_links(base_url: str, html_text: str, allowed_host: str) -> list[str]:
    collector = _LinkCollector()
    collector.feed(html_text)

    ranked: list[tuple[int, str]] = []
    seen = set()
    base_prefix = _prefix_path(urlparse(base_url).path)

    for raw_href in collector.links:
        candidate = _normalize_link(base_url, raw_href)
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)

        parsed = urlparse(candidate)
        if parsed.netloc.lower() != allowed_host:
            continue
        if not _is_crawlable_html_path(parsed.path):
            continue

        score = 0
        lower_path = parsed.path.lower()
        if _prefix_path(parsed.path) == base_prefix:
            score += 10
        for keyword in _DOC_KEYWORDS:
            if keyword in lower_path:
                score += 15
        for token in _DEPRIORITIZED_PATH_TOKENS:
            if token in lower_path:
                score -= 40
        score -= lower_path.count("/")
        ranked.append((score, candidate))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [candidate for _, candidate in ranked[: MAX_SITE_CRAWL_PAGES * 3]]


def _normalize_link(base_url: str, href: str) -> str | None:
    href = href.strip()
    if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("javascript:"):
        return None

    normalized = _normalize_crawl_url(urljoin(base_url, href))
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        return None
    return normalized


def _normalize_crawl_url(url: str) -> str:
    parsed = urlparse(url)
    cleaned_path = parsed.path or "/"
    return parsed._replace(fragment="", query="").geturl().rstrip("/")


def _is_html_response(response: requests.Response) -> bool:
    content_type = str(response.headers.get("Content-Type", "")).lower()
    return not content_type or "html" in content_type or "text/" in content_type


def _is_crawlable_html_path(path: str) -> bool:
    lower_path = path.lower()
    suffix = _path_suffix(lower_path)
    return suffix not in _NON_HTML_EXTENSIONS


def _path_suffix(path: str) -> str:
    if "." not in path.rsplit("/", 1)[-1]:
        return ""
    return "." + path.rsplit(".", 1)[-1]


def _prefix_path(path: str) -> str:
    parts = [part for part in path.split("/") if part]
    return parts[0] if parts else ""


def _append_limited(existing: str, section: str) -> str:
    section = section.strip()
    if not section:
        return existing
    candidate = section if not existing else f"{existing}\n\n{section}"
    return candidate[:MAX_ARTICLE_CHARS]


def _segment_from_page(page: PageSnapshot) -> dict:
    title = page.title or _path_tail(page.url) or page.url
    return asdict(
        ScrapedSegment(
            segment_id=f"page:{_stable_id(page.url)}",
            kind="web_page",
            source_url=page.url,
            title=title,
            heading_path=[title],
            text=page.content[:MAX_ARTICLE_CHARS],
        )
    )


def _markdown_segment(
    *,
    source_url: str,
    title: str,
    heading_path: list[str],
    text: str,
    base_link_url: str,
    link_source_text: str | None = None,
) -> dict:
    return asdict(
        ScrapedSegment(
            segment_id=f"markdown:{_stable_id(source_url)}",
            kind="github_markdown",
            source_url=source_url,
            title=title,
            heading_path=heading_path,
            text=text,
            links=_extract_markdown_links(link_source_text or text, base_link_url),
        )
    )


def _crawl_markdown_link_segments(base_url: str, markdown_text: str, seen_links: set[str] | None = None) -> list[dict]:
    seen_links = seen_links if seen_links is not None else set()
    candidates = [link for link in _extract_markdown_links(markdown_text, base_url) if _should_crawl_markdown_link(link)]
    linked_segments: list[dict] = []

    for link in candidates:
        if link in seen_links:
            continue
        seen_links.add(link)
        result = _scrape_url(link, depth=0)
        if result.status != "ok":
            continue
        for segment in result.segments:
            text = str(segment.get("text") or "").strip()
            if not text:
                continue
            linked_segments.append(segment)

    return linked_segments


def _should_crawl_markdown_link(link: str) -> bool:
    host = urlparse(link).netloc.casefold()
    return bool(host) and host not in _SKIP_MARKDOWN_CRAWL_DOMAINS


def _extract_markdown_links(markdown_text: str, base_url: str) -> list[str]:
    candidates = []
    for href in re.findall(r"\[[^\]]+\]\(([^)\s]+)", markdown_text):
        candidates.append(href)
    for href in re.findall(r"https?://[^\s)>\"]+", markdown_text):
        candidates.append(href)

    normalized_links = []
    seen = set()
    for href in candidates:
        normalized = _normalize_link(base_url, href)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        normalized_links.append(normalized)
    return normalized_links


def _append_segment_content(existing: str, segments: list[dict]) -> str:
    aggregated = existing
    for segment in segments:
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        title = str(segment.get("title") or segment.get("source_url") or "").strip()
        section = f"Linked source: {segment.get('source_url')}\nTitle: {title}\n{text}"
        aggregated = _append_limited(aggregated, section)
        if len(aggregated) >= MAX_ARTICLE_CHARS:
            break
    return aggregated


def _fallback_from_url(
    url: str,
    url_type: UrlType,
    *,
    resolved_url: str | None = None,
    title: str = "",
    description: str = "",
) -> ScrapeResult:
    try:
        fetched_resolved_url, fetched_title, fetched_description = _fetch_og_metadata(resolved_url or url)
        resolved_url = fetched_resolved_url
        title = title or fetched_title
        description = description or fetched_description
    except Exception:
        resolved_url = resolved_url or url
    return ScrapeResult(
        url=url,
        url_type=url_type,
        resolved_url=resolved_url,
        content="",
        title=title,
        og_description=description,
        status="fallback",
        error=None,
    )


def _fetch_og_metadata(url: str) -> tuple[str, str, str]:
    response = _http_get(url, allow_redirects=True)
    response.raise_for_status()
    title, description = _extract_html_metadata(response.text)
    return response.url, title, description


def _extract_html_metadata(html_text: str) -> tuple[str, str]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.IGNORECASE | re.DOTALL)
    title = _clean_html_text(title_match.group(1)) if title_match else ""

    description = ""
    for pattern in (
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']og:description["\']',
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']',
    ):
        match = re.search(pattern, html_text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            description = _clean_html_text(match.group(1))
            break

    return title, description


def _clean_html_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    return " ".join(value.split())


def _http_get(url: str, *, allow_redirects: bool = False) -> requests.Response:
    return requests.get(
        url,
        headers=_HTTP_HEADERS,
        allow_redirects=allow_redirects,
        timeout=REQUEST_TIMEOUT,
    )


def _github_api_get(url: str) -> dict:
    response = requests.get(
        url,
        headers={**_HTTP_HEADERS, **_GITHUB_API_HEADERS},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def _github_raw_url(url: str) -> str:
    base_url = url.split("#", 1)[0].split("?", 1)[0]
    return base_url.replace("https://github.com/", "https://raw.githubusercontent.com/", 1).replace("/blob/", "/", 1)


def _github_repo_slug(url: str) -> tuple[str, str]:
    path_parts = [part for part in urlparse(url).path.split("/") if part]
    if len(path_parts) < 2:
        raise ValueError(f"Unable to parse GitHub repository from URL: {url}")
    return path_parts[0], path_parts[1]


def _github_readme_content(payload: dict) -> str:
    encoded = payload.get("content")
    if isinstance(encoded, str) and str(payload.get("encoding", "")).lower() == "base64":
        normalized = encoded.replace("\n", "")
        try:
            decoded = base64.b64decode(normalized)
            text = decoded.decode("utf-8", errors="replace").strip()
            if text:
                return text
        except (binascii.Error, ValueError):
            return ""
    return ""


def _pdf_text_from_bytes(content_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(content_bytes))
    return "\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()


def _youtube_video_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc.lower() == "youtu.be":
        return parsed.path.lstrip("/")
    query = parse_qs(parsed.query)
    video_ids = query.get("v")
    if not video_ids:
        raise ValueError(f"Missing YouTube video ID for URL: {url}")
    return video_ids[0]


def _youtube_start_seconds(url: str) -> int:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if "t" in query and query["t"]:
        return _parse_seconds(query["t"][0])
    if "start" in query and query["start"]:
        return _parse_seconds(query["start"][0])
    return 0


def _parse_seconds(value: str) -> int:
    value = value.strip().lower()
    if value.isdigit():
        return int(value)
    if value.endswith("s") and value[:-1].isdigit():
        return int(value[:-1])

    total = 0
    matches = re.findall(r"(\d+)([hms])", value)
    for amount, unit in matches:
        number = int(amount)
        if unit == "h":
            total += number * 3600
        elif unit == "m":
            total += number * 60
        else:
            total += number
    return total


def _trim_transcript(transcript: list[dict], start_seconds: int) -> list[dict]:
    trimmed = []
    for item in transcript:
        start = float(item.get("start", 0))
        duration = float(item.get("duration", 0))
        if start + duration >= start_seconds:
            trimmed.append(item)
    return trimmed


def _path_tail(url: str) -> str:
    return urlparse(url).path.rsplit("/", 1)[-1]


def _stable_id(value: str) -> str:
    import hashlib

    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def _youtube_transcript(video_id: str) -> list[dict]:
    api = YouTubeTranscriptApi()
    if hasattr(api, "fetch"):
        fetched = api.fetch(video_id, languages=("en",))
        return [item.to_raw_data() if hasattr(item, "to_raw_data") else _snippet_dict(item) for item in fetched]
    if hasattr(YouTubeTranscriptApi, "get_transcript"):
        return YouTubeTranscriptApi.get_transcript(video_id)
    raise RuntimeError("youtube-transcript-api does not expose a supported transcript API")


def _snippet_dict(item: object) -> dict:
    return {
        "text": str(getattr(item, "text", "")),
        "start": float(getattr(item, "start", 0)),
        "duration": float(getattr(item, "duration", 0)),
    }
