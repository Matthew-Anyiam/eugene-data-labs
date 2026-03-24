"""
Eugene Intelligence — Yahoo Finance Data Source
Stock prices, earnings data, dividends, and company info.
"""

import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional


def get_stock_prices(
    ticker: str,
    period: str = "5y",
    interval: str = "1d"
) -> dict:
    """
    Get historical stock prices for a ticker.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        period: Time period — 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, 20y, max
        interval: Data interval — 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
    
    Returns:
        dict with price history, current quote, and summary stats
    """
    try:
        stock = yf.Ticker(ticker.upper().strip())
        hist = stock.history(period=period, interval=interval)
        
        if hist.empty:
            return {
                "ticker": ticker.upper(),
                "error": f"No price data found for {ticker}",
                "source": "Yahoo Finance"
            }
        
        info = stock.info or {}
        
        prices = []
        for date, row in hist.iterrows():
            prices.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(row.get("Open", 0), 2),
                "high": round(row.get("High", 0), 2),
                "low": round(row.get("Low", 0), 2),
                "close": round(row.get("Close", 0), 2),
                "volume": int(row.get("Volume", 0)),
            })
        
        if len(prices) >= 2:
            latest_close = prices[-1]["close"]
            first_close = prices[0]["close"]
            total_return = ((latest_close - first_close) / first_close) * 100
            
            closes = [p["close"] for p in prices]
            high_52w = max(closes[-min(252, len(closes)):])
            low_52w = min(closes[-min(252, len(closes)):])
            
            sma_50 = round(sum(closes[-50:]) / min(50, len(closes)), 2) if len(closes) >= 50 else None
            sma_200 = round(sum(closes[-200:]) / min(200, len(closes)), 2) if len(closes) >= 200 else None
        else:
            total_return = 0
            high_52w = prices[0]["close"] if prices else 0
            low_52w = prices[0]["close"] if prices else 0
            sma_50 = None
            sma_200 = None
        
        result = {
            "ticker": ticker.upper(),
            "company_name": info.get("longName", info.get("shortName", ticker.upper())),
            "currency": info.get("currency", "USD"),
            "exchange": info.get("exchange", ""),
            "source": "Yahoo Finance",
            "period": period,
            "interval": interval,
            "data_points": len(prices),
            "date_range": {
                "start": prices[0]["date"] if prices else None,
                "end": prices[-1]["date"] if prices else None,
            },
            "current_quote": {
                "price": round(info.get("currentPrice", info.get("regularMarketPrice", prices[-1]["close"] if prices else 0)), 2),
                "previous_close": round(info.get("previousClose", 0), 2),
                "market_cap": info.get("marketCap"),
                "pe_ratio": round(info.get("trailingPE", 0), 2) if info.get("trailingPE") else None,
                "forward_pe": round(info.get("forwardPE", 0), 2) if info.get("forwardPE") else None,
                "dividend_yield": round(info.get("dividendYield", 0) * 100, 2) if info.get("dividendYield") else None,
                "beta": round(info.get("beta", 0), 2) if info.get("beta") else None,
            },
            "summary_stats": {
                "total_return_pct": round(total_return, 2),
                "52_week_high": high_52w,
                "52_week_low": low_52w,
                "sma_50": sma_50,
                "sma_200": sma_200,
            },
            "prices": prices,
        }
        
        return result
        
    except Exception as e:
        return {
            "ticker": ticker.upper(),
            "error": str(e),
            "source": "Yahoo Finance"
        }


