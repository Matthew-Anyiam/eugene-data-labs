"""Tests for peer comparison handler."""
from eugene.handlers.peers import _compare, _median, _get_ratio


MOCK_PROFILE = {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "sector": "Technology",
    "industry": "Consumer Electronics",
    "market_cap": 3_000_000_000_000,
}

MOCK_SCREENER = {
    "results": [
        {"ticker": "MSFT", "name": "Microsoft"},
        {"ticker": "GOOG", "name": "Alphabet"},
        {"ticker": "AAPL", "name": "Apple"},  # should be excluded
        {"ticker": "META", "name": "Meta"},
    ],
    "count": 4,
}

MOCK_METRICS = {
    "profitability": {"gross_margin": 0.45, "net_margin": 0.25, "return_on_equity": 1.50},
    "valuation": {"pe_ratio": 30.0, "ev_to_ebitda": 22.0},
    "leverage": {"debt_to_equity": 1.5},
    "growth": {"revenue_growth": 0.08, "earnings_growth": 0.12},
}

MOCK_RESOLVED = {"cik": "320193", "ticker": "AAPL", "company": "Apple Inc."}


def test_peers_handler_full(monkeypatch):
    from eugene.handlers.peers import peers_handler

    monkeypatch.setattr("eugene.handlers.peers.get_profile", lambda t: MOCK_PROFILE)
    monkeypatch.setattr("eugene.handlers.peers.get_screener", lambda **kw: MOCK_SCREENER)
    monkeypatch.setattr("eugene.handlers.peers.metrics_handler", lambda r, p: MOCK_METRICS)
    monkeypatch.setattr("eugene.handlers.peers.resolve", lambda t: {"cik": "000", "ticker": t})

    result = peers_handler(MOCK_RESOLVED, {"limit": "3"})

    assert result["ticker"] == "AAPL"
    assert result["sector"] == "Technology"
    assert "AAPL" not in result["peers"]  # excluded self
    assert len(result["peers"]) <= 3
    assert result["peer_count"] > 0
    assert "relative_valuation" in result


def test_peers_handler_no_sector(monkeypatch):
    from eugene.handlers.peers import peers_handler

    monkeypatch.setattr("eugene.handlers.peers.get_profile", lambda t: {"ticker": "XYZ"})

    result = peers_handler({"cik": "999", "ticker": "XYZ"}, {})
    assert "error" in result


def test_peers_handler_profile_error(monkeypatch):
    from eugene.handlers.peers import peers_handler

    monkeypatch.setattr("eugene.handlers.peers.get_profile", lambda t: {"error": "not found"})

    result = peers_handler({"cik": "999", "ticker": "XYZ"}, {})
    assert "error" in result


def test_compare_percentiles():
    target = {
        "profitability": {"gross_margin": 0.45, "net_margin": 0.20},
        "valuation": {"pe_ratio": 25.0},
    }
    peers = [
        {"ticker": "A", "metrics": {"profitability": {"gross_margin": 0.30, "net_margin": 0.10}, "valuation": {"pe_ratio": 20.0}}},
        {"ticker": "B", "metrics": {"profitability": {"gross_margin": 0.50, "net_margin": 0.25}, "valuation": {"pe_ratio": 35.0}}},
        {"ticker": "C", "metrics": {"profitability": {"gross_margin": 0.40, "net_margin": 0.15}, "valuation": {"pe_ratio": 30.0}}},
    ]
    result = _compare(target, peers)

    assert "gross_margin" in result
    assert "peer_median" in result["gross_margin"]
    assert "percentile" in result["gross_margin"]
    assert 0 <= result["gross_margin"]["percentile"] <= 100
    assert result["gross_margin"]["higher_is_better"] is True
    assert result["pe_ratio"]["higher_is_better"] is False


def test_compare_empty_peers():
    result = _compare(MOCK_METRICS, [])
    assert result == {}


def test_get_ratio():
    data = {"profitability": {"gross_margin": 0.45}}
    assert _get_ratio(data, "profitability", "gross_margin") == 0.45
    assert _get_ratio(data, "profitability", "net_margin") is None
    assert _get_ratio({}, "profitability", "gross_margin") is None


def test_median():
    assert _median([1, 2, 3]) == 2
    assert _median([1, 2, 3, 4]) == 2.5
    assert _median([5]) == 5
    assert _median([]) == 0.0
