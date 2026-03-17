import pandas as pd
import numpy as np
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from transformers import AutoTokenizer, AutoModelForSequenceClassification

df = pd.read_csv("data/processed/sentiment_train.csv")
_, X_test, _, y_test = train_test_split(
    df["text"], df["label_encoded"],
    test_size=0.2, stratify=df["label_encoded"], random_state=42
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

tokenizer = AutoTokenizer.from_pretrained("models/sentiment_model")
model = AutoModelForSequenceClassification.from_pretrained("models/sentiment_model")
model.to(device).eval()

preds = []
texts = X_test.tolist()
print(f"Running on {len(texts)} test samples...")

for i in range(0, len(texts), 32):
    batch = texts[i:i+32]
    inputs = tokenizer(batch, truncation=True, padding=True, max_length=128, return_tensors="pt").to(device)
    with torch.no_grad():
        logits = model(**inputs).logits
        preds.extend(torch.argmax(logits, dim=1).cpu().numpy())

y_pred = np.array(preds)

print("\n" + "="*55)
print("CLASSIFICATION REPORT")
print("="*55)
print(classification_report(y_test, y_pred, target_names=["Negative", "Neutral", "Positive"], digits=4))

print(f"Overall Accuracy: {accuracy_score(y_test, y_pred):.4f}")
