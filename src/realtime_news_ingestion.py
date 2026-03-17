import os
import sys
import re
import time
import urllib.parse
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor, as_completed
import feedparser
from bs4 import BeautifulSoup
import pandas as pd
import torch
import torch.nn.functional as F
import json
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
from langdetect import detect, LangDetectException
from deep_translator import GoogleTranslator

# ---------------- PATH SETUP ----------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
    
RESULTS_PATH = os.path.join(BASE_DIR, "results", "realtime_predictions.csv")

from src.api.pipeline_status import update_status

load_dotenv()

# ---------------- MODEL (shared singleton) ----------------
from src.model_loader import tokenizer, model, device

groq_api_key = os.getenv("GROQ_API_KEY")
llm_client = OpenAI(api_key=groq_api_key, base_url="https://api.groq.com/openai/v1") if groq_api_key else None
LLM_MODEL = "llama-3.3-70b-versatile"
if not groq_api_key:
    print("GROQ_API_KEY not set. Tags and countries will be empty.")

# ---------------- HTTP SESSION WITH RETRY ----------------
def _get_http_session():
    """Returns a requests.Session with automatic retry on transient errors."""
    s = requests.Session()
    retries = Retry(total=3, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))
    return s

# ---------------- TEXT CLEANUP & LANGUAGE ----------------
def _strip_html(text):
    """Remove all HTML tags from text using BeautifulSoup."""
    return BeautifulSoup(text, "html.parser").get_text(separator=" ", strip=True)

def _is_mojibake(text):
    """Detect garbled/encoding-corrupted text (mojibake)."""
    if not text or len(text) < 10:
        return True
    # Count characters that are common in mojibake
    mojibake_chars = sum(1 for c in text if ord(c) > 0xFFF0 or c in 'ãƒãƒ¼ã‚¤Ø§Ù„Ø')
    ratio = mojibake_chars / len(text)
    return ratio > 0.15

def _ensure_english(text):
    """Detect language; translate to English if needed. Returns None for garbled text."""
    if not text or len(text.strip()) < 20:
        return None
    if _is_mojibake(text):
        return None
    try:
        lang = detect(text)
    except LangDetectException:
        return None  # undetectable = likely garbled
    if lang == "en":
        return text
    # Translate non-English to English
    try:
        translated = GoogleTranslator(source="auto", target="en").translate(text[:4500])
        if translated and len(translated.strip()) > 20:
            print(f"  [Translated {lang}→en]: {translated[:80]}...")
            return translated
    except Exception as e:
        print(f"  [Translation failed for {lang}]: {e}")
    return None  # translation failed, skip article

