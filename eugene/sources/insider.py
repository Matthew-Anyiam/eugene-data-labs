"""
Eugene Intelligence — SEC EDGAR Insider Transactions (Forms 3, 4, 5)
"""

import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Optional, List

HEADERS = {"User-Agent": "Eugene Intelligence matthew@eugeneintelligence.com", "Accept": "application/json"}


def _get_cik_for_ticker(ticker: str) -> Optional[str]:
    try:
        resp = requests.get("https://www.sec.gov/files/company_tickers.json", headers=HEADERS, timeout=10)
        data = resp.json()
        ticker_upper = ticker.upper().strip()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker_upper:
                return str(entry["cik_str"]).zfill(10)
        return None
    except:
        return None


def _decode_txn_code(code: str) -> str:
    codes = {"P": "Open market purchase", "S": "Open market sale", "A": "Grant/award", "D": "Sale to issuer", "F": "Tax withholding", "M": "Exercise of options", "G": "Gift", "X": "Exercise derivative"}
    return codes.get(code, f"Other ({code})")


def _parse_form4_xml(xml_content: str) -> dict:
    try:
        root = ET.fromstring(xml_content)
        
        def find_text(element, path, default=""):
            if element is None: return default
            parts = path.split("/")
            el = element
            for part in parts:
                if el is None: return default
                found = None
                for child in el:
                    tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                    if tag == part:
                        found = child
                        break
                el = found
            return el.text.strip() if el is not None and el.text else default
        
        def find_elem(element, tag_name):
            if element is None: return None
            for child in element:
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if tag == tag_name:
                    return child
            return None
        
        issuer = find_elem(root, "issuer")
        issuer_data = {
            "cik": find_text(issuer, "issuerCik"),
            "name": find_text(issuer, "issuerName"),
            "ticker": find_text(issuer, "issuerTradingSymbol")
        } if issuer is not None else {}
        
        owner_elem = find_elem(root, "reportingOwner")
        owner_data = {}
        if owner_elem is not None:
            owner_id = find_elem(owner_elem, "reportingOwnerId")
            owner_rel = find_elem(owner_elem, "reportingOwnerRelationship")
            owner_data = {"name": find_text(owner_id, "rptOwnerName") if owner_id else ""}
            if owner_rel is not None:
                owner_data["is_director"] = find_text(owner_rel, "isDirector") in ("1", "true")
                owner_data["is_officer"] = find_text(owner_rel, "isOfficer") in ("1", "true")
                owner_data["officer_title"] = find_text(owner_rel, "officerTitle")
        
        transactions = []
        nd_table = find_elem(root, "nonDerivativeTable")
        if nd_table is not None:
            for txn in nd_table:
                txn_tag = txn.tag.split("}")[-1] if "}" in txn.tag else txn.tag
                if "Transaction" not in txn_tag: continue
                
                coding = find_elem(txn, "transactionCoding")
                amounts = find_elem(txn, "transactionAmounts")
                post = find_elem(txn, "postTransactionAmounts")
                txn_date_elem = find_elem(txn, "transactionDate")
                
                txn_code = find_text(coding, "transactionCode") if coding else ""
                
                acq_disp_elem = find_elem(amounts, "transactionAcquiredDisposedCode") if amounts else None
                acq_disp = find_text(acq_disp_elem, "value") if acq_disp_elem else ""
                
                shares_elem = find_elem(amounts, "transactionShares") if amounts else None
                price_elem = find_elem(amounts, "transactionPricePerShare") if amounts else None
                post_elem = find_elem(post, "sharesOwnedFollowingTransaction") if post else None
                
                try: shares = float(find_text(shares_elem, "value", "0"))
                except: shares = 0
                try: price = float(find_text(price_elem, "value", "0"))
                except: price = 0
                try: post_shares = float(find_text(post_elem, "value", "0"))
                except: post_shares = 0
                
                transactions.append({
                    "date": find_text(txn_date_elem, "value") if txn_date_elem else "",
                    "transaction_code": txn_code,
                    "transaction_type": _decode_txn_code(txn_code),
                    "acquired_disposed": "acquired" if acq_disp == "A" else "disposed" if acq_disp == "D" else acq_disp,
                    "shares": shares,
                    "price_per_share": price,
                    "total_value": round(shares * price, 2) if shares and price else 0,
                    "shares_owned_after": post_shares,
                })
        
        return {"issuer": issuer_data, "owner": owner_data, "transactions": transactions}
    except Exception as e:
        return {"error": str(e)}


