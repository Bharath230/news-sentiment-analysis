"""
Backfill Script: Extract Affected Countries for Existing Articles
=================================================================
Processes all existing articles in realtime_predictions.csv through
the Groq LLM (Llama 3.3 70B) to extract affected countries.

Creates a backup before modifying and adds the Affected_Countries column.

Usage:  python src/backfill_countries.py
"""

import os
import sys
import json
import time
import shutil
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
load_dotenv(os.path.join(BASE_DIR, ".env"))

CSV_PATH = os.path.join(BASE_DIR, "results", "realtime_predictions.csv")
BACKUP_PATH = CSV_PATH + ".bak"

# Groq config
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    print("Error: GROQ_API_KEY not set in .env")
    sys.exit(1)

client = OpenAI(api_key=groq_api_key, base_url="https://api.groq.com/openai/v1")
MODEL = "llama-3.3-70b-versatile"

BATCH_SIZE = 10
MAX_RETRIES = 3
BASE_DELAY = 5


def extract_countries_batch(texts, batch_index, total_batches):
    """Extract affected countries from a batch of article texts."""
    prompt = (
        "For each news article below, extract the countries that are MENTIONED or AFFECTED. "
        "Return ONLY valid JSON: a dictionary where keys are article numbers ('1', '2', ...) "
        "and values are comma-separated country name strings. If no specific country is mentioned, "
        "use 'Global'.\n"
        'Example: {"1": "USA, China", "2": "India, Bangladesh", "3": "Global"}\n\n'
    )
    for i, text in enumerate(texts, 1):
        prompt += f"Article {i}:\n{str(text)[:800]}\n\n"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"  [Batch {batch_index}/{total_batches}] Extracting countries "
                  f"(attempt {attempt}/{MAX_RETRIES})...")

            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You extract country names from news articles. Return only JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
            )
            content = response.choices[0].message.content or ""
            cleaned = content.replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned)

            countries = []
            for i in range(1, len(texts) + 1):
                countries.append(result.get(str(i), "Global").strip())
            return countries

        except json.JSONDecodeError as e:
            print(f"  [Batch {batch_index}] JSON Parse Error: {e}")
            return ["Global"] * len(texts)

        except Exception as e:
            error_msg = str(e).lower()
            if ("429" in error_msg or "rate limit" in error_msg) and attempt < MAX_RETRIES:
                wait = BASE_DELAY * (2 ** (attempt - 1))
                print(f"  [Batch {batch_index}] Rate limited, retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"  [Batch {batch_index}] Error: {e}")
                return ["Global"] * len(texts)

    return ["Global"] * len(texts)


def main():
    print("=" * 60)
    print("  BACKFILL: Extracting Affected Countries")
    print("=" * 60)

    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV not found at {CSV_PATH}")
        return

    # Load CSV
    df = pd.read_csv(CSV_PATH)
    total = len(df)
    print(f"Loaded {total} articles from CSV")

    # Check if already backfilled
    if "Affected_Countries" in df.columns:
        filled = df["Affected_Countries"].notna() & (df["Affected_Countries"].str.len() > 0)
        if filled.all():
            print("All articles already have countries. Nothing to do.")
            return
        # Only process rows missing countries
        to_process = df[~filled].index.tolist()
        print(f"  {filled.sum()} already have countries, processing {len(to_process)} remaining")
    else:
        df["Affected_Countries"] = ""
        to_process = list(range(total))
        print(f"  Adding Affected_Countries column, processing all {total} articles")

    # Backup
    print(f"Creating backup at {BACKUP_PATH}...")
    shutil.copy2(CSV_PATH, BACKUP_PATH)

    # Process in batches
    texts = df["News_Full"].tolist()
    total_batches = (len(to_process) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_num in range(total_batches):
        if batch_num > 0:
            time.sleep(3)  # Rate limit buffer

        start_idx = batch_num * BATCH_SIZE
        batch_indices = to_process[start_idx:start_idx + BATCH_SIZE]
        batch_texts = [texts[i] for i in batch_indices]

        countries = extract_countries_batch(batch_texts, batch_num + 1, total_batches)

        for idx, country in zip(batch_indices, countries):
            df.at[idx, "Affected_Countries"] = country

        pct = int((batch_num + 1) / total_batches * 100)
        print(f"  Progress: {pct}% ({batch_num + 1}/{total_batches} batches)")

    # Save
    df.to_csv(CSV_PATH, index=False)
    print(f"\nDone! Saved {total} articles with countries to {CSV_PATH}")

    # Quick stats
    country_counts = {}
    for val in df["Affected_Countries"].dropna():
        for c in str(val).split(","):
            c = c.strip()
            if c:
                country_counts[c] = country_counts.get(c, 0) + 1

    print(f"\nTop 10 countries mentioned:")
    for country, count in sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {country}: {count} articles")


if __name__ == "__main__":
    main()
