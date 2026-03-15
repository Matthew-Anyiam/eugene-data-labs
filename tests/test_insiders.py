"""Tests for insider sentiment scoring."""
from eugene.handlers.insiders import _compute_sentiment, _detect_cluster


def _make_filing(owner_officer=False, owner_director=False, transactions=None):
    return {
        "owner": {"is_officer": owner_officer, "is_director": owner_director, "name": "Test Owner"},
        "transactions": transactions or [],
    }


def _make_tx(tx_type="purchase", shares=1000, price=50.0, date="2025-01-15"):
    return {"transaction_type": tx_type, "shares": shares, "price_per_share": price, "date": date}


def test_neutral_no_transactions():
    result = _compute_sentiment([])
    assert result["score"] == 50
    assert result["signal"] == "neutral"
    assert result["buy_value"] == 0
    assert result["sell_value"] == 0


def test_bullish_large_officer_buys():
    filings = [
        _make_filing(owner_officer=True, transactions=[
            _make_tx("purchase", 10000, 150.0, "2025-01-10"),
            _make_tx("purchase", 5000, 150.0, "2025-01-12"),
        ]),
        _make_filing(owner_officer=True, transactions=[
            _make_tx("purchase", 8000, 150.0, "2025-01-14"),
        ]),
    ]
    result = _compute_sentiment(filings)
    assert result["signal"] == "bullish"
    assert result["score"] >= 65
    assert result["officer_buys"] == 3
    assert result["buy_value"] > 0
    assert result["cluster_buying_detected"]


def test_bearish_heavy_selling():
    filings = [
        _make_filing(transactions=[
            _make_tx("sale", 50000, 100.0, "2025-01-10"),
            _make_tx("sale", 30000, 100.0, "2025-01-12"),
        ]),
    ]
    result = _compute_sentiment(filings)
    assert result["signal"] == "bearish"
    assert result["score"] <= 35
    assert result["sell_value"] == 8_000_000.0
    assert result["net_value"] < 0


def test_mixed_signals_neutral():
    filings = [
        _make_filing(transactions=[
            _make_tx("purchase", 1000, 50.0, "2025-01-10"),
            _make_tx("sale", 1000, 50.0, "2025-01-12"),
        ]),
    ]
    result = _compute_sentiment(filings)
    assert result["signal"] == "neutral"
    assert result["buy_count"] == 1
    assert result["sell_count"] == 1


def test_director_buys_counted():
    filings = [
        _make_filing(owner_director=True, transactions=[
            _make_tx("purchase", 500, 30.0, "2025-01-10"),
        ]),
    ]
    result = _compute_sentiment(filings)
    assert result["director_buys"] == 1


def test_buy_sell_ratio_all_buys():
    filings = [
        _make_filing(transactions=[_make_tx("purchase", 100, 10.0)]),
    ]
    result = _compute_sentiment(filings)
    assert result["buy_sell_ratio"] is None  # infinite — all buys


def test_detect_cluster_true():
    dates = ["2025-01-10", "2025-01-12", "2025-01-14"]
    assert _detect_cluster(dates, window_days=14, min_count=3)


def test_detect_cluster_false_spread_out():
    dates = ["2025-01-10", "2025-03-15", "2025-06-20"]
    assert not _detect_cluster(dates, window_days=14, min_count=3)


def test_detect_cluster_not_enough():
    dates = ["2025-01-10", "2025-01-12"]
    assert not _detect_cluster(dates, window_days=14, min_count=3)


def test_score_clamped():
    """Ensure score stays within 0-100."""
    # Massive buys from officer with clustering
    filings = [
        _make_filing(owner_officer=True, transactions=[
            _make_tx("purchase", 100000, 500.0, f"2025-01-{10 + i}")
            for i in range(5)
        ]),
    ]
    result = _compute_sentiment(filings)
    assert 0 <= result["score"] <= 100