# ---------------- FUNCTIONS ----------------
def predict_sentiment(texts):
    inputs = tokenizer(
        texts,
        truncation=True,
        padding=True,
        max_length=128,
        return_tensors="pt"
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        # Get probabilities instead of just labels
        probs = F.softmax(outputs.logits, dim=1)
        return probs.cpu().numpy()

def calculate_risk_score(probs):
    # probs is [p_negative, p_neutral, p_positive]
    # We define weights: Negative=0.9, Neutral=0.5, Positive=0.1
    p_neg = float(probs[0])
    p_neu = float(probs[1])
    p_pos = float(probs[2])
    
    # Weighted sum for a smoother risk score
    score = (p_neg * 0.9) + (p_neu * 0.5) + (p_pos * 0.1)
    
    # Determine level for display
    if score >= 0.7:
        return score, "High Risk", "Negative"
    elif score >= 0.4:
        return score, "Medium Risk", "Neutral"
    else:
        return score, "Low Risk", "Positive"

def extract_features(text):
    text_lower = text.lower()
    keywords = [
        "supply chain", "logistics", "port", "delay", "shortage", "tariff",
        "strike", "disruption", "inventory", "freight", "warehouse", "shipping",
        "bottleneck", "container", "customs", "embargo", "import", "export",
        "demand", "backlog", "inflation", "recall", "semiconductor", "raw material",
    ]
    count = sum(1 for k in keywords if k in text_lower)
    return count

def generate_tags_and_countries_batch(texts, batch_index, total_batches):
    """Generate tags AND extract affected countries using LLM in batches with retry.
    Returns list of (tags_str, countries_str) tuples."""
    empty_result = [("", "")] * len(texts)
    if not llm_client:
        print(f"[Batch {batch_index}/{total_batches}] Skipped: missing GROQ_API_KEY.")
        return empty_result

    MAX_RETRIES = 3
    BASE_DELAY = 5  # seconds; doubles each retry (5, 10, 20)

    prompt_content = (
        "For each news article below, do two things:\n"
        "1. Generate 3 to 6 concise category tags\n"
        "2. Extract the countries mentioned or affected (use 'Global' if none specific)\n\n"
        "Return ONLY valid JSON: a dictionary where keys are article numbers ('1','2',...) "
        "and values are objects with 'tags' and 'countries' fields (both comma-separated strings).\n"
        'Example: {"1": {"tags": "Supply Chain, Tech", "countries": "USA, China"}, '
        '"2": {"tags": "Finance", "countries": "Global"}}\n\n'
    )
    for i, text in enumerate(texts, start=1):
        prompt_content += f"Article {i}:\n{text[:1000]}\n\n"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[Batch {batch_index}/{total_batches}] Requesting tags+countries from LLM for "
                  f"{len(texts)} articles (attempt {attempt}/{MAX_RETRIES})...")

            response = llm_client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": "You categorize news articles and extract affected countries. Return only JSON."},
                    {"role": "user", "content": prompt_content}
                ],
                temperature=0.2
            )
            content = response.choices[0].message.content or ""

            cleaned_content = content.replace("```json", "").replace("```", "").strip()
            result_dict = json.loads(cleaned_content)

            results = []
            for i in range(1, len(texts) + 1):
                entry = result_dict.get(str(i), {})
                if isinstance(entry, dict):
                    tags = entry.get("tags", "").strip()
                    countries = entry.get("countries", "Global").strip()
                else:
                    # Fallback if LLM returns flat string (treat as tags only)
                    tags = str(entry).strip()
                    countries = "Global"
                results.append((tags, countries))
                print(f"  - Article {i} Tags: {tags} | Countries: {countries}")

            return results

        except json.JSONDecodeError as e:
            print(f"[Batch {batch_index}/{total_batches}] LLM JSON Parse Error: {e}")
            print(f"Content was: {content}")
            return empty_result

        except Exception as e:
            error_msg = str(e).lower()
            is_rate_limit = "429" in error_msg or "rate limit" in error_msg

            if is_rate_limit and attempt < MAX_RETRIES:
                wait = BASE_DELAY * (2 ** (attempt - 1))
                print(f"[Batch {batch_index}/{total_batches}] Rate limited. "
                      f"Retrying in {wait}s... (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(wait)
            else:
                print(f"[Batch {batch_index}/{total_batches}] LLM Error: {e}")
                return empty_result

    return empty_result

# ---------------- NEWS SOURCES ----------------
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
NEWS_ENDPOINT = "https://newsapi.org/v2/everything"

GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "")
GNEWS_ENDPOINT = "https://gnews.io/api/v4/search"

GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"

RSS_FEEDS = [
    "https://www.supplychaindive.com/feeds/news/",
    "https://www.freightwaves.com/feed",
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://www.cnbc.com/id/10001147/device/rss/rss.html"  # Transportation
]

GOOGLE_NEWS_RSS_QUERIES = [
    "supply chain",
    "logistics disruption",
    "port congestion",
]

def fetch_news_api():
    print("Fetching from NewsAPI...")
    if not NEWS_API_KEY:
        print("  Skipping NewsAPI: NEWS_API_KEY not set.")
        return []
    try:
        session = _get_http_session()
        params = {
            "q": "supply chain OR logistics OR port congestion",
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 10,
            "apiKey": NEWS_API_KEY
        }
        res = session.get(NEWS_ENDPOINT, params=params, timeout=15).json()
        articles = [
            (a.get("title", "") + ". " + (a.get("description") or "")).strip()
            for a in res.get("articles", [])
            if a.get("title")
        ]
        return articles
    except Exception as e:
        print(f"NewsAPI Error: {e}")
        return []

def fetch_rss_news():
    print("Fetching from RSS Feeds...")
    articles = []
    for feed_url in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            print(f"  - {feed.feed.get('title', feed_url)}: Found {len(feed.entries)} entries")
            for entry in feed.entries[:5]:  # Limit to 5 per feed to avoid spam
                # Combine title and summary for analysis
                text = entry.get("title", "") + ". " + entry.get("summary", "")
                # Strip ALL HTML tags properly
                text = _strip_html(text)
                if len(text) > 50: # Filter out very short snippets
                    articles.append(text)
        except Exception as e:
            print(f"  - Error fetching {feed_url}: {e}")
    return articles

def fetch_gnews_api():
    """Fetch news from GNews API (free tier: 100 req/day, 10 articles/req)."""
    if not GNEWS_API_KEY:
        print("Skipping GNews: GNEWS_API_KEY not set.")
        return []
    print("Fetching from GNews API...")
    try:
        session = _get_http_session()
        params = {
            "q": "supply chain logistics",
            "lang": "en",
            "max": 10,
            "token": GNEWS_API_KEY
        }
        res = session.get(GNEWS_ENDPOINT, params=params, timeout=15).json()
        articles = [
            (a.get("title", "") + ". " + (a.get("description") or "")).strip()
            for a in res.get("articles", [])
            if a.get("title")
        ]
        print(f"  GNews: Found {len(articles)} articles")
        return articles
    except Exception as e:
        print(f"GNews API Error: {e}")
        return []

