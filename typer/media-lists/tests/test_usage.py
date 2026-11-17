from types import SimpleNamespace

from media_lists.usage import Usage


def test_estimate_uses_model_and_credit_prices(monkeypatch):
    for name in ("MEDIA_LIST_PRICE_IN", "MEDIA_LIST_PRICE_OUT", "FIRECRAWL_CREDIT_USD", "HUNTER_CREDIT_USD"):
        monkeypatch.delenv(name, raising=False)
    u = Usage(model="grok-4")
    u.add_llm(SimpleNamespace(prompt_tokens=1_000_000, completion_tokens=100_000))
    u.add_firecrawl("scrape", 1)
    u.add_firecrawl("search", 2)
    u.hunter_credits = 40
    e = u.estimate()
    assert e["model_usd"] == 4.5  # $3 in + $1.50 out
    assert e["firecrawl_credits"] == 3 and e["firecrawl_scrapes"] == 1 and e["firecrawl_searches"] == 1
    assert e["hunter_usd"] == 0.98  # 40 x $49/2000
    assert e["total_usd"] == round(4.5 + 3 * 19 / 5000 + 0.98, 4)


def test_env_overrides_and_unknown_model(monkeypatch):
    u = Usage(model="some-new-model")
    u.add_llm(SimpleNamespace(prompt_tokens=500_000, completion_tokens=0))
    assert u.estimate()["model_usd"] is None
    assert "price unknown" in " ".join(u.summary_lines())
    monkeypatch.setenv("MEDIA_LIST_PRICE_IN", "2")
    monkeypatch.setenv("MEDIA_LIST_PRICE_OUT", "6")
    assert u.estimate()["model_usd"] == 1.0
