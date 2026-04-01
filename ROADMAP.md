# Eugene Intelligence — Roadmap

## Shipped

### Core Platform
- [x] SEC EDGAR data pipeline (10-K, 10-Q, 8-K, Form 4, 13F, XBRL)
- [x] 19 data extract types (financials, insiders, holdings, sections, technicals, etc.)
- [x] Stock screener (sector, market cap, price, volume, beta)
- [x] Economic indicators (9 FRED categories, 200+ series)
- [x] Prediction markets (Polymarket/Kalshi integration)
- [x] Crypto quotes and historical data

### AI Research
- [x] Deep Research agent (7 data sources, Claude Haiku)
- [x] Bull/Bear Debate (3 AI analysts)
- [x] Market Simulation (5 investor personas)
- [x] Email briefs (send research to your inbox)

### World Intelligence
- [x] News intelligence (GDELT feeds, sentiment, topic filtering)
- [x] Sanctions screening (OFAC SDN, EU, UN lists)
- [x] Regulatory monitoring (Federal Register changes)
- [x] Disaster tracking (USGS earthquakes, GDACS multi-hazard, NASA FIRMS fires)
- [x] Conflict intelligence (UCDP events, escalation scoring)
- [x] Supply chain monitoring (15 ports, 8 chokepoints, UN Comtrade trade flows)
- [x] Flight intelligence (OpenSky aircraft, 15 airports, airspace status)
- [x] Convergence engine (cross-signal risk detection, 5 named patterns)

### Private Credit
- [x] BDC universe (12 tracked companies with SEC filings)
- [x] BDC holdings parser (Schedule of Investments extraction)
- [x] Credit spreads (6 FRED series — HY, BBB, BB, B, CCC, lending standards)
- [x] Market stress indicators

### Infrastructure
- [x] Dual SQLite/PostgreSQL database with transparent SQL translation
- [x] Celery + Redis workers (8 periodic ingestion tasks)
- [x] Modal.com GPU inference pipeline (NER, sentiment, 3-tier fallback)
- [x] Entity ontology graph (entities, edges, signals, convergence)
- [x] API key authentication with tiered rate limits
- [x] Structured JSON logging and monitoring

### Access Methods
- [x] REST API (62 endpoints)
- [x] MCP server (7 tools, ~35 sub-actions)
- [x] CLI (`eugene sec`, `eugene econ`, `eugene prices`, `eugene crypto`)
- [x] SSE streaming (real-time filing alerts)

### Frontend
- [x] 11 pages (Landing, Company, Screener, Economics, Predictions, Ontology, World, Dashboard, Docs, Pricing, 404)
- [x] Responsive design with dark mode
- [x] Live data demo on landing page

## Next Up
- [ ] Production deployment of Celery workers on Railway
- [ ] Real-time price data integration
- [ ] Portfolio tracking and alerts
- [ ] Webhook notifications for convergence events
- [ ] Frontend code-splitting for bundle optimization
- [ ] Error boundaries and improved error UX
