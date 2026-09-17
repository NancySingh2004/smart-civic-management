"""
services/ai_analyzer.py

AI Complaint Understanding -- runs automatically on every complaint
submission so citizens never have to pick a category or a priority
themselves.

Given a citizen's free-text description, ask an LLM to extract structured
fields (category, location, duration, urgency, summary). Two providers are
supported, tried in order, each independently:
    1. Groq (GROQ_API_KEY) -- has a genuinely free tier, used via plain
       stdlib HTTP calls (no extra pip dependency required). Model is
       configurable via GROQ_MODEL.
    2. Anthropic (ANTHROPIC_API_KEY) -- used if Groq is not configured, or
       is configured but fails, and the `anthropic` package is installed.

If neither provider is configured, or both fail/time out/return unusable
output, `detect_category_and_priority` falls back to a lightweight offline
keyword classifier (see CATEGORY_KEYWORDS below) instead of raising, so
complaint intake never depends on an API key being present or working.
Extracted values are always validated against the app's real category list
before being trusted; anything else is dropped rather than blindly used.

No API key is ever logged, returned in an API response, or included in an
error message -- only sanitized diagnostics (provider, model, HTTP status,
provider-reported error type/message) are logged server-side to help debug
provider-side failures such as an invalid key, a decommissioned model, or
rate limiting.
"""

import os
import json
import logging
import asyncio
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

from models.complaint import CATEGORIES

# Load backend/.env explicitly by path so this module behaves the same
# regardless of the process's current working directory (e.g. running
# `uvicorn main:app` from the repo root vs. from inside backend/). This is
# redundant with main.py's own load_dotenv() call in normal operation, but
# makes this module self-sufficient (e.g. for scripts/tests that import it
# directly without going through main.py first). override=False so it never
# clobbers real environment variables (e.g. in production/hosted deploys)
# with a stale local .env file.
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

logger = logging.getLogger("ai_analyzer")

try:
    import anthropic  # type: ignore
    _ANTHROPIC_AVAILABLE = True
except ImportError:  # pragma: no cover - depends on optional dependency
    _ANTHROPIC_AVAILABLE = False

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
ANTHROPIC_MODEL = "claude-3-5-haiku-20241022"
REQUEST_TIMEOUT_SECONDS = 12

SYSTEM_PROMPT = f"""You extract structured civic-complaint data from a citizen's free-text report.
Respond with ONLY a JSON object (no markdown, no prose) with these exact keys:
"category" (must be exactly one of {CATEGORIES}),
"location" (short place name mentioned in the text, or null if none is mentioned),
"duration" (short human phrase describing how long the issue has been happening, or null),
"urgency" (exactly one of "Low", "Medium", "High" -- base this on safety risk, severity, how many \
people are affected, infrastructure/health impact and how disruptive the issue is, not just on \
how it's worded. Most everyday complaints are "Medium"; reserve "High" for genuine safety, health \
or large-scale disruption risk, and "Low" for minor/cosmetic issues),
"summary" (a single concise sentence summarizing the issue).
If a field cannot be determined from the text, use null for it (except urgency, always provide your best estimate)."""

# ---------------------------------------------------------------------------
# Offline fallback classifier -- used whenever no AI provider is configured
# (or every configured AI call fails), so category detection never blocks
# submission. Keywords include common Hinglish transliterations since
# that's how many citizens actually phrase reports (e.g. "pani", "kachra",
# "gaddha"). Checked in this order; the first category with a keyword hit
# wins.
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS = [
    ("Water Supply", ["water", "pani", "paani", "pipeline", "pipe", "supply", "leak", "tap"]),
    ("Streetlight", ["streetlight", "street light", "lamp", "bulb", "batti", "andhera", "dark", "light"]),
    ("Pothole", ["pothole", "gaddha", "gadda", "sadak", "road", "crater"]),
    ("Garbage", ["garbage", "kachra", "kooda", "kachara", "trash", "waste", "dump", "litter", "safai"]),
]

