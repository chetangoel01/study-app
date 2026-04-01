import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - optional dependency for local convenience
    def load_dotenv(path: Path) -> bool:
        if not path.exists():
            return False
        loaded = False
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")
            if not key or key in os.environ:
                continue
            os.environ[key] = value
            loaded = True
        return loaded

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent
CACHE_DIR = PIPELINE_DIR / ".cache"
OUTPUT_PATH = REPO_ROOT / "study-app" / "knowledge-base.json"

load_dotenv(REPO_ROOT / "study-app" / ".env")

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", OPENROUTER_API_KEY)
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
PROCESSOR_MODEL = os.environ.get("LLM_MODEL", "xiaomi/mimo-v2-pro")
OPENROUTER_HTTP_REFERER = os.environ.get("OPENROUTER_HTTP_REFERER", "")
OPENROUTER_TITLE = os.environ.get("OPENROUTER_TITLE", "study-app pipeline")
LLM_REQUEST_TIMEOUT = int(os.environ.get("LLM_REQUEST_TIMEOUT", "90"))
LLM_MAX_RETRIES = int(os.environ.get("LLM_MAX_RETRIES", "3"))
LLM_RETRY_BACKOFF_SECONDS = float(os.environ.get("LLM_RETRY_BACKOFF_SECONDS", "2"))

REQUEST_TIMEOUT = 15
MAX_TRANSCRIPT_CHARS = 8000
MAX_ARTICLE_CHARS = 6000
CHUNK_TARGET_CHARS = 3500
MAX_SITE_CRAWL_PAGES = 5
MAX_SITE_CRAWL_DEPTH = 1
MAX_GITHUB_DOC_FILES = 8
BUCKET_EVIDENCE_CHAR_BUDGET = 32000
BUCKET_TOPIC_CHUNK_LIMIT = 3
CACHE_VERSION = "3"
SCRAPE_CACHE_KEY_VERSION = "2"
BUCKET_TOPIC_CACHE_KEY_VERSION = "3"
TOPIC_LESSON_CACHE_KEY_VERSION = "1"
