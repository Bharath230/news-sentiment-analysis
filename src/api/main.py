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

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.api.database import create_db_and_tables, get_session
from src.api.models import NewsArticle, RiskForecast, UserTagPreference
from src.api.auth import get_current_user
from src.api.pipeline_status import get_status, reset as reset_pipeline_status
from src.realtime_news_ingestion import run_pipeline, RESULTS_PATH
from src.risk_forecasting import OUTPUT_PATH as FORECAST_PATH
from src.risk_forecasting import PLOT_RISK_SCORE_PATH, PLOT_SENTIMENT_PATH, PLOT_VOLUME_PATH
from src.risk_forecasting import run_forecasting

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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Frontend URL
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
                    timestamp=pd.to_datetime(row.get("Timestamp"))
                )
                session.add(article)
            session.commit()
            print(f"Database synced from CSV. Loaded {len(df)} records.")
    except Exception as e:
        print(f"Error syncing DB: {e}")

@app.get("/")
def read_root():
    return {"message": "Supply Chain Risk API is running"}

@app.get("/risk-history", response_model=List[NewsArticle])
def get_risk_history(session: Session = Depends(get_session), user: dict = Depends(get_current_user)):
    print(f"User {user.get('sub')} requested risk history.")
    # Returns the latest 100 articles
    statement = select(NewsArticle).order_by(NewsArticle.timestamp.desc()).limit(100)
    results = session.exec(statement).all()
    print(f"Found {len(results)} articles in DB.")
    return results

@app.get("/forecast")
def get_forecast(user: dict = Depends(get_current_user)):
    if os.path.exists(FORECAST_PATH):
        df = pd.read_csv(FORECAST_PATH)
        return df.to_dict(orient="records")
    return {"message": "No forecast available yet"}

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
