"""
Eugene Intelligence — GPU Inference Pipeline.

NER, sentiment classification, and entity extraction via Modal.com.
Falls back to CPU-based or LLM-based extraction when Modal is unavailable.

Requires:
  - modal package (pip install modal)
  - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET env vars
"""
