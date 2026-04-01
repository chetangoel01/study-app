from __future__ import annotations

import hashlib
import re

from config import CHUNK_TARGET_CHARS


def chunk_document(document: dict) -> list[dict]:
    text = str(document.get("text") or "").strip()
    if not text:
        return []

    sections = _markdown_sections(text, document) or _paragraph_sections(text, document)
    chunks = []
    ordinal = 0

    for section in sections:
        for chunk_text in _split_to_size(section["text"], CHUNK_TARGET_CHARS):
            chunk_text = chunk_text.strip()
            if not chunk_text:
                continue
            ordinal += 1
            chunk_id = _chunk_id(document["document_id"], ordinal, chunk_text)
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "document_id": document["document_id"],
                    "module_id": document["module_id"],
                    "module_title": document.get("module_title"),
                    "module_phase": document.get("module_phase"),
                    "resource_label": document.get("resource_label"),
                    "resource_type": document.get("resource_type"),
                    "status": document.get("status"),
                    "resource_url": document["resource_url"],
                    "source_url": document["source_url"],
                    "resolved_url": document.get("resolved_url"),
                    "kind": document.get("kind"),
                    "title": document["title"],
                    "segment_title": document.get("segment_title"),
                    "heading_path": section["heading_path"],
                    "ordinal": ordinal,
                    "text": chunk_text,
                }
            )

    return chunks


def _markdown_sections(text: str, document: dict) -> list[dict]:
    lines = text.splitlines()
    sections = []
    current_heading = list(document.get("heading_path") or [document["title"]])
    current_lines = []
    saw_heading = False

    for line in lines:
        match = re.match(r"^(#{1,6})\s+(.*\S)\s*$", line)
        if match:
            saw_heading = True
            if current_lines:
                sections.append(
                    {
                        "heading_path": current_heading,
                        "text": "\n".join(current_lines).strip(),
                    }
                )
                current_lines = []

            level = len(match.group(1))
            heading = match.group(2).strip()
            current_heading = current_heading[: max(0, level - 1)] + [heading]
            continue

        current_lines.append(line)

    if current_lines:
        sections.append(
            {
                "heading_path": current_heading,
                "text": "\n".join(current_lines).strip(),
            }
        )

    return sections if saw_heading else []


def _paragraph_sections(text: str, document: dict) -> list[dict]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if not paragraphs:
        paragraphs = [text]
    return [
        {
            "heading_path": list(document.get("heading_path") or [document["title"]]),
            "text": "\n\n".join(paragraphs),
        }
    ]


def _split_to_size(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if not paragraphs:
        return [text[:limit]]

    chunks = []
    current = ""
    for paragraph in paragraphs:
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(paragraph) <= limit:
            current = paragraph
            continue
        chunks.extend(_split_long_paragraph(paragraph, limit))
        current = ""
    if current:
        chunks.append(current)
    return chunks


def _split_long_paragraph(paragraph: str, limit: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    chunks = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        candidate = sentence if not current else f"{current} {sentence}"
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(sentence) <= limit:
            current = sentence
            continue
        chunks.extend([sentence[index : index + limit] for index in range(0, len(sentence), limit)])
        current = ""
    if current:
        chunks.append(current)
    return chunks


def _chunk_id(document_id: str, ordinal: int, text: str) -> str:
    digest = hashlib.sha1(f"{document_id}:{ordinal}:{text}".encode("utf-8")).hexdigest()[:12]
    return f"chunk:{digest}"
