"""Tests for CLI output formatter."""
from eugene.formatter import format_output, _fmt_num, _unwrap


class TestFmtNum:
    def test_none(self):
        assert _fmt_num(None) == "—"

    def test_string(self):
        assert _fmt_num("hello") == "hello"

    def test_billions(self):
        assert _fmt_num(391_000_000_000) == "391.0B"
        assert _fmt_num(1_500_000_000.0) == "1.5B"

    def test_millions(self):
        assert _fmt_num(93_700_000) == "93.7M"
        assert _fmt_num(5_000_000.0) == "5.0M"

    def test_thousands(self):
        assert _fmt_num(50_000.0) == "50,000"
        assert _fmt_num(1234) == "1,234"

    def test_small_float(self):
        assert _fmt_num(0.005) == "0.0050"
        assert _fmt_num(23.45) == "23.45"

    def test_zero(self):
        assert _fmt_num(0) == "0"
        assert _fmt_num(0.0) == "0.00"

    def test_negative_billions(self):
        assert _fmt_num(-2_000_000_000) == "-2.0B"


class TestUnwrap:
    def test_envelope(self):
        data = {"status": "success", "resolved": {"ticker": "AAPL"}, "data": {"revenue": 100}}
        resolved, inner, status = _unwrap(data)
        assert resolved["ticker"] == "AAPL"
        assert inner["revenue"] == 100
        assert status == "success"

    def test_raw_data(self):
        data = {"revenue": 100}
        resolved, inner, status = _unwrap(data)
        assert resolved == {}
        assert inner["revenue"] == 100
        assert status == "success"


class TestFormatOutput:
    def test_json_format(self):
        data = {"status": "success", "data": {"revenue": 100}}
        result = format_output(data, fmt="json")
        assert '"revenue": 100' in result

    def test_table_format_profile(self):
        data = {
            "status": "success",
            "resolved": {"ticker": "AAPL", "name": "Apple Inc"},
            "data": {"ticker": "AAPL", "name": "Apple Inc", "cik": "320193"},
        }
        result = format_output(data, fmt="table", extract="profile")
        assert "AAPL" in result
        assert "320193" in result

    def test_table_format_error(self):
        data = {"status": "error", "data": {"error": "Not found"}}
        result = format_output(data, fmt="table", extract="profile")
        assert "Not found" in result

    def test_table_format_financials(self):
        data = {
            "status": "success",
            "resolved": {"ticker": "AAPL"},
            "data": {
                "periods": [{
                    "fiscal_year": 2024, "period_type": "FY",
                    "metrics": {"revenue": {"value": 391_000_000_000}},
                }],
            },
        }
        result = format_output(data, fmt="table", extract="financials")
        assert "revenue" in result
        assert "391.0B" in result

    def test_table_format_generic_dict(self):
        data = {"status": "success", "data": {"key1": "val1", "key2": 42}}
        result = format_output(data, fmt="table")
        assert "key1" in result

    def test_table_format_generic_list(self):
        data = {
            "status": "success",
            "resolved": {},
            "data": [{"name": "Apple", "price": 150}, {"name": "Google", "price": 140}],
        }
        result = format_output(data, fmt="table")
        assert "Apple" in result

    def test_csv_format(self):
        data = {
            "status": "success",
            "resolved": {},
            "data": {
                "filings": [
                    {"date": "2024-01-01", "form": "10-K"},
                    {"date": "2023-01-01", "form": "10-Q"},
                ],
            },
        }
        result = format_output(data, fmt="csv")
        assert "date" in result
        assert "10-K" in result
        lines = result.strip().split("\n")
        assert len(lines) == 3  # header + 2 rows


class TestCLIOutputOption:
    def test_sec_help_has_output(self):
        """Verify the -o/--output option exists on sec command."""
        from eugene.cli import sec
        params = {p.name for p in sec.params}
        assert "fmt" in params
