"""Institutional ownership from 13F-HR filings with full holdings parsing."""
import xml.etree.ElementTree as ET
from eugene.handlers.filings import filings_handler
from eugene.sources.sec_api import fetch_filing_index, fetch_filing_xml


def _find_infotable_xml(cik: str, accession: str) -> str | None:
    """Find the informationTable XML document in a 13F-HR filing."""
    try:
        index = fetch_filing_index(cik, accession)
        items = index.get("directory", {}).get("item", [])
        for item in items:
            name = item.get("name", "").lower()
            if "infotable" in name and name.endswith(".xml"):
                return item["name"]
        # Fallback: look for any XML that isn't the primary doc
        for item in items:
            name = item.get("name", "").lower()
            if name.endswith(".xml") and "primary_doc" not in name:
                return item["name"]
    except Exception:
        pass
    return None


def _parse_13f_xml(xml_text: str) -> list[dict]:
    """Parse a 13F informationTable XML into structured holdings."""
    root = ET.fromstring(xml_text)

    # Handle namespace — 13F XML typically uses a namespace
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    holdings = []

    for info_table in root.iter(f"{ns}infoTable"):
        def findtext(tag, default=""):
            el = info_table.find(f"{ns}{tag}")
            if el is None:
                el = info_table.find(tag)
            return el.text.strip() if el is not None and el.text else default

        name = findtext("nameOfIssuer")
        cusip = findtext("cusip")
        title = findtext("titleOfClass")
        value = findtext("value")  # in thousands
        shares_el = info_table.find(f"{ns}shrsOrPrnAmt")
        if shares_el is None:
            shares_el = info_table.find("shrsOrPrnAmt")

        shares = ""
        share_type = ""
        if shares_el is not None:
            sh = shares_el.find(f"{ns}sshPrnamt")
            if sh is None:
                sh = shares_el.find("sshPrnamt")
            if sh is not None and sh.text:
                shares = sh.text.strip()
            st = shares_el.find(f"{ns}sshPrnamtType")
            if st is None:
                st = shares_el.find("sshPrnamtType")
            if st is not None and st.text:
                share_type = st.text.strip()

        # Voting authority
        voting_el = info_table.find(f"{ns}votingAuthority")
        if voting_el is None:
            voting_el = info_table.find("votingAuthority")

        voting = {}
        if voting_el is not None:
            for field in ("Sole", "Shared", "None"):
                vel = voting_el.find(f"{ns}{field}")
                if vel is None:
                    vel = voting_el.find(field)
                if vel is not None and vel.text:
                    voting[field.lower()] = int(vel.text.strip())

        # Investment discretion
        discretion = findtext("investmentDiscretion")

        holdings.append({
            "issuer": name,
            "title_of_class": title,
            "cusip": cusip,
            "value_thousands": int(value) if value else None,
            "shares": int(shares) if shares else None,
            "share_type": share_type,  # "SH" = shares, "PRN" = principal
            "investment_discretion": discretion,
            "voting_authority": voting if voting else None,
        })

    return holdings


def ownership_handler(resolved: dict, params: dict) -> dict:
    """List 13F-HR filings with parsed institutional holdings."""
    cik = resolved["cik"]
    limit = int(params.get("limit", 5))

    # Get 13F-HR filings
    params_copy = dict(params)
    params_copy["form"] = "13F-HR"
    params_copy["limit"] = limit
    result = filings_handler(resolved, params_copy)
    filings = result.get("filings", [])

    parsed_filings = []
    for filing in filings:
        accession = filing.get("accession", "")
        entry = {**filing, "holdings": [], "total_value_thousands": 0, "position_count": 0}

        try:
            xml_name = _find_infotable_xml(cik, accession)
            if xml_name:
                xml_text = fetch_filing_xml(cik, accession, xml_name)
                holdings = _parse_13f_xml(xml_text)
                # Sort by value descending
                holdings.sort(key=lambda h: h.get("value_thousands") or 0, reverse=True)
                total_value = sum(h.get("value_thousands") or 0 for h in holdings)
                entry["holdings"] = holdings
                entry["total_value_thousands"] = total_value
                entry["position_count"] = len(holdings)
        except Exception:
            pass  # Fall back to metadata-only

        parsed_filings.append(entry)

    return {
        "ownership_filings": parsed_filings,
        "count": len(parsed_filings),
    }
