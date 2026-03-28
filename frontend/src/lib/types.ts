export interface Provenance {
  source: string;
  url?: string;
}

export interface EugeneResponse<T> {
  status: 'success' | 'partial' | 'error';
  identifier: string;
  resolved: {
    ticker?: string;
    cik?: string;
    company?: string;
  };
  data: T;
  provenance: Provenance[];
  metadata: {
    service: string;
    version: string;
  };
  error?: string;
}

// Profile
export interface ProfileData {
  name: string;
  cik: string;
  sic: string;
  sic_description: string;
  ticker: string;
  exchanges: string[];
  state: string;
  fiscal_year_end: string;
  website?: string;
  phone?: string;
  address?: {
    street1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

// Financials
export interface MetricValue {
  value: number;
  unit: string;
  source_tag: string;
  derived?: boolean;
  formula?: string;
}

export interface FinancialPeriod {
  period_end: string;
  period_type: string;
  fiscal_year: number | null;
  filing: string;
  accession: string;
  filed_date: string;
  income_statement: Record<string, MetricValue>;
  balance_sheet: Record<string, MetricValue>;
  cash_flow_statement: Record<string, MetricValue>;
}

export interface FinancialsData {
  periods: FinancialPeriod[];
  concepts_found: string[];
  period_type: string;
}

// Metrics
export interface MetricsData {
  periods: {
    period_end: string;
    metrics: {
      profitability?: Record<string, number>;
      liquidity?: Record<string, number>;
      leverage?: Record<string, number>;
      efficiency?: Record<string, number>;
      valuation?: Record<string, number>;
      growth?: Record<string, number>;
      per_share?: Record<string, number>;
    };
  }[];
}

// Prices
export interface PriceData {
  ticker: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap: number;
  day_high: number;
  day_low: number;
  year_high: number;
  year_low: number;
  avg_50: number;
  avg_200: number;
}

// OHLCV
export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVData {
  ticker: string;
  interval: string;
  count: number;
  bars: OHLCVBar[];
}

// Screener — matches backend get_screener() response shape
export interface ScreenerResult {
  ticker: string;
  name: string;
  market_cap: number;
  price: number;
  sector: string;
  industry: string;
  country: string;
  beta: number;
  volume: number;
  exchange: string;
}

// Economics / FRED
export interface FredSeries {
  id: string;
  title: string;
  value: number | string;
  date: string;
  units: string;
  frequency: string;
  history?: { date: string; value: number }[];
}

export interface FredCategory {
  category: string;
  series: FredSeries[];
}

// Filings — matches backend filings_handler response
export interface Filing {
  form: string;
  filed_date: string;
  accession: string;
  description: string;
  url: string;
}

export interface FilingsData {
  filings: Filing[];
  total_available: number;
}

// Insiders — matches backend insiders_handler response
export interface InsiderTx {
  date: string;
  security: string;
  transaction_code: string;
  transaction_type: string;
  shares: number | null;
  price_per_share: number | null;
  direction: string;
  shares_owned_after: number | null;
  derivative: boolean;
}

export interface InsiderFiling {
  form: string;
  filed_date: string;
  accession: string;
  description: string;
  url: string;
  owner: {
    name: string;
    cik?: string;
    is_director: boolean;
    is_officer: boolean;
    title: string;
  };
  issuer?: {
    name: string;
    ticker: string;
  };
  transactions: InsiderTx[];
}

export interface InsidersData {
  insider_filings: InsiderFiling[];
  count: number;
  summary: {
    total_purchases: number;
    total_sales: number;
    net_direction: string;
  };
  sentiment: {
    score: number;
    signal: string;
    buy_value: number;
    sell_value: number;
    net_value: number;
  };
}

// Sections — matches backend sections_handler response
export interface SectionData {
  text: string | null;
  char_count?: number;
  truncated?: boolean;
  reason?: string;
}

export interface SectionsData {
  filing: {
    form: string;
    filed_date: string;
    accession: string;
  };
  sections: Record<string, SectionData>;
}
