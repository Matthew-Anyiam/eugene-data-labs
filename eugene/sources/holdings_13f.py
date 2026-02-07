"""
Eugene Intelligence — 13F Institutional Holdings
Parse SEC 13F-HR filings to track institutional ownership.
"""

import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional, List

HEADERS = {"User-Agent": "Eugene Intelligence matthew@eugeneintelligence.com"}

# Well-known institution CIKs
KNOWN_INSTITUTIONS = {
    "BERKSHIRE": "0001067983",
    "BLACKROCK": "0001364742", 
    "VANGUARD": "0000102909",
    "FIDELITY": "0000315066",
    "CITADEL": "0001423053",
    "BRIDGEWATER": "0001350694",
    "RENAISSANCE": "0001037389",
}


def get_13f_filing(cik: str, accession: str = None) -> dict:
    """
    Parse a 13F-HR filing to extract all holdings.
    
    Args:
        cik: Institution's CIK number
        accession: Specific filing (optional, uses latest)
    """
    cik = str(cik).zfill(10)
    
    try:
        # Get institution's filings
        resp = requests.get(f"https://data.sec.gov/submissions/CIK{cik}.json", headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return {"cik": cik, "error": f"EDGAR returned {resp.status_code}", "source": "SEC 13F-HR"}
        
        data = resp.json()
        institution_name = data.get("name", f"CIK {cik}")
        
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        accessions = recent.get("accessionNumber", [])
        dates = recent.get("filingDate", [])
        
        # Find 13F-HR filing
        target_acc, filing_date = None, None
        if accession:
            target_acc = accession
            idx = accessions.index(accession) if accession in accessions else -1
            filing_date = dates[idx] if idx >= 0 else None
        else:
            for i, form in enumerate(forms):
                if form == "13F-HR":
                    target_acc = accessions[i]
                    filing_date = dates[i]
                    break
        
        if not target_acc:
            return {"cik": cik, "institution": institution_name, "error": "No 13F-HR found", "source": "SEC 13F-HR"}
        
        # Find infotable.xml
        acc_clean = target_acc.replace("-", "")
        cik_short = cik.lstrip("0")
        
        idx_resp = requests.get(f"https://www.sec.gov/Archives/edgar/data/{cik_short}/{acc_clean}/index.json", headers=HEADERS, timeout=10)
        
        infotable_file = None
        if idx_resp.status_code == 200:
            for item in idx_resp.json().get("directory", {}).get("item", []):
                name = item.get("name", "").lower()
                if name.endswith(".xml") and "index" not in name and name != "primary_doc.xml":
                    infotable_file = item.get("name")
                    break
        
        if not infotable_file:
            return {"cik": cik, "institution": institution_name, "filing_date": filing_date, "error": "No infotable.xml found", "source": "SEC 13F-HR"}
        
        # Parse holdings
        xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_short}/{acc_clean}/{infotable_file}"
        xml_resp = requests.get(xml_url, headers=HEADERS, timeout=15)
        
        if xml_resp.status_code != 200:
            return {"cik": cik, "error": f"Could not fetch infotable", "source": "SEC 13F-HR"}
        
        holdings = _parse_infotable(xml_resp.text)
        
        total_value = sum(h.get("value", 0) for h in holdings)
        
        return {
            "cik": cik,
            "institution": institution_name,
            "filing_date": filing_date,
            "accession": target_acc,
            "source": "SEC 13F-HR",
            "source_url": xml_url,
            "summary": {
                "total_positions": len(holdings),
                "total_value": total_value,
            },
            "holdings": holdings[:100],  # Limit for MCP response size
        }
        
    except Exception as e:
        return {"cik": cik, "error": str(e), "source": "SEC 13F-HR"}


def _parse_infotable(xml_content: str) -> List[dict]:
    """Parse 13F infotable XML."""
    holdings = []
    
    try:
        root = ET.fromstring(xml_content)
        
        # Find all infoTable entries (handle namespaces)
        entries = []
        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag.lower() == "infotable":
                entries.append(elem)
        
        for entry in entries:
            holding = {}
            
            for child in entry.iter():
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                tag_lower = tag.lower()
                text = child.text.strip() if child.text else ""
                
                if not text:
                    continue
                
                if tag_lower == "nameofissuer":
                    holding["name"] = text
                elif tag_lower == "titleofclass":
                    holding["title"] = text
                elif tag_lower == "cusip":
                    holding["cusip"] = text
                elif tag_lower == "value":
                    try:
                        holding["value"] = int(text.replace(",", ""))  # 13F reports in thousands
                    except:
                        pass
                elif tag_lower == "sshprnamt":
                    try:
                        holding["shares"] = int(text.replace(",", ""))
                    except:
                        pass
                elif tag_lower == "sshprnamttype":
                    holding["share_type"] = text
                elif tag_lower == "investmentdiscretion":
                    holding["discretion"] = text
                elif tag_lower == "putcall":
                    holding["put_call"] = text
            
            if holding.get("name") or holding.get("cusip"):
                holdings.append(holding)
        
        # Sort by value descending
        holdings.sort(key=lambda x: x.get("value", 0), reverse=True)
        
    except:
        pass
    
    return holdings


def get_whale_holdings(institution: str) -> dict:
    """Get holdings for well-known institutions (Berkshire, BlackRock, etc.)"""
    inst_key = institution.upper().replace(" ", "_").replace("HATHAWAY", "").strip("_")
    
    cik = KNOWN_INSTITUTIONS.get(inst_key)
    if not cik:
        for key, val in KNOWN_INSTITUTIONS.items():
            if inst_key in key or key in inst_key:
                cik = val
                break
    
    if not cik:
        return {"institution": institution, "error": f"Unknown. Try: {', '.join(KNOWN_INSTITUTIONS.keys())}", "source": "SEC 13F-HR"}
    
    return get_13f_filing(cik)


def get_institution_history(cik: str, quarters: int = 4) -> dict:
    """Get list of recent 13F filings for an institution."""
    cik = str(cik).zfill(10)
    
    try:
        resp = requests.get(f"https://data.sec.gov/submissions/CIK{cik}.json", headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return {"cik": cik, "error": "Could not fetch", "source": "SEC 13F-HR"}
        
        data = resp.json()
        recent = data.get("filings", {}).get("recent", {})
        
        filings = []
        for i, form in enumerate(recent.get("form", [])):
            if form == "13F-HR" and len(filings) < quarters:
                filings.append({
                    "accession": recent["accessionNumber"][i],
                    "filing_date": recent["filingDate"][i],
                })
        
        return {
            "cik": cik,
            "institution": data.get("name"),
            "source": "SEC 13F-HR",
            "filings": filings,
        }
    except Exception as e:
        return {"cik": cik, "error": str(e), "source": "SEC 13F-HR"}
