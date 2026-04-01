from __future__ import annotations

from enum import Enum
from urllib.parse import parse_qs, urlparse


class UrlType(str, Enum):
    YOUTUBE_VIDEO = "youtube_video"
    YOUTUBE_PLAYLIST = "youtube_playlist"
    COURSERA = "coursera"
    GITHUB_PDF = "github_pdf"
    GITHUB_MARKDOWN = "github_markdown"
    GITHUB_REPO = "github_repo"
    SHORTLINK = "shortlink"
    PLATFORM = "platform"
    ARCHIVE = "archive"
    ARTICLE = "article"


SHORTLINK_DOMAINS = {
    "amzn.to",
    "bit.ly",
    "buff.ly",
    "geni.us",
    "goo.gl",
    "ow.ly",
    "rebrand.ly",
    "shorturl.at",
    "t.co",
    "tinyurl.com",
}

PLATFORM_DOMAINS = {
    "amazon.com",
    "interviewing.io",
    "pramp.com",
    "www.amazon.com",
    "www.interviewing.io",
    "www.pramp.com",
}


def classify(url: str) -> UrlType:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path.lower()
    query = parse_qs(parsed.query)

    if host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if path == "/watch" and query.get("v"):
            return UrlType.YOUTUBE_VIDEO
        if path == "/playlist" and not query.get("v"):
            return UrlType.YOUTUBE_PLAYLIST

    if host == "youtu.be":
        return UrlType.YOUTUBE_VIDEO

    if host.endswith("coursera.org"):
        return UrlType.COURSERA

    if host.endswith("github.com"):
        if path.endswith(".pdf"):
            return UrlType.GITHUB_PDF
        if path.endswith(".md"):
            return UrlType.GITHUB_MARKDOWN
        return UrlType.GITHUB_REPO

    if host in SHORTLINK_DOMAINS:
        return UrlType.SHORTLINK

    if host in PLATFORM_DOMAINS:
        return UrlType.PLATFORM

    if host.endswith("archive.org"):
        return UrlType.ARCHIVE

    return UrlType.ARTICLE
