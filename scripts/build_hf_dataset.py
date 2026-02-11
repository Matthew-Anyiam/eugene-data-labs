#!/usr/bin/env python3
"""
Eugene Intelligence - HuggingFace Dataset Builder

Builds a HuggingFace dataset from SEC filing extractions.

This creates a public dataset that:
1. Showcases Eugene's extraction capabilities
2. Provides training data for financial models
3. Drives awareness and adoption

Dataset structure:
- ticker: Stock ticker
- company_name: Company name
- filing_date: Date filed
- filing_type: 10-K or 10-Q
- total_debt: Total debt in millions
- net_debt: Net debt in millions
- leverage_ratio: Debt / EBITDA
- interest_coverage: EBITDA / Interest expense
- debt_instruments: JSON list of instruments
- covenants: JSON list of covenants
- maturity_schedule: JSON list of maturities
- extraction_quality: Quality score 0-1

Usage:
    # Build from local extractions
    python build_hf_dataset.py --source data/extractions
    
    # Push to HuggingFace Hub
    python build_hf_dataset.py --source data/extractions --push --repo eugene-intel/credit-data
"""

import argparse
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime


def load_extractions(source_dir: str) -> List[Dict]:
    """Load all extraction JSON files from a directory"""
    source_path = Path(source_dir)
    extractions = []
    
    for json_file in source_path.glob("*.json"):
        try:
            with open(json_file) as f:
                data = json.load(f)
            
            # Skip if mock or low quality
            if data.get("mock"):
                continue
            
            quality = data.get("quality", {})
            if quality.get("overall_confidence", 0) < 0.7:
                continue
            
            extractions.append(data)
            
        except Exception as e:
            print(f"Warning: Could not load {json_file}: {e}")
    
    return extractions


def transform_to_dataset_row(extraction: Dict) -> Optional[Dict]:
    """Transform an extraction to a dataset row"""
    try:
        ticker = extraction.get("ticker", "")
        company_name = extraction.get("company_name", "")
        filing_date = extraction.get("filing_date", "")
        filing_type = extraction.get("filing_type", "10-K")
        
        ext_data = extraction.get("extraction", extraction.get("data", {}))
        quality = extraction.get("quality", {})
        
        # Aggregate metrics
        metrics = ext_data.get("aggregate_metrics", {})
        
        # Build row
        row = {
            "ticker": ticker,
            "company_name": company_name,
            "filing_date": filing_date,
            "filing_type": filing_type,
            "total_debt": metrics.get("total_debt"),
            "net_debt": metrics.get("net_debt"),
            "cash_and_equivalents": metrics.get("cash_and_equivalents"),
            "ebitda": metrics.get("ebitda"),
            "leverage_ratio": metrics.get("leverage_ratio"),
            "interest_coverage": metrics.get("interest_coverage_ratio"),
            "debt_instruments": json.dumps(ext_data.get("debt_instruments", [])),
            "covenants": json.dumps(ext_data.get("covenants", [])),
            "maturity_schedule": json.dumps(ext_data.get("maturity_schedule", [])),
            "credit_facility": json.dumps(ext_data.get("credit_facility", {})),
            "extraction_quality": quality.get("overall_confidence", 0),
            "extraction_notes": ext_data.get("extraction_notes", "")
        }
        
        return row
        
    except Exception as e:
        print(f"Warning: Could not transform extraction: {e}")
        return None


def build_dataset(extractions: List[Dict]) -> List[Dict]:
    """Build dataset from extractions"""
    rows = []
    
    for extraction in extractions:
        row = transform_to_dataset_row(extraction)
        if row:
            rows.append(row)
    
    return rows


