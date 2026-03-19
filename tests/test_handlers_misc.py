"""Tests for misc handlers: segments, export."""
from unittest.mock import patch


# ===== Segments Handler =====

class TestSegmentsHandler:
    @patch("eugene.handlers.segments.fetch_companyfacts")
    def test_segments_business(self, mock_fetch):
        from eugene.handlers.segments import segments_handler
        mock_fetch.return_value = {
            "facts": {
                "us-gaap": {
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "label": "Revenue",
                        "units": {
                            "USD": [
                                {
                                    "end": "2024-09-28", "val": 100000000000,
                                    "form": "10-K", "fy": 2024, "fp": "FY",
                                    "segments": {
                                        "us-gaap:StatementBusinessSegmentsAxis": "aapl:iPhoneSegmentMember"
                                    },
                                },
                                {
                                    "end": "2024-09-28", "val": 50000000000,
                                    "form": "10-K", "fy": 2024, "fp": "FY",
                                    "segments": {
                                        "us-gaap:StatementBusinessSegmentsAxis": "aapl:ServicesSegmentMember"
                                    },
                                },
                            ]
                        }
                    }
                },
                "dei": {},
            }
        }
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = segments_handler(resolved, {})

        assert result["ticker"] == "AAPL"
        assert result["period_type"] == "FY"
        assert "2024-09-28" in result["business_segments"]
        biz = result["business_segments"]["2024-09-28"]
        assert "iPhoneSegmentMember" in biz
        assert "ServicesSegmentMember" in biz

    @patch("eugene.handlers.segments.fetch_companyfacts")
    def test_segments_geographic(self, mock_fetch):
        from eugene.handlers.segments import segments_handler
        mock_fetch.return_value = {
            "facts": {
                "us-gaap": {
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "label": "Revenue",
                        "units": {
                            "USD": [
                                {
                                    "end": "2024-09-28", "val": 80000000000,
                                    "form": "10-K", "fy": 2024, "fp": "FY",
                                    "segments": {
                                        "us-gaap:StatementGeographicalAxis": "aapl:AmericasSegmentMember"
                                    },
                                },
                            ]
                        }
                    }
                },
                "dei": {},
            }
        }
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = segments_handler(resolved, {})

        assert "2024-09-28" in result["geographic_segments"]

    @patch("eugene.handlers.segments.fetch_companyfacts")
    def test_segments_no_dimensions(self, mock_fetch):
        from eugene.handlers.segments import segments_handler
        mock_fetch.return_value = {
            "facts": {
                "us-gaap": {
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "label": "Revenue",
                        "units": {
                            "USD": [
                                {"end": "2024-09-28", "val": 391035000000, "form": "10-K"},
                            ]
                        }
                    }
                },
                "dei": {},
            }
        }
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = segments_handler(resolved, {})

        assert result["business_segments"] == {}
        assert result["geographic_segments"] == {}

    @patch("eugene.handlers.segments.fetch_companyfacts")
    def test_segments_quarterly(self, mock_fetch):
        from eugene.handlers.segments import segments_handler
        mock_fetch.return_value = {
            "facts": {
                "us-gaap": {
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "label": "Revenue",
                        "units": {
                            "USD": [
                                {
                                    "end": "2024-06-29", "val": 50000000000,
                                    "form": "10-Q", "fy": 2024, "fp": "Q3",
                                    "segments": {
                                        "us-gaap:StatementBusinessSegmentsAxis": "aapl:iPhoneSegmentMember"
                                    },
                                },
                            ]
                        }
                    }
                },
                "dei": {},
            }
        }
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = segments_handler(resolved, {"period": "Q"})

        assert result["period_type"] == "Q"
        assert "2024-06-29" in result["business_segments"]


# ===== Export Handler =====

class TestExportHandler:
    @patch("eugene.router.query")
    def test_export_csv_basic(self, mock_query):
        from eugene.handlers.export import export_financials_csv
        mock_query.return_value = {
            "data": {
                "periods": [
                    {
                        "period_end": "2024-09-28", "period_type": "FY",
                        "fiscal_year": 2024, "filing": "10-K",
                        "metrics": {
                            "revenue": {"value": 391035000000},
                            "net_income": {"value": 93736000000},
                        }
                    },
                    {
                        "period_end": "2023-09-30", "period_type": "FY",
                        "fiscal_year": 2023, "filing": "10-K",
                        "metrics": {
                            "revenue": {"value": 383285000000},
                            "net_income": {"value": 96995000000},
                        }
                    },
                ]
            }
        }

        csv_str = export_financials_csv("AAPL")

        assert "period_end" in csv_str
        assert "revenue" in csv_str
        assert "net_income" in csv_str
        assert "391035000000" in csv_str
        lines = csv_str.strip().split("\n")
        assert len(lines) == 3  # header + 2 rows

    @patch("eugene.router.query")
    def test_export_csv_empty(self, mock_query):
        from eugene.handlers.export import export_financials_csv
        mock_query.return_value = {"data": {"periods": []}}

        csv_str = export_financials_csv("AAPL")

        assert csv_str == ""

    @patch("eugene.router.query")
    def test_export_csv_none_values_excluded(self, mock_query):
        from eugene.handlers.export import export_financials_csv
        mock_query.return_value = {
            "data": {
                "periods": [
                    {
                        "period_end": "2024-09-28", "period_type": "FY",
                        "fiscal_year": 2024, "filing": "10-K",
                        "metrics": {
                            "revenue": {"value": 100},
                            "empty_metric": None,
                        }
                    },
                ]
            }
        }

        csv_str = export_financials_csv("AAPL")

        assert "revenue" in csv_str
        assert "empty_metric" not in csv_str
