"""Insider trades from SEC Form 4 filings with full transaction parsing."""
import xml.etree.ElementTree as ET
from eugene.handlers.filings import filings_handler
from eugene.sources.sec_api import fetch_submissions, fetch_filing_index, fetch_filing_xml


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

    return {
        "insider_filings": parsed_filings,
        "count": len(parsed_filings),
        "summary": {
            "total_purchases": total_buys,
            "total_sales": total_sells,
            "net_direction": "buying" if total_buys > total_sells else "selling" if total_sells > total_buys else "neutral",
        },
    }