# Signals used to vary the *fallback* urgency estimate so it isn't a flat
# "High"/"Medium" regardless of content -- weighted roughly by safety risk,
# duration, and scale of disruption, per the same rubric given to the AI.
HIGH_URGENCY_KEYWORDS = [
    "accident", "injur", "fire", "collapse", "electrocut", "live wire", "exposed wire",
    "sewage", "contaminat", "no water", "entire locality", "entire area", "whole colony",
    "week", "hafte", "several days", "many days", "kaafi din", "kai din", "month", "mahine",
    "long time", "din se", "children", "school", "hospital",
]
LOW_URGENCY_KEYWORDS = ["today", "abhi", "just now", "this morning", "minor", "small"]


def classify_category_fallback(text: str) -> str:
    """Simple keyword match against the app's real category list."""
    lowered = text.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            return category
    return "Other"


def estimate_urgency_fallback(text: str) -> str:
    """
    Deliberately conservative default of "Medium" -- only escalates to
    "High" on an actual safety/scale/duration signal, and only drops to
    "Low" on an explicit "just happened, minor" signal. This keeps the
    offline fallback from labeling every complaint the same way.
    """
    lowered = text.lower()
    if any(kw in lowered for kw in HIGH_URGENCY_KEYWORDS):
        return "High"
    if any(kw in lowered for kw in LOW_URGENCY_KEYWORDS):
        return "Low"
    return "Medium"


def _get_env_key(name: str) -> Optional[str]:
    """
    Read an env var defensively: strips surrounding whitespace and any
    accidentally-included quote characters (a common .env authoring
    mistake, e.g. GROQ_API_KEY="gsk_xxx"), and treats an empty result as
    "not configured" rather than a real (invalid) key.
    """
    raw = os.getenv(name)
    if not raw:
        return None
    cleaned = raw.strip().strip('"').strip("'").strip()
    return cleaned or None


def _extract_json_object(raw_text: str) -> dict:
    """
    Parse the model's response into a dict, tolerating the common ways an
    LLM deviates from "ONLY a JSON object": markdown code fences, and/or
    extra prose before/after the JSON. Raises ValueError if no valid JSON
    object can be recovered.
    """
    text = raw_text.strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back to slicing out the outermost {...} in case of stray text.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Could not parse JSON object from model output: {exc}") from exc

    raise ValueError("Model output did not contain a JSON object")


def _validate_and_clean(raw: dict) -> dict:
    """Never blindly trust the model's output -- validate each field."""
    category = raw.get("category")
    if category not in CATEGORIES:
        category = None

    urgency = raw.get("urgency")
    if urgency not in ("Low", "Medium", "High"):
        urgency = "Medium"

    location = raw.get("location")
    if not isinstance(location, str) or not location.strip():
        location = None

    duration = raw.get("duration")
    if not isinstance(duration, str) or not duration.strip():
        duration = None

    summary = raw.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        summary = None

    return {
        "category": category,
        "location": location.strip() if location else None,
        "duration": duration,
        "urgency": urgency,
        "summary": summary,
    }


def _call_groq_sync(text: str, api_key: str, model: str) -> str:
    """
    Blocking HTTP call to Groq's OpenAI-compatible chat completions endpoint,
    using only Python's standard library so no extra pip dependency is
    required just to support this provider.

    Raises urllib.error.HTTPError / URLError on failure -- the caller is
    responsible for catching, logging (without the key), and falling back.
    """
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text.strip()[:2000]},
        ],
        "max_tokens": 400,
        "temperature": 0.2,
    }
    request = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        body = json.loads(response.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


def _call_anthropic_sync(text: str, api_key: str) -> str:
    """Blocking call to the Anthropic SDK (fallback provider)."""
    client = anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text.strip()[:2000]}],
    )
    return "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )


def _log_http_error(provider: str, model: str, exc: urllib.error.HTTPError) -> None:
    """
    Log a sanitized diagnostic for a provider HTTP failure: status code and
    (if present) the provider's own error type/message from the response
    body. Never logs the Authorization header or the API key itself.
    """
    status = exc.code
    provider_message = None
    try:
        body = json.loads(exc.read().decode("utf-8"))
        provider_message = body.get("error", {}).get("message") or body.get("error")
    except Exception:  # noqa: BLE001 - best-effort diagnostics only
        pass

    hint = {
        401: "invalid or missing API key",
        403: "request forbidden -- check the key is active, has access to this model, "
             "and that your account/region/plan allows it",
        404: "model not found -- it may have been renamed or decommissioned; "
             "set GROQ_MODEL in .env to a currently supported model",
        429: "rate limited -- too many requests or over quota",
    }.get(status, "unexpected provider error")

    logger.warning(
        "[ai_analyzer] %s request failed (model=%s): HTTP %s (%s). Provider message: %s. "
        "Falling back to the next provider / offline classifier.",
        provider, model, status, hint, provider_message or "<none returned>",
    )


