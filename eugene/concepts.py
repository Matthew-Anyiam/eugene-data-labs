"""
Canonical financial concept mapping.

Maps multiple XBRL tags → ONE stable concept name.
This is the core normalization layer.
"""

CANONICAL_CONCEPTS = {
    # === Income Statement ===
    "revenue": {
        "tags": [
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "RevenueFromContractWithCustomerIncludingAssessedTax",
            "Revenues",
            "SalesRevenueNet",
            "SalesRevenueGoodsNet",
            "SalesRevenueServicesNet",
            "RegulatedAndUnregulatedOperatingRevenue",
            "InterestAndDividendIncomeOperating",
            "FinancialServicesRevenue",
            "RealEstateRevenueNet",
            "ElectricUtilityRevenue",
            "OilAndGasRevenue",
            "HealthCareOrganizationRevenue",
            "RevenueMineralSales",
        ],
        "statement": "income",
        "unit": "USD",
        "description": "Total revenue / net sales",
    },
    "net_income": {
        "tags": [
            "NetIncomeLoss",
            "NetIncomeLossAvailableToCommonStockholdersBasic",
            "ProfitLoss",
        ],
        "statement": "income",
        "unit": "USD",
        "description": "Net income attributable to company",
    },
    "operating_income": {
        "tags": [
            "OperatingIncomeLoss",
        ],
        "statement": "income",
        "unit": "USD",
        "description": "Operating income / loss",
    },
    "gross_profit": {
        "tags": [
            "GrossProfit",
        ],
        "statement": "income",
        "unit": "USD",
        "description": "Gross profit",
    },
    "eps_basic": {
        "tags": ["EarningsPerShareBasic"],
        "statement": "income",
        "unit": "USD/shares",
        "description": "Basic earnings per share",
    },
    "eps_diluted": {
        "tags": ["EarningsPerShareDiluted"],
        "statement": "income",
        "unit": "USD/shares",
        "description": "Diluted earnings per share",
    },

    # === Cash Flow ===
    "operating_cf": {
        "tags": [
            "NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
        ],
        "statement": "cash_flow",
        "unit": "USD",
        "description": "Cash from operations",
    },
    "capex": {
        "tags": [
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "PaymentsToAcquireProductiveAssets",
            "PaymentsForCapitalImprovements",
        ],
        "statement": "cash_flow",
        "unit": "USD",
        "description": "Capital expenditures",
    },

    # === Balance Sheet ===
    "total_assets": {
        "tags": ["Assets"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Total assets",
    },
    "total_liabilities": {
        "tags": [
            "Liabilities",
        ],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Total liabilities",
    },
    "stockholders_equity": {
        "tags": [
            "StockholdersEquity",
            "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        ],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Total stockholders equity",
    },
    "cash": {
        "tags": [
            "CashAndCashEquivalentsAtCarryingValue",
            "CashCashEquivalentsAndShortTermInvestments",
            "Cash",
            "CashAndDueFromBanks",
        ],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Cash and cash equivalents",
    },
    "total_debt": {
        "tags": [
            "LongTermDebt",
            "LongTermDebtAndCapitalLeaseObligations",
            "DebtInstrumentCarryingAmount",
            "LongTermDebtNoncurrent",
        ],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Total long-term debt",
    },
    "shares_outstanding": {
        "tags": [
            "CommonStockSharesOutstanding",
            "EntityCommonStockSharesOutstanding",
        ],
        "statement": "balance_sheet",
        "unit": "shares",
        "description": "Common shares outstanding",
    },

    # === Derived (computed, not fetched) ===
    "free_cf": {
        "derived": True,
        "formula": "operating_cf - capex",
        "statement": "cash_flow",
        "unit": "USD",
        "description": "Free cash flow (OCF minus capex)",
    },
}

# Reverse lookup: XBRL tag → canonical concept name
TAG_TO_CONCEPT = {}
for _name, _config in CANONICAL_CONCEPTS.items():
    if _config.get("derived"):
        continue
    for _tag in _config["tags"]:
        TAG_TO_CONCEPT[_tag] = _name

VALID_CONCEPTS = list(CANONICAL_CONCEPTS.keys())
