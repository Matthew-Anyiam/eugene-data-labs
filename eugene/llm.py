"""
Eugene Intelligence - Multi-Model LLM Provider

Supports multiple AI providers with automatic fallback:
- Anthropic Claude (Haiku, Sonnet, Opus)
- Moonshot Kimi (K2.5)
- Zhipu GLM (GLM-4, GLM-5)

All providers use OpenAI-compatible APIs except Anthropic.
Falls back to the next provider if one fails.
"""

import json
import logging
import os
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Unified response from any LLM provider."""
    text: str
    input_tokens: int
    output_tokens: int
    model: str
    provider: str

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
         temperature: float = 0.1, provider_name: str | None = None) -> LLMResponse:
    """Call an LLM with automatic fallback across providers.

    Args:
        system: System prompt
        user: User prompt
        max_tokens: Max output tokens
        temperature: Sampling temperature
        provider_name: Force a specific provider ("anthropic", "kimi", "glm").
                      If None, tries all configured providers in order.

    Returns:
        LLMResponse with text, token counts, model, and provider name.

    Raises:
        RuntimeError: If all providers fail or none are configured.
    """
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
        try:
            if provider.kind == "anthropic":
                return _call_anthropic(provider, system, user, max_tokens, temperature)
            else:
                return _call_openai_compat(provider, system, user, max_tokens, temperature)
        except Exception as e:
            logger.warning(f"LLM provider {provider.name} ({provider.model}) failed: {e}")
            errors.append(f"{provider.name}: {e}")

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