def _log_other_error(provider: str, model: str, exc: Exception) -> None:
    """Sanitized diagnostic for non-HTTP failures (timeout, connection, parsing, etc.)."""
    logger.warning(
        "[ai_analyzer] %s request failed (model=%s): %s: %s. "
        "Falling back to the next provider / offline classifier.",
        provider, model, type(exc).__name__, exc,
    )


async def _try_groq(text: str) -> Optional[dict]:
    api_key = _get_env_key("GROQ_API_KEY")
    if not api_key:
        return None

    model = _get_env_key("GROQ_MODEL") or "llama-3.3-70b-versatile"
    try:
        raw_text = await asyncio.to_thread(_call_groq_sync, text, api_key, model)
    except urllib.error.HTTPError as exc:
        _log_http_error("Groq", model, exc)
        return None
    except (urllib.error.URLError, TimeoutError) as exc:
        _log_other_error("Groq", model, exc)
        return None

    try:
        parsed = _validate_and_clean(_extract_json_object(raw_text))
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        _log_other_error("Groq", model, exc)
        return None

    if not parsed["category"]:
        logger.warning("[ai_analyzer] Groq (model=%s) returned no usable category; falling back.", model)
        return None

    logger.info("[ai_analyzer] Groq (model=%s) succeeded.", model)
    return parsed


async def _try_anthropic(text: str) -> Optional[dict]:
    api_key = _get_env_key("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    if not _ANTHROPIC_AVAILABLE:
        logger.warning(
            "[ai_analyzer] ANTHROPIC_API_KEY is set but the `anthropic` package is not installed "
            "(pip install anthropic). Falling back to the offline classifier."
        )
        return None

    try:
        raw_text = await asyncio.to_thread(_call_anthropic_sync, text, api_key)
    except Exception as exc:  # noqa: BLE001 - SDK raises its own exception hierarchy
        # anthropic's SDK exceptions carry a status_code attribute for HTTP errors.
        status = getattr(exc, "status_code", None)
        if status:
            logger.warning(
                "[ai_analyzer] Anthropic request failed (model=%s): HTTP %s: %s. "
                "Falling back to the offline classifier.",
                ANTHROPIC_MODEL, status, type(exc).__name__,
            )
        else:
            _log_other_error("Anthropic", ANTHROPIC_MODEL, exc)
        return None

    try:
        parsed = _validate_and_clean(_extract_json_object(raw_text))
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        _log_other_error("Anthropic", ANTHROPIC_MODEL, exc)
        return None

    if not parsed["category"]:
        logger.warning("[ai_analyzer] Anthropic returned no usable category; falling back.")
        return None

    logger.info("[ai_analyzer] Anthropic (model=%s) succeeded.", ANTHROPIC_MODEL)
    return parsed


async def detect_category_and_priority(text: str) -> dict:
    """
    Runs automatically for every complaint submission -- the citizen never
    picks a category or priority themselves.

    Returns (always, never raises):
        {"category": one of CATEGORIES, "location": str|None, "duration": str|None,
         "urgency": "Low"|"Medium"|"High", "summary": str|None,
         "source": "ai" | "fallback"}

    Tries Groq first (if configured), then Anthropic (if configured and
    Groq didn't yield a usable result), then the offline keyword classifier
    -- each step is independent, so a failure in one provider (bad key,
    decommissioned model, rate limit, timeout, malformed response, ...)
    always falls through to the next rather than raising, and complaint
    submission is never blocked by an AI/provider problem.
    """
    result = await _try_groq(text)
    if result is not None:
        return {**result, "source": "ai"}

    result = await _try_anthropic(text)
    if result is not None:
        return {**result, "source": "ai"}

    logger.info("[ai_analyzer] No AI provider available/succeeded; using offline keyword classifier.")
    return {
        "category": classify_category_fallback(text),
        "location": None,
        "duration": None,
        "urgency": estimate_urgency_fallback(text),
        "summary": None,
        "source": "fallback",
    }
