from __future__ import annotations

import time

import requests

from config import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MAX_RETRIES,
    LLM_REQUEST_TIMEOUT,
    LLM_RETRY_BACKOFF_SECONDS,
    OPENROUTER_HTTP_REFERER,
    OPENROUTER_TITLE,
    PROCESSOR_MODEL,
)
from progress import progress_write


def complete_prompt(
    prompt: str,
    *,
    max_tokens: int,
    response_format: dict | None = None,
    reasoning: dict | None = None,
) -> str:
    if not LLM_API_KEY:
        raise RuntimeError("LLM_API_KEY or OPENROUTER_API_KEY is required")

    payload = {
        "model": PROCESSOR_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    if response_format is not None:
        payload["response_format"] = response_format
    if reasoning is not None:
        payload["reasoning"] = reasoning

    attempts = max(1, LLM_MAX_RETRIES)
    for attempt in range(1, attempts + 1):
        try:
            response = requests.post(
                f"{LLM_BASE_URL.rstrip('/')}/chat/completions",
                headers=_headers(),
                json=payload,
                timeout=LLM_REQUEST_TIMEOUT,
            )
            if response.status_code in {408, 409, 425, 429, 500, 502, 503, 504} and attempt < attempts:
                progress_write(
                    f"[LLM] HTTP {response.status_code} from {PROCESSOR_MODEL}; retrying "
                    f"{attempt + 1}/{attempts} after {LLM_RETRY_BACKOFF_SECONDS:.1f}s"
                )
                time.sleep(LLM_RETRY_BACKOFF_SECONDS)
                continue
            response.raise_for_status()
            payload = response.json()
            return _message_text(payload)
        except requests.exceptions.Timeout as exc:
            if attempt >= attempts:
                raise RuntimeError(
                    f"Timed out waiting for {PROCESSOR_MODEL} after {attempts} attempts "
                    f"({LLM_REQUEST_TIMEOUT}s each)"
                ) from exc
            progress_write(
                f"[LLM] Timeout from {PROCESSOR_MODEL}; retrying {attempt + 1}/{attempts} "
                f"after {LLM_RETRY_BACKOFF_SECONDS:.1f}s"
            )
            time.sleep(LLM_RETRY_BACKOFF_SECONDS)
        except requests.exceptions.RequestException as exc:
            if attempt < attempts and _is_retryable_request_exception(exc):
                progress_write(
                    f"[LLM] Transport error from {PROCESSOR_MODEL}; retrying {attempt + 1}/{attempts} "
                    f"after {LLM_RETRY_BACKOFF_SECONDS:.1f}s"
                )
                time.sleep(LLM_RETRY_BACKOFF_SECONDS)
                continue
            raise


def _headers() -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    if "openrouter.ai" in LLM_BASE_URL:
        if OPENROUTER_HTTP_REFERER:
            headers["HTTP-Referer"] = OPENROUTER_HTTP_REFERER
        if OPENROUTER_TITLE:
            headers["X-Title"] = OPENROUTER_TITLE
    return headers


def _message_text(payload: dict) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Chat completion response missing choices")

    choice = choices[0]
    message = choice.get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        text = content.strip()
        if text:
            return text
    if isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            item_type = str(item.get("type", ""))
            if item_type in {"text", "output_text"}:
                text = item.get("text", "")
                if isinstance(text, dict):
                    text = text.get("value", "")
                parts.append(str(text))
        text = "".join(parts).strip()
        if text:
            return text
    if isinstance(choice.get("text"), str) and choice["text"].strip():
        return choice["text"].strip()

    finish_reason = str(choice.get("finish_reason", ""))
    refusal = str(message.get("refusal", "")).strip()
    reasoning = str(message.get("reasoning", "")).strip()
    diagnostic = {
        "finish_reason": finish_reason,
        "message_keys": sorted(message.keys()) if isinstance(message, dict) else [],
        "choice_keys": sorted(choice.keys()) if isinstance(choice, dict) else [],
        "has_refusal": bool(refusal),
        "has_reasoning": bool(reasoning),
    }
    if refusal:
        raise RuntimeError(f"Chat completion refused request: {refusal}")
    raise RuntimeError(f"Chat completion response missing text content: {diagnostic}")


def _is_retryable_request_exception(exc: requests.exceptions.RequestException) -> bool:
    if isinstance(exc, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)):
        return True
    message = str(exc).casefold()
    return "timed out" in message or "temporarily unavailable" in message
