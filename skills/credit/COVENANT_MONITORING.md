# Covenant Monitoring Skill

## Metadata
name: covenant-monitoring
description: Monitor financial covenants and alert on potential breaches
version: 1.0.0
author: Eugene Intelligence

## When to Use

Use this skill when the user asks about:
- Covenant compliance status
- Covenant cushion analysis
- Breach risk assessment
- Covenant waiver scenarios
- Amendment probability

## Instructions

### Step 1: Identify All Covenants

Common financial covenant types:

| Covenant Type | Typical Structure | Trigger |
|--------------|-------------------|---------|
| **Leverage** | Debt/EBITDA ≤ X.Xx | Maximum |
| **Net Leverage** | Net Debt/EBITDA ≤ X.Xx | Maximum |
| **Interest Coverage** | EBITDA/Interest ≥ X.Xx | Minimum |
| **Fixed Charge Coverage** | (EBITDA-CapEx)/FC ≥ X.Xx | Minimum |
| **Liquidity** | Cash + Availability ≥ $X | Minimum |
| **CapEx Limit** | CapEx ≤ $X | Maximum |
| **Asset Coverage** | Assets/Debt ≥ X.Xx | Minimum |

### Step 2: Calculate Current Position

For each covenant:

1. **Get the definition** - How exactly is the ratio calculated?
   - What's included in "Debt"? (gross vs. net, include leases?)
   - What adjustments to EBITDA? (add-backs, pro forma?)
   - What measurement period? (quarterly, LTM?)

2. **Calculate current ratio**
   ```
   Current Value = [Numerator per definition] / [Denominator per definition]
   ```

3. **Compare to threshold**
   ```
   For MAX covenant: Cushion = (Threshold - Current) / Threshold
   For MIN covenant: Cushion = (Current - Threshold) / Threshold
   ```

### Step 3: Assess Cushion Quality

| Cushion Level | Assessment | Action |
|---------------|------------|--------|
| > 30% | Comfortable | Monitor quarterly |
| 20-30% | Adequate | Watch for deterioration |
| 10-20% | Tight | Model downside scenarios |
| 0-10% | Critical | Breach risk high |
| < 0% | Breached | Waiver required |

### Step 4: Stress Test

Model scenarios that would trigger breach:

**EBITDA Sensitivity**
```
Breach EBITDA = Debt / Leverage Threshold
Current EBITDA = $X
Buffer = (Current EBITDA - Breach EBITDA) / Current EBITDA
```

Example: If threshold is 4.5x and debt is $4.5B
- Breach EBITDA = $4.5B / 4.5 = $1.0B
- If current EBITDA is $1.3B, buffer = 23%
- EBITDA can decline 23% before breach

**Debt Sensitivity**
```
Breach Debt = EBITDA × Leverage Threshold
Current Debt = $X
Buffer = (Breach Debt - Current Debt) / Current Debt
```

### Step 5: Timeline Analysis

Consider timing factors:

1. **Test Dates** - When are covenants measured?
   - Quarterly vs. annual
   - Springing conditions

2. **Cure Rights** - Can equity cure a breach?
   - How much can be cured?
   - How many times?

3. **Grace Periods** - Time to remedy breach
   - Typically 30 days for financial covenants

### Step 6: Consequences of Breach

Map out the cascade:

```
Covenant Breach
    ↓
Event of Default (after cure period)
    ↓
Cross-Default to Other Debt
    ↓
Acceleration Rights
    ↓
Potential forced restructuring
```

### Step 7: Amendment/Waiver Assessment

If breach is likely, evaluate options:

1. **Likelihood of Waiver**
   - Relationship with lenders
   - Severity of breach
   - Path back to compliance

2. **Cost of Amendment**
   - Fee (typically 25-75 bps)
   - Pricing increase
   - Additional restrictions

3. **Alternatives**
   - Asset sales to reduce debt
   - Equity injection
   - Refinancing

## Alert Thresholds

Configure monitoring alerts at these levels:

| Alert Level | Cushion | Action |
|-------------|---------|--------|
| 🟢 Green | > 25% | Routine monitoring |
| 🟡 Yellow | 15-25% | Increased scrutiny |
| 🟠 Orange | 5-15% | Active monitoring, model scenarios |
| 🔴 Red | < 5% | Alert, prepare contingency |

## Output Format

```markdown
# Covenant Monitor: [Company] ([Ticker])

## Compliance Summary

| Status | Covenant | Threshold | Current | Cushion |
|--------|----------|-----------|---------|---------|
| 🟢 | Max Leverage | 4.50x | 3.20x | 29% |
| 🟡 | Min Coverage | 3.00x | 3.45x | 15% |

## Stress Analysis

**Leverage Covenant**
- Current: 3.20x (threshold: 4.50x)
- EBITDA can decline 29% before breach
- Debt can increase by 41% before breach

## Key Dates
- Next test date: [Date]
- Fiscal quarter end: [Date]

## Risk Assessment
[Overall assessment of covenant risk]
```

## Common Covenant Definitions

### Consolidated Total Debt
Typically includes:
- Term loans
- Revolving credit drawings
- Bonds and notes
- Capital lease obligations
- Letters of credit (face amount or drawn)

Often excludes:
- Operating leases (pre-ASC 842 deals)
- Pension obligations
- Contingent liabilities

### Consolidated EBITDA (Covenant Definition)
Starts with net income, then adds back:
- Interest expense
- Income taxes
- Depreciation and amortization
- Non-cash charges
- Restructuring costs (often capped)
- Pro forma adjustments for acquisitions

May also add back:
- Stock-based compensation
- Management fees
- Transaction costs
- Sponsor advisory fees

**Critical**: Covenant EBITDA often differs significantly from reported EBITDA. Always use the covenant definition.

## Related Skills

- `/skills/credit/SKILL.md` - Full credit analysis
- `/skills/refinancing/SKILL.md` - Refinancing risk assessment
