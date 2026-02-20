"""Company profile from SEC submissions."""
from eugene.sources.sec_api import fetch_submissions


def profile_handler(resolved: dict, params: dict) -> dict:
    cik = resolved["cik"]
    subs = fetch_submissions(cik)
    business = subs.get("addresses", {}).get("business", {})

    return {
        "cik": cik,
        "name": subs.get("name"),
        "ticker": resolved.get("ticker"),
        "sic": subs.get("sic"),
        "sic_description": subs.get("sicDescription"),
        "ein": subs.get("ein"),
        "fiscal_year_end": subs.get("fiscalYearEnd"),
        "state_of_incorporation": subs.get("stateOfIncorporation"),
        "website": subs.get("website", ""),
        "phone": business.get("phone", ""),
        "address": {
            "street": business.get("street1", ""),
            "city": business.get("city", ""),
            "state": business.get("stateOrCountry", ""),
            "zip": business.get("zipCode", ""),
        },
        "former_names": [
            {"name": fn.get("name"), "until": fn.get("to")}
            for fn in subs.get("formerNames", [])
        ],
        "filings_count": len(subs.get("filings", {}).get("recent", {}).get("form", [])),
    }
