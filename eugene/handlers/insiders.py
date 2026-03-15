"""Insider trades from SEC Form 4 filings with full transaction parsing."""
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from eugene.handlers.filings import filings_handler
from eugene.sources.sec_api import fetch_filing_index, fetch_filing_xml


def _find_xml_doc(cik: str, accession: str) -> str | None:
    """Find the primary XML document in a Form 4 filing."""
    try:
        index = fetch_filing_index(cik, accession)
        items = index.get("directory", {}).get("item", [])
        for item in items:
            name = item.get("name", "")
            if name.endswith(".xml") and "primary_doc" not in name:
                return name
    except Exception:
        pass
    return None


def _parse_form4_xml(xml_text: str) -> dict:
    """Parse a Form 4 XML document into structured transaction data."""
    root = ET.fromstring(xml_text)

    # Namespace handling — Form 4 XML may or may not use namespaces
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    def find(el, tag):
        """Find element with or without namespace."""
        result = el.find(f"{ns}{tag}")
        if result is None:
            result = el.find(tag)
        return result

    def findtext(el, tag, default=""):
        result = find(el, tag)
        return result.text.strip() if result is not None and result.text else default

    # Reporting owner
    owner_el = find(root, "reportingOwner")
    owner = {}
    if owner_el is not None:
        owner_id = find(owner_el, "reportingOwnerId")
        owner_rel = find(owner_el, "reportingOwnerRelationship")
        if owner_id is not None:
            owner["name"] = findtext(owner_id, "rptOwnerName")
            owner["cik"] = findtext(owner_id, "rptOwnerCik")
        if owner_rel is not None:
            owner["is_director"] = findtext(owner_rel, "isDirector") == "1"
            owner["is_officer"] = findtext(owner_rel, "isOfficer") == "1"
            owner["title"] = findtext(owner_rel, "officerTitle")

    # Issuer
    issuer_el = find(root, "issuer")
    issuer = {}
    if issuer_el is not None:
        issuer["name"] = findtext(issuer_el, "issuerName")
        issuer["ticker"] = findtext(issuer_el, "issuerTradingSymbol")
        issuer["cik"] = findtext(issuer_el, "issuerCik")

    # Transaction code meanings
    code_map = {
        "P": "purchase", "S": "sale", "A": "grant",
        "M": "exercise", "G": "gift", "F": "tax_withholding",
        "C": "conversion", "J": "other",
    }

    def _parse_tx(tx, derivative=False):
        """Parse a single transaction element (non-derivative or derivative)."""
        sec_title = findtext(find(tx, "securityTitle") or tx, "value")

        tx_amounts = find(tx, "transactionAmounts")
        shares = ""
        price = ""
        acquired_disposed = ""
        tx_code = ""

        if tx_amounts is not None:
            shares_el = find(tx_amounts, "transactionShares")
            if shares_el is not None:
                shares = findtext(shares_el, "value")

            price_el = find(tx_amounts, "transactionPricePerShare")
            if price_el is not None:
                price = findtext(price_el, "value")

            ad_el = find(tx_amounts, "transactionAcquiredDisposedCode")
            if ad_el is not None:
                acquired_disposed = findtext(ad_el, "value")

        tx_coding = find(tx, "transactionCoding")
        if tx_coding is not None:
            tx_code = findtext(tx_coding, "transactionCode")

        tx_date_el = find(tx, "transactionDate")
        tx_date = findtext(tx_date_el, "value") if tx_date_el is not None else ""

        post_el = find(tx, "postTransactionAmounts")
        shares_after = ""
        if post_el is not None:
            owned_el = find(post_el, "sharesOwnedFollowingTransaction")
            if owned_el is not None:
                shares_after = findtext(owned_el, "value")

        direction = "unknown"
        if acquired_disposed == "A":
            direction = "acquired"
        elif acquired_disposed == "D":
            direction = "disposed"

        entry = {
            "date": tx_date,
            "security": sec_title,
            "transaction_code": tx_code,
            "transaction_type": code_map.get(tx_code, tx_code),
            "shares": float(shares) if shares else None,
            "price_per_share": float(price) if price else None,
            "direction": direction,
            "shares_owned_after": float(shares_after) if shares_after else None,
            "derivative": derivative,
        }

        # For derivatives, include underlying security info
        if derivative:
            underlying = find(tx, "underlyingSecurity")
            if underlying is not None:
                entry["underlying_security"] = findtext(find(underlying, "underlyingSecurityTitle") or underlying, "value")
                ul_shares = findtext(find(underlying, "underlyingSecurityShares") or underlying, "value")
                entry["underlying_shares"] = float(ul_shares) if ul_shares else None

        return entry

    transactions = []

    # Non-derivative transactions
    nd_table = find(root, "nonDerivativeTable")
    if nd_table is not None:
        for tx in nd_table:
            tag = tx.tag.replace(ns, "")
            if tag in ("nonDerivativeTransaction", "nonDerivativeHolding"):
                transactions.append(_parse_tx(tx, derivative=False))

    # Derivative transactions
    d_table = find(root, "derivativeTable")
    if d_table is not None:
        for tx in d_table:
            tag = tx.tag.replace(ns, "")
            if tag in ("derivativeTransaction", "derivativeHolding"):
                transactions.append(_parse_tx(tx, derivative=True))

    return {
        "owner": owner,
        "issuer": issuer,
        "transactions": transactions,
    }


