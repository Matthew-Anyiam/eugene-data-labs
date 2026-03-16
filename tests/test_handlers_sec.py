"""Tests for SEC-backed handlers: profile, filings, concepts, ownership, events, sections, exhibits."""
from unittest.mock import patch


# --- Shared fixtures ---

SAMPLE_SUBMISSIONS = {
    "cik": "0000320193",
    "name": "Apple Inc",
    "sic": "3571",
    "sicDescription": "Electronic Computers",
    "ein": "942404110",
    "fiscalYearEnd": "0928",
    "stateOfIncorporation": "CA",
    "website": "https://www.apple.com",
    "addresses": {
        "business": {
            "street1": "One Apple Park Way",
            "city": "Cupertino",
            "stateOrCountry": "CA",
            "zipCode": "95014",
            "phone": "408-996-1010",
        }
    },
    "formerNames": [
        {"name": "Apple Computer Inc", "to": "2007-01-09"},
    ],
    "filings": {
        "recent": {
            "form": ["10-K", "10-Q", "8-K", "4", "8-K", "13F-HR", "10-Q"],
            "filingDate": ["2024-11-01", "2024-08-02", "2024-07-15", "2024-06-01", "2024-05-20", "2024-05-01", "2024-05-01"],
            "accessionNumber": [
                "0000320193-24-000123",
                "0000320193-24-000100",
                "0000320193-24-000090",
                "0000320193-24-000080",
                "0000320193-24-000070",
                "0000320193-24-000060",
                "0000320193-24-000050",
            ],
            "primaryDocument": [
                "aapl-20240928.htm",
                "aapl-20240629.htm",
                "aapl-8k.htm",
                "form4.xml",
                "aapl-8k2.htm",
                "infotable.xml",
                "aapl-20240330.htm",
            ],
            "primaryDocDescription": [
                "10-K Annual Report",
                "10-Q Quarterly Report",
                "8-K Current Report",
                "Form 4",
                "8-K Current Report",
                "13F-HR",
                "10-Q Quarterly Report",
            ],
        }
    },
}


# ===== Profile Handler =====

class TestProfileHandler:
    @patch("eugene.handlers.profile.fetch_submissions")
    def test_profile_returns_company_info(self, mock_fetch):
        from eugene.handlers.profile import profile_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = profile_handler(resolved, {})

        assert result["name"] == "Apple Inc"
        assert result["cik"] == "0000320193"
        assert result["ticker"] == "AAPL"
        assert result["sic"] == "3571"
        assert result["sic_description"] == "Electronic Computers"
        assert result["ein"] == "942404110"
        assert result["fiscal_year_end"] == "0928"
        assert result["state_of_incorporation"] == "CA"

    @patch("eugene.handlers.profile.fetch_submissions")
    def test_profile_address(self, mock_fetch):
        from eugene.handlers.profile import profile_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = profile_handler(resolved, {})

        assert result["address"]["city"] == "Cupertino"
        assert result["address"]["state"] == "CA"
        assert result["phone"] == "408-996-1010"

    @patch("eugene.handlers.profile.fetch_submissions")
    def test_profile_former_names(self, mock_fetch):
        from eugene.handlers.profile import profile_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = profile_handler(resolved, {})

        assert len(result["former_names"]) == 1
        assert result["former_names"][0]["name"] == "Apple Computer Inc"

    @patch("eugene.handlers.profile.fetch_submissions")
    def test_profile_filings_count(self, mock_fetch):
        from eugene.handlers.profile import profile_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193", "ticker": "AAPL"}

        result = profile_handler(resolved, {})

        assert result["filings_count"] == 7


# ===== Filings Handler =====

class TestFilingsHandler:
    @patch("eugene.handlers.filings.fetch_submissions")
    def test_filings_default_limit(self, mock_fetch):
        from eugene.handlers.filings import filings_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = filings_handler(resolved, {})

        assert "filings" in result
        assert result["total_available"] == 7

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_filings_form_filter(self, mock_fetch):
        from eugene.handlers.filings import filings_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = filings_handler(resolved, {"form": "10-K"})

        assert all(f["form"] == "10-K" for f in result["filings"])
        assert len(result["filings"]) == 1

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_filings_multi_form_filter(self, mock_fetch):
        from eugene.handlers.filings import filings_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = filings_handler(resolved, {"form": "8-K,10-Q"})

        forms = {f["form"] for f in result["filings"]}
        assert forms <= {"8-K", "10-Q"}

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_filings_limit(self, mock_fetch):
        from eugene.handlers.filings import filings_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = filings_handler(resolved, {"limit": 3})

        assert len(result["filings"]) == 3

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_filings_date_filter(self, mock_fetch):
        from eugene.handlers.filings import filings_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = filings_handler(resolved, {"from": "2024-06-01", "to": "2024-08-31"})

        for f in result["filings"]:
            assert f["filed_date"] >= "2024-06-01"
            assert f["filed_date"] <= "2024-08-31"

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_filings_url_format(self, mock_fetch):
        from eugene.handlers.filings import filings_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = filings_handler(resolved, {"form": "10-K"})

        filing = result["filings"][0]
        assert "sec.gov/Archives/edgar/data" in filing["url"]
        assert filing["accession"] == "0000320193-24-000123"


