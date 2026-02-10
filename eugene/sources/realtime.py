"""
Eugene Intelligence - Real-time SEC Filings
Monitor recent SEC filings through RSS feed polling.
"""
import re
import time
import logging
import xml.etree.ElementTree as ET
from typing import List, Dict, Callable, Optional
from datetime import datetime, timedelta
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)

def get_recent_filings(minutes: int = 60) -> List[Dict]:
    """
    Get recent SEC filings from the last N minutes.

    Args:
        minutes: Number of minutes to look back

    Returns:
        List of filing dictionaries
    """
    try:
        import requests

        config = get_config()

        # SEC RSS feed URL for recent filings
        rss_url = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=40&output=atom"

        headers = {
            'User-Agent': getattr(config, 'user_agent', 'Eugene Intelligence Financial Bot'),
            'Accept': 'application/atom+xml,application/xml,text/xml'
        }

        response = requests.get(rss_url, headers=headers)
        response.raise_for_status()

        # Parse XML/Atom feed
        filings = _parse_atom_feed(response.text)

        # Filter by time window
        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        recent_filings = []

        for filing in filings:
            try:
                filing_time = datetime.fromisoformat(filing.get('filing_date', '').replace('Z', '+00:00'))
                if filing_time >= cutoff_time:
                    recent_filings.append(filing)
            except (ValueError, TypeError):
                # Include filing if we can't parse the date
                recent_filings.append(filing)

        logger.info(f"Found {len(recent_filings)} recent filings in last {minutes} minutes")
        return recent_filings

    except Exception as e:
        logger.error(f"Failed to get recent filings: {e}")
        return []

def start_monitor(callback: Callable[[Dict], None], poll_interval: int = 30):
    """
    Start continuous monitoring of SEC filings.

    Args:
        callback: Function to call with each new filing
        poll_interval: Seconds between polls (default 30)
    """
    logger.info(f"Starting SEC filings monitor (polling every {poll_interval}s)")

    seen_filings = set()

    try:
        while True:
            try:
                # Get recent filings
                filings = get_recent_filings(minutes=poll_interval // 60 + 5)  # Small buffer

                for filing in filings:
                    filing_id = filing.get('accession_number', '') + filing.get('company_name', '')

                    if filing_id and filing_id not in seen_filings:
                        seen_filings.add(filing_id)

                        try:
                            callback(filing)
                        except Exception as e:
                            logger.warning(f"Callback failed for filing {filing_id}: {e}")

                # Clean up old seen filings (keep last 1000)
                if len(seen_filings) > 1000:
                    seen_filings = set(list(seen_filings)[-1000:])

                time.sleep(poll_interval)

            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
                time.sleep(60)  # Back off on error

    except KeyboardInterrupt:
        logger.info("Monitor stopped by user")
    except Exception as e:
        logger.error(f"Monitor failed: {e}")

def _parse_atom_feed(xml_content: str) -> List[Dict]:
    """Parse SEC Atom XML feed."""
    filings = []

    try:
        root = ET.fromstring(xml_content)
        namespace = {'atom': 'http://www.w3.org/2005/Atom'}

        for entry in root.findall('.//atom:entry', namespace):
            try:
                title_elem = entry.find('atom:title', namespace)
                link_elem = entry.find('atom:link', namespace)
                updated_elem = entry.find('atom:updated', namespace)

                if all(elem is not None for elem in [title_elem, link_elem, updated_elem]):
                    title = title_elem.text or ''

                    # Parse title: "FORM TYPE - COMPANY NAME (CIK: 0000000000)"
                    form_type, company_info = _parse_filing_title(title)
                    company_name, cik = _parse_company_info(company_info)

                    filing = {
                        'form_type': form_type,
                        'company_name': company_name,
                        'cik': cik,
                        'filing_url': link_elem.get('href', ''),
                        'filing_date': updated_elem.text or '',
                        'title': title,
                        'accession_number': _extract_accession_from_url(link_elem.get('href', ''))
                    }
                    filings.append(filing)

            except Exception as e:
                logger.debug(f"Failed to parse feed entry: {e}")
                continue

    except ET.ParseError as e:
        logger.warning(f"Failed to parse Atom XML: {e}")

    return filings

def _parse_filing_title(title: str) -> tuple:
    """Parse filing title to extract form type and company info."""
    try:
        parts = title.split(' - ', 1)
        if len(parts) >= 2:
            return parts[0].strip(), parts[1].strip()
        else:
            return 'Unknown', title
    except:
        return 'Unknown', title

def _parse_company_info(company_info: str) -> tuple:
    """Parse company info to extract name and CIK."""
    try:
        # Look for CIK pattern: (CIK: 0000000000)
        cik_match = re.search(r'\(CIK:\s*(\d+)\)', company_info)
        if cik_match:
            cik = cik_match.group(1).zfill(10)
            company_name = company_info[:cik_match.start()].strip()
        else:
            cik = ''
            company_name = company_info

        return company_name, cik
    except:
        return company_info, ''

def _extract_accession_from_url(url: str) -> str:
    """Extract accession number from SEC URL."""
    try:
        # URL format contains accession number
        # https://www.sec.gov/Archives/edgar/data/320193/000032019323000064/0000320193-23-000064-index.html
        parts = url.split('/')
        for part in parts:
            if '-' in part and len(part) >= 18:
                return part.split('-index')[0]
    except:
        pass
    return ''

# Example usage functions
def monitor_8k_filings(callback: Callable[[Dict], None]):
    """Monitor only 8-K filings (breaking news)."""
    def filtered_callback(filing):
        if filing.get('form_type') == '8-K':
            callback(filing)

    start_monitor(filtered_callback)

def monitor_earnings_filings(callback: Callable[[Dict], None]):
    """Monitor earnings-related filings (10-K, 10-Q)."""
    def filtered_callback(filing):
        form_type = filing.get('form_type', '')
        if form_type in ['10-K', '10-Q']:
            callback(filing)

    start_monitor(filtered_callback)