"""
Eugene Intelligence — Equity Research Agent
Comprehensive equity research reports combining fundamentals, 
price performance, earnings quality, insider activity, and peer analysis.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict
from eugene.sources.yahoo import get_stock_prices, get_earnings_data
from eugene.sources.insider import get_insider_transactions


class EquityResearchAgent:
    """Comprehensive equity research agent."""
    
    def __init__(self, config):
        self.config = config
        self._health = None
        self._earnings = None
    
    @property
    def health(self):
        if self._health is None:
            from eugene.agents.health import HealthMonitor
            self._health = HealthMonitor(self.config)
        return self._health
    
    @property
    def earnings_agent(self):
        if self._earnings is None:
            from eugene.agents.earnings import EarningsAgent
            self._earnings = EarningsAgent(self.config)
        return self._earnings
    
    def generate_report(self, ticker: str, peers: List[str] = None) -> dict:
        """
        Generate comprehensive equity research report.
        
        Args:
            ticker: Stock symbol
            peers: Optional list of peer tickers for comparison
        
        Returns:
            Full equity research report
        """
        ticker = ticker.upper().strip()
        peers = [p.upper().strip() for p in (peers or [])][:5]
        
        report = {
            "ticker": ticker,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source": "Eugene Intelligence",
        }
        
        # 1. Company Overview & Fundamentals
        report["overview"] = self._get_overview(ticker)
        
        # 2. Financial Health
        report["financial_health"] = self._get_financial_health(ticker)
        
        # 3. Growth Analysis
        report["growth"] = self._get_growth_analysis(ticker)
        
        # 4. Price Performance
        report["price_performance"] = self._get_price_performance(ticker)
        
        # 5. Valuation
        report["valuation"] = self._get_valuation(ticker)
        
        # 6. Earnings Quality
        report["earnings"] = self._get_earnings_quality(ticker)
        
        # 7. Insider Sentiment
        report["insider_activity"] = self._get_insider_sentiment(ticker)
        
        # 8. Peer Comparison
        if peers:
            report["peer_comparison"] = self._get_peer_comparison(ticker, peers)
        
        # 9. Risk Assessment
        report["risks"] = self._get_risk_assessment(report)
        
        # 10. Investment Thesis
        report["thesis"] = self._generate_thesis(report)
        
        return report
    
    def _get_overview(self, ticker: str) -> dict:
        """Company overview from Yahoo + XBRL."""
        prices = get_stock_prices(ticker, "1d", "1d")
        
        overview = {
            "company_name": prices.get("company_name", ticker),
            "ticker": ticker,
            "exchange": prices.get("exchange", ""),
            "currency": prices.get("currency", "USD"),
        }
        
        quote = prices.get("current_quote", {})
        overview["market_cap"] = quote.get("market_cap")
        overview["current_price"] = quote.get("price")
        
        # Get fundamentals for additional context
        try:
            health_data = self.health.analyze(ticker)
            if hasattr(health_data, 'to_dict'):
                metrics = health_data.to_dict().get("metrics", {})
                overview["revenue"] = metrics.get("_revenue", {}).get("value")
                overview["net_income"] = metrics.get("_net_income", {}).get("value")
                overview["total_assets"] = metrics.get("_total_assets", {}).get("value")
        except:
            pass
        
        return overview
    
    def _get_financial_health(self, ticker: str) -> dict:
        """Financial ratios and health metrics."""
        try:
            health_data = self.health.analyze(ticker)
            if hasattr(health_data, 'to_dict'):
                metrics = health_data.to_dict().get("metrics", {})
                
                return {
                    "liquidity": {
                        "current_ratio": metrics.get("current_ratio", {}).get("value"),
                    },
                    "leverage": {
                        "debt_to_assets": metrics.get("debt_to_assets", {}).get("value"),
                        "debt_to_equity": metrics.get("debt_to_equity", {}).get("value"),
                        "net_debt_to_ebitda": metrics.get("net_debt_to_ebitda", {}).get("value"),
                    },
                    "profitability": {
                        "roe_pct": metrics.get("roe_pct", {}).get("value"),
                        "roa_pct": metrics.get("roa_pct", {}).get("value"),
                        "net_margin_pct": metrics.get("net_margin_pct", {}).get("value"),
                    },
                    "balance_sheet": {
                        "cash": metrics.get("_cash", {}).get("value"),
                        "total_debt": metrics.get("_total_debt", {}).get("value"),
                        "total_assets": metrics.get("_total_assets", {}).get("value"),
                    },
                }
        except Exception as e:
            return {"error": str(e)}
        
        return {}
    
    def _get_growth_analysis(self, ticker: str) -> dict:
        """5-year growth trends."""
        try:
            health_data = self.health.analyze(ticker, include_trends=True)
            if hasattr(health_data, 'to_dict'):
                data = health_data.to_dict()
                trends = data.get("trends", {})
                
                return {
                    "revenue_cagr_5y": trends.get("revenue_cagr"),
                    "net_income_cagr_5y": trends.get("net_income_cagr"),
                    "eps_cagr_5y": trends.get("eps_cagr"),
                    "asset_growth_5y": trends.get("asset_growth"),
                    "revenue_history": trends.get("revenue_history", [])[-5:],
                    "net_income_history": trends.get("net_income_history", [])[-5:],
                }
        except:
            pass
        
        # Fallback to Yahoo
        earnings = get_earnings_data(ticker)
        return {
            "annual_financials": earnings.get("annual_financials", [])[:5],
            "quarterly_revenue": earnings.get("quarterly_revenue", [])[:8],
        }
    
    def _get_price_performance(self, ticker: str) -> dict:
        """Price performance and technicals."""
        # Multiple timeframes
        perf = {}
        
        for period, label in [("1mo", "1M"), ("3mo", "3M"), ("6mo", "6M"), ("1y", "1Y"), ("5y", "5Y")]:
            data = get_stock_prices(ticker, period, "1d")
            if "error" not in data:
                perf[f"return_{label}"] = data.get("summary_stats", {}).get("total_return_pct")
        
        # Get current data
        current = get_stock_prices(ticker, "1y", "1d")
        if "error" not in current:
            stats = current.get("summary_stats", {})
            quote = current.get("current_quote", {})
            
            perf["current_price"] = quote.get("price")
            perf["52_week_high"] = stats.get("52_week_high")
            perf["52_week_low"] = stats.get("52_week_low")
            perf["sma_50"] = stats.get("sma_50")
            perf["sma_200"] = stats.get("sma_200")
            perf["beta"] = quote.get("beta")
            
            # Price vs SMAs
            price = quote.get("price", 0)
            if stats.get("sma_50") and price:
                perf["vs_sma_50_pct"] = round(((price - stats["sma_50"]) / stats["sma_50"]) * 100, 2)
            if stats.get("sma_200") and price:
                perf["vs_sma_200_pct"] = round(((price - stats["sma_200"]) / stats["sma_200"]) * 100, 2)
            
            # 52W range position
            high = stats.get("52_week_high", 0)
            low = stats.get("52_week_low", 0)
            if high and low and high != low:
                perf["52w_range_position_pct"] = round(((price - low) / (high - low)) * 100, 2)
        
        return perf
    
    def _get_valuation(self, ticker: str) -> dict:
        """Valuation metrics."""
        prices = get_stock_prices(ticker, "1d", "1d")
        quote = prices.get("current_quote", {})
        
        valuation = {
            "pe_ratio": quote.get("pe_ratio"),
            "forward_pe": quote.get("forward_pe"),
            "dividend_yield_pct": quote.get("dividend_yield"),
        }
        
        # Calculate P/S if we have data
        market_cap = quote.get("market_cap")
        try:
            health_data = self.health.analyze(ticker)
            if hasattr(health_data, 'to_dict'):
                metrics = health_data.to_dict().get("metrics", {})
                revenue = metrics.get("_revenue", {}).get("value")
                if market_cap and revenue and revenue > 0:
                    valuation["ps_ratio"] = round(market_cap / revenue, 2)
        except:
            pass
        
        return valuation
    
    def _get_earnings_quality(self, ticker: str) -> dict:
        """Earnings quality and predictability."""
        earnings = get_earnings_data(ticker)
        if "error" in earnings:
            return earnings
        
        track = earnings.get("track_record", {})
        
        # Get post-earnings moves
        try:
            moves = self.earnings_agent.analyze_post_earnings_moves(ticker, 8)
            post_moves = moves.get("summary", {})
        except:
            post_moves = {}
        
        return {
            "beat_rate_pct": track.get("beat_rate_pct"),
            "total_beats": track.get("beats"),
            "total_misses": track.get("misses"),
            "next_earnings": earnings.get("next_earnings", {}).get("date") if earnings.get("next_earnings") else None,
            "trailing_eps": earnings.get("current_estimates", {}).get("trailing_eps"),
            "forward_eps": earnings.get("current_estimates", {}).get("forward_eps"),
            "earnings_growth_pct": earnings.get("current_estimates", {}).get("earnings_growth"),
            "revenue_growth_pct": earnings.get("current_estimates", {}).get("revenue_growth"),
            "peg_ratio": earnings.get("current_estimates", {}).get("peg_ratio"),
            "avg_move_on_beat_pct": post_moves.get("avg_move_on_beat_pct"),
            "avg_move_on_miss_pct": post_moves.get("avg_move_on_miss_pct"),
            "recent_history": earnings.get("earnings_history", [])[:4],
        }
    
    def _get_insider_sentiment(self, ticker: str) -> dict:
        """Insider trading activity and sentiment."""
        insider = get_insider_transactions(ticker, days_back=180)
        if "error" in insider:
            return insider
        
        s = insider.get("summary", {})
        
        return {
            "signal": s.get("signal"),
            "total_buys": s.get("total_buys"),
            "total_sells": s.get("total_sells"),
            "total_buy_value": s.get("total_buy_value"),
            "total_sell_value": s.get("total_sell_value"),
            "net_value": s.get("net_value"),
            "unique_buyers": s.get("unique_buyers", 0),
            "unique_sellers": s.get("unique_sellers", 0),
            "notable_transactions": insider.get("notable_transactions", [])[:3],
        }
    
    def _get_peer_comparison(self, ticker: str, peers: List[str]) -> dict:
        """Side-by-side peer comparison."""
        all_tickers = [ticker] + peers
        
        comparison = {"tickers": all_tickers, "metrics": {}}
        
        for t in all_tickers:
            try:
                # Get key metrics for each
                prices = get_stock_prices(t, "1y", "1d")
                quote = prices.get("current_quote", {})
                stats = prices.get("summary_stats", {})
                
                health_data = self.health.analyze(t)
                metrics = {}
                if hasattr(health_data, 'to_dict'):
                    metrics = health_data.to_dict().get("metrics", {})
                
                comparison["metrics"][t] = {
                    "market_cap": quote.get("market_cap"),
                    "pe_ratio": quote.get("pe_ratio"),
                    "return_1y_pct": stats.get("total_return_pct"),
                    "roe_pct": metrics.get("roe_pct", {}).get("value"),
                    "net_margin_pct": metrics.get("net_margin_pct", {}).get("value"),
                    "debt_to_equity": metrics.get("debt_to_equity", {}).get("value"),
                }
            except:
                comparison["metrics"][t] = {"error": "Could not retrieve data"}
        
        return comparison
    
    def _get_risk_assessment(self, report: dict) -> dict:
        """Assess key risks based on collected data."""
        risks = []
        risk_score = 0
        
        # Leverage risk
        leverage = report.get("financial_health", {}).get("leverage", {})
        debt_to_equity = leverage.get("debt_to_equity")
        if debt_to_equity and debt_to_equity > 2:
            risks.append({"type": "HIGH_LEVERAGE", "detail": f"Debt/Equity of {debt_to_equity}x is elevated"})
            risk_score += 2
        elif debt_to_equity and debt_to_equity > 1:
            risks.append({"type": "MODERATE_LEVERAGE", "detail": f"Debt/Equity of {debt_to_equity}x"})
            risk_score += 1
        
        # Earnings volatility
        earnings = report.get("earnings", {})
        beat_rate = earnings.get("beat_rate_pct")
        if beat_rate and beat_rate < 50:
            risks.append({"type": "EARNINGS_VOLATILITY", "detail": f"Only {beat_rate}% beat rate"})
            risk_score += 2
        
        # Insider selling
        insider = report.get("insider_activity", {})
        if insider.get("signal") == "net_selling":
            net_sell = insider.get("net_value", 0)
            risks.append({"type": "INSIDER_SELLING", "detail": f"Net insider selling of ${abs(net_sell):,.0f}"})
            risk_score += 1
        
        # Valuation risk
        valuation = report.get("valuation", {})
        pe = valuation.get("pe_ratio")
        if pe and pe > 50:
            risks.append({"type": "HIGH_VALUATION", "detail": f"P/E of {pe}x is elevated"})
            risk_score += 1
        
        # Price momentum
        perf = report.get("price_performance", {})
        vs_sma_200 = perf.get("vs_sma_200_pct")
        if vs_sma_200 and vs_sma_200 < -20:
            risks.append({"type": "NEGATIVE_MOMENTUM", "detail": f"Trading {abs(vs_sma_200)}% below 200-day SMA"})
            risk_score += 1
        
        # Liquidity risk
        liquidity = report.get("financial_health", {}).get("liquidity", {})
        current_ratio = liquidity.get("current_ratio")
        if current_ratio and current_ratio < 1:
            risks.append({"type": "LIQUIDITY_CONCERN", "detail": f"Current ratio of {current_ratio}x below 1"})
            risk_score += 2
        
        return {
            "risk_score": risk_score,
            "risk_level": "HIGH" if risk_score >= 5 else "MODERATE" if risk_score >= 2 else "LOW",
            "identified_risks": risks,
        }
    
    def _generate_thesis(self, report: dict) -> dict:
        """Generate bull/bear thesis and key catalysts."""
        bull_points = []
        bear_points = []
        catalysts = []
        
        # Analyze the data for thesis points
        
        # Profitability
        prof = report.get("financial_health", {}).get("profitability", {})
        roe = prof.get("roe_pct")
        margin = prof.get("net_margin_pct")
        
        if roe and roe > 15:
            bull_points.append(f"Strong ROE of {roe}% indicates efficient capital deployment")
        elif roe and roe < 10:
            bear_points.append(f"Below-average ROE of {roe}%")
        
        if margin and margin > 20:
            bull_points.append(f"High profit margins of {margin}% provide cushion")
        elif margin and margin < 5:
            bear_points.append(f"Thin margins of {margin}% limit flexibility")
        
        # Growth
        growth = report.get("growth", {})
        rev_cagr = growth.get("revenue_cagr_5y")
        if rev_cagr and rev_cagr > 10:
            bull_points.append(f"Strong revenue growth of {rev_cagr}% CAGR over 5 years")
        elif rev_cagr and rev_cagr < 0:
            bear_points.append(f"Declining revenue ({rev_cagr}% CAGR)")
        
        # Earnings
        earnings = report.get("earnings", {})
        beat_rate = earnings.get("beat_rate_pct")
        if beat_rate and beat_rate > 75:
            bull_points.append(f"Consistent earnings beats ({beat_rate}% beat rate)")
        
        earnings_growth = earnings.get("earnings_growth_pct")
        if earnings_growth and earnings_growth > 15:
            bull_points.append(f"Strong earnings growth outlook ({earnings_growth}%)")
        elif earnings_growth and earnings_growth < 0:
            bear_points.append(f"Negative earnings growth expected ({earnings_growth}%)")
        
        # Insider activity
        insider = report.get("insider_activity", {})
        if insider.get("signal") == "net_buying":
            bull_points.append("Insider buying signals management confidence")
        elif insider.get("signal") == "net_selling":
            bear_points.append("Notable insider selling activity")
        
        # Valuation
        valuation = report.get("valuation", {})
        pe = valuation.get("pe_ratio")
        forward_pe = valuation.get("forward_pe")
        if pe and forward_pe and forward_pe < pe:
            bull_points.append(f"Forward P/E ({forward_pe}x) below trailing ({pe}x) suggests growth")
        if pe and pe > 40:
            bear_points.append(f"Premium valuation at {pe}x P/E")
        
        # Catalysts
        next_earnings = earnings.get("next_earnings")
        if next_earnings:
            catalysts.append(f"Upcoming earnings: {next_earnings}")
        
        # Technical
        perf = report.get("price_performance", {})
        if perf.get("vs_sma_200_pct") and perf["vs_sma_200_pct"] > 0:
            catalysts.append("Trading above 200-day moving average (bullish trend)")
        
        return {
            "bull_case": bull_points[:5],
            "bear_case": bear_points[:5],
            "catalysts": catalysts[:3],
            "summary": self._generate_summary(report, bull_points, bear_points),
        }
    
    def _generate_summary(self, report: dict, bull_points: list, bear_points: list) -> str:
        """Generate one-paragraph summary."""
        ticker = report.get("ticker", "")
        name = report.get("overview", {}).get("company_name", ticker)
        
        # Build summary based on data
        parts = [f"{name} ({ticker})"]
        
        # Market cap context
        mcap = report.get("overview", {}).get("market_cap")
        if mcap:
            if mcap > 200e9:
                parts.append("is a mega-cap company")
            elif mcap > 10e9:
                parts.append("is a large-cap company")
            elif mcap > 2e9:
                parts.append("is a mid-cap company")
            else:
                parts.append("is a small-cap company")
        
        # Financial health
        risk_level = report.get("risks", {}).get("risk_level", "MODERATE")
        if risk_level == "LOW":
            parts.append("with a solid financial profile.")
        elif risk_level == "HIGH":
            parts.append("with elevated risk factors.")
        else:
            parts.append("with a moderate risk profile.")
        
        # Key metrics
        roe = report.get("financial_health", {}).get("profitability", {}).get("roe_pct")
        margin = report.get("financial_health", {}).get("profitability", {}).get("net_margin_pct")
        if roe and margin:
            parts.append(f"Profitability metrics show {roe}% ROE and {margin}% net margins.")
        
        # Verdict hint
        if len(bull_points) > len(bear_points) + 2:
            parts.append("The overall picture skews positive.")
        elif len(bear_points) > len(bull_points) + 2:
            parts.append("Several concerns warrant caution.")
        else:
            parts.append("The investment case is balanced.")
        
        return " ".join(parts)
    
    def quick_screen(self, tickers: List[str]) -> dict:
        """
        Quick screening of multiple stocks.
        Returns key metrics for comparison.
        """
        results = []
        
        for ticker in tickers[:20]:
            try:
                prices = get_stock_prices(ticker, "1y", "1d")
                quote = prices.get("current_quote", {})
                stats = prices.get("summary_stats", {})
                
                insider = get_insider_transactions(ticker, days_back=90)
                insider_signal = insider.get("summary", {}).get("signal", "unknown")
                
                results.append({
                    "ticker": ticker.upper(),
                    "price": quote.get("price"),
                    "market_cap": quote.get("market_cap"),
                    "pe_ratio": quote.get("pe_ratio"),
                    "return_1y_pct": stats.get("total_return_pct"),
                    "vs_sma_200_pct": None,  # Would need calculation
                    "insider_signal": insider_signal,
                })
            except:
                results.append({"ticker": ticker.upper(), "error": "Failed to retrieve"})
        
        return {
            "source": "Eugene Intelligence",
            "tickers_screened": len(tickers),
            "results": results,
        }