# ===== Concepts Handler =====

class TestConceptsHandler:
    @patch("eugene.handlers.concepts_raw.fetch_companyfacts")
    def test_concepts_single_tag(self, mock_fetch):
        from eugene.handlers.concepts_raw import concepts_handler
        mock_fetch.return_value = {
            "facts": {
                "us-gaap": {
                    "Revenues": {
                        "label": "Revenues",
                        "units": {
                            "USD": [
                                {"end": "2024-09-28", "val": 391035000000, "form": "10-K", "fy": 2024, "fp": "FY"},
                                {"end": "2023-09-30", "val": 383285000000, "form": "10-K", "fy": 2023, "fp": "FY"},
                            ]
                        }
                    }
                },
                "dei": {},
            }
        }
        resolved = {"cik": "0000320193"}

        result = concepts_handler(resolved, {"concept": "Revenues"})

        assert "concepts" in result
        assert "Revenues" in result["concepts"]
        assert result["concepts"]["Revenues"]["total"] == 2
        assert result["concepts"]["Revenues"]["values"][0]["value"] == 391035000000

    @patch("eugene.handlers.concepts_raw.fetch_companyfacts")
    def test_concepts_missing_tag(self, mock_fetch):
        from eugene.handlers.concepts_raw import concepts_handler
        mock_fetch.return_value = {"facts": {"us-gaap": {}, "dei": {}}}
        resolved = {"cik": "0000320193"}

        result = concepts_handler(resolved, {"concept": "Nonexistent"})

        assert "error" in result["concepts"]["Nonexistent"]

    def test_concepts_missing_param_raises_validation_error(self):
        from eugene.handlers.concepts_raw import concepts_handler
        from eugene.errors import ValidationError

        try:
            concepts_handler({"cik": "0000320193"}, {})
            assert False, "Should raise ValidationError"
        except ValidationError as e:
            assert "concept parameter required" in e.message

    @patch("eugene.handlers.concepts_raw.fetch_companyfacts")
    def test_concepts_form_filter(self, mock_fetch):
        from eugene.handlers.concepts_raw import concepts_handler
        mock_fetch.return_value = {
            "facts": {
                "us-gaap": {
                    "Assets": {
                        "label": "Assets",
                        "units": {
                            "USD": [
                                {"end": "2024-09-28", "val": 100, "form": "10-K"},
                                {"end": "2024-06-29", "val": 90, "form": "10-Q"},
                            ]
                        }
                    }
                },
                "dei": {},
            }
        }
        resolved = {"cik": "0000320193"}

        result = concepts_handler(resolved, {"concept": "Assets", "form": "10-K"})

        values = result["concepts"]["Assets"]["values"]
        assert all(v["form"] == "10-K" for v in values)


# ===== Events Handler =====

class TestEventsHandler:
    @patch("eugene.handlers.filings.fetch_submissions")
    def test_events_filters_8k(self, mock_fetch):
        from eugene.handlers.events import events_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = events_handler(resolved, {})

        assert "events" in result
        assert result["count"] >= 0
        for event in result["events"]:
            assert event["form"] in ("8-K", "8-K/A")

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_events_with_limit(self, mock_fetch):
        from eugene.handlers.events import events_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = events_handler(resolved, {"limit": 1})

        assert result["count"] <= 1


# ===== Exhibits Handler =====

class TestExhibitsHandler:
    @patch("eugene.handlers.exhibits.fetch_submissions")
    def test_exhibits_default_10k(self, mock_fetch):
        from eugene.handlers.exhibits import exhibits_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = exhibits_handler(resolved, {})

        assert "filings" in result
        for f in result["filings"]:
            assert f["form"] == "10-K"
            assert "index_url" in f

    @patch("eugene.handlers.exhibits.fetch_submissions")
    def test_exhibits_form_filter(self, mock_fetch):
        from eugene.handlers.exhibits import exhibits_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = exhibits_handler(resolved, {"form": "10-Q"})

        for f in result["filings"]:
            assert f["form"] == "10-Q"

    @patch("eugene.handlers.exhibits.fetch_submissions")
    def test_exhibits_limit(self, mock_fetch):
        from eugene.handlers.exhibits import exhibits_handler
        mock_fetch.return_value = SAMPLE_SUBMISSIONS
        resolved = {"cik": "0000320193"}

        result = exhibits_handler(resolved, {"form": "10-Q", "limit": 1})

        assert len(result["filings"]) == 1


