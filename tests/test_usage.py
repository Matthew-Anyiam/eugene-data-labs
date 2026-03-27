"""Tests for usage tracking and rate limiting."""
import time
from eugene.usage import UsageTracker


class TestUsageTracker:
    def test_allows_requests_within_limit(self):
        tracker = UsageTracker(window_seconds=60, max_per_window=5)
        result = tracker.check_and_record("key1")
        assert result["allowed"] is True
        assert result["remaining"] == 4
        assert result["limit"] == 5
        assert result["total"] == 1

    def test_counts_increment(self):
        tracker = UsageTracker(window_seconds=60, max_per_window=10)
        for i in range(5):
            tracker.check_and_record("key1")
        result = tracker.check_and_record("key1")
        assert result["total"] == 6
        assert result["remaining"] == 4

    def test_blocks_at_limit(self):
        tracker = UsageTracker(window_seconds=60, max_per_window=3)
        tracker.check_and_record("key1")
        tracker.check_and_record("key1")
        tracker.check_and_record("key1")
        result = tracker.check_and_record("key1")
        assert result["allowed"] is False
        assert result["remaining"] == 0

    def test_separate_keys_independent(self):
        tracker = UsageTracker(window_seconds=60, max_per_window=2)
        tracker.check_and_record("key1")
        tracker.check_and_record("key1")
        # key1 is at limit
        result1 = tracker.check_and_record("key1")
        assert result1["allowed"] is False
        # key2 is fresh
        result2 = tracker.check_and_record("key2")
        assert result2["allowed"] is True
        assert result2["remaining"] == 1

    def test_reset_after_window(self):
        tracker = UsageTracker(window_seconds=1, max_per_window=2)
        tracker.check_and_record("key1")
        tracker.check_and_record("key1")
        result = tracker.check_and_record("key1")
        assert result["allowed"] is False
        # Wait for window to expire
        time.sleep(1.1)
        result = tracker.check_and_record("key1")
        assert result["allowed"] is True
        # Total keeps accumulating
        assert result["total"] == 3

    def test_get_stats_no_side_effects(self):
        tracker = UsageTracker(window_seconds=60, max_per_window=10)
        tracker.check_and_record("key1")
        stats = tracker.get_stats("key1")
        assert stats["current_window"] == 1
        assert stats["total"] == 1
        # Getting stats again should show same count
        stats2 = tracker.get_stats("key1")
        assert stats2["total"] == 1

    def test_get_all_stats(self):
        tracker = UsageTracker(window_seconds=60, max_per_window=10)
        tracker.check_and_record("abcdefghij")
        tracker.check_and_record("1234567890")
        result = tracker.get_all_stats()
        assert len(result) == 2

    def test_rate_limited_has_reset(self):
        tracker = UsageTracker(window_seconds=30, max_per_window=1)
        tracker.check_and_record("key1")
        result = tracker.check_and_record("key1")
        assert result["allowed"] is False
        assert result["reset"] >= 1
        assert result["reset"] <= 30


class TestOpenAPISpec:
    def test_spec_valid_structure(self):
        from eugene.openapi import openapi_spec
        spec = openapi_spec()
        assert spec["openapi"] == "3.1.0"
        assert "Eugene Intelligence" in spec["info"]["title"]
        assert "/v1/sec/{identifier}" in spec["paths"]
        assert "/health" in spec["paths"]

    def test_spec_has_all_endpoints(self):
        from eugene.openapi import openapi_spec
        spec = openapi_spec()
        paths = spec["paths"]
        assert "/v1/economics/{category}" in paths
        assert "/v1/screener" in paths
        assert "/v1/crypto/{symbol}" in paths
        assert "/v1/stream/filings" in paths
        assert "/v1/capabilities" in paths

    def test_spec_has_security_schemes(self):
        from eugene.openapi import openapi_spec
        spec = openapi_spec()
        schemes = spec["components"]["securitySchemes"]
        assert "ApiKeyHeader" in schemes
        assert "ApiKeyQuery" in schemes
        assert schemes["ApiKeyHeader"]["name"] == "X-API-Key"

    def test_spec_envelope_schema(self):
        from eugene.openapi import openapi_spec
        spec = openapi_spec()
        envelope = spec["components"]["schemas"]["Envelope"]
        assert "status" in envelope["properties"]
        assert "data" in envelope["properties"]
        assert "provenance" in envelope["properties"]

    def test_spec_no_stub_extracts(self):
        from eugene.openapi import openapi_spec
        import json
        spec_str = json.dumps(openapi_spec())
        assert "options" not in spec_str.lower() or "coming_soon" not in spec_str.lower()
        assert "orderbook" not in spec_str.lower()


class TestAuthWithUsage:
    def test_rate_limit_headers_format(self):
        """Verify _add_rate_headers adds correct headers."""
        from eugene.auth import _add_rate_headers

        class FakeResponse:
            def __init__(self):
                self.headers = {}

        resp = FakeResponse()
        _add_rate_headers(resp, {"limit": 60, "remaining": 55, "reset": 45, "total": 5})
        assert resp.headers["X-RateLimit-Limit"] == "60"
        assert resp.headers["X-RateLimit-Remaining"] == "55"
        assert resp.headers["X-RateLimit-Reset"] == "45"
        assert resp.headers["X-Request-Count"] == "5"
