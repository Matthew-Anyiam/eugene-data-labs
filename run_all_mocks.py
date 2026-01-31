import json
from pathlib import Path
from datetime import datetime

SAMPLES_DIR = Path("data/samples")
OUTPUT_DIR = Path("data/extractions")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 50)
print("BATCH MOCK EXTRACTION")
print("=" * 50)

for sample_file in sorted(SAMPLES_DIR.glob("*.json")):
    with open(sample_file) as f:
        data = json.load(f)
    
    ticker = data["company"]["ticker"]
    name = data["company"]["name"]
    
    extraction = {
        "ticker": ticker,
        "company_name": name,
        "mock": True,
        "timestamp": datetime.now().isoformat(),
        "metrics": {
            "total_debt": 50000,
            "leverage": 1.5
        }
    }
    
    out_path = OUTPUT_DIR / f"{ticker}_mock.json"
    with open(out_path, "w") as f:
        json.dump(extraction, f, indent=2)
    
    print(f"✓ {ticker} - {name}")

print("=" * 50)
print("Done! Check data/extractions/")