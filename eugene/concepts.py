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
            "Revenues","Revenue",
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

    # === Additional Balance Sheet (for ratios) ===
    "current_assets": {
        "tags": ["AssetsCurrent"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Total current assets",
    },
    "current_liabilities": {
        "tags": ["LiabilitiesCurrent"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Total current liabilities",
    },
    "inventory": {
        "tags": ["InventoryNet", "InventoryFinishedGoodsNetOfReserves"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Inventory",
    },
    "accounts_receivable": {
        "tags": [
            "AccountsReceivableNetCurrent",
            "AccountsReceivableNet",
            "ReceivablesNetCurrent",
        ],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Accounts receivable",
    },
    "accounts_payable": {
        "tags": ["AccountsPayableCurrent", "AccountsPayable"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Accounts payable",
    },
    "short_term_debt": {
        "tags": ["ShortTermBorrowings", "CommercialPaper", "LongTermDebtCurrent"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Short-term debt and current portion of long-term debt",
    },
    "long_term_debt": {
        "tags": ["LongTermDebtNoncurrent", "LongTermDebt"],
        "statement": "balance_sheet",
        "unit": "USD",
        "description": "Long-term debt (non-current)",
    },

    # === Additional Income Statement (for ratios) ===
    "cost_of_revenue": {
        "tags": ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
        "statement": "income",
        "unit": "USD",
        "description": "Cost of revenue / COGS",
    },
    "interest_expense": {
        "tags": ["InterestExpense", "InterestExpenseDebt", "InterestIncomeExpenseNet"],
        "statement": "income",
        "unit": "USD",
        "description": "Interest expense",
    },

    # === Additional Cash Flow (for ratios) ===
    "depreciation_amortization": {
        "tags": [
            "DepreciationDepletionAndAmortization",
            "DepreciationAndAmortization",
            "Depreciation",
        ],
        "statement": "cash_flow",
        "unit": "USD",
        "description": "Depreciation and amortization",
    },
    "dividends_paid": {
        "tags": ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends", "Dividends"],
        "statement": "cash_flow",
        "unit": "USD",
        "description": "Dividends paid",
    },

    # === Derived (computed, not fetched) ===
    "free_cf": {
        "derived": True,
        "formula": "operating_cf - capex",
        "statement": "cash_flow",
        "unit": "USD",
        "description": "Free cash flow (OCF minus capex)",
    },
    "ebitda": {
        "derived": True,
        "formula": "operating_income + depreciation_amortization",
        "statement": "income",
        "unit": "USD",
        "description": "Earnings before interest, taxes, depreciation, and amortization",
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