def fetch_gdelt_news():
    """Fetch news from GDELT DOC 2.0 API (free, no key required)."""
    print("Fetching from GDELT Project...")
    queries = ["supply chain", "logistics disruption", "port congestion"]
    articles = []
    for idx, query in enumerate(queries):
        # Add delay between requests to avoid 429 rate limiting
        if idx > 0:
            time.sleep(5)
        try:
            params = {
                "query": query,
                "mode": "ArtList",
                "maxrecords": 10,
                "format": "html",
                "timespan": "24h",
            }
            session = _get_http_session()
            res = session.get(GDELT_ENDPOINT, params=params, timeout=60)
            res.raise_for_status()

            soup = BeautifulSoup(res.text, "lxml")
            # GDELT returns styled HTML; article titles are in <span class="arttitle">
            for title_span in soup.find_all("span", class_="arttitle"):
                title_text = title_span.get_text(strip=True)
                if title_text and len(title_text) > 20:
                    title_text = re.sub(r"\s+", " ", title_text)
                    articles.append(title_text)
            print(f"  - GDELT '{query}': Found {len(soup.find_all('span', class_='arttitle'))} articles")
        except Exception as e:
            print(f"  - GDELT Error for '{query}': {e}")

    # Deduplicate within GDELT results
    articles = list(dict.fromkeys(articles))
    print(f"  GDELT Total: {len(articles)} unique articles")
    return articles

def fetch_google_news_rss():
    """Fetch news from Google News RSS (free, no key required)."""
    print("Fetching from Google News RSS...")
    articles = []
    for query in GOOGLE_NEWS_RSS_QUERIES:
        try:
            encoded_query = urllib.parse.quote_plus(query)
            url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
            feed = feedparser.parse(url)
            print(f"  - Google News '{query}': Found {len(feed.entries)} entries")
            for entry in feed.entries[:10]:
                title = entry.get("title", "").strip()
                # Google News RSS titles often end with " - Source Name"
                if title and len(title) > 20:
                    articles.append(title)
        except Exception as e:
            print(f"  - Google News RSS Error for '{query}': {e}")
    return articles

def _normalize_text(text):
    """Normalize text for deduplication: lowercase, strip punctuation, collapse whitespace."""
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', '', text.lower())).strip()

def fetch_all_news():
    # Fetch from independent sources concurrently for speed
    with ThreadPoolExecutor(max_workers=4) as pool:
        future_newsapi = pool.submit(fetch_news_api)
        future_rss = pool.submit(fetch_rss_news)
        future_gnews = pool.submit(fetch_gnews_api)
        future_google = pool.submit(fetch_google_news_rss)

    news_api_articles = future_newsapi.result()
    rss_articles = future_rss.result()
    gnews_articles = future_gnews.result()
    google_rss_articles = future_google.result()

    # GDELT stays sequential due to rate limits
    gdelt_articles = fetch_gdelt_news()

    all_news = (news_api_articles + rss_articles + gnews_articles
                + gdelt_articles + google_rss_articles)

    # Fuzzy deduplication: normalize text before comparing
    seen = set()
    unique_news = []
    for article in all_news:
        key = _normalize_text(article)
        if key not in seen:
            seen.add(key)
            unique_news.append(article)

    print(f"Total unique articles fetched: {len(unique_news)} "
          f"(NewsAPI: {len(news_api_articles)}, RSS: {len(rss_articles)}, "
          f"GNews: {len(gnews_articles)}, GDELT: {len(gdelt_articles)}, "
          f"Google RSS: {len(google_rss_articles)})")

    # --- Language detection + translation pass ---
    print("Running language detection & translation...")
    english_news = []
    skipped_lang = 0
    translated_count = 0
    for article in unique_news:
        result = _ensure_english(article)
        if result is None:
            skipped_lang += 1
        else:
            if result != article:
                translated_count += 1
            english_news.append(result)

    if skipped_lang > 0 or translated_count > 0:
        print(f"  Language filter: {skipped_lang} non-English/garbled removed, "
              f"{translated_count} translated to English")
    print(f"  Final article count: {len(english_news)}")
    return english_news

