"""
Ontology ingestion pipeline — populate the entity graph from existing Eugene data.

Ingests data from:
  - SEC EDGAR: Companies, officers, filings, insider transactions
  - FRED: Economic indicators
  - Crypto: Crypto assets
  - Screener: Company attributes (sector, market cap, etc.)

Each ingestion function is idempotent — safe to re-run.
"""

import logging

from eugene.ontology.entities import create_entity, resolve_entity
from eugene.ontology.edges import create_edge
from eugene.ontology.signals import record_signal

logger = logging.getLogger(__name__)


def ingest_company(ticker: str) -> dict:
    """Ingest a company and its relationships from SEC EDGAR.

    Resolves the ticker, creates company entity, then pulls:
    - Officer relationships (person → company)
    - Recent filings (company → filing)
    - Insider transactions (person → company via transaction)
    - Institutional holders (institution → company)
    - Peer relationships (company → company)

    Returns summary of what was ingested.
    """
    from eugene.router import query

    stats = {"entities": 0, "edges": 0, "signals": 0, "errors": []}

    try:
        # 1. Get company profile
        profile_result = query(ticker, "profile")
        profile = profile_result.get("data", {})
        if not profile:
            stats["errors"].append(f"No profile found for {ticker}")
            return stats

        cik = profile_result.get("resolved", {}).get("cik", "")
        company_name = profile.get("company_name", "") or profile.get("name", ticker)
        sector = profile.get("sector", "")
        sic = profile.get("sic", "")
        exchange = profile.get("exchange", "")

        # Create company entity
        company = create_entity(
            entity_type="company",
            canonical_name=company_name,
            attributes={
                "ticker": ticker.upper(),
                "cik": cik,
                "sector": sector,
                "sic": sic,
                "exchange": exchange,
                "fiscal_year_end": profile.get("fiscal_year_end", ""),
                "state": profile.get("state", ""),
                "description": profile.get("description", "")[:500] if profile.get("description") else "",
            },
            source="sec",
            source_id=cik or ticker.upper(),
            aliases=[
                {"alias": ticker.upper(), "alias_type": "ticker", "source": "sec"},
                {"alias": cik, "alias_type": "cik", "source": "sec"} if cik else None,
                {"alias": company_name, "alias_type": "name", "source": "sec"},
            ] if cik else [
                {"alias": ticker.upper(), "alias_type": "ticker", "source": "sec"},
                {"alias": company_name, "alias_type": "name", "source": "sec"},
            ],
        )
        # Filter None aliases
        stats["entities"] += 1
        company_id = company["id"]

    except Exception as e:
        stats["errors"].append(f"Profile error: {str(e)}")
        return stats

    # 2. Ingest officers
    try:
        _ingest_officers(ticker, company_id, stats)
    except Exception as e:
        stats["errors"].append(f"Officers error: {str(e)}")

    # 3. Ingest recent filings
    try:
        _ingest_filings(ticker, company_id, stats)
    except Exception as e:
        stats["errors"].append(f"Filings error: {str(e)}")

    # 4. Ingest insider transactions
    try:
        _ingest_insiders(ticker, company_id, stats)
    except Exception as e:
        stats["errors"].append(f"Insiders error: {str(e)}")

    # 5. Ingest institutional holders
    try:
        _ingest_holders(ticker, company_id, stats)
    except Exception as e:
        stats["errors"].append(f"Holders error: {str(e)}")

    # 6. Ingest peer relationships
    try:
        _ingest_peers(ticker, company_id, stats)
    except Exception as e:
        stats["errors"].append(f"Peers error: {str(e)}")

    logger.info(
        "Ingested %s: %d entities, %d edges, %d signals, %d errors",
        ticker, stats["entities"], stats["edges"], stats["signals"], len(stats["errors"]),
    )
    return stats


def _ingest_officers(ticker: str, company_id: str, stats: dict):
    """Ingest company officers as person entities."""
    from eugene.router import query
    try:
        result = query(ticker, "profile")
        profile = result.get("data", {})
        officers = profile.get("officers", [])
        if not officers:
            return

        for officer in officers[:20]:  # Cap at 20 officers
            name = officer.get("name", "")
            if not name:
                continue
            title = officer.get("title", "")

            person = create_entity(
                entity_type="person",
                canonical_name=name,
                attributes={"title": title, "company": ticker.upper()},
                source="sec",
                source_id=f"{ticker.upper()}_officer_{name.replace(' ', '_').lower()}",
                aliases=[{"alias": name, "alias_type": "name", "source": "sec"}],
            )
            stats["entities"] += 1

            create_edge(
                source_id=person["id"],
                target_id=company_id,
                relationship="officer_of",
                attributes={"role": title},
            )
            stats["edges"] += 1
    except Exception:
        pass  # Non-critical


