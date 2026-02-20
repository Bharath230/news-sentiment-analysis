import os
import pandas as pd
import numpy as np
import torch

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.utils.class_weight import compute_class_weight
from torch import nn

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "sentiment_train.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models", "sentiment_model")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

df = pd.read_csv(DATA_PATH)

X_train, X_test, y_train, y_test = train_test_split(
    df["text"],
    df["label_encoded"],
    test_size=0.2,
    stratify=df["label_encoded"],
    random_state=42
)

# Switch to roberta-base for better performance and compatibility
model_name = "roberta-base"
tokenizer = AutoTokenizer.from_pretrained(model_name)

train_enc = tokenizer(X_train.tolist(), truncation=True, padding=True, max_length=128)
test_enc = tokenizer(X_test.tolist(), truncation=True, padding=True, max_length=128)

# Compute class weights (Softened to improve Precision)
class_weights = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(y_train),
    y=y_train
)
# Take square root to soften the weights (reduce False Positives for Class 0)
class_weights = np.sqrt(class_weights)
class_weights = torch.tensor(class_weights, dtype=torch.float).to(device)
print(f"Computed Class Weights (Softened): {class_weights}")

class SentimentDataset(torch.utils.data.Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels.tolist()

    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item

    def __len__(self):
        return len(self.labels)

train_dataset = SentimentDataset(train_enc, y_train)
test_dataset = SentimentDataset(test_enc, y_test)

model = AutoModelForSequenceClassification.from_pretrained(
    model_name,
    num_labels=3
)
model.to(device)

training_args = TrainingArguments(
    output_dir=RESULTS_DIR,
    num_train_epochs=5,              # Increased epochs
    per_device_train_batch_size=32,
    per_device_eval_batch_size=32,
    learning_rate=2e-5,
    weight_decay=0.01,
    logging_dir=os.path.join(RESULTS_DIR, "logs"),
    report_to="none",
    fp16=torch.cuda.is_available(),
    eval_strategy="epoch",           # Updated from evaluation_strategy
    save_strategy="epoch",           # Save every epoch
    load_best_model_at_end=True,     # Load best model
    metric_for_best_model="eval_loss",
    label_smoothing_factor=0.1       # Helps with generalization and calibration
)

class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.get("labels")
        outputs = model(**inputs)
        logits = outputs.get("logits")
        # Reverted to Standard CrossEntropy with Weights (Focal Loss was hurting Precision)
        loss_fct = nn.CrossEntropyLoss(weight=class_weights)
        loss = loss_fct(logits.view(-1, self.model.config.num_labels), labels.view(-1))
        return (loss, outputs) if return_outputs else loss

trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset
)

trainer.train()

preds = trainer.predict(test_dataset)
y_pred = np.argmax(preds.predictions, axis=1)

print(classification_report(y_test, y_pred))

model.save_pretrained(MODEL_DIR)
tokenizer.save_pretrained(MODEL_DIR)

print("Model saved to:", MODEL_DIR)
