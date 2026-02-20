import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_PATH = os.path.join(BASE_DIR, "data", "raw", "kaggle_sentiment.csv")
PROCESSED_DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "sentiment_train.csv")

df = pd.read_csv(RAW_DATA_PATH)
print("Dataset Shape:", df.shape)

print(df.info())
print(df.isnull().sum())
print(df["Sentiment"].value_counts())

plt.figure(figsize=(6, 4))
sns.countplot(x="Sentiment", data=df)
plt.title("Sentiment Class Distribution")
plt.show()

df = df.rename(columns={
    "Sentence": "text",
    "Sentiment": "label"
})

label_mapping = {
    "negative": 0,
    "neutral": 1,
    "positive": 2
}

df["label_encoded"] = df["label"].map(label_mapping)

df["text_length"] = df["text"].apply(lambda x: len(x.split()))

plt.figure(figsize=(6, 4))
sns.histplot(df["text_length"], bins=30)
plt.title("Text Length Distribution")
plt.show()

df_clean = df[["text", "label_encoded"]]

df_clean.to_csv(PROCESSED_DATA_PATH, index=False)
print("Cleaned dataset saved to:", PROCESSED_DATA_PATH)