def get_dividend_history(ticker: str, period: str = "5y") -> dict:
    """
    Get dividend history for a ticker using yfinance.

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        period: Time period ('1y', '2y', '5y', '10y', 'max')

    Returns:
        Dictionary with dividend data and analysis
    """
    try:
        ticker = ticker.upper()
        stock = yf.Ticker(ticker)

        # Get dividend data
        dividends = stock.dividends

        if dividends.empty:
            return {
                "ticker": ticker,
                "has_dividends": False,
                "message": "No dividend history found",
                "source": "Yahoo Finance"
            }

        # Filter by period
        if period != 'max':
            period_map = {'1y': 365, '2y': 730, '5y': 1825, '10y': 3650}
            days = period_map.get(period, 1825)
            cutoff_date = datetime.now() - timedelta(days=days)
            dividends = dividends[dividends.index >= cutoff_date]

        # Calculate dividend metrics
        dividend_data = []
        for date, amount in dividends.items():
            dividend_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "amount": round(float(amount), 4),
                "year": date.year,
                "quarter": f"Q{((date.month-1)//3)+1}"
            })

        # Sort by date (newest first)
        dividend_data.sort(key=lambda x: x["date"], reverse=True)

        # Calculate analysis
        annual_dividends = {}
        for div in dividend_data:
            year = div["year"]
            if year not in annual_dividends:
                annual_dividends[year] = 0
            annual_dividends[year] += div["amount"]

        # Calculate growth rates
        years = sorted(annual_dividends.keys(), reverse=True)
        growth_rates = []

        for i in range(len(years) - 1):
            current_year = years[i]
            prior_year = years[i + 1]
            current_div = annual_dividends[current_year]
            prior_div = annual_dividends[prior_year]

            if prior_div > 0:
                growth_rate = ((current_div - prior_div) / prior_div) * 100
                growth_rates.append({
                    "year": current_year,
                    "growth_rate": round(growth_rate, 2)
                })

        # Calculate dividend yield (approximate)
        current_price = stock.info.get('currentPrice', stock.info.get('regularMarketPrice'))
        current_yield = None
        if current_price and years:
            latest_annual = annual_dividends[years[0]]
            current_yield = round((latest_annual / current_price) * 100, 2)

        return {
            "ticker": ticker,
            "has_dividends": True,
            "period": period,
            "total_payments": len(dividend_data),
            "dividend_history": dividend_data,
            "annual_totals": dict(sorted(annual_dividends.items(), reverse=True)),
            "growth_analysis": {
                "growth_rates": growth_rates,
                "avg_growth_rate": round(sum(g["growth_rate"] for g in growth_rates) / len(growth_rates), 2) if growth_rates else None,
                "consecutive_increases": len([g for g in growth_rates if g["growth_rate"] > 0])
            },
            "current_yield": current_yield,
            "source": "Yahoo Finance"
        }

    except Exception as e:
        return {
            "ticker": ticker.upper(),
            "error": str(e),
            "source": "Yahoo Finance"
        }


def get_stock_splits(ticker: str, period: str = "10y") -> dict:
    """
    Get stock split history for a ticker using yfinance.

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL')
        period: Time period ('1y', '2y', '5y', '10y', 'max')

    Returns:
        Dictionary with stock split data and analysis
    """
    try:
        ticker = ticker.upper()
        stock = yf.Ticker(ticker)

        # Get split data
        splits = stock.splits

        if splits.empty:
            return {
                "ticker": ticker,
                "has_splits": False,
                "message": "No stock split history found",
                "source": "Yahoo Finance"
            }

        # Filter by period
        if period != 'max':
            period_map = {'1y': 365, '2y': 730, '5y': 1825, '10y': 3650}
            days = period_map.get(period, 3650)
            cutoff_date = datetime.now() - timedelta(days=days)
            splits = splits[splits.index >= cutoff_date]

        # Process split data
        split_data = []
        total_split_factor = 1.0

        for date, ratio in splits.items():
            # Convert split ratio to readable format
            ratio_float = float(ratio)

            if ratio_float > 1:
                # Stock split (e.g., 2.0 = 2:1 split)
                split_type = "split"
                readable_ratio = f"{int(ratio_float)}:1"
            else:
                # Reverse split (e.g., 0.5 = 1:2 reverse split)
                split_type = "reverse_split"
                reverse_ratio = 1 / ratio_float
                readable_ratio = f"1:{int(reverse_ratio)}"

            total_split_factor *= ratio_float

            split_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "ratio": ratio_float,
                "readable_ratio": readable_ratio,
                "type": split_type,
                "year": date.year
            })

        # Sort by date (newest first)
        split_data.sort(key=lambda x: x["date"], reverse=True)

        # Calculate cumulative effect
        cumulative_factor = 1.0
        for split in reversed(split_data):  # Process oldest first for cumulative
            cumulative_factor *= split["ratio"]
            split["cumulative_factor"] = round(cumulative_factor, 4)

        split_data.reverse()  # Back to newest first

        return {
            "ticker": ticker,
            "has_splits": True,
            "period": period,
            "total_splits": len(split_data),
            "split_history": split_data,
            "analysis": {
                "total_split_factor": round(total_split_factor, 4),
                "years_with_splits": len(set(s["year"] for s in split_data)),
                "split_types": {
                    "splits": len([s for s in split_data if s["type"] == "split"]),
                    "reverse_splits": len([s for s in split_data if s["type"] == "reverse_split"])
                },
                "most_recent": split_data[0] if split_data else None
            },
            "interpretation": {
                "effect": "If you owned 1 share at the beginning of the period, you would now own {:.4f} shares".format(total_split_factor),
                "price_adjustment": "Historical prices should be multiplied by {:.4f} to adjust for splits".format(1 / total_split_factor if total_split_factor != 0 else 1)
            },
            "source": "Yahoo Finance"
        }

    except Exception as e:
        return {
            "ticker": ticker.upper(),
            "error": str(e),
            "source": "Yahoo Finance"
        }


