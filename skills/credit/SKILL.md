# Credit Analysis Skill

## Metadata
name: credit-analysis
description: Comprehensive credit analysis workflow for evaluating company debt profiles
version: 1.0.0
author: Eugene Intelligence

## When to Use

Use this skill when the user asks about:
- Credit risk assessment
- Debt structure analysis
- Covenant compliance
- Refinancing risk
- Leverage analysis
- Interest coverage
- Debt maturity profiles
- Credit ratings implications

## Instructions

### Step 1: Gather Company Context

Before diving into credit analysis, understand the company:

1. **Identify the company** - Confirm ticker and full name
2. **Understand the business** - Industry, business model, cyclicality
3. **Check recent events** - Any material changes (M&A, restructuring, asset sales)

### Step 2: Pull Credit Data

Use Eugene API to retrieve:

```
GET /v1/credit/{ticker}
```

This returns:
- Total debt and net debt
- EBITDA and interest expense
- All debt instruments
- Covenant terms and compliance
- Maturity schedule

### Step 3: Analyze Debt Structure

For each debt instrument, evaluate:

| Factor | What to Check |
|--------|---------------|
| Seniority | Senior secured vs. unsecured vs. subordinated |
| Security | Collateral type and coverage |
| Covenants | Financial maintenance vs. incurrence |
| Maturity | Near-term maturities (<3 years) |
| Rate Type | Fixed vs. floating exposure |
| Call Features | Prepayment flexibility |

### Step 4: Assess Key Credit Metrics

Calculate and contextualize:

#### Leverage Ratios
- **Total Debt / EBITDA**: Primary leverage metric
  - Investment grade: typically <3.0x
  - BB range: 3.0-5.0x
  - B range: 5.0-7.0x
  - CCC and below: >7.0x

- **Net Debt / EBITDA**: Adjusts for cash
  - Negative = net cash position (rare, very strong)

#### Coverage Ratios
- **EBITDA / Interest**: Interest coverage
  - Above 5.0x: Strong
  - 3.0-5.0x: Adequate
  - 2.0-3.0x: Weak
  - Below 2.0x: Distressed

- **Fixed Charge Coverage**: (EBITDA - CapEx) / Fixed Charges
  - Captures maintenance CapEx requirements

### Step 5: Evaluate Covenant Cushion

For each financial covenant:

1. Calculate current cushion as percentage
2. Flag if cushion below 20%
3. Model sensitivity: What EBITDA decline triggers breach?

### Step 6: Analyze Maturity Profile

Create maturity wall analysis:

1. Calculate debt due in next 12, 24, 36 months
2. Compare to cash plus revolver availability
3. Assess refinancing risk:
   - Can the company access capital markets?
   - What would refinancing rates look like?
   - Are there extension options?

### Step 7: Industry Context

Compare to industry peers:
- Leverage relative to sector median
- Coverage relative to sector median
- Any industry-specific considerations (regulated, capital-intensive, etc.)

### Step 8: Synthesize and Conclude

Provide a clear credit assessment:

1. **Credit Quality**: Investment grade / High yield / Distressed
2. **Key Strengths**: What supports the credit?
3. **Key Risks**: What could deteriorate the credit?
4. **Near-term Outlook**: Improving / Stable / Deteriorating
5. **Catalysts to Watch**: What would change the view?

## Output Format

Structure your analysis as:

```markdown
# Credit Analysis: [Company Name] ([Ticker])

## Executive Summary
[2-3 sentence credit view]

## Key Credit Metrics
| Metric | Value | Industry Median | Assessment |
|--------|-------|-----------------|------------|
| Leverage | X.Xx | X.Xx | [Strong/Adequate/Weak] |
| Interest Coverage | X.Xx | X.Xx | [Strong/Adequate/Weak] |
| Net Debt | $X,XXXM | — | — |

## Debt Structure
[Table of instruments]

## Covenant Analysis
[Status and cushion for each covenant]

## Maturity Profile
[Schedule and refinancing assessment]

## Credit View
**Rating Equivalent**: [IG/BB/B/CCC]
**Outlook**: [Positive/Stable/Negative]

### Strengths
- [Bullet points]

### Risks
- [Bullet points]

### Catalysts
- [What to watch]
```

## Industry-Specific Guidelines

### Technology / SaaS
- Often lower leverage tolerance due to intangible assets
- Recurring revenue provides stability
- Watch for customer concentration

### Healthcare / Pharma
- Drug pipeline creates binary risk
- Patent cliffs matter for maturities
- Regulatory risk can be material

### Retail / Consumer
- Highly cyclical, use normalized EBITDA
- Lease obligations are debt-like
- Seasonal working capital swings

### Energy / Utilities
- Asset-heavy, leverage can be higher
- Regulated utilities have rate recovery
- Commodity exposure creates volatility

### Financial Services
- Traditional leverage metrics don't apply
- Focus on capital ratios (CET1, Tier 1)
- Asset quality is key credit driver

## Common Pitfalls

1. **Ignoring off-balance sheet obligations** - Operating leases, guarantees, pension
2. **Using wrong EBITDA** - Reported vs. adjusted vs. covenant EBITDA differ
3. **Missing seasonal effects** - Quarter-end leverage may not represent average
4. **Forgetting about floating rate exposure** - Rising rates can stress coverage
5. **Overlooking springing covenants** - May activate under certain conditions

## Related Skills

- `/skills/dcf/SKILL.md` - For valuation analysis
- `/skills/earnings/SKILL.md` - For earnings analysis
- `/skills/maturity/SKILL.md` - Deep dive on refinancing risk
