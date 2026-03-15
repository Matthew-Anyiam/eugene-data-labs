"""
Technical indicator computation from OHLCV data.

Computes: SMA(20/50/200), EMA(12/26), RSI(14), MACD(12,26,9),
Bollinger Bands(20,2), ATR(14), VWAP(20).
"""
from eugene.sources.fmp import get_historical_bars


def technicals_handler(resolved: dict, params: dict) -> dict:
    """Compute technical indicators for a ticker."""
    ticker = resolved.get("ticker")
    if not ticker:
        return {"error": "Ticker required for technical indicators"}

    bars_data = get_historical_bars(ticker, interval="daily")
    bars = bars_data.get("bars", [])
    if not bars:
        return {"error": "No price data available"}

    # FMP returns newest first — reverse to chronological
    bars = list(reversed(bars))
    closes = [b["close"] for b in bars if b.get("close") is not None]
    highs = [b["high"] for b in bars if b.get("high") is not None]
    lows = [b["low"] for b in bars if b.get("low") is not None]
    volumes = [b["volume"] for b in bars if b.get("volume") is not None]

    if len(closes) < 2:
        return {"error": "Insufficient price data for indicators"}

    indicators = {
        "sma_20": _sma(closes, 20),
        "sma_50": _sma(closes, 50),
        "sma_200": _sma(closes, 200),
        "ema_12": _ema(closes, 12),
        "ema_26": _ema(closes, 26),
        "rsi_14": _rsi(closes, 14),
        "macd": _macd(closes, 12, 26, 9),
        "bollinger_bands": _bollinger(closes, 20, 2),
        "atr_14": _atr(highs, lows, closes, 14),
        "vwap_20": _vwap(highs, lows, closes, volumes, 20),
    }

    return {
        "ticker": ticker,
        "latest_close": closes[-1],
        "indicators": indicators,
        "data_points": len(closes),
    }


# ---------------------------------------------------------------------------
# Indicator math
# ---------------------------------------------------------------------------

def _sma(data, period):
    if len(data) < period:
        return None
    return round(sum(data[-period:]) / period, 4)


def _ema(data, period):
    if len(data) < period:
        return None
    k = 2 / (period + 1)
    ema = sum(data[:period]) / period
    for price in data[period:]:
        ema = price * k + ema * (1 - k)
    return round(ema, 4)


def _ema_series(data, period):
    """Full EMA series for MACD signal line computation."""
    if len(data) < period:
        return []
    k = 2 / (period + 1)
    ema = sum(data[:period]) / period
    series = [ema]
    for price in data[period:]:
        ema = price * k + ema * (1 - k)
        series.append(ema)
    return series


def _rsi(data, period=14):
    if len(data) < period + 1:
        return None
    deltas = [data[i] - data[i - 1] for i in range(1, len(data))]
    gains = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _macd(data, fast=12, slow=26, signal_period=9):
    if len(data) < slow:
        return None
    ema_fast = _ema_series(data, fast)
    ema_slow = _ema_series(data, slow)
    # Align lengths: ema_fast is longer, trim from front
    offset = len(ema_fast) - len(ema_slow)
    macd_line = [f - s for f, s in zip(ema_fast[offset:], ema_slow)]
    if len(macd_line) < signal_period:
        return {"macd_line": round(macd_line[-1], 4) if macd_line else None,
                "signal": None, "histogram": None}
    signal = _ema_series(macd_line, signal_period)
    macd_val = round(macd_line[-1], 4)
    signal_val = round(signal[-1], 4) if signal else None
    histogram = round(macd_val - signal_val, 4) if signal_val is not None else None
    return {"macd_line": macd_val, "signal": signal_val, "histogram": histogram}


def _bollinger(data, period=20, std_dev=2):
    if len(data) < period:
        return None
    window = data[-period:]
    sma = sum(window) / period
    variance = sum((x - sma) ** 2 for x in window) / period
    std = variance ** 0.5
    return {
        "upper": round(sma + std_dev * std, 4),
        "middle": round(sma, 4),
        "lower": round(sma - std_dev * std, 4),
        "bandwidth": round((2 * std_dev * std) / sma, 4) if sma else None,
    }


def _atr(highs, lows, closes, period=14):
    if len(closes) < period + 1:
        return None
    trs = []
    for i in range(1, len(closes)):
        tr = max(highs[i] - lows[i],
                 abs(highs[i] - closes[i - 1]),
                 abs(lows[i] - closes[i - 1]))
        trs.append(tr)
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period
    return round(atr, 4)


def _vwap(highs, lows, closes, volumes, period=20):
    if not volumes or len(volumes) < period:
        return None
    h = highs[-period:]
    lo_s = lows[-period:]
    c = closes[-period:]
    v = volumes[-period:]
    cum_vol = sum(v)
    if cum_vol == 0:
        return None
    cum_tp_vol = sum((hi + lo + cl) / 3 * vol for hi, lo, cl, vol in zip(h, lo_s, c, v))
    return round(cum_tp_vol / cum_vol, 4)