def insiders_handler(resolved: dict, params: dict) -> dict:
    """List insider trade filings with parsed Form 4 transactions."""
    cik = resolved["cik"]
    limit = int(params.get("limit", 10))

    # Get Form 4 filings
    params_copy = dict(params)
    params_copy["form"] = "4"
    params_copy["limit"] = limit
    result = filings_handler(resolved, params_copy)
    filings = result.get("filings", [])

    parsed_filings = []
    for filing in filings:
        accession = filing.get("accession", "")
        entry = {**filing, "transactions": [], "owner": {}}

        try:
            xml_name = _find_xml_doc(cik, accession)
            if xml_name:
                xml_text = fetch_filing_xml(cik, accession, xml_name)
                parsed = _parse_form4_xml(xml_text)
                entry["owner"] = parsed["owner"]
                entry["issuer"] = parsed["issuer"]
                entry["transactions"] = parsed["transactions"]
        except Exception:
            pass  # Fall back to metadata-only

        parsed_filings.append(entry)

    # Summary stats
    total_buys = 0
    total_sells = 0
    for f in parsed_filings:
        for tx in f.get("transactions", []):
            if tx["transaction_type"] == "purchase":
                total_buys += 1
            elif tx["transaction_type"] == "sale":
                total_sells += 1

    sentiment = _compute_sentiment(parsed_filings)

    return {
        "insider_filings": parsed_filings,
        "count": len(parsed_filings),
        "summary": {
            "total_purchases": total_buys,
            "total_sales": total_sells,
            "net_direction": "buying" if total_buys > total_sells else "selling" if total_sells > total_buys else "neutral",
        },
        "sentiment": sentiment,
    }


def _compute_sentiment(parsed_filings: list) -> dict:
    """Compute insider sentiment scoring from parsed Form 4 data.

    Score: 0-100 (50 = neutral). Signal: bullish (>=65) / neutral / bearish (<=35).
    """
    buy_value = 0.0
    sell_value = 0.0
    buy_count = 0
    sell_count = 0
    officer_buys = 0
    director_buys = 0
    buy_dates: list[str] = []

    for f in parsed_filings:
        owner = f.get("owner", {})
        is_officer = owner.get("is_officer", False)
        is_director = owner.get("is_director", False)

        for tx in f.get("transactions", []):
            shares = tx.get("shares") or 0
            price = tx.get("price_per_share") or 0
            value = shares * price

            if tx.get("transaction_type") == "purchase":
                buy_value += value
                buy_count += 1
                if is_officer:
                    officer_buys += 1
                if is_director:
                    director_buys += 1
                if tx.get("date"):
                    buy_dates.append(tx["date"])
            elif tx.get("transaction_type") == "sale":
                sell_value += value
                sell_count += 1

    net_value = buy_value - sell_value

    # Buy/sell ratio
    if sell_count > 0:
        buy_sell_ratio = buy_count / sell_count
    elif buy_count > 0:
        buy_sell_ratio = None  # all buys, no sells — infinite
    else:
        buy_sell_ratio = 0.0

    # Scoring (0-100, 50 = neutral)
    score = 50

    # Net value impact
    if net_value > 1_000_000:
        score += 20
    elif net_value > 100_000:
        score += 10
    elif net_value < -1_000_000:
        score -= 20
    elif net_value < -100_000:
        score -= 10

    # Officer buys are a strong signal
    if officer_buys >= 2:
        score += 10
    elif officer_buys == 1:
        score += 5

    # Buy/sell ratio (only adjust if there are actual trades)
    if buy_sell_ratio is not None and (buy_count + sell_count) > 0:
        if buy_sell_ratio > 2:
            score += 5
        elif buy_sell_ratio < 0.5:
            score -= 5

    # Cluster detection: 3+ buys within 14 days
    has_cluster = _detect_cluster(buy_dates, window_days=14, min_count=3)
    if has_cluster:
        score += 10

    score = max(0, min(100, score))
    signal = "bullish" if score >= 65 else "bearish" if score <= 35 else "neutral"

    return {
        "score": score,
        "signal": signal,
        "buy_value": round(buy_value, 2),
        "sell_value": round(sell_value, 2),
        "net_value": round(net_value, 2),
        "buy_count": buy_count,
        "sell_count": sell_count,
        "buy_sell_ratio": round(buy_sell_ratio, 2) if buy_sell_ratio is not None else None,
        "officer_buys": officer_buys,
        "director_buys": director_buys,
        "cluster_buying_detected": has_cluster,
    }


def _detect_cluster(dates: list[str], window_days: int = 14, min_count: int = 3) -> bool:
    """Detect if there are min_count buys within window_days of each other."""
    if len(dates) < min_count:
        return False

    parsed = []
    for d in dates:
        try:
            parsed.append(datetime.strptime(d, "%Y-%m-%d"))
        except (ValueError, TypeError):
            continue

    if len(parsed) < min_count:
        return False

    parsed.sort()
    window = timedelta(days=window_days)

    for i in range(len(parsed) - min_count + 1):
        if parsed[i + min_count - 1] - parsed[i] <= window:
            return True
    return False
