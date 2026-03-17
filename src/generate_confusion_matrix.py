"""
Generate a confusion matrix and classification report for the sentiment model.
Saves the plot to results/confusion_matrix.png
"""

import os
import numpy as np
import pandas as pd
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# ── Paths ──
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "sentiment_train.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models", "sentiment_model")
OUTPUT_PATH = os.path.join(BASE_DIR, "results", "confusion_matrix.png")

# ── Load data (same split as training) ──
df = pd.read_csv(DATA_PATH)
_, X_test, _, y_test = train_test_split(
    df["text"], df["label_encoded"],
    test_size=0.2, stratify=df["label_encoded"], random_state=42
)

# ── Load trained model ──
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
model.to(device)
model.eval()

# ── Run predictions in batches ──
BATCH_SIZE = 32
all_preds = []
texts = X_test.tolist()

print(f"Running predictions on {len(texts)} test samples...")
for i in range(0, len(texts), BATCH_SIZE):
    batch = texts[i:i + BATCH_SIZE]
    inputs = tokenizer(batch, truncation=True, padding=True, max_length=128, return_tensors="pt").to(device)
    with torch.no_grad():
        logits = model(**inputs).logits
        preds = torch.argmax(logits, dim=1).cpu().numpy()
        all_preds.extend(preds)

y_pred = np.array(all_preds)
labels = ["Negative", "Neutral", "Positive"]

# ── Print classification report ──
print("\n" + "="*50)
print("CLASSIFICATION REPORT")
print("="*50)
print(classification_report(y_test, y_pred, target_names=labels))

# ── Generate confusion matrix plot ──
cm = confusion_matrix(y_test, y_pred)

fig, ax = plt.subplots(figsize=(8, 6))
fig.patch.set_facecolor("#0f172a")
ax.set_facecolor("#1e293b")

sns.heatmap(
    cm, annot=True, fmt="d", cmap="Blues",
    xticklabels=labels, yticklabels=labels,
    linewidths=1, linecolor="#334155",
    annot_kws={"size": 16, "weight": "bold"},
    ax=ax
)

ax.set_xlabel("Predicted Label", fontsize=13, color="#e2e8f0", labelpad=10)
ax.set_ylabel("True Label", fontsize=13, color="#e2e8f0", labelpad=10)
ax.set_title("Sentiment Classification — Confusion Matrix", fontsize=15, color="#e2e8f0", pad=15)
ax.tick_params(colors="#94a3b8", labelsize=11)

plt.tight_layout()
plt.savefig(OUTPUT_PATH, dpi=150, facecolor=fig.get_facecolor(), edgecolor="none")
plt.close()

print(f"\nConfusion matrix saved to: {OUTPUT_PATH}")