def _ingest_filings(ticker: str, company_id: str, stats: dict):
    """Ingest recent filings as filing entities."""
    from eugene.router import query
    try:
        result = query(ticker, "filings", limit=20)
        data = result.get("data", {})
        filings = data.get("filings", [])
        if not filings:
            return

        for filing in filings[:20]:
            accession = filing.get("accession", "")
            form_type = filing.get("form", "") or filing.get("form_type", "")
            filed_date = filing.get("filing_date", "") or filing.get("date", "")

            if not accession:
                continue

            filing_entity = create_entity(
                entity_type="filing",
                canonical_name=f"{ticker.upper()} {form_type} ({filed_date})",
                attributes={
                    "accession": accession,
                    "form_type": form_type,
                    "filing_date": filed_date,
                    "ticker": ticker.upper(),
                },
                source="sec",
                source_id=accession,
                aliases=[{"alias": accession, "alias_type": "accession", "source": "sec"}],
            )
            stats["entities"] += 1

            create_edge(
                source_id=company_id,
                target_id=filing_entity["id"],
                relationship="filed",
                attributes={"form_type": form_type, "date": filed_date},
                valid_from=filed_date,
            )
            stats["edges"] += 1
    except Exception:
        pass


def _ingest_insiders(ticker: str, company_id: str, stats: dict):
    """Ingest insider transactions as person + transaction entities."""
    from eugene.router import query
    try:
        result = query(ticker, "insiders", limit=20)
        data = result.get("data", {})
        insider_filings = data.get("insider_filings", [])
        if not insider_filings:
            return

        for tx in insider_filings[:20]:
            owner = tx.get("owner", "") or tx.get("reporting_owner", "")
            if not owner:
                continue

            tx_type = tx.get("transaction_type", "") or tx.get("type", "")
            shares = tx.get("shares", 0) or tx.get("securities_transacted", 0)
            price = tx.get("price", 0) or tx.get("price_per_share", 0)
            date = tx.get("transaction_date", "") or tx.get("date", "")

            # Create person entity for insider
            person = create_entity(
                entity_type="person",
                canonical_name=owner,
                attributes={"role": tx.get("owner_type", "insider")},
                source="sec",
                source_id=f"insider_{owner.replace(' ', '_').lower()}",
                aliases=[{"alias": owner, "alias_type": "name", "source": "sec"}],
            )
            stats["entities"] += 1

            # Create transaction entity
            create_entity(
                entity_type="transaction",
                canonical_name=f"{owner} {tx_type} {ticker.upper()} ({date})",
                attributes={
                    "transaction_type": tx_type,
                    "shares": shares,
                    "price": price,
                    "date": date,
                    "ticker": ticker.upper(),
                },
                source="sec",
                source_id=f"tx_{ticker.upper()}_{owner.replace(' ', '_').lower()}_{date}",
            )
            stats["entities"] += 1

            # Person → Company via Transaction
            create_edge(
                source_id=person["id"],
                target_id=company_id,
                relationship="transacted",
                attributes={
                    "transaction_type": tx_type,
                    "shares": shares,
                    "price": price,
                    "date": date,
                },
                valid_from=date,
            )
            stats["edges"] += 1

            # Generate signal for insider activity
            if tx_type and shares:
                signal_type = "insider_sell" if "sale" in tx_type.lower() or "sell" in tx_type.lower() else "insider_buy"
                magnitude = min(1.0, float(shares) / 100000.0) if shares else 0.5
                record_signal(
                    entity_id=company_id,
                    signal_type=signal_type,
                    magnitude=magnitude,
                    metadata={"owner": owner, "shares": shares, "price": price},
                    occurred_at=date or None,
                )
                stats["signals"] += 1

    except Exception:
        pass


def _ingest_holders(ticker: str, company_id: str, stats: dict):
    """Ingest institutional holders."""
    from eugene.router import query
    try:
        result = query(ticker, "ownership", limit=20)
        data = result.get("data", {})
        holders = data.get("holders", []) or data.get("institutional_holders", [])
        if not holders:
            return

        for holder in holders[:15]:
            name = holder.get("holder", "") or holder.get("investor", "") or holder.get("name", "")
            if not name:
                continue

            shares = holder.get("shares", 0)
            value = holder.get("value", 0)
            change = holder.get("change", 0) or holder.get("change_pct", 0)
            report_date = holder.get("date_reported", "") or holder.get("report_date", "")

            institution = create_entity(
                entity_type="institution",
                canonical_name=name,
                attributes={"type": "institutional_holder"},
                source="sec",
                source_id=f"inst_{name.replace(' ', '_').lower()[:50]}",
                aliases=[{"alias": name, "alias_type": "name", "source": "sec"}],
            )
            stats["entities"] += 1

            create_edge(
                source_id=institution["id"],
                target_id=company_id,
                relationship="holds",
                attributes={
                    "shares": shares,
                    "value": value,
                    "change": change,
                    "report_date": report_date,
                },
                valid_from=report_date,
            )
            stats["edges"] += 1

    except Exception:
        pass


