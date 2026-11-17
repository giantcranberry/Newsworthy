"""Count paid usage during a run and estimate its cost.

Prices are list-price estimates (Nov 2026) and can be overridden in .env:

  MEDIA_LIST_PRICE_IN / MEDIA_LIST_PRICE_OUT   model $ per 1M input / output tokens
  FIRECRAWL_CREDIT_USD                         $ per Firecrawl credit
  HUNTER_CREDIT_USD                            $ per Hunter.io credit

Firecrawl and Hunter are monthly subscriptions, so their figure is the share of
the plan this run used, not an extra charge.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from threading import Lock

# $ per 1M tokens (input, output). Unknown models fall back to the env vars or show tokens only.
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "grok-4": (3.00, 15.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "deepseek-chat": (0.27, 1.10),
}
FIRECRAWL_CREDIT_USD = 19 / 5000   # Hobby: $19/mo for 5,000 credits
HUNTER_CREDIT_USD = 49 / 2000      # Starter: $49/mo for 2,000 credits


def _env_float(name: str) -> float | None:
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return None


@dataclass
class Usage:
    model: str = ""
    llm_calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    firecrawl_scrapes: int = 0
    firecrawl_searches: int = 0
    firecrawl_credits: float = 0.0
    hunter_credits: float = 0.0
    hunter_calls: int = 0
    _lock: Lock = field(default_factory=Lock, repr=False)

    def add_llm(self, usage) -> None:
        if usage is None:
            return
        with self._lock:
            self.llm_calls += 1
            self.input_tokens += int(getattr(usage, "prompt_tokens", 0) or 0)
            self.output_tokens += int(getattr(usage, "completion_tokens", 0) or 0)

    def add_firecrawl(self, kind: str, credits: float) -> None:
        with self._lock:
            if kind == "search":
                self.firecrawl_searches += 1
            else:
                self.firecrawl_scrapes += 1
            self.firecrawl_credits += credits

    def model_prices(self) -> tuple[float, float] | None:
        env_in, env_out = _env_float("MEDIA_LIST_PRICE_IN"), _env_float("MEDIA_LIST_PRICE_OUT")
        if env_in is not None and env_out is not None:
            return env_in, env_out
        return MODEL_PRICES.get(self.model)

    def estimate(self) -> dict:
        prices = self.model_prices()
        model_usd = (
            (self.input_tokens * prices[0] + self.output_tokens * prices[1]) / 1_000_000 if prices else None
        )
        firecrawl_rate = _env_float("FIRECRAWL_CREDIT_USD") or FIRECRAWL_CREDIT_USD
        hunter_rate = _env_float("HUNTER_CREDIT_USD") or HUNTER_CREDIT_USD
        firecrawl_usd = self.firecrawl_credits * firecrawl_rate
        hunter_usd = self.hunter_credits * hunter_rate
        return {
            "model": self.model,
            "llm_calls": self.llm_calls,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "model_usd": round(model_usd, 4) if model_usd is not None else None,
            "firecrawl_scrapes": self.firecrawl_scrapes,
            "firecrawl_searches": self.firecrawl_searches,
            "firecrawl_credits": self.firecrawl_credits,
            "firecrawl_usd": round(firecrawl_usd, 4),
            "hunter_calls": self.hunter_calls,
            "hunter_credits": self.hunter_credits,
            "hunter_usd": round(hunter_usd, 4),
            "total_usd": round((model_usd or 0) + firecrawl_usd + hunter_usd, 4),
        }

    def summary_lines(self) -> list[str]:
        e = self.estimate()
        model_cost = f"${e['model_usd']:.2f}" if e["model_usd"] is not None else "price unknown (set MEDIA_LIST_PRICE_IN/OUT)"
        return [
            "Estimated cost of this run:",
            f"  Model ({e['model'] or 'unknown'}): {e['llm_calls']} calls, "
            f"{e['input_tokens']:,} in / {e['output_tokens']:,} out tokens  {model_cost}",
            f"  Firecrawl: {e['firecrawl_scrapes']} scrapes, {e['firecrawl_searches']} searches, "
            f"{e['firecrawl_credits']:g} credits  ${e['firecrawl_usd']:.2f} of plan",
            f"  Hunter.io: {e['hunter_calls']} calls, {e['hunter_credits']:g} credits  ${e['hunter_usd']:.2f} of plan",
            f"  Total: ${e['total_usd']:.2f}"
            + ("" if e["model_usd"] is not None else " (excluding model)"),
        ]


USAGE = Usage()
