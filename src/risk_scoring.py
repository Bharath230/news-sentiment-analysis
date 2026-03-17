import os
import sys
import torch
import pandas as pd

# Ensure src is on path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.model_loader import tokenizer, model, device

def predict(texts):
    inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="pt").to(device)
    with torch.no_grad():
        return torch.argmax(model(**inputs).logits, dim=1).cpu().numpy()

if __name__ == "__main__":
    sample_news = [
        "Port congestion delayed shipments",
        "Production remained stable",
        "New supplier improved delivery"
    ]

    labels = predict(sample_news)

    df = pd.DataFrame({
        "News": sample_news,
        "Sentiment": labels
    })

    print(df)