def _find_xml_file(cik: str, accession: str) -> Optional[str]:
    """Find the actual XML file in a Form 4 filing."""
    acc_clean = accession.replace("-", "")
    index_url = f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc_clean}/index.json"
    try:
        resp = requests.get(index_url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            idx = resp.json()
            for item in idx.get("directory", {}).get("item", []):
                name = item.get("name", "")
                if name.endswith(".xml") and name not in ("primary_doc.xml",):
                    return name
    except:
        pass
    return "edgardoc.xml"  # fallback


def get_insider_transactions(ticker: str, days_back: int = 365, transaction_type: Optional[str] = None) -> dict:
    ticker = ticker.upper().strip()
    
    try:
        cik = _get_cik_for_ticker(ticker)
        if not cik:
            return {"ticker": ticker, "error": f"Could not find CIK for {ticker}", "source": "SEC EDGAR"}
        
        filings_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        resp = requests.get(filings_url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return {"ticker": ticker, "error": f"EDGAR returned {resp.status_code}", "source": "SEC EDGAR"}
        
        company_data = resp.json()
        company_name = company_data.get("name", ticker)
        
        recent = company_data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        
        start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        form4_filings = []
        for i, form in enumerate(forms):
            if form in ("4", "4/A") and i < len(dates) and dates[i] >= start_date:
                form4_filings.append({"filing_date": dates[i], "accession": accessions[i] if i < len(accessions) else ""})
        
        all_transactions = []
        parsed_count = 0
        
        for filing in form4_filings[:20]:
            acc = filing["accession"]
            acc_clean = acc.replace("-", "")
            
            # Find and fetch the XML file
            xml_file = _find_xml_file(cik, acc)
            xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc_clean}/{xml_file}"
            
            try:
                xml_resp = requests.get(xml_url, headers=HEADERS, timeout=10)
                if xml_resp.status_code == 200 and "<?xml" in xml_resp.text[:100]:
                    parsed = _parse_form4_xml(xml_resp.text)
                    if "error" not in parsed and parsed.get("transactions"):
                        for txn in parsed["transactions"]:
                            txn["filing_date"] = filing["filing_date"]
                            txn["owner_name"] = parsed.get("owner", {}).get("name", "")
                            txn["owner_title"] = parsed.get("owner", {}).get("officer_title", "")
                            all_transactions.append(txn)
                        parsed_count += 1
            except: continue
        
        if transaction_type:
            if transaction_type.lower() == "buy":
                all_transactions = [t for t in all_transactions if t["acquired_disposed"] == "acquired" and t["transaction_code"] == "P"]
            elif transaction_type.lower() == "sell":
                all_transactions = [t for t in all_transactions if t["acquired_disposed"] == "disposed" and t["transaction_code"] in ("S", "F")]
        
        all_transactions.sort(key=lambda x: x.get("date", ""), reverse=True)
        
        buys = [t for t in all_transactions if t["acquired_disposed"] == "acquired" and t["transaction_code"] == "P"]
        sells = [t for t in all_transactions if t["acquired_disposed"] == "disposed" and t["transaction_code"] in ("S", "F")]
        
        total_buy_value = sum(t["total_value"] for t in buys if t["total_value"])
        total_sell_value = sum(t["total_value"] for t in sells if t["total_value"])
        
        notable = [t for t in all_transactions if t["total_value"] and t["total_value"] >= 1_000_000]
        
        return {
            "ticker": ticker,
            "company_name": company_name,
            "source": "SEC EDGAR Form 4",
            "period": f"Last {days_back} days",
            "filings_found": len(form4_filings),
            "filings_parsed": parsed_count,
            "summary": {
                "total_transactions": len(all_transactions),
                "total_buys": len(buys),
                "total_sells": len(sells),
                "total_buy_value": round(total_buy_value, 2),
                "total_sell_value": round(total_sell_value, 2),
                "net_value": round(total_buy_value - total_sell_value, 2),
                "signal": "net_buying" if total_buy_value > total_sell_value else "net_selling" if total_sell_value > total_buy_value else "neutral",
            },
            "notable_transactions": [{"date": t["date"], "owner": t["owner_name"], "title": t["owner_title"], "type": t["transaction_type"], "shares": t["shares"], "price": t["price_per_share"], "total_value": t["total_value"]} for t in notable[:10]],
            "transactions": all_transactions,
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "SEC EDGAR"}
