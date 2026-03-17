from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sqlmodel import Session, select, delete
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import os
import sys
import json
import time
import threading
import os
import sys
from openai import OpenAI
from dotenv import load_dotenv

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.api.database import create_db_and_tables, get_session
from src.api.models import NewsArticle, RiskForecast, UserTagPreference, UserProfile
from src.api.auth import get_current_user
from src.api.pipeline_status import get_status, reset as reset_pipeline_status
from src.realtime_news_ingestion import run_pipeline, RESULTS_PATH
from src.risk_forecasting import OUTPUT_PATH as FORECAST_PATH
from src.risk_forecasting import RESAMPLED_PATH
from src.risk_forecasting import PLOT_RISK_SCORE_PATH, PLOT_SENTIMENT_PATH, PLOT_VOLUME_PATH
from src.risk_forecasting import run_forecasting

# Load environment for LLM
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
llm_client = OpenAI(api_key=groq_api_key, base_url="https://api.groq.com/openai/v1") if groq_api_key else None
LLM_MODEL = "llama-3.3-70b-versatile"

# In-memory cache for news digest (invalidated on pipeline run)
_digest_cache = {"data": None, "timestamp": 0}

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    
    # Check if CSV exists, if not run initial pipeline to ensure data availability
    if not os.path.exists(RESULTS_PATH):
        print("No existing data found. Running initial analysis pipeline...")
        try:
            run_pipeline()
        except Exception as e:
            print(f"Error running initial pipeline: {e}")

    # Sync CSV to DB on startup
    sync_csv_to_db()
    yield

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sync_csv_to_db():
    """Reads existing CSV and populates the DB if empty or updates it."""
    print("Checking for CSV data to sync...")
    if not os.path.exists(RESULTS_PATH):
        print("No CSV found at", RESULTS_PATH)
        return

    try:
        df = pd.read_csv(RESULTS_PATH)
        if df.empty:
            print("CSV is empty.")
            return

        with next(get_session()) as session:
            # Always clear and reload to ensure consistency with CSV
            # This handles the case where the DB might be empty or out of sync
            session.exec(delete(NewsArticle))
            
            df["Timestamp"] = pd.to_datetime(df["Timestamp"], format="mixed", errors="coerce")
            df = df.dropna(subset=["Timestamp"])
            
            articles = []
            for _, row in df.iterrows():
                article = NewsArticle(
                    news_preview=row.get("News_Preview", ""),
                    news_full=row.get("News_Full", ""),
                    sentiment_label=row.get("Sentiment_Label", ""),
                    risk_score=row.get("Risk_Score", 0.0),
                    risk_level=row.get("Risk_Level", ""),
                    prob_neg=row.get("Prob_Neg", 0.0),
                    prob_neu=row.get("Prob_Neu", 0.0),
                    prob_pos=row.get("Prob_Pos", 0.0),
                    keyword_count=row.get("Keyword_Count", 0),
                    tags=row.get("Tags", ""),
                    affected_countries=row.get("Affected_Countries", ""),
                    timestamp=row["Timestamp"]
                )
                articles.append(article)
            session.add_all(articles)
            session.commit()
            print(f"Database synced from CSV. Loaded {len(articles)} records.")
    except Exception as e:
        print(f"Error syncing DB: {e}")

@app.get("/")
def read_root():
    return {"message": "Supply Chain Risk API is running"}

