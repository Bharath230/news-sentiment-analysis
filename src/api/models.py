from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class NewsArticle(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    news_preview: str
    news_full: str = Field(index=True)  # Index for duplicate checking
    sentiment_label: str
    risk_score: float
    risk_level: str
    prob_neg: float
    prob_neu: float
    prob_pos: float
    keyword_count: int
    tags: Optional[str] = Field(default="")  # Comma-separated tags
    timestamp: datetime = Field(default_factory=datetime.now)

class RiskForecast(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime
    forecasted_risk_score: float

class UserTagPreference(SQLModel, table=True):
    user_id: str = Field(primary_key=True)  # Clerk user sub
    preferred_tags: str = Field(default="")  # Comma-separated preferred tags
