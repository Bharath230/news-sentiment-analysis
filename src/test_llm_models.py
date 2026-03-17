"""
LLM Model Comparison Test Script
=================================
Compares Gemini 2.0 Flash, Llama 3.3 70B (Groq), and Z.AI GLM-4.7-Flash
across three tasks:
  1. Tagging (compared against existing tags)
  2. Domain Summarization (News Digest insights)
  3. Country Extraction (for Globe page)

Usage:
  1. Set API keys in your .env file:
       GEMINI_API_KEY=your_key_here       (from https://aistudio.google.com/apikey)
       GROQ_API_KEY=your_key_here         (from https://console.groq.com/keys)
       ZAI_API_KEY=your_existing_key      (already set)
  2. Run:  python src/test_llm_models.py
"""

import os
import sys
import json
import time
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI

# ─── Setup ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
load_dotenv(os.path.join(BASE_DIR, ".env"))

CSV_PATH = os.path.join(BASE_DIR, "results", "realtime_predictions.csv")

# ─── Model Configs ────────────────────────────────────────────────────────────
MODELS = {
    "Gemini 2.0 Flash": {
        "api_key_env": "GEMINI_API_KEY",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": "gemini-2.0-flash",
    },
    "Llama 3.3 70B (Groq)": {
        "api_key_env": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.3-70b-versatile",
    },
    "Z.AI GLM-4.7-Flash": {
        "api_key_env": "ZAI_API_KEY",
        "base_url": "https://api.z.ai/api/paas/v4/",
        "model": "glm-4.7-flash",
    },
}


def get_client(model_name):
    """Create an OpenAI-compatible client for the given model."""
    cfg = MODELS[model_name]
    api_key = os.getenv(cfg["api_key_env"])
    if not api_key:
        return None
    return OpenAI(api_key=api_key, base_url=cfg["base_url"])


def load_sample_articles(n=5):
    """Load n articles from the CSV that have existing tags for comparison."""
    df = pd.read_csv(CSV_PATH)
    # Pick articles that have tags and decent text length
    tagged = df[df["Tags"].notna() & (df["Tags"].str.len() > 5) & (df["News_Full"].str.len() > 80)]
    sample = tagged.head(n).reset_index(drop=True)
    return sample


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1: TAGGING
# ═══════════════════════════════════════════════════════════════════════════════