# ---------------- PIPELINE ----------------
def _append_row_to_csv(row_dict, target_columns):
    """Append a single row to the CSV immediately. Writes header if the file doesn't exist yet."""
    df_row = pd.DataFrame([row_dict])[target_columns]
    write_header = not os.path.exists(RESULTS_PATH) or os.path.getsize(RESULTS_PATH) == 0

    MAX_RETRIES = 3
    for retry in range(MAX_RETRIES):
        try:
            df_row.to_csv(RESULTS_PATH, mode="a", index=False, header=write_header)
            return True
        except PermissionError:
            if retry < MAX_RETRIES - 1:
                print(f"  Permission denied – retrying in 2s... ({retry + 1}/{MAX_RETRIES})")
                time.sleep(2)
            else:
                print(f"  Error: Could not write to {RESULTS_PATH} after {MAX_RETRIES} attempts.")
                return False
        except Exception as e:
            print(f"  Unexpected save error: {e}")
            return False


def run_pipeline():
    print(f"[{datetime.now()}] Starting news ingestion...")
    update_status("Fetching news from various sources...", 5)
    texts = fetch_all_news()

    if not texts:
        print("No news articles found.")
        update_status("No news articles found.", 100, "done")
        return

    # --- Load existing articles to filter duplicates BEFORE tagging ---
    existing_texts = set()
    initial_count = 0
    target_columns = [
        "News_Preview", "News_Full", "Sentiment_Label", "Risk_Score", "Risk_Level",
        "Prob_Neg", "Prob_Neu", "Prob_Pos", "Keyword_Count", "Tags", "Affected_Countries", "Timestamp"
    ]

    if os.path.exists(RESULTS_PATH):
        try:
            df_old = pd.read_csv(RESULTS_PATH)
            default_values = {
                "News_Preview": "", "News_Full": "", "Sentiment_Label": "",
                "Risk_Score": 0.0, "Risk_Level": "", "Prob_Neg": 0.0,
                "Prob_Neu": 0.0, "Prob_Pos": 0.0, "Keyword_Count": 0,
                "Tags": "", "Affected_Countries": "", "Timestamp": ""
            }
            for col in target_columns:
                if col not in df_old.columns:
                    df_old[col] = default_values.get(col, "")
            initial_count = len(df_old)
            existing_texts = set(df_old["News_Full"].dropna().tolist())
        except Exception as e:
            print(f"Warning: Could not read existing CSV ({e}). Starting fresh.")

    # Filter out duplicates before expensive tagging
    update_status("Removing duplicate articles...", 25)
    fresh_texts = [t for t in texts if t not in existing_texts]
    skipped_count = len(texts) - len(fresh_texts)
    if skipped_count > 0:
        print(f"Filtered out {skipped_count} duplicate articles before processing.")
    print(f"Processing {len(fresh_texts)} fresh articles...")

    if not fresh_texts:
        print("No new data to save.")
        update_status("No new articles to process.", 100, "done")
        return

    update_status("Running sentiment analysis...", 35)
    probs_batch = predict_sentiment(fresh_texts)

    # --- Process tags + countries in batches of 10 ---
    BATCH_SIZE = 10
    total = len(fresh_texts)
    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    all_tags = []
    all_countries = []
    
    for i in range(0, total, BATCH_SIZE):
        # Delay between batches to avoid hitting API rate limits
        if i > 0:
            time.sleep(5)

        batch_texts = fresh_texts[i:i + BATCH_SIZE]
        batch_index = (i // BATCH_SIZE) + 1
        
        tag_progress = 40 + int((batch_index / total_batches) * 55)
        update_status(f"Tagging batch {batch_index} of {total_batches}...", tag_progress)
        
        batch_results = generate_tags_and_countries_batch(batch_texts, batch_index, total_batches)
        for tags, countries in batch_results:
            all_tags.append(tags)
            all_countries.append(countries)

    saved_count = 0
    for i, (text, probs, tags, countries) in enumerate(zip(fresh_texts, probs_batch, all_tags, all_countries), start=1):
        score, level, sent_str = calculate_risk_score(probs)
        kw_count = extract_features(text)
        print(f"[{i}/{total}] Sentiment: {sent_str} | Risk: {level} ({score:.2f})")

        row = {
            "News_Preview": text[:100] + "..." if len(text) > 100 else text,
            "News_Full": text,
            "Sentiment_Label": sent_str,
            "Risk_Score": score,
            "Risk_Level": level,
            "Prob_Neg": probs[0],
            "Prob_Neu": probs[1],
            "Prob_Pos": probs[2],
            "Keyword_Count": kw_count,
            "Tags": tags,
            "Affected_Countries": countries,
            "Timestamp": datetime.now()
        }

        if _append_row_to_csv(row, target_columns):
            saved_count += 1
            print(f"  ✓ Saved to CSV ({initial_count + saved_count} total records)")

    print(f"\nDone. Added {saved_count} new records (total: {initial_count + saved_count}).")
    update_status(f"Analysis complete! Added {saved_count} new articles.", 100, "done")

if __name__ == "__main__":
    run_pipeline()
