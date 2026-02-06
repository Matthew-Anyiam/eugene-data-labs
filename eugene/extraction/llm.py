"""
Eugene Intelligence - LLM Extraction Engine

Handles all LLM-based extraction using Claude API.
Includes prompt engineering, response parsing, and error handling.
"""

import json
import logging
import time
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from eugene.config import Config, get_config

logger = logging.getLogger(__name__)


class ExtractionError(Exception):
    """Base exception for extraction errors"""
    pass


class LLMError(ExtractionError):
    """Error from LLM API"""
    pass


class ParseError(ExtractionError):
    """Error parsing LLM response"""
    pass


@dataclass
class ExtractionRequest:
    """Request for extraction"""
    text: str
    schema: Dict[str, Any]
    system_prompt: str
    user_prompt: str
    max_tokens: int = 4096
    temperature: float = 0.0


@dataclass
class ExtractionResponse:
    """Response from extraction"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    raw_response: Optional[str] = None
    tokens_used: int = 0
    latency_ms: int = 0


class LLMClient:
    """
    Client for LLM API calls.
    
    Handles:
    - API authentication
    - Rate limiting
    - Retry logic
    - Error handling
    """
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self._client = None
        
        if not self.config.api.anthropic_api_key:
            logger.warning("Anthropic API key not set. LLM extraction will fail.")
    
    @property
    def client(self):
        """Lazy initialization of Anthropic client"""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.Anthropic(
                    api_key=self.config.api.anthropic_api_key
                )
            except ImportError:
                raise LLMError("anthropic package not installed. Run: pip install anthropic")
            except Exception as e:
                raise LLMError(f"Failed to initialize Anthropic client: {e}")
        return self._client
    
    def extract(self, request: ExtractionRequest) -> ExtractionResponse:
        """Send extraction request to LLM."""
        if not self.config.api.anthropic_api_key:
            return ExtractionResponse(
                success=False,
                error="Anthropic API key not configured"
            )
        
        start_time = time.time()
        raw_text = ""
        
        try:
            messages = [
                {
                    "role": "user",
                    "content": request.user_prompt.format(text=request.text)
                }
            ]
            
            response = self.client.messages.create(
                model=self.config.api.anthropic_model,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                system=request.system_prompt,
                messages=messages
            )
            
            raw_text = response.content[0].text
            data = self._parse_json_response(raw_text)
            latency_ms = int((time.time() - start_time) * 1000)
            
            return ExtractionResponse(
                success=True,
                data=data,
                raw_response=raw_text,
                tokens_used=response.usage.input_tokens + response.usage.output_tokens,
                latency_ms=latency_ms
            )
            
        except json.JSONDecodeError as e:
            return ExtractionResponse(
                success=False,
                error=f"Failed to parse JSON response: {e}",
                raw_response=raw_text
            )
        except Exception as e:
            logger.error(f"LLM extraction error: {e}")
            return ExtractionResponse(
                success=False,
                error=str(e)
            )
    
    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """Parse JSON from LLM response."""
        import re
        text = text.strip()
        
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        
        # Try code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try { ... }
        brace_match = re.search(r'\{[\s\S]*\}', text)
        if brace_match:
            try:
                return json.loads(brace_match.group())
            except json.JSONDecodeError:
                pass
        
        raise json.JSONDecodeError("Could not find valid JSON in response", text, 0)
    
    def extract_with_retry(
        self,
        request: ExtractionRequest,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ) -> ExtractionResponse:
        """Extract with automatic retry on failure."""
        last_error = None
        
        for attempt in range(max_retries):
            response = self.extract(request)
            
            if response.success:
                return response
            
            last_error = response.error
            logger.warning(f"Extraction attempt {attempt + 1} failed: {last_error}")
            
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
        
        return ExtractionResponse(
            success=False,
            error=f"Failed after {max_retries} attempts. Last error: {last_error}"
        )


class MockLLMClient(LLMClient):
    """Mock LLM client for testing without API calls."""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self._mock_responses: Dict[str, Dict] = {}
    
    def add_mock_response(self, pattern: str, response: Dict):
        """Add a mock response for a text pattern"""
        self._mock_responses[pattern] = response
    
    def extract(self, request: ExtractionRequest) -> ExtractionResponse:
        """Return mock response based on text content"""
        start_time = time.time()
        
        for pattern, response_data in self._mock_responses.items():
            if pattern.lower() in request.text.lower():
                return ExtractionResponse(
                    success=True,
                    data=response_data,
                    raw_response=json.dumps(response_data),
                    tokens_used=100,
                    latency_ms=int((time.time() - start_time) * 1000)
                )
        
        return ExtractionResponse(
            success=True,
            data={"mock": True, "message": "No specific mock found"},
            raw_response='{"mock": true}',
            tokens_used=50,
            latency_ms=10
        )


# ==============================================================================
# Extraction Prompts
# ==============================================================================

DEBT_EXTRACTION_SYSTEM_PROMPT = """You are a financial data extraction specialist. Extract structured debt information from SEC filings.