# ===== Sections Handler =====

class TestSectionsHandler:
    @patch("eugene.handlers.sections.fetch_filing_html")
    @patch("eugene.handlers.sections.fetch_submissions")
    def test_sections_mdna(self, mock_subs, mock_html):
        from eugene.handlers.sections import sections_handler
        mock_subs.return_value = SAMPLE_SUBMISSIONS
        mock_html.return_value = """
        <html><body>
        <h2>Item 7. Management's Discussion and Analysis</h2>
        <p>We had a great year with record revenue growth across all segments.</p>
        <h2>Item 8. Financial Statements</h2>
        </body></html>
        """
        resolved = {"cik": "0000320193"}

        result = sections_handler(resolved, {"section": "mdna"})

        assert "sections" in result
        assert "mdna" in result["sections"]
        assert result["sections"]["mdna"]["text"] is not None
        assert "Management" in result["sections"]["mdna"]["text"]

    @patch("eugene.handlers.sections.fetch_filing_html")
    @patch("eugene.handlers.sections.fetch_submissions")
    def test_sections_not_found(self, mock_subs, mock_html):
        from eugene.handlers.sections import sections_handler
        mock_subs.return_value = SAMPLE_SUBMISSIONS
        mock_html.return_value = "<html><body>No relevant sections here</body></html>"
        resolved = {"cik": "0000320193"}

        result = sections_handler(resolved, {"section": "risk_factors"})

        assert result["sections"]["risk_factors"]["text"] is None

    @patch("eugene.handlers.sections.fetch_submissions")
    def test_sections_no_filing(self, mock_subs):
        from eugene.handlers.sections import sections_handler
        empty_subs = {
            "filings": {"recent": {"form": [], "filingDate": [], "accessionNumber": [], "primaryDocument": []}}
        }
        mock_subs.return_value = empty_subs
        resolved = {"cik": "0000320193"}

        result = sections_handler(resolved, {"section": "mdna"})

        assert "error" in result


# ===== Ownership Handler =====

class TestOwnershipHandler:
    @patch("eugene.handlers.ownership.fetch_filing_xml")
    @patch("eugene.handlers.ownership.fetch_filing_index")
    @patch("eugene.handlers.filings.fetch_submissions")
    def test_ownership_parses_13f(self, mock_subs, mock_index, mock_xml):
        from eugene.handlers.ownership import ownership_handler
        mock_subs.return_value = SAMPLE_SUBMISSIONS
        mock_index.return_value = {
            "directory": {
                "item": [
                    {"name": "primary_doc.xml"},
                    {"name": "infotable.xml"},
                ]
            }
        }
        mock_xml.return_value = """<?xml version="1.0"?>
        <informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
            <infoTable>
                <nameOfIssuer>APPLE INC</nameOfIssuer>
                <titleOfClass>COM</titleOfClass>
                <cusip>037833100</cusip>
                <value>5000000</value>
                <shrsOrPrnAmt>
                    <sshPrnamt>25000</sshPrnamt>
                    <sshPrnamtType>SH</sshPrnamtType>
                </shrsOrPrnAmt>
                <investmentDiscretion>SOLE</investmentDiscretion>
                <votingAuthority>
                    <Sole>25000</Sole>
                    <Shared>0</Shared>
                    <None>0</None>
                </votingAuthority>
            </infoTable>
        </informationTable>
        """
        resolved = {"cik": "0000320193"}

        result = ownership_handler(resolved, {"limit": 1})

        assert "ownership_filings" in result
        assert result["count"] >= 0
        if result["count"] > 0:
            filing = result["ownership_filings"][0]
            assert filing["position_count"] >= 0

    @patch("eugene.handlers.filings.fetch_submissions")
    def test_ownership_no_13f_filings(self, mock_subs):
        from eugene.handlers.ownership import ownership_handler
        subs_no_13f = {
            "filings": {
                "recent": {
                    "form": ["10-K", "10-Q"],
                    "filingDate": ["2024-11-01", "2024-08-02"],
                    "accessionNumber": ["0000320193-24-000123", "0000320193-24-000100"],
                    "primaryDocument": ["doc1.htm", "doc2.htm"],
                    "primaryDocDescription": ["10-K", "10-Q"],
                }
            }
        }
        mock_subs.return_value = subs_no_13f
        resolved = {"cik": "0000320193"}

        result = ownership_handler(resolved, {})

        assert result["count"] == 0
