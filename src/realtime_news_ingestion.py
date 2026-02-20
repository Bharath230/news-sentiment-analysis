import os
import re
import time
import urllib.parse
import requests
import feedparser
from bs4 import BeautifulSoup
import pandas as pd
import torch
import torch.nn.functional as F
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from openai import OpenAI
from dotenv import load_dotenv
from src.api.pipeline_status import update_status

load_dotenv()

# ---------------- PATH SETUP ----------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "sentiment_model")
RESULTS_PATH = os.path.join(BASE_DIR, "results", "realtime_predictions.csv")

# ---------------- MODEL ----------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.to(device)
model.eval()

zai_api_key = os.getenv("ZAI_API_KEY")
print(zai_api_key)
zai_client = OpenAI(api_key=zai_api_key, base_url="https://api.z.ai/api/paas/v4/") if zai_api_key else None
if not zai_api_key:
    print("ZAI_API_KEY not set. Tags will be empty.")

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
    keywords = ["supply chain", "logistics", "port", "delay", "shortage", "tariff", "strike", "disruption", "inventory"]
    count = sum(1 for k in keywords if k in text_lower)
    return count

def generate_tags(text, index, total):
    if not zai_client:
        print(f"[Tagging {index}/{total}] Skipped: missing ZAI_API_KEY.")
        return ""
    try:
        print(f"[Tagging {index}/{total}] Requesting tags...")
        response = zai_client.chat.completions.create(
            model="glm-4.7-flash",
            messages=[
                {"role": "system", "content": "You generate short topical tags for news."},
                {
                    "role": "user",
                    "content": (
                        "Generate 3 to 6 concise tags for this news item. "
                        "Return only a comma-separated list of tags, no extra text.\n\n"
                        f"{text[:1500]}"
                    )
                }
            ],
            temperature=0.2
        )
        content = response.choices[0].message.content or ""
        tags = content.strip()
        if not tags:
            print(f"[Tagging {index}/{total}] Empty tag response.")
        else:
            print(f"[Tagging {index}/{total}] Tags: {tags}")
        return tags
    except Exception as e:
        print(f"[Tagging {index}/{total}] Error: {e}")
        return ""

# ---------------- NEWS SOURCES ----------------
NEWS_API_KEY = "0e3527ed4cdb4dbe8e5f131eef7f2787"
NEWS_ENDPOINT = "https://newsapi.org/v2/everything"

GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "")
GNEWS_ENDPOINT = "https://gnews.io/api/v4/search"

GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"

RSS_FEEDS = [
    "https://www.supplychaindive.com/feeds/news/",
    "https://www.logisticsmgmt.com/rss/news",
    "http://feeds.reuters.com/reuters/businessNews",
    "https://www.cnbc.com/id/10001147/device/rss/rss.html"  # Transportation
]

GOOGLE_NEWS_RSS_QUERIES = [
    "supply chain",
    "logistics disruption",
    "port congestion",
]

def fetch_news_api():
    print("Fetching from NewsAPI...")
    try:
        params = {
            "q": "supply chain OR logistics OR port congestion",
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 10,
            "apiKey": NEWS_API_KEY
        }
        res = requests.get(NEWS_ENDPOINT, params=params).json()
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
                # Clean up HTML tags if present (basic cleanup)
                text = text.replace("<p>", "").replace("</p>", "").replace("<br>", " ")
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
        params = {
            "q": "supply chain logistics",
            "lang": "en",
            "max": 10,
            "token": GNEWS_API_KEY
        }
        res = requests.get(GNEWS_ENDPOINT, params=params, timeout=15).json()
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
    for query in queries:
        try:
            params = {
                "query": query,
                "mode": "ArtList",
                "maxrecords": 10,
                "format": "html",
                "timespan": "24h",
            }
            res = requests.get(GDELT_ENDPOINT, params=params, timeout=60)
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
            for entry in feed.entries[:5]:
                title = entry.get("title", "").strip()
                # Google News RSS titles often end with " - Source Name"
                if title and len(title) > 20:
                    articles.append(title)
        except Exception as e:
            print(f"  - Google News RSS Error for '{query}': {e}")
    return articles

def fetch_all_news():
    news_api_articles = fetch_news_api()
    rss_articles = fetch_rss_news()
    gnews_articles = fetch_gnews_api()
    gdelt_articles = fetch_gdelt_news()
    google_rss_articles = fetch_google_news_rss()
    
    all_news = (news_api_articles + rss_articles + gnews_articles 
                + gdelt_articles + google_rss_articles)
    
    # Simple deduplication
    unique_news = list(set(all_news))
    print(f"Total unique articles fetched: {len(unique_news)} "
          f"(NewsAPI: {len(news_api_articles)}, RSS: {len(rss_articles)}, "
          f"GNews: {len(gnews_articles)}, GDELT: {len(gdelt_articles)}, "
          f"Google RSS: {len(google_rss_articles)})")
    return unique_news

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
        "Prob_Neg", "Prob_Neu", "Prob_Pos", "Keyword_Count", "Tags", "Timestamp"
    ]

    if os.path.exists(RESULTS_PATH):
        try:
            df_old = pd.read_csv(RESULTS_PATH)
            default_values = {
                "News_Preview": "", "News_Full": "", "Sentiment_Label": "",
                "Risk_Score": 0.0, "Risk_Level": "", "Prob_Neg": 0.0,
                "Prob_Neu": 0.0, "Prob_Pos": 0.0, "Keyword_Count": 0,
                "Tags": "", "Timestamp": ""
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

    total = len(fresh_texts)
    saved_count = 0
    for i, (text, probs) in enumerate(zip(fresh_texts, probs_batch), start=1):
        score, level, sent_str = calculate_risk_score(probs)
        kw_count = extract_features(text)
        print(f"[{i}/{total}] Sentiment: {sent_str} | Risk: {level} ({score:.2f})")
        # Progress: tagging goes from 40% to 95%
        tag_progress = 40 + int((i / total) * 55)
        update_status(f"Tagging article {i} of {total}...", tag_progress)
        tags = generate_tags(text, i, total)

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
            "Timestamp": datetime.now()
        }

        if _append_row_to_csv(row, target_columns):
            saved_count += 1
            print(f"  ✓ Saved to CSV ({initial_count + saved_count} total records)")

    print(f"\nDone. Added {saved_count} new records (total: {initial_count + saved_count}).")
    update_status(f"Analysis complete! Added {saved_count} new articles.", 100, "done")

if __name__ == "__main__":
    run_pipeline()