@app.get("/risk-history", response_model=List[NewsArticle])
def get_risk_history(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    user_id = user.get("sub", "dev_user")
    print(f"User {user_id} requested risk history.")
    
    # 1. Fetch user profile to get component
    profile = session.get(UserProfile, user_id)
    component = profile.sc_component if profile else ""
    
    # 2. Get articles
    statement = select(NewsArticle).order_by(NewsArticle.timestamp.desc()).limit(100)
    results = session.exec(statement).all()
    
    # 3. Filter articles by component keyword if component exists
    if component:
        # Define component keywords mapped to the 5 core components
        comp_keywords = {
            "Suppliers": ["supplier", "raw material", "sourcing", "procurement"],
            "Manufacturers/Producers": ["manufactur", "produc", "factory", "assembly"],
            "Warehouse/Storage": ["warehouse", "storage", "inventory", "facility"],
            "Transportation/Logistics": ["transportation", "logistic", "freight", "shipping", "port", "carrier"],
            "Distribution/Intermediaries": ["distribut", "retail", "wholesale", "intermediary"]
        }
        
        user_components = [c.strip() for c in component.split(",") if c.strip()]
        keywords = []
        for c in user_components:
            keywords.extend(comp_keywords.get(c, [c.lower()]))
            
        filtered_results = []
        for article in results:
            text = (article.news_full + " " + (article.tags or "")).lower()
            if any(k.lower() in text for k in keywords):
                filtered_results.append(article)
                
        # If filtering resulted in too few, return global as fallback or just return what we have
        # Usually we would just return what we have.
        results = filtered_results

    print(f"Returning {len(results)} articles for domain: {component}")
    return results

@app.get("/impact-summary")
def get_impact_summary(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    """Aggregates news into impact areas by grouping articles by common tags."""
    articles = session.exec(select(NewsArticle)).all()

    # 1. Build a map: tag -> list of articles containing that tag
    tag_articles: dict[str, list] = {}
    for article in articles:
        if not article.tags:
            continue
        for tag in article.tags.split(","):
            tag = tag.strip()
            if not tag:
                continue
            if tag not in tag_articles:
                tag_articles[tag] = []
            tag_articles[tag].append(article)

    # 2. For each tag, compute aggregate stats
    impact_areas = []
    for tag, arts in tag_articles.items():
        if len(arts) < 2:  # Only show areas with multiple articles
            continue
        avg_risk = sum(a.risk_score for a in arts) / len(arts)
        neg_count = sum(1 for a in arts if a.sentiment_label == "Negative")
        pos_count = sum(1 for a in arts if a.sentiment_label == "Positive")
        neu_count = sum(1 for a in arts if a.sentiment_label == "Neutral")
        dominant_sentiment = max(
            [("Negative", neg_count), ("Positive", pos_count), ("Neutral", neu_count)],
            key=lambda x: x[1],
        )[0]

        # Impact score = article_count * average_risk (higher = more impactful)
        impact_score = len(arts) * avg_risk

        # Risk level based on avg_risk
        if avg_risk >= 0.7:
            risk_level = "High Risk"
        elif avg_risk >= 0.4:
            risk_level = "Medium Risk"
        else:
            risk_level = "Low Risk"

        # Top headlines (sorted by risk_score desc, take top 5)
        sorted_arts = sorted(arts, key=lambda a: a.risk_score, reverse=True)
        top_headlines = [
            {
                "preview": a.news_preview[:120] + ("..." if len(a.news_preview) > 120 else ""),
                "risk_score": round(a.risk_score, 3),
                "sentiment": a.sentiment_label,
                "risk_level": a.risk_level,
            }
            for a in sorted_arts[:5]
        ]

        impact_areas.append(
            {
                "area": tag,
                "article_count": len(arts),
                "avg_risk_score": round(avg_risk, 3),
                "impact_score": round(impact_score, 3),
                "risk_level": risk_level,
                "dominant_sentiment": dominant_sentiment,
                "neg_count": neg_count,
                "pos_count": pos_count,
                "neu_count": neu_count,
                "top_headlines": top_headlines,
            }
        )

    # 3. Sort by impact_score descending
    impact_areas.sort(key=lambda x: x["impact_score"], reverse=True)

    # Return top 20 impact areas
    return impact_areas[:20]


@app.get("/news-digest")
def get_news_digest(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    """Builds LLM-powered analytical summaries by grouping articles around major themes."""
    import re
    from collections import Counter

    # Check cache first
    if _digest_cache["data"] is not None:
        return _digest_cache["data"]

    articles = session.exec(select(NewsArticle)).all()
    if not articles:
        return []

    # 1. Build tag → articles map
    tag_articles: dict[str, list] = {}
    for article in articles:
        if not article.tags:
            continue
        for tag in article.tags.split(","):
            tag = tag.strip()
            if not tag:
                continue
            tag_articles.setdefault(tag, []).append(article)

    # 2. Identify major themes: tags with 3+ articles
    major_tags = {t: arts for t, arts in tag_articles.items() if len(arts) >= 3}
    if not major_tags:
        major_tags = {t: arts for t, arts in tag_articles.items() if len(arts) >= 2}

    # 3. Build digest for each theme
    seen_article_ids = set()
    digests = []

    for theme, theme_articles in sorted(major_tags.items(), key=lambda x: len(x[1]), reverse=True):
        new_ids = {a.id for a in theme_articles} - seen_article_ids
        if len(new_ids) < 2:
            continue

        # Co-occurring tags
        co_tags = Counter()
        for article in theme_articles:
            if not article.tags:
                continue
            for tag in article.tags.split(","):
                tag = tag.strip()
                if tag and tag != theme:
                    co_tags[tag] += 1
        related_areas = [t for t, c in co_tags.most_common(8) if c >= 2]

        # Sentiment counts
        neg = sum(1 for a in theme_articles if a.sentiment_label == "Negative")
        pos = sum(1 for a in theme_articles if a.sentiment_label == "Positive")
        neu = sum(1 for a in theme_articles if a.sentiment_label == "Neutral")
        total = len(theme_articles)

        # Determine tone
        if neg > pos and neg > neu:
            tone = "concerning"
            tone_icon = "warning"
        elif pos > neg and pos > neu:
            tone = "positive"
            tone_icon = "positive"
        else:
            tone = "mixed"
            tone_icon = "neutral"

        # --- LLM-powered insights ---
        sorted_arts = sorted(theme_articles, key=lambda a: a.risk_score, reverse=True)
        headlines = [a.news_preview.strip()[:200] for a in sorted_arts[:8]]
        headline_block = "\n".join(f"- {h}" for h in headlines if h)

        summary = f"{theme} shows {tone} signals across {total} reports"
        key_developments = [h[:150] for h in headlines[:5]]  # fallback

        if llm_client and headline_block:
            try:
                prompt = (
                    f"You are a supply chain risk analyst. Below are {total} news headlines "
                    f"related to the topic '{theme}'.\n\n"
                    f"{headline_block}\n\n"
                    "Do three things:\n"
                    "1. Write a one-line overall assessment of this topic (concise, analytical)\n"
                    "2. Produce 3-5 concise analytical insight bullets summarizing KEY RISKS, "
                    "IMPACTS, and DEVELOPMENTS. Each should be a clear, actionable insight "
                    "(NOT a raw headline). Think cause-and-effect.\n"
                    "3. Determine the overall tone of these headlines. Must be exactly one of: 'concerning', 'positive', or 'mixed'.\n\n"
                    "Return JSON: {\"assessment\": \"...\", \"insights\": [\"...\", ...], \"tone\": \"concerning|positive|mixed\"}"
                )
                response = llm_client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a supply chain risk analyst. Return only JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.3,
                )
                content = response.choices[0].message.content or ""
                cleaned = content.replace("```json", "").replace("```", "").strip()
                result = json.loads(cleaned)
                
                summary = result.get("assessment", summary)
                insights = result.get("insights", [])
                llm_tone = str(result.get("tone", tone)).lower().strip()
                
                if llm_tone in ["concerning", "positive", "mixed"]:
                    tone = llm_tone
                    tone_icon = "warning" if tone == "concerning" else "positive" if tone == "positive" else "neutral"
                
                if insights:
                    key_developments = insights[:5]
            except Exception as e:
                print(f"[Digest LLM] Error for theme '{theme}': {e}")
                # Keep fallback summary and key_developments

        avg_risk = sum(a.risk_score for a in theme_articles) / total

        digests.append({
            "theme": theme,
            "summary": summary,
            "tone": tone,
            "tone_icon": tone_icon,
            "article_count": total,
            "related_areas": related_areas[:6],
            "key_developments": key_developments[:5],
            "neg_count": neg,
            "pos_count": pos,
            "neu_count": neu,
            "avg_risk": round(avg_risk, 3),
        })

        seen_article_ids.update(a.id for a in theme_articles)

        if len(digests) >= 15:
            break

    # Cache the results
    _digest_cache["data"] = digests
    _digest_cache["timestamp"] = time.time()

    return digests


@app.get("/country-risk-map")
def get_country_risk_map(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    """Groups articles by affected country for the globe visualization."""
    articles = session.exec(select(NewsArticle)).all()

    country_articles: dict[str, list] = {}
    for article in articles:
        if not article.affected_countries:
            continue
        for country in article.affected_countries.split(","):
            country = country.strip()
            if not country:
                continue
            country_articles.setdefault(country, []).append(article)

    country_data = []
    for country, arts in country_articles.items():
        if len(arts) < 1:
            continue
        avg_risk = sum(a.risk_score for a in arts) / len(arts)
        if avg_risk >= 0.7:
            risk_level = "High Risk"
        elif avg_risk >= 0.4:
            risk_level = "Medium Risk"
        else:
            risk_level = "Low Risk"

        sorted_arts = sorted(arts, key=lambda a: a.risk_score, reverse=True)
        top_headlines = [
            {
                "preview": a.news_preview[:120],
                "risk_score": round(a.risk_score, 3),
                "sentiment": a.sentiment_label,
            }
            for a in sorted_arts[:5]
        ]

        country_data.append({
            "country": country,
            "article_count": len(arts),
            "avg_risk_score": round(avg_risk, 3),
            "risk_level": risk_level,
            "top_headlines": top_headlines,
        })

    country_data.sort(key=lambda x: x["article_count"] * x["avg_risk_score"], reverse=True)
    return country_data[:40]


@app.get("/country-articles/{country}")
def get_country_articles(country: str, session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    """Returns articles that mention or affect a specific country."""
    articles = session.exec(select(NewsArticle).order_by(NewsArticle.timestamp.desc())).all()
    country_lower = country.lower().strip()
    filtered = [
        a for a in articles
        if a.affected_countries and country_lower in a.affected_countries.lower()
    ]
    return filtered[:50]


class UserProfilePayload(BaseModel):
    name: str
    company_name: str
    sc_component: str
    business_details: str

@app.get("/user-profile")
def get_user_profile(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    user_id = user.get("sub", "dev_user")
    profile = session.get(UserProfile, user_id)
    if profile:
        return profile
    raise HTTPException(status_code=404, detail="Profile not found")

@app.post("/user-profile")
def save_user_profile(
    payload: UserProfilePayload,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user)
):
    user_id = user.get("sub", "dev_user")
    profile = session.get(UserProfile, user_id)
    if not profile:
        profile = UserProfile(user_id=user_id, **payload.dict())
        session.add(profile)
    else:
        for k, v in payload.dict().items():
            setattr(profile, k, v)
    session.commit()
    return {"message": "Profile saved", "profile": profile}

@app.get("/forecast")
def get_forecast(user: dict = Depends(get_current_user)):
    if os.path.exists(FORECAST_PATH):
        df = pd.read_csv(FORECAST_PATH)
        return df.to_dict(orient="records")
    return {"message": "No forecast available yet"}

@app.get("/forecast-chart-data")
def get_forecast_chart_data(user: dict = Depends(get_current_user)):
    """Returns resampled timeseries + forecast data as JSON for live charts."""
    result = {"historical": [], "forecast": []}

    if os.path.exists(RESAMPLED_PATH):
        df = pd.read_csv(RESAMPLED_PATH)
        df["Timestamp"] = pd.to_datetime(df["Timestamp"], format="mixed", errors="coerce")
        df = df.dropna(subset=["Timestamp"])
        df["Timestamp"] = df["Timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
        result["historical"] = df.to_dict(orient="records")

    if os.path.exists(FORECAST_PATH):
        df_fc = pd.read_csv(FORECAST_PATH)
        df_fc["Timestamp"] = pd.to_datetime(df_fc["Timestamp"], format="mixed", errors="coerce")
        df_fc = df_fc.dropna(subset=["Timestamp"])
        df_fc["Timestamp"] = df_fc["Timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
        result["forecast"] = df_fc.to_dict(orient="records")

    return result

_FORECAST_PLOT_MAP = {
    "risk_score": PLOT_RISK_SCORE_PATH,
    "sentiment": PLOT_SENTIMENT_PATH,
    "volume": PLOT_VOLUME_PATH,
}

@app.get("/forecast-plot/{plot_name}")
def get_forecast_plot(plot_name: str, user: dict = Depends(get_current_user)):
    """Serve an individual forecast chart image."""
    path = _FORECAST_PLOT_MAP.get(plot_name)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Plot not found")
    return FileResponse(path, media_type="image/png")

@app.post("/trigger-ingest")
def trigger_ingest(user: dict = Depends(get_current_user)):
    """Start the pipeline in a background thread and return immediately."""
    current = get_status()
    if current["state"] == "running":
        return {"message": "Pipeline is already running"}

    def _run():
        try:
            run_pipeline()
            run_forecasting()
            sync_csv_to_db()
        except Exception as e:
            from src.api.pipeline_status import update_status
            update_status(f"Error: {e}", 0, "error")

    reset_pipeline_status()
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    # Invalidate digest cache when new pipeline runs
    _digest_cache["data"] = None
    _digest_cache["timestamp"] = 0
    return {"message": "Pipeline started"}


def _sse_generator():
    """Yield SSE events until the pipeline finishes or errors."""
    while True:
        status = get_status()
        data = json.dumps(status)
        yield f"data: {data}\n\n"
        if status["state"] in ("done", "error"):
            break
        time.sleep(1)


@app.get("/pipeline-progress")
def pipeline_progress():
    """SSE stream of pipeline progress events."""
    return StreamingResponse(
        _sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.get("/tags", response_model=List[str])
def get_unique_tags(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    """Returns a sorted list of unique tags extracted from all articles."""
    articles = session.exec(select(NewsArticle)).all()
    tag_set = set()
    for article in articles:
        if article.tags:
            for tag in article.tags.split(","):
                stripped = tag.strip()
                if stripped:
                    tag_set.add(stripped)
    return sorted(tag_set)

class TagPreferencePayload(BaseModel):
    preferred_tags: List[str]

@app.get("/user-preferences")
def get_user_preferences(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    """Returns the current user's tag preferences."""
    user_id = user.get("sub", "dev_user")
    pref = session.get(UserTagPreference, user_id)
    if pref and pref.preferred_tags:
        return {"preferred_tags": [t.strip() for t in pref.preferred_tags.split(",") if t.strip()]}
    return {"preferred_tags": []}

@app.put("/user-preferences")
def update_user_preferences(
    payload: TagPreferencePayload,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user)
):
    """Creates or updates the current user's tag preferences."""
    user_id = user.get("sub", "dev_user")
    pref = session.get(UserTagPreference, user_id)
    if pref:
        pref.preferred_tags = ", ".join(payload.preferred_tags)
    else:
        pref = UserTagPreference(user_id=user_id, preferred_tags=", ".join(payload.preferred_tags))
        session.add(pref)
    session.commit()
    return {"message": "Preferences saved", "preferred_tags": payload.preferred_tags}
