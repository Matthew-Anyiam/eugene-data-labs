"""
Eugene Intelligence — Earnings Agent
Earnings calendar, post-earnings price analysis, and 8-K press release extraction.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict
import requests

from eugene.sources.yahoo import get_stock_prices, get_earnings_data
from eugene.sources.edgar import EDGARClient


class EarningsAgent:
    """Comprehensive earnings intelligence agent."""
    
    def __init__(self, config):
        self.config = config
        self._edgar = None
    
    @property
    def edgar(self):
        if self._edgar is None:
            self._edgar = EDGARClient(self.config)
        return self._edgar
    
    def get_earnings_calendar(self, tickers: List[str]) -> dict:
        """
        Get upcoming earnings dates for a watchlist.
        
        Args:
            tickers: List of ticker symbols
        
        Returns:
            Sorted list of upcoming earnings with days until report
        """
        today = datetime.now().date()
        calendar = []
        
        for ticker in tickers[:20]:  # Limit to 20
            try:
                data = get_earnings_data(ticker)
                if "error" in data:
                    continue
                
                next_earn = data.get("next_earnings")
                if next_earn and next_earn.get("date"):
                    try:
                        earn_date = datetime.strptime(next_earn["date"][:10], "%Y-%m-%d").date()
                        days_until = (earn_date - today).days
                        
                        if days_until >= 0:  # Only future dates
                            calendar.append({
                                "ticker": ticker.upper(),
                                "company_name": data.get("company_name", ticker),
                                "earnings_date": next_earn["date"][:10],
                                "days_until": days_until,
                                "eps_estimate": next_earn.get("eps_estimate"),
                                "beat_rate_pct": data.get("track_record", {}).get("beat_rate_pct"),
                            })
                    except:
                        continue
            except:
                continue
        
        # Sort by days until earnings
        calendar.sort(key=lambda x: x["days_until"])
        
        return {
            "source": "Yahoo Finance",
            "as_of": today.strftime("%Y-%m-%d"),
            "tickers_checked": len(tickers),
            "upcoming_earnings": len(calendar),
            "calendar": calendar,
        }
    
    def analyze_post_earnings_moves(self, ticker: str, num_quarters: int = 8) -> dict:
        """
        Analyze stock price movement after earnings announcements.
        
        Args:
            ticker: Stock symbol
            num_quarters: Number of past quarters to analyze
        
        Returns:
            Analysis of post-earnings price moves
        """
        ticker = ticker.upper().strip()
        
        # Get earnings history
        earnings = get_earnings_data(ticker)
        if "error" in earnings:
            return earnings
        
        # Get price history (need 2 years for 8 quarters)
        prices = get_stock_prices(ticker, period="2y", interval="1d")
        if "error" in prices:
            return prices
        
        # Build price lookup by date
        price_lookup = {p["date"]: p for p in prices.get("prices", [])}
        
        # Analyze each earnings report
        analyses = []
        reported = [e for e in earnings.get("earnings_history", []) 
                   if e.get("result") in ("beat", "miss", "inline")][:num_quarters]
        
        for earn in reported:
            earn_date = earn.get("date", "")[:10]
            if not earn_date:
                continue
            
            # Find price on earnings day and days after
            day_0_price = None
            day_1_price = None
            day_5_price = None
            
            # Look for prices around earnings date
            try:
                earn_dt = datetime.strptime(earn_date, "%Y-%m-%d")
                
                # Find closest trading day (earnings might be after hours)
                for offset in range(0, 5):
                    check_date = (earn_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
                    if check_date in price_lookup:
                        if day_0_price is None:
                            day_0_price = price_lookup[check_date]["close"]
                        break
                
                # Day 1 (next trading day after earnings)
                for offset in range(1, 7):
                    check_date = (earn_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
                    if check_date in price_lookup:
                        day_1_price = price_lookup[check_date]["close"]
                        break
                
                # Day 5 (one week after)
                for offset in range(5, 12):
                    check_date = (earn_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
                    if check_date in price_lookup:
                        day_5_price = price_lookup[check_date]["close"]
                        break
                
                # Calculate moves
                move_1d = None
                move_5d = None
                
                if day_0_price and day_1_price:
                    move_1d = round(((day_1_price - day_0_price) / day_0_price) * 100, 2)
                if day_0_price and day_5_price:
                    move_5d = round(((day_5_price - day_0_price) / day_0_price) * 100, 2)
                
                analyses.append({
                    "date": earn_date,
                    "result": earn["result"],
                    "eps_estimate": earn.get("eps_estimate"),
                    "eps_actual": earn.get("eps_actual"),
                    "surprise_pct": earn.get("surprise_pct"),
                    "price_before": day_0_price,
                    "move_1d_pct": move_1d,
                    "move_5d_pct": move_5d,
                })
            except:
                continue
        
        # Calculate summary stats
        beats = [a for a in analyses if a["result"] == "beat"]
        misses = [a for a in analyses if a["result"] == "miss"]
        
        avg_move_on_beat = None
        avg_move_on_miss = None
        
        if beats:
            beat_moves = [b["move_1d_pct"] for b in beats if b["move_1d_pct"] is not None]
            if beat_moves:
                avg_move_on_beat = round(sum(beat_moves) / len(beat_moves), 2)
        
        if misses:
            miss_moves = [m["move_1d_pct"] for m in misses if m["move_1d_pct"] is not None]
            if miss_moves:
                avg_move_on_miss = round(sum(miss_moves) / len(miss_moves), 2)
        
        return {
            "ticker": ticker,
            "company_name": earnings.get("company_name", ticker),
            "source": "Yahoo Finance + Price Data",
            "quarters_analyzed": len(analyses),
            "summary": {
                "total_beats": len(beats),
                "total_misses": len(misses),
                "avg_move_on_beat_pct": avg_move_on_beat,
                "avg_move_on_miss_pct": avg_move_on_miss,
                "beat_rate_pct": earnings.get("track_record", {}).get("beat_rate_pct"),
            },
            "history": analyses,
        }
    
    def get_earnings_8k(self, ticker: str, limit: int = 4) -> dict:
        """
        Get recent 8-K earnings press releases and extract key points.
        
        Args:
            ticker: Stock symbol
            limit: Number of recent 8-Ks to retrieve
        
        Returns:
            Extracted earnings information from 8-K filings
        """
        ticker = ticker.upper().strip()
        
        try:
            # Get recent 8-K filings
            filings = self.edgar.get_filings(ticker, form_type="8-K", limit=limit * 3)
            
            earnings_8ks = []
            
            for filing in filings:
                if len(earnings_8ks) >= limit:
                    break
                
                # Check if it's an earnings-related 8-K (Item 2.02)
                try:
                    # Get the 8-K content
                    content = self.edgar.get_filing_content(filing.accession_number)
                    
                    if not content:
                        continue
                    
                    # Check for earnings indicators
                    content_lower = content.lower()
                    is_earnings = any(term in content_lower for term in [
                        "item 2.02",
                        "results of operations",
                        "earnings",
                        "quarterly results",
                        "financial results",
                        "announces results",
                    ])
                    
                    if not is_earnings:
                        continue
                    
                    # Extract key metrics (basic extraction)
                    extracted = self._extract_8k_metrics(content)
                    
                    earnings_8ks.append({
                        "filing_date": filing.filed_date,
                        "accession": filing.accession_number,
                        "period": filing.period_of_report if hasattr(filing, 'period_of_report') else None,
                        "extracted": extracted,
                    })
                except:
                    continue
            
            return {
                "ticker": ticker,
                "source": "SEC EDGAR 8-K",
                "filings_checked": len(filings),
                "earnings_8ks_found": len(earnings_8ks),
                "filings": earnings_8ks,
            }
        
        except Exception as e:
            return {
                "ticker": ticker,
                "error": str(e),
                "source": "SEC EDGAR 8-K"
            }
    
    def _extract_8k_metrics(self, content: str) -> dict:
        """Extract key metrics from 8-K text content."""
        import re
        
        extracted = {
            "revenue_mentioned": [],
            "eps_mentioned": [],
            "guidance_mentioned": False,
            "key_phrases": [],
        }
        
        # Look for revenue figures
        rev_patterns = [
            r'revenue[s]?\s+(?:of|was|were|totaled)?\s*\$?([\d,.]+)\s*(billion|million|B|M)',
            r'net\s+revenue[s]?\s+(?:of|was|were)?\s*\$?([\d,.]+)\s*(billion|million|B|M)',
            r'\$([\d,.]+)\s*(billion|million)\s+(?:in\s+)?revenue',
        ]
        
        for pattern in rev_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches[:3]:
                extracted["revenue_mentioned"].append(f"${match[0]} {match[1]}")
        
        # Look for EPS figures
        eps_patterns = [
            r'(?:earnings|EPS|diluted\s+EPS)\s+(?:of|was|were)?\s*\$?([\d.]+)',
            r'\$([\d.]+)\s+(?:per\s+share|EPS)',
        ]
        
        for pattern in eps_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches[:3]:
                extracted["eps_mentioned"].append(f"${match}")
        
        # Check for guidance
        guidance_terms = ["guidance", "outlook", "expects", "forecasts", "projects"]
        extracted["guidance_mentioned"] = any(term in content.lower() for term in guidance_terms)
        
        # Extract key phrases
        key_terms = ["record", "growth", "increased", "decreased", "exceeded", "beat", "missed"]
        sentences = content.split(".")
        for sentence in sentences[:50]:
            if any(term in sentence.lower() for term in key_terms):
                clean = sentence.strip()[:200]
                if len(clean) > 30:
                    extracted["key_phrases"].append(clean)
                if len(extracted["key_phrases"]) >= 3:
                    break
        
        return extracted
    
    def full_earnings_report(self, ticker: str) -> dict:
        """
        Complete earnings intelligence report for a ticker.
        Combines calendar, price analysis, and 8-K data.
        
        Args:
            ticker: Stock symbol
        
        Returns:
            Comprehensive earnings report
        """
        ticker = ticker.upper().strip()
        
        # Get all components
        earnings_data = get_earnings_data(ticker)
        price_analysis = self.analyze_post_earnings_moves(ticker)
        # 8k_data = self.get_earnings_8k(ticker)  # Can be slow, make optional
        
        return {
            "ticker": ticker,
            "company_name": earnings_data.get("company_name", ticker),
            "source": "Eugene Intelligence",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            
            "next_earnings": earnings_data.get("next_earnings"),
            
            "track_record": earnings_data.get("track_record", {}),
            
            "current_estimates": earnings_data.get("current_estimates", {}),
            
            "post_earnings_moves": {
                "avg_move_on_beat_pct": price_analysis.get("summary", {}).get("avg_move_on_beat_pct"),
                "avg_move_on_miss_pct": price_analysis.get("summary", {}).get("avg_move_on_miss_pct"),
                "history": price_analysis.get("history", [])[:4],
            },
            
            "quarterly_revenue": earnings_data.get("quarterly_revenue", [])[:4],
            
            "annual_financials": earnings_data.get("annual_financials", [])[:3],
        }