def save_dataset_local(rows: List[Dict], output_path: str):
    """Save dataset locally as JSON and CSV"""
    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save as JSON
    json_path = output_dir / "credit_data.json"
    with open(json_path, 'w') as f:
        json.dump(rows, f, indent=2)
    print(f"Saved JSON: {json_path}")
    
    # Save as JSONL (for HF)
    jsonl_path = output_dir / "credit_data.jsonl"
    with open(jsonl_path, 'w') as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    print(f"Saved JSONL: {jsonl_path}")
    
    # Save as CSV
    try:
        import csv
        csv_path = output_dir / "credit_data.csv"
        
        if rows:
            fieldnames = rows[0].keys()
            with open(csv_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            print(f"Saved CSV: {csv_path}")
    except Exception as e:
        print(f"Warning: Could not save CSV: {e}")
    
    return output_dir


def push_to_hub(rows: List[Dict], repo_id: str, token: Optional[str] = None):
    """Push dataset to HuggingFace Hub"""
    try:
        from datasets import Dataset
        
        # Create HuggingFace dataset
        dataset = Dataset.from_list(rows)
        
        # Push to hub
        dataset.push_to_hub(
            repo_id,
            token=token,
            private=False,
            commit_message=f"Update credit data - {len(rows)} companies"
        )
        
        print(f"Pushed to HuggingFace Hub: {repo_id}")
        print(f"View at: https://huggingface.co/datasets/{repo_id}")
        
    except ImportError:
        print("Error: datasets library not installed")
        print("Install with: pip install datasets")
    except Exception as e:
        print(f"Error pushing to Hub: {e}")


def create_dataset_card(repo_id: str, num_rows: int) -> str:
    """Create README.md for the dataset"""
    return f"""---
license: mit
task_categories:
  - text-classification
  - table-question-answering
language:
  - en
tags:
  - finance
  - credit
  - sec-filings
  - debt
  - covenants
size_categories:
  - n<1K
---

# Eugene Credit Data

Structured credit and debt data extracted from SEC filings using AI.

## Dataset Description

This dataset contains extracted credit information from 10-K and 10-Q filings, including:

- **Debt instruments**: Term loans, bonds, credit facilities with rates and maturities
- **Financial covenants**: Leverage ratios, interest coverage, with compliance status
- **Maturity schedules**: Year-by-year debt maturities
- **Aggregate metrics**: Total debt, net debt, leverage ratios

## Dataset Structure

| Field | Type | Description |
|-------|------|-------------|
| ticker | string | Stock ticker |
| company_name | string | Company name |
| filing_date | string | Date of SEC filing |
| filing_type | string | 10-K or 10-Q |
| total_debt | float | Total debt in millions |
| net_debt | float | Net debt (debt - cash) in millions |
| leverage_ratio | float | Debt / EBITDA |
| interest_coverage | float | EBITDA / Interest expense |
| debt_instruments | json | List of debt instruments |
| covenants | json | List of financial covenants |
| maturity_schedule | json | Debt maturity schedule |
| extraction_quality | float | Quality score 0-1 |

## Usage

```python
from datasets import load_dataset

dataset = load_dataset("{repo_id}")

# Filter high-quality extractions
high_quality = dataset.filter(lambda x: x["extraction_quality"] > 0.85)

# Get companies with leverage > 4x
leveraged = dataset.filter(lambda x: x["leverage_ratio"] and x["leverage_ratio"] > 4)
```

## Source

Data extracted by [Eugene Intelligence](https://github.com/eugene-intelligence/eugene) from SEC EDGAR filings.

## License

MIT

## Citation

```bibtex
@dataset{{eugene_credit_data,
  title={{Eugene Credit Data}},
  author={{Eugene Intelligence}},
  year={{2025}},
  publisher={{HuggingFace}}
}}
```
"""


def main():
    parser = argparse.ArgumentParser(description="Build HuggingFace dataset from extractions")
    parser.add_argument("--source", "-s", default="data/extractions", help="Source directory")
    parser.add_argument("--output", "-o", default="data/hf_dataset", help="Output directory")
    parser.add_argument("--push", action="store_true", help="Push to HuggingFace Hub")
    parser.add_argument("--repo", "-r", default="eugene-intel/credit-data", help="HuggingFace repo ID")
    parser.add_argument("--token", "-t", help="HuggingFace token (or set HF_TOKEN env)")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("EUGENE - HUGGINGFACE DATASET BUILDER")
    print("=" * 60)
    print()
    
    # Load extractions
    print(f"Loading extractions from {args.source}...")
    extractions = load_extractions(args.source)
    print(f"Found {len(extractions)} valid extractions")
    print()
    
    if not extractions:
        print("No extractions found. Run extraction pipeline first:")
        print("  python eugene_cli.py extract --ticker TSLA")
        return
    
    # Build dataset
    print("Building dataset...")
    rows = build_dataset(extractions)
    print(f"Created {len(rows)} dataset rows")
    print()
    
    # Save locally
    print("Saving locally...")
    output_dir = save_dataset_local(rows, args.output)
    print()
    
    # Create dataset card
    card = create_dataset_card(args.repo, len(rows))
    card_path = output_dir / "README.md"
    with open(card_path, 'w') as f:
        f.write(card)
    print(f"Created dataset card: {card_path}")
    print()
    
    # Push to Hub
    if args.push:
        token = args.token or os.environ.get("HF_TOKEN")
        if not token:
            print("Warning: No HuggingFace token provided")
            print("Set HF_TOKEN environment variable or use --token")
        else:
            push_to_hub(rows, args.repo, token)
    
    print()
    print("=" * 60)
    print("DONE")
    print("=" * 60)
    print(f"Dataset saved to: {output_dir}")
    
    if not args.push:
        print()
        print("To push to HuggingFace Hub:")
        print(f"  python build_hf_dataset.py --push --repo {args.repo} --token YOUR_TOKEN")


if __name__ == "__main__":
    main()
