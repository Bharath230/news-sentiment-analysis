import os
import torch
import pandas as pd
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "sentiment_model")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.to(device)
model.eval()

def predict(texts):
    inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="pt").to(device)
    with torch.no_grad():
        return torch.argmax(model(**inputs).logits, dim=1).cpu().numpy()

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