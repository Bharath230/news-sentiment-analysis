import sys
import os
from sqlmodel import select

# Add src to path
sys.path.append(os.path.join(os.getcwd()))

from src.api.database import get_session, create_db_and_tables
from src.api.models import NewsArticle

def check_db():
    print("Checking database...")
    try:
        create_db_and_tables() # Ensure tables exist
        with next(get_session()) as session:
            articles = session.exec(select(NewsArticle)).all()
            print(f"Total articles in DB: {len(articles)}")
            if len(articles) > 0:
                print("First article:", articles[0])
            else:
                print("Database is empty.")
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_db()
