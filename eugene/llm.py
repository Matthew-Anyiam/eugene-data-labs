"""
Eugene Intelligence - Multi-Model LLM Provider

Supports multiple AI providers with automatic fallback:
- Anthropic Claude (Haiku, Sonnet, Opus)
- Moonshot Kimi (K2.5)
- Zhipu GLM (GLM-4, GLM-5)

All providers use OpenAI-compatible APIs except Anthropic.
Falls back to the next provider if one fails.

Resilience features (inspired by Crucix):
- Per-provider retry with exponential backoff
- Response caching to avoid duplicate LLM calls
- Token budget tracking across providers
- Never hard-fails when rule-based fallback is available
"""

import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Unified response from any LLM provider."""
    text: str
    input_tokens: int
    output_tokens: int
    model: str
    provider: str
    cached: bool = False
    latency_ms: float = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass
class Provider:
    """Configuration for a single LLM provider."""
    name: str
    api_key: str
    model: str
    base_url: str | None = None  # None = Anthropic native SDK
    kind: str = "openai"  # "openai" or "anthropic"


# ---------------------------------------------------------------------------
# Response cache — avoids duplicate LLM calls for identical prompts
# ---------------------------------------------------------------------------

_response_cache: dict[str, tuple[LLMResponse, float]] = {}
_CACHE_TTL = 600  # 10 minutes
_CACHE_MAX = 200


def _cache_key(system: str, user: str, max_tokens: int) -> str:
    content = f"{system}:{user}:{max_tokens}"
    return hashlib.sha256(content.encode()).hexdigest()[:24]


def _cache_get(key: str) -> LLMResponse | None:
    if key in _response_cache:
        resp, ts = _response_cache[key]
        if time.time() - ts < _CACHE_TTL:
            cached_resp = LLMResponse(
                text=resp.text,
                input_tokens=resp.input_tokens,
                output_tokens=resp.output_tokens,
                model=resp.model,
                provider=resp.provider,
                cached=True,
                latency_ms=0,
            )
            return cached_resp
        del _response_cache[key]
    return None


def _cache_set(key: str, resp: LLMResponse) -> None:
    if len(_response_cache) >= _CACHE_MAX:
        # Evict oldest
        oldest_key = min(_response_cache, key=lambda k: _response_cache[k][1])
        del _response_cache[oldest_key]
    _response_cache[key] = (resp, time.time())


# ---------------------------------------------------------------------------
# Token budget tracking
# ---------------------------------------------------------------------------

@dataclass
class _TokenTracker:
    total_input: int = 0
    total_output: int = 0
    call_count: int = 0
    cache_hits: int = 0
    errors: int = 0
    by_provider: dict = field(default_factory=dict)

    def record(self, resp: LLMResponse) -> None:
        self.total_input += resp.input_tokens
        self.total_output += resp.output_tokens
        self.call_count += 1
        if resp.cached:
            self.cache_hits += 1
        p = resp.provider
        if p not in self.by_provider:
            self.by_provider[p] = {"input": 0, "output": 0, "calls": 0}
        self.by_provider[p]["input"] += resp.input_tokens
        self.by_provider[p]["output"] += resp.output_tokens
        self.by_provider[p]["calls"] += 1

    def to_dict(self) -> dict:
        return {
            "total_input_tokens": self.total_input,
            "total_output_tokens": self.total_output,
            "total_calls": self.call_count,
            "cache_hits": self.cache_hits,
            "errors": self.errors,
            "by_provider": self.by_provider,
        }


_token_tracker = _TokenTracker()


def get_token_usage() -> dict:
    """Get token usage statistics."""
    return _token_tracker.to_dict()


def _get_providers() -> list[Provider]:
    """Build ordered list of available providers from environment variables."""
    providers = []

    # Anthropic Claude
    key = os.getenv("ANTHROPIC_API_KEY")
    if key:
        model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        providers.append(Provider(
            name="anthropic",
            api_key=key,
            model=model,
            kind="anthropic",
        ))

    # Moonshot Kimi
    key = os.getenv("KIMI_API_KEY") or os.getenv("MOONSHOT_API_KEY")
    if key:
        model = os.getenv("KIMI_MODEL", "kimi-k2.5")
        providers.append(Provider(
            name="kimi",
            api_key=key,
            model=model,
            base_url="https://api.moonshot.ai/v1",
            kind="openai",
        ))

    # Zhipu GLM
    key = os.getenv("GLM_API_KEY") or os.getenv("ZHIPUAI_API_KEY")
    if key:
        model = os.getenv("GLM_MODEL", "glm-4.7-flash")
        providers.append(Provider(
            name="glm",
            api_key=key,
            model=model,
            base_url="https://open.bigmodel.cn/api/paas/v4/",
            kind="openai",
        ))

    return providers


def _call_anthropic(provider: Provider, system: str, user: str,
                    max_tokens: int, temperature: float) -> LLMResponse:
    """Call Anthropic Claude API."""
    import anthropic
    client = anthropic.Anthropic(api_key=provider.api_key)
    response = client.messages.create(
        model=provider.model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return LLMResponse(
        text=response.content[0].text,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        model=provider.model,
        provider=provider.name,
    )


def _call_openai_compat(provider: Provider, system: str, user: str,
                        max_tokens: int, temperature: float) -> LLMResponse:
    """Call OpenAI-compatible API (Kimi, GLM)."""
    from openai import OpenAI
    client = OpenAI(api_key=provider.api_key, base_url=provider.base_url)
    response = client.chat.completions.create(
        model=provider.model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    choice = response.choices[0]
    usage = response.usage
    return LLMResponse(
        text=choice.message.content,
        input_tokens=usage.prompt_tokens if usage else 0,
        output_tokens=usage.completion_tokens if usage else 0,
        model=provider.model,
        provider=provider.name,
    )


def chat(system: str, user: str, max_tokens: int = 1000,
         temperature: float = 0.1, provider_name: str | None = None,
         use_cache: bool = True, max_retries: int = 2) -> LLMResponse:
    """Call an LLM with automatic fallback across providers.

    Features:
    - Response caching (10min TTL) to avoid duplicate calls
    - Per-provider retry with exponential backoff
    - Token budget tracking across all calls
    - Never hard-fails silently — raises with full error context

    Args:
        system: System prompt
        user: User prompt
        max_tokens: Max output tokens
        temperature: Sampling temperature
        provider_name: Force a specific provider ("anthropic", "kimi", "glm").
                      If None, tries all configured providers in order.
        use_cache: Check response cache before calling LLM
        max_retries: Retries per provider before moving to next

    Returns:
        LLMResponse with text, token counts, model, and provider name.

    Raises:
        RuntimeError: If all providers fail or none are configured.
    """
    # Check cache first
    if use_cache:
        ck = _cache_key(system, user, max_tokens)
        cached = _cache_get(ck)
        if cached is not None:
            _token_tracker.record(cached)
            return cached

    providers = _get_providers()

    if not providers:
        raise RuntimeError(
            "No AI providers configured. Set at least one of: "
            "ANTHROPIC_API_KEY, KIMI_API_KEY, GLM_API_KEY"
        )

    # Filter to specific provider if requested
    if provider_name:
        providers = [p for p in providers if p.name == provider_name]
        if not providers:
            raise RuntimeError(f"Provider '{provider_name}' not configured. Check API key env var.")

    errors = []
    for provider in providers:
        for attempt in range(max_retries + 1):
            try:
                t0 = time.time()
                if provider.kind == "anthropic":
                    resp = _call_anthropic(provider, system, user, max_tokens, temperature)
                else:
                    resp = _call_openai_compat(provider, system, user, max_tokens, temperature)
                resp.latency_ms = (time.time() - t0) * 1000
                _token_tracker.record(resp)
                # Cache successful response
                if use_cache:
                    _cache_set(_cache_key(system, user, max_tokens), resp)
                return resp
            except Exception as e:
                _token_tracker.errors += 1
                err_msg = f"{provider.name} (attempt {attempt + 1}): {e}"
                logger.warning("LLM call failed — %s", err_msg)
                errors.append(err_msg)
                if attempt < max_retries:
                    backoff = 2.0 * (attempt + 1)
                    time.sleep(backoff)

    raise RuntimeError(f"All AI providers failed: {'; '.join(errors)}")


def chat_json(system: str, user: str, max_tokens: int = 1000,
              temperature: float = 0.1, provider_name: str | None = None) -> tuple[dict | None, LLMResponse]:
    """Call an LLM and parse the response as JSON.

    Returns:
        Tuple of (parsed_dict_or_None, raw_response)
    """
    response = chat(system, user, max_tokens, temperature, provider_name)
    parsed = _parse_json(response.text)
    return parsed, response


def _parse_json(text: str) -> dict | None:
    """Parse JSON from LLM response, handling markdown fences."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


def available_providers() -> list[dict]:
    """Return list of configured providers (without exposing keys)."""
    return [
        {"name": p.name, "model": p.model}
        for p in _get_providers()
    ]
