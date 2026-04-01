"""
Modal.com GPU inference functions.

Deploy:
  modal deploy eugene/inference/modal_app.py

Run locally for testing:
  modal run eugene/inference/modal_app.py

Functions are called remotely from the Eugene API server.
Each function runs on GPU-accelerated containers in Modal's cloud.
"""

import modal

app = modal.App("eugene-inference")

# Container image with ML dependencies
inference_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch>=2.0",
        "transformers>=4.35",
        "sentencepiece",
    )
)


# ---------------------------------------------------------------------------
# Named Entity Recognition (NER)
# ---------------------------------------------------------------------------

@app.cls(
    image=inference_image,
    gpu="T4",
    timeout=120,
    container_idle_timeout=300,
    retries=2,
)
class NERModel:
    """GPU-accelerated Named Entity Recognition.

    Uses a transformer-based NER model to extract entities from text:
    companies, persons, locations, organizations, dates, monetary values.
    """

    @modal.enter()
    def load_model(self):
        from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
        model_name = "dslim/bert-base-NER"
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForTokenClassification.from_pretrained(model_name)
        self.pipeline = pipeline(
            "ner",
            model=self.model,
            tokenizer=self.tokenizer,
            aggregation_strategy="simple",
            device=0,
        )

    @modal.method()
    def extract_entities(self, text: str) -> list[dict]:
        """Extract named entities from text."""
        if not text or len(text) < 5:
            return []

        text = text[:4096]
        results = self.pipeline(text)

        entities = []
        for r in results:
            if r["score"] < 0.7:
                continue
            entities.append({
                "entity": r["word"],
                "entity_group": _map_ner_label(r["entity_group"]),
                "score": round(float(r["score"]), 4),
                "start": r["start"],
                "end": r["end"],
            })

        seen = set()
        unique = []
        for e in entities:
            key = (e["entity"].lower(), e["entity_group"])
            if key not in seen:
                seen.add(key)
                unique.append(e)

        return unique

    @modal.method()
    def batch_extract(self, texts: list[str]) -> list[list[dict]]:
        """Batch NER extraction for multiple texts."""
        return [self.extract_entities(t) for t in texts]


# ---------------------------------------------------------------------------
# Sentiment Classification
# ---------------------------------------------------------------------------

@app.cls(
    image=inference_image,
    gpu="T4",
    timeout=120,
    container_idle_timeout=300,
    retries=2,
)
class SentimentModel:
    """GPU-accelerated sentiment classification.

    Uses a financial sentiment model tuned for market/news text.
    """

    @modal.enter()
    def load_model(self):
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
        model_name = "ProsusAI/finbert"
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.pipeline = pipeline(
            "sentiment-analysis",
            model=self.model,
            tokenizer=self.tokenizer,
            device=0,
        )

    @modal.method()
    def classify(self, text: str) -> dict:
        """Classify sentiment of a single text."""
        if not text or len(text) < 5:
            return {"label": "neutral", "score": 0.5, "raw_scores": {}}

        text = text[:512]
        result = self.pipeline(text, top_k=3)

        scores = {r["label"].lower(): round(float(r["score"]), 4) for r in result}

        top = max(result, key=lambda x: x["score"])
        label = top["label"].lower()
        score = round(float(top["score"]), 4)

        if label == "positive":
            tone = score
        elif label == "negative":
            tone = -score
        else:
            tone = 0.0

        return {
            "label": label,
            "score": score,
            "tone": round(tone, 4),
            "raw_scores": scores,
        }

    @modal.method()
    def batch_classify(self, texts: list[str]) -> list[dict]:
        """Batch sentiment classification."""
        return [self.classify(t) for t in texts]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _map_ner_label(label: str) -> str:
    """Map NER model labels to Eugene entity types."""
    mapping = {
        "PER": "person",
        "ORG": "company",
        "LOC": "location",
        "MISC": "other",
    }
    return mapping.get(label, label.lower())


# ---------------------------------------------------------------------------
# Local entry point for testing
# ---------------------------------------------------------------------------

@app.local_entrypoint()
def main():
    """Test the inference pipeline locally."""
    ner = NERModel()
    sentiment = SentimentModel()

    test_text = "Apple Inc. CEO Tim Cook announced record quarterly revenue of $94.8 billion, driven by strong iPhone sales in China."

    print("=== NER ===")
    entities = ner.extract_entities.remote(test_text)
    for e in entities:
        print(f"  {e['entity']} ({e['entity_group']}) score={e['score']}")

    print("\n=== Sentiment ===")
    result = sentiment.classify.remote(test_text)
    print(f"  {result['label']} (score={result['score']}, tone={result['tone']})")