def _ingest_peers(ticker: str, company_id: str, stats: dict):
    """Ingest peer company relationships."""
    from eugene.router import query
    try:
        result = query(ticker, "peers")
        data = result.get("data", {})
        peers = data.get("peers", [])
        if not peers:
            return

        for peer_ticker in peers[:10]:
            if isinstance(peer_ticker, dict):
                peer_ticker = peer_ticker.get("ticker", "")
            if not peer_ticker or peer_ticker == ticker.upper():
                continue

            # Try to resolve peer — create minimal entity if not already ingested
            existing = resolve_entity(peer_ticker, entity_type="company", limit=1)
            if existing:
                peer_id = existing[0]["id"]
            else:
                peer = create_entity(
                    entity_type="company",
                    canonical_name=peer_ticker,
                    attributes={"ticker": peer_ticker},
                    source="sec",
                    source_id=peer_ticker,
                    aliases=[{"alias": peer_ticker, "alias_type": "ticker", "source": "sec"}],
                )
                peer_id = peer["id"]
                stats["entities"] += 1

            create_edge(
                source_id=company_id,
                target_id=peer_id,
                relationship="peer_of",
                attributes={"basis": "sector"},
            )
            stats["edges"] += 1

    except Exception:
        pass


def ingest_economic_indicators() -> dict:
    """Ingest FRED economic indicators as entities."""
    from eugene.sources.fred import get_all

    stats = {"entities": 0, "edges": 0, "errors": []}

    try:
        data = get_all()
        categories = data.get("categories", {})

        for category_name, indicators in categories.items():
            if not isinstance(indicators, list):
                continue

            for indicator in indicators:
                series_id = indicator.get("series_id", "") or indicator.get("id", "")
                name = indicator.get("title", "") or indicator.get("name", series_id)
                value = indicator.get("value", indicator.get("latest_value"))
                frequency = indicator.get("frequency", "")

                if not series_id:
                    continue

                create_entity(
                    entity_type="economic_indicator",
                    canonical_name=name,
                    attributes={
                        "series_id": series_id,
                        "category": category_name,
                        "frequency": frequency,
                        "latest_value": value,
                        "units": indicator.get("units", ""),
                    },
                    source="fred",
                    source_id=series_id,
                    aliases=[
                        {"alias": series_id, "alias_type": "series_id", "source": "fred"},
                        {"alias": name, "alias_type": "name", "source": "fred"},
                    ],
                )
                stats["entities"] += 1

    except Exception as e:
        stats["errors"].append(f"FRED error: {str(e)}")

    logger.info("Ingested FRED indicators: %d entities", stats["entities"])
    return stats


def ingest_batch(tickers: list[str]) -> dict:
    """Ingest multiple companies in batch.

    Args:
        tickers: List of ticker symbols to ingest

    Returns:
        Aggregate stats across all tickers
    """
    total = {"entities": 0, "edges": 0, "signals": 0, "errors": [], "tickers_processed": 0}

    for ticker in tickers:
        try:
            result = ingest_company(ticker)
            total["entities"] += result["entities"]
            total["edges"] += result["edges"]
            total["signals"] += result["signals"]
            total["errors"].extend(result["errors"])
            total["tickers_processed"] += 1
        except Exception as e:
            total["errors"].append(f"{ticker}: {str(e)}")

    return total


def get_ingestion_stats() -> dict:
    """Get current ontology statistics."""
    from eugene.db import _get_conn

    with _get_conn() as conn:
        entity_counts = conn.execute(
            "SELECT entity_type, COUNT(*) as cnt FROM entities GROUP BY entity_type ORDER BY cnt DESC"
        ).fetchall()
        edge_counts = conn.execute(
            "SELECT relationship, COUNT(*) as cnt FROM edges GROUP BY relationship ORDER BY cnt DESC"
        ).fetchall()
        signal_counts = conn.execute(
            "SELECT signal_type, COUNT(*) as cnt FROM signals GROUP BY signal_type ORDER BY cnt DESC"
        ).fetchall()
        total_entities = conn.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
        total_edges = conn.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
        total_signals = conn.execute("SELECT COUNT(*) FROM signals").fetchone()[0]
        total_aliases = conn.execute("SELECT COUNT(*) FROM entity_aliases").fetchone()[0]

    return {
        "total_entities": total_entities,
        "total_edges": total_edges,
        "total_signals": total_signals,
        "total_aliases": total_aliases,
        "entity_breakdown": {r["entity_type"]: r["cnt"] for r in entity_counts},
        "edge_breakdown": {r["relationship"]: r["cnt"] for r in edge_counts},
        "signal_breakdown": {r["signal_type"]: r["cnt"] for r in signal_counts},
    }