def get_earnings_data(ticker: str) -> dict:
    """
    Get earnings history — EPS actuals vs estimates, revenue, and earnings dates.
    """
    try:
        stock = yf.Ticker(ticker.upper().strip())
        
        earnings_hist = []
        
        try:
            earnings_dates = stock.earnings_dates
            if earnings_dates is not None and not earnings_dates.empty:
                for date, row in earnings_dates.iterrows():
                    eps_estimate = row.get("EPS Estimate")
                    eps_actual = row.get("Reported EPS")
                    surprise_pct = row.get("Surprise(%)")
                    
                    entry = {
                        "date": date.strftime("%Y-%m-%d") if hasattr(date, 'strftime') else str(date),
                        "eps_estimate": round(float(eps_estimate), 4) if eps_estimate is not None and str(eps_estimate) != 'nan' else None,
                        "eps_actual": round(float(eps_actual), 4) if eps_actual is not None and str(eps_actual) != 'nan' else None,
                        "surprise_pct": round(float(surprise_pct), 2) if surprise_pct is not None and str(surprise_pct) != 'nan' else None,
                    }
                    
                    if entry["eps_actual"] is not None and entry["eps_estimate"] is not None:
                        if entry["eps_actual"] > entry["eps_estimate"]:
                            entry["result"] = "beat"
                        elif entry["eps_actual"] < entry["eps_estimate"]:
                            entry["result"] = "miss"
                        else:
                            entry["result"] = "inline"
                    else:
                        entry["result"] = "upcoming" if entry["eps_actual"] is None else "unknown"
                    
                    earnings_hist.append(entry)
        except Exception:
            pass
        
        revenue_history = []
        try:
            quarterly = stock.quarterly_financials
            if quarterly is not None and not quarterly.empty:
                for col in quarterly.columns:
                    revenue = quarterly.loc["Total Revenue", col] if "Total Revenue" in quarterly.index else None
                    net_income = quarterly.loc["Net Income", col] if "Net Income" in quarterly.index else None
                    
                    revenue_history.append({
                        "quarter_end": col.strftime("%Y-%m-%d") if hasattr(col, 'strftime') else str(col),
                        "revenue": int(revenue) if revenue is not None and str(revenue) != 'nan' else None,
                        "net_income": int(net_income) if net_income is not None and str(net_income) != 'nan' else None,
                    })
        except Exception:
            pass
        
        annual_earnings = []
        try:
            annual = stock.financials
            if annual is not None and not annual.empty:
                for col in annual.columns:
                    revenue = annual.loc["Total Revenue", col] if "Total Revenue" in annual.index else None
                    net_income = annual.loc["Net Income", col] if "Net Income" in annual.index else None
                    ebit = annual.loc["EBIT", col] if "EBIT" in annual.index else None
                    
                    annual_earnings.append({
                        "year_end": col.strftime("%Y-%m-%d") if hasattr(col, 'strftime') else str(col),
                        "revenue": int(revenue) if revenue is not None and str(revenue) != 'nan' else None,
                        "net_income": int(net_income) if net_income is not None and str(net_income) != 'nan' else None,
                        "ebit": int(ebit) if ebit is not None and str(ebit) != 'nan' else None,
                    })
        except Exception:
            pass
        
        reported = [e for e in earnings_hist if e["result"] in ("beat", "miss", "inline")]
        beats = len([e for e in reported if e["result"] == "beat"])
        misses = len([e for e in reported if e["result"] == "miss"])
        inline = len([e for e in reported if e["result"] == "inline"])
        
        upcoming = [e for e in earnings_hist if e["result"] == "upcoming"]
        
        info = stock.info or {}
        
        result = {
            "ticker": ticker.upper(),
            "company_name": info.get("longName", info.get("shortName", ticker.upper())),
            "source": "Yahoo Finance",
            "earnings_history": earnings_hist,
            "quarterly_revenue": revenue_history,
            "annual_financials": annual_earnings,
            "next_earnings": upcoming[0] if upcoming else None,
            "track_record": {
                "total_quarters_reported": len(reported),
                "beats": beats,
                "misses": misses,
                "inline": inline,
                "beat_rate_pct": round((beats / len(reported)) * 100, 1) if reported else None,
            },
            "current_estimates": {
                "trailing_eps": round(info.get("trailingEps", 0), 4) if info.get("trailingEps") else None,
                "forward_eps": round(info.get("forwardEps", 0), 4) if info.get("forwardEps") else None,
                "peg_ratio": round(info.get("pegRatio", 0), 2) if info.get("pegRatio") else None,
                "earnings_growth": round(info.get("earningsGrowth", 0) * 100, 2) if info.get("earningsGrowth") else None,
                "revenue_growth": round(info.get("revenueGrowth", 0) * 100, 2) if info.get("revenueGrowth") else None,
            },
        }
        
        return result
        
    except Exception as e:
        return {
            "ticker": ticker.upper(),
            "error": str(e),
            "source": "Yahoo Finance"
        }
