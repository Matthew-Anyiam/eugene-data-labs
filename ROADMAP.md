# Eugene Intelligence — Roadmap

## Shipped
- [x] SEC EDGAR data pipeline (10-K, 10-Q, 8-K, Form 4, 13F)
- [x] AI Deep Research agent (7 data sources, Claude Haiku)
- [x] SEC EFTS news handler (8-K/6-K filings)
- [x] SQLite persistence (feedback, waitlist, usage, rate limits)
- [x] Structured JSON logging & monitoring (`/v1/stats`)
- [x] Frontend test suite (19 tests, Vitest)
- [x] Feedback widget

## In Progress
- [ ] Production hardening & scaling

## Planned

### Private Credit Market Data
**Priority:** High — user-requested feature
**Opportunity:** $1.7T+ market with very little transparent data. Institutional investors pay premium for visibility.

Potential data sources:
- **BDC filings (SEC EDGAR)** — Ares Capital (ARCC), Owl Rock (OBDC), Blue Owl (OWL) etc. file quarterly holdings in 10-Q/10-K. We already have the SEC pipeline to extract these.
- **Cliffwater Direct Lending Index** — benchmark for private credit returns
- **LCD by PitchBook** — leveraged loan and private credit deal data
- **Federal Reserve SLOOS** — Senior Loan Officer Opinion Survey for lending conditions
- **FRED** — high-yield spreads, leveraged loan indices as market context

Implementation ideas:
1. Start with BDC holdings extraction (free, uses existing SEC pipeline)
2. Add private credit market indicators from FRED (free API)
3. Build a "Private Credit Dashboard" section in the frontend
4. Premium tier: deeper analytics, deal-level data from paid sources

### Other Ideas
- [ ] Real-time price data integration
- [ ] Portfolio tracking & alerts
- [ ] Earnings call transcript analysis
- [ ] Peer comparison tool
- [ ] API key authentication for power users
- [ ] Webhook notifications for material events
