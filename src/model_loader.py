"""
Shared singleton model loader for the sentiment analysis model.
Both realtime_news_ingestion.py and risk_scoring.py import from here
to avoid loading the model into memory twice.
"""
import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "sentiment_model")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[ModelLoader] Using device: {device}")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.to(device)
model.eval()

print(f"[ModelLoader] Sentiment model loaded from: {MODEL_PATH}")