def test_tagging(client, model_name, articles_df):
    """Test tagging capability. Returns list of tag strings and elapsed time."""
    cfg = MODELS[model_name]
    texts = articles_df["News_Full"].tolist()

    prompt = (
        "Generate 3 to 6 concise, high-level category tags for each of the following news articles. "
        "Return ONLY valid JSON: a dictionary where keys are article numbers as strings ('1', '2', ...) "
        "and values are comma-separated tag strings.\n"
        'Example: {"1": "Supply Chain, Tech", "2": "Finance, Risk"}\n\n'
    )
    for i, text in enumerate(texts, 1):
        prompt += f"Article {i}:\n{text[:800]}\n\n"

    start = time.time()
    try:
        response = client.chat.completions.create(
            model=cfg["model"],
            messages=[
                {"role": "system", "content": "You categorize news articles with short topical tags. Return only JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        content = response.choices[0].message.content or ""
        elapsed = time.time() - start

        cleaned = content.replace("```json", "").replace("```", "").strip()
        tags_dict = json.loads(cleaned)

        tags_list = []
        for i in range(1, len(texts) + 1):
            tags_list.append(tags_dict.get(str(i), "").strip())
        return tags_list, elapsed

    except Exception as e:
        elapsed = time.time() - start
        print(f"  ❌ {model_name} tagging error: {e}")
        return [""] * len(texts), elapsed


def compute_tag_overlap(old_tags_str, new_tags_str):
    """Compute Jaccard similarity between two comma-separated tag strings."""
    old = {t.strip().lower() for t in old_tags_str.split(",") if t.strip()}
    new = {t.strip().lower() for t in new_tags_str.split(",") if t.strip()}
    if not old and not new:
        return 1.0
    if not old or not new:
        return 0.0
    intersection = old & new
    union = old | new
    return len(intersection) / len(union)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2: DOMAIN SUMMARIZATION (News Digest)
# ═══════════════════════════════════════════════════════════════════════════════

def test_summarization(client, model_name, articles_df):
    """Test analytical summarization for a domain theme."""
    cfg = MODELS[model_name]

    # Group the articles as if they belong to a domain theme
    headlines = articles_df["News_Full"].str[:200].tolist()
    headline_block = "\n".join(f"- {h}" for h in headlines)

    prompt = (
        "You are a supply chain risk analyst. Below are news article summaries related to "
        "the 'Supply Chain & Trade' domain.\n\n"
        f"{headline_block}\n\n"
        "Produce exactly 3 to 5 concise analytical insight bullets that summarize the KEY RISKS, "
        "IMPACTS, and DEVELOPMENTS across these articles. Each bullet should be a clear, actionable "
        "insight — NOT a raw headline. Also provide a one-line overall assessment.\n\n"
        "Return JSON in this format:\n"
        '{"assessment": "one-line overall assessment", "insights": ["insight 1", "insight 2", ...]}'
    )

    start = time.time()
    try:
        response = client.chat.completions.create(
            model=cfg["model"],
            messages=[
                {"role": "system", "content": "You are a supply chain risk analyst. Return structured JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        content = response.choices[0].message.content or ""
        elapsed = time.time() - start

        cleaned = content.replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)
        return result, elapsed

    except Exception as e:
        elapsed = time.time() - start
        print(f"  ❌ {model_name} summarization error: {e}")
        return None, elapsed


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 3: COUNTRY EXTRACTION (Globe Page)
# ═══════════════════════════════════════════════════════════════════════════════

def test_country_extraction(client, model_name, articles_df):
    """Test extracting affected countries from articles."""
    cfg = MODELS[model_name]
    texts = articles_df["News_Full"].tolist()

    prompt = (
        "For each news article below, extract the countries that are MENTIONED or AFFECTED. "
        "Return ONLY valid JSON: a dictionary where keys are article numbers ('1', '2', ...) "
        "and values are comma-separated country name strings. If no specific country is mentioned, "
        "use 'Global'.\n"
        'Example: {"1": "USA, China", "2": "India, Bangladesh", "3": "Global"}\n\n'
    )
    for i, text in enumerate(texts, 1):
        prompt += f"Article {i}:\n{text[:800]}\n\n"

    start = time.time()
    try:
        response = client.chat.completions.create(
            model=cfg["model"],
            messages=[
                {"role": "system", "content": "You extract country names from news articles. Return only JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )
        content = response.choices[0].message.content or ""
        elapsed = time.time() - start

        cleaned = content.replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)

        countries_list = []
        for i in range(1, len(texts) + 1):
            countries_list.append(result.get(str(i), "Global").strip())
        return countries_list, elapsed

    except Exception as e:
        elapsed = time.time() - start
        print(f"  ❌ {model_name} country extraction error: {e}")
        return [""] * len(texts), elapsed


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN — Run all tests and print comparison
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 80)
    print("  LLM MODEL COMPARISON TEST")
    print("  Gemini 2.0 Flash  vs  Llama 3.3 70B (Groq)  vs  Z.AI GLM-4.7-Flash")
    print("=" * 80)

    # Check API keys
    available_models = {}
    for name in MODELS:
        client = get_client(name)
        if client:
            available_models[name] = client
            print(f"  ✅ {name}: API key found")
        else:
            print(f"  ⚠️  {name}: API key missing ({MODELS[name]['api_key_env']} not set)")

    if not available_models:
        print("\n❌ No API keys configured. Add them to your .env file:")
        print("   GEMINI_API_KEY=...   (from https://aistudio.google.com/apikey)")
        print("   GROQ_API_KEY=...     (from https://console.groq.com/keys)")
        return

    # Load sample articles
    print(f"\n📰 Loading sample articles from CSV...")
    df = load_sample_articles(5)
    print(f"   Loaded {len(df)} articles with existing tags\n")

    # ── TEST 1: TAGGING ────────────────────────────────────────────────────
    print("═" * 80)
    print("  TEST 1: TAGGING COMPARISON")
    print("═" * 80)

    tagging_results = {}
    for name, client in available_models.items():
        print(f"\n🏷️  Testing {name}...")
        tags, elapsed = test_tagging(client, name, df)
        tagging_results[name] = {"tags": tags, "time": elapsed}
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        for i, tag in enumerate(tags):
            print(f"   Article {i+1}: {tag}")

    # Compare with existing tags
    print(f"\n{'─' * 80}")
    print("  TAG QUALITY COMPARISON (against existing Z.AI tags)")
    print(f"{'─' * 80}")
    print(f"\n  {'Article':<10} {'Existing Tags':<50} ", end="")
    for name in tagging_results:
        short = name.split(" ")[0]
        print(f"{'Overlap('+short+')':<18}", end="")
    print()

    for i in range(len(df)):
        existing = str(df.iloc[i]["Tags"])
        print(f"  Art {i+1:<5} {existing[:48]:<50} ", end="")
        for name, res in tagging_results.items():
            overlap = compute_tag_overlap(existing, res["tags"][i])
            print(f"{overlap:.0%}{'':>14}", end="")
        print()

    # Average overlap and speed
    print(f"\n  {'SUMMARY':<60}", end="")
    for name in tagging_results:
        short = name.split("(")[0].strip()
        print(f"{short:<18}", end="")
    print()

    print(f"  {'Avg Tag Overlap':<60}", end="")
    for name, res in tagging_results.items():
        overlaps = [compute_tag_overlap(str(df.iloc[i]["Tags"]), res["tags"][i]) for i in range(len(df))]
        avg = sum(overlaps) / len(overlaps)
        print(f"{avg:.0%}{'':<15}", end="")
    print()

    print(f"  {'Response Time':<60}", end="")
    for name, res in tagging_results.items():
        print(f"{res['time']:.2f}s{'':<13}", end="")
    print()

    # ── TEST 2: DOMAIN SUMMARIZATION ───────────────────────────────────────
    print(f"\n\n{'═' * 80}")
    print("  TEST 2: DOMAIN SUMMARIZATION (News Digest)")
    print("═" * 80)

    for name, client in available_models.items():
        print(f"\n📝 Testing {name}...")
        result, elapsed = test_summarization(client, name, df)
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        if result:
            print(f"   📊 Assessment: {result.get('assessment', 'N/A')}")
            insights = result.get("insights", [])
            for j, insight in enumerate(insights, 1):
                print(f"   {j}. {insight}")
        else:
            print("   ❌ Failed to generate summary")

    # ── TEST 3: COUNTRY EXTRACTION ─────────────────────────────────────────
    print(f"\n\n{'═' * 80}")
    print("  TEST 3: COUNTRY EXTRACTION (Globe Page)")
    print("═" * 80)

    country_results = {}
    for name, client in available_models.items():
        print(f"\n🌍 Testing {name}...")
        countries, elapsed = test_country_extraction(client, name, df)
        country_results[name] = {"countries": countries, "time": elapsed}
        print(f"   ⏱️  Time: {elapsed:.2f}s")
        for i, c in enumerate(countries):
            preview = str(df.iloc[i]["News_Full"])[:80]
            print(f"   Article {i+1}: {c}")
            print(f"             └─ \"{preview}...\"")

    # ── FINAL SUMMARY ──────────────────────────────────────────────────────
    print(f"\n\n{'═' * 80}")
    print("  FINAL COMPARISON SUMMARY")
    print("═" * 80)

    header = f"  {'Metric':<35}"
    for name in available_models:
        short = name.split("(")[0].strip()[:20]
        header += f"{short:<22}"
    print(header)
    print("  " + "─" * (35 + 22 * len(available_models)))

    # Tagging speed
    row = f"  {'Tagging Speed':<35}"
    for name in available_models:
        if name in tagging_results:
            row += f"{tagging_results[name]['time']:.2f}s{'':<17}"
        else:
            row += f"{'N/A':<22}"
    print(row)

    # Tagging overlap
    row = f"  {'Avg Tag Overlap vs Existing':<35}"
    for name in available_models:
        if name in tagging_results:
            overlaps = [compute_tag_overlap(str(df.iloc[i]["Tags"]), tagging_results[name]["tags"][i]) for i in range(len(df))]
            avg = sum(overlaps) / len(overlaps)
            row += f"{avg:.0%}{'':<19}"
        else:
            row += f"{'N/A':<22}"
    print(row)

    # Country extraction speed
    row = f"  {'Country Extraction Speed':<35}"
    for name in available_models:
        if name in country_results:
            row += f"{country_results[name]['time']:.2f}s{'':<17}"
        else:
            row += f"{'N/A':<22}"
    print(row)

    print(f"\n{'═' * 80}")
    print("  Done! Review the results above to pick your preferred model.")
    print("═" * 80)


if __name__ == "__main__":
    main()
