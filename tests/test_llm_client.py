import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"

for path in (ROOT, PIPELINE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")


import llm_client


class LlmClientTests(unittest.TestCase):
    def test_message_text_accepts_output_text_parts(self):
        payload = {
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {
                        "role": "assistant",
                        "content": [
                            {"type": "output_text", "text": {"value": "{\"ok\":true}"}},
                        ],
                    },
                }
            ]
        }

        self.assertEqual(llm_client._message_text(payload), "{\"ok\":true}")

    def test_message_text_raises_diagnostic_when_content_missing(self):
        payload = {
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {
                        "role": "assistant",
                        "reasoning": "internal chain",
                    },
                }
            ]
        }

        with self.assertRaises(RuntimeError) as exc:
            llm_client._message_text(payload)

        self.assertIn("missing text content", str(exc.exception))
        self.assertIn("has_reasoning", str(exc.exception))

    def test_complete_prompt_retries_timeout_then_succeeds(self):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            "choices": [{"message": {"content": "{\"ok\":true}"}}]
        }
        response.raise_for_status.return_value = None

        with patch.object(llm_client, "LLM_MAX_RETRIES", 3), patch.object(
            llm_client, "LLM_REQUEST_TIMEOUT", 42
        ), patch.object(llm_client, "LLM_RETRY_BACKOFF_SECONDS", 0), patch.object(
            llm_client.requests,
            "post",
            side_effect=[llm_client.requests.exceptions.Timeout(), response],
        ) as mock_post, patch.object(llm_client, "progress_write") as mock_progress, patch.object(
            llm_client.time, "sleep"
        ) as mock_sleep:
            text = llm_client.complete_prompt("hello", max_tokens=100)

        self.assertEqual(text, "{\"ok\":true}")
        self.assertEqual(mock_post.call_count, 2)
        self.assertEqual(mock_progress.call_count, 1)
        mock_sleep.assert_called_once_with(0)

    def test_complete_prompt_raises_after_exhausting_timeouts(self):
        with patch.object(llm_client, "LLM_MAX_RETRIES", 2), patch.object(
            llm_client, "LLM_REQUEST_TIMEOUT", 7
        ), patch.object(llm_client, "LLM_RETRY_BACKOFF_SECONDS", 0), patch.object(
            llm_client.requests,
            "post",
            side_effect=llm_client.requests.exceptions.Timeout(),
        ), patch.object(llm_client, "progress_write"), patch.object(
            llm_client.time, "sleep"
        ):
            with self.assertRaises(RuntimeError) as exc:
                llm_client.complete_prompt("hello", max_tokens=100)

        self.assertIn("Timed out waiting", str(exc.exception))
        self.assertIn("7s each", str(exc.exception))


if __name__ == "__main__":
    unittest.main()
