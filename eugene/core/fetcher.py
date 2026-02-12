import os
import os
"""
Eugene Intelligence — Robust Data Fetcher
"""
import requests
import time
from typing import Dict

DEFAULT_TIMEOUT = 10
MAX_RETRIES = 3
RETRY_BACKOFF = [1, 2, 4]
SEC_USER_AGENT = os.environ.get("SEC_USER_AGENT", "Eugene Intelligence (matthew@eugeneintelligence.com)")
HEADERS = {"User-Agent": SEC_USER_AGENT}


class FetchError(Exception):
    def __init__(self, message: str, code: str, status_code: int = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


def fetch_with_retry(url: str, params: Dict = None, headers: Dict = None, timeout: int = DEFAULT_TIMEOUT, retries: int = MAX_RETRIES) -> dict:
    merged_headers = {**HEADERS, **(headers or {})}
    last_error = None
    
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, headers=merged_headers, timeout=timeout)
            
            if response.status_code == 429:
                time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])
                continue
            if response.status_code >= 500:
                time.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])
                continue
            if response.status_code == 404:
                raise FetchError("Resource not found", "NOT_FOUND", 404)
            if response.status_code == 403:
                raise FetchError("Access forbidden", "FORBIDDEN", 403)
            if response.status_code >= 400:
                raise FetchError(f"Request failed: {response.status_code}", "CLIENT_ERROR", response.status_code)
            
            return response.json()
        except requests.exceptions.Timeout:
            last_error = FetchError(f"Timeout after {timeout}s", "TIMEOUT")
        except requests.exceptions.ConnectionError:
            last_error = FetchError("Connection failed", "CONNECTION_ERROR")
        except requests.exceptions.JSONDecodeError:
            return {"_raw": response.text}
        except FetchError:
            raise
        except Exception as e:
            last_error = FetchError(str(e), "UNKNOWN_ERROR")
        
        if attempt < retries - 1:
            time.sleep(RETRY_BACKOFF[attempt])
    
    raise last_error or FetchError("Max retries exceeded", "MAX_RETRIES")


def safe_fetch(url: str, params: Dict = None, default=None):
    try:
        return fetch_with_retry(url, params)
    except FetchError:
        return default