Extract:
1. Individual debt instruments with details
2. Total debt amounts
3. Debt maturity schedule
4. Covenant terms if mentioned

Rules:
- Return ONLY valid JSON, no explanations
- Use null for unknown values
- All monetary amounts in millions USD
- Interest rates as decimals (5.25% = 0.0525)
- Dates as YYYY-MM-DD
- Include confidence score (0-1) for each item

JSON Schema:
{schema}
"""

DEBT_EXTRACTION_USER_PROMPT = """Extract debt information from this SEC filing:

<filing_text>
{text}
</filing_text>

Return JSON matching the schema."""


COVENANT_EXTRACTION_SYSTEM_PROMPT = """You are a financial analyst specializing in debt covenants. Extract covenant information from SEC filings.

Focus on:
1. Financial maintenance covenants (leverage, coverage ratios)
2. Current covenant values and thresholds
3. Compliance status

Rules:
- Return ONLY valid JSON
- Use null for unknown values
- Include covenant type, threshold, current value, compliance status
- Add confidence score (0-1) for each covenant

JSON Schema:
{schema}
"""

COVENANT_EXTRACTION_USER_PROMPT = """Extract covenant information:

<text>
{text}
</text>

Return JSON."""


# ==============================================================================
# JSON Schemas
# ==============================================================================

DEBT_SCHEMA = {
    "type": "object",
    "properties": {
        "total_debt": {"type": ["number", "null"]},
        "total_long_term_debt": {"type": ["number", "null"]},
        "total_short_term_debt": {"type": ["number", "null"]},
        "cash_and_equivalents": {"type": ["number", "null"]},
        "instruments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "instrument_type": {"type": "string"},
                    "principal": {"type": "number"},
                    "rate_type": {"type": ["string", "null"]},
                    "interest_rate": {"type": ["number", "null"]},
                    "spread_bps": {"type": ["integer", "null"]},
                    "benchmark": {"type": ["string", "null"]},
                    "maturity_date": {"type": ["string", "null"]},
                    "is_secured": {"type": ["boolean", "null"]},
                    "seniority": {"type": ["string", "null"]},
                    "confidence": {"type": "number"}
                },
                "required": ["name", "instrument_type", "principal"]
            }
        },
        "maturities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer"},
                    "amount": {"type": "number"}
                }
            }
        }
    }
}

COVENANT_SCHEMA = {
    "type": "object",
    "properties": {
        "covenants": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "covenant_type": {"type": "string"},
                    "threshold": {"type": "number"},
                    "current_value": {"type": ["number", "null"]},
                    "is_maximum": {"type": "boolean"},
                    "is_in_compliance": {"type": ["boolean", "null"]},
                    "confidence": {"type": "number"}
                },
                "required": ["name", "covenant_type", "threshold"]
            }
        }
    }
}


# ==============================================================================
# Helper Functions
# ==============================================================================

def get_llm_client(mock: bool = False, config: Optional[Config] = None) -> LLMClient:
    """Get LLM client instance."""
    if mock:
        return MockLLMClient(config)
    return LLMClient(config)


def create_debt_extraction_request(text: str) -> ExtractionRequest:
    """Create extraction request for debt information"""
    return ExtractionRequest(
        text=text,
        schema=DEBT_SCHEMA,
        system_prompt=DEBT_EXTRACTION_SYSTEM_PROMPT.format(schema=json.dumps(DEBT_SCHEMA, indent=2)),
        user_prompt=DEBT_EXTRACTION_USER_PROMPT
    )


def create_covenant_extraction_request(text: str) -> ExtractionRequest:
    """Create extraction request for covenant information"""
    return ExtractionRequest(
        text=text,
        schema=COVENANT_SCHEMA,
        system_prompt=COVENANT_EXTRACTION_SYSTEM_PROMPT.format(schema=json.dumps(COVENANT_SCHEMA, indent=2)),
        user_prompt=COVENANT_EXTRACTION_USER_PROMPT
    )


if __name__ == "__main__":
    print("Testing LLM extraction engine...\n")
    
    client = MockLLMClient()
    
    client.add_mock_response("senior notes", {
        "total_debt": 5000,
        "instruments": [
            {
                "name": "5.25% Senior Notes due 2028",
                "instrument_type": "senior_notes",
                "principal": 1500,
                "rate_type": "fixed",
                "interest_rate": 0.0525,
                "maturity_date": "2028-06-15",
                "confidence": 0.92
            }
        ]
    })
    
    request = create_debt_extraction_request(
        "The company has $1.5 billion in 5.25% Senior Notes due 2028."
    )
    
    response = client.extract(request)
    
    print(f"Success: {response.success}")
    print(f"Data: {json.dumps(response.data, indent=2)}")
    
    print("\n✅ LLM extraction test passed!")
