"""Tests for eugene.handlers.technicals — indicator math."""
from eugene.handlers.technicals import _sma, _ema, _rsi, _macd, _bollinger, _atr, _vwap


class TestSMA:
    def test_basic(self):
        data = [10, 20, 30, 40, 50]
        assert _sma(data, 3) == 40.0  # (30+40+50)/3

    def test_insufficient_data(self):
        assert _sma([1, 2], 5) is None

    def test_full_period(self):
        data = [2, 4, 6, 8, 10]
        assert _sma(data, 5) == 6.0


class TestEMA:
    def test_basic(self):
        data = list(range(1, 21))  # 1..20, enough for period 12
        result = _ema(data, 12)
        assert result is not None
        assert isinstance(result, float)

    def test_insufficient_data(self):
        assert _ema([1, 2, 3], 10) is None


class TestRSI:
    def test_known_values(self):
        # All gains → RSI should be 100
        data = list(range(1, 20))  # strictly increasing
        assert _rsi(data, 14) == 100.0

    def test_all_losses(self):
        data = list(range(20, 1, -1))  # strictly decreasing
        assert _rsi(data, 14) == 0.0

    def test_insufficient_data(self):
        assert _rsi([1, 2, 3], 14) is None

    def test_mixed(self):
        data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10,
                45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00]
        result = _rsi(data, 14)
        assert result is not None
        assert 0 <= result <= 100


class TestMACD:
    def test_basic(self):
        data = list(range(1, 50))
        result = _macd(data, 12, 26, 9)
        assert result is not None
        assert "macd_line" in result
        assert "signal" in result
        assert "histogram" in result

    def test_insufficient_data(self):
        assert _macd([1, 2, 3], 12, 26, 9) is None


class TestBollinger:
    def test_basic(self):
        data = list(range(1, 25))
        result = _bollinger(data, 20, 2)
        assert result is not None
        assert result["upper"] > result["middle"] > result["lower"]

    def test_insufficient_data(self):
        assert _bollinger([1, 2], 20) is None


class TestATR:
    def test_basic(self):
        highs = [h + 2 for h in range(20)]
        lows = list(range(20))
        closes = [h + 1 for h in range(20)]
        result = _atr(highs, lows, closes, 14)
        assert result is not None
        assert result > 0

    def test_insufficient_data(self):
        assert _atr([1], [0], [0.5], 14) is None


class TestVWAP:
    def test_basic(self):
        highs = [10, 11, 12, 13, 14]
        lows = [8, 9, 10, 11, 12]
        closes = [9, 10, 11, 12, 13]
        volumes = [100, 200, 150, 300, 250]
        result = _vwap(highs, lows, closes, volumes, 5)
        assert result is not None
        assert result > 0

    def test_insufficient_data(self):
        assert _vwap([10], [8], [9], [100], 5) is None

    def test_zero_volume(self):
        assert _vwap([10] * 5, [8] * 5, [9] * 5, [0] * 5, 5) is None
