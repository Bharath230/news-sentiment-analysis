# Supply Chain Risk Monitoring Dashboard

## Overview

The **Supply Chain Risk Dashboard** is a comprehensive, AI-powered platform designed to ingest, analyze, and visualize global news to detect and forecast supply chain risks. By leveraging advanced Natural Language Processing (NLP) and Large Language Models (LLMs) like Llama 3.3 70B, this application provides real-time insights, sentiment analysis, and predictive risk scoring for global supply chain operations.

## Features

- **Real-Time News Ingestion & Processing**: Continuously fetches global news articles, performs language detection, automatically translates non-English content to English, and cleanses HTML tags.
- **AI-Powered Insights**: Utilizes LLMs to generate analytical summaries, assess business impact, and extract relevant supply chain keywords/tags.
- **Risk Scoring & Sentiment Analysis**: Employs locally hosted models and heuristics to accurately score the risk level and sentiment of incoming news data.
- **Interactive Global Risk Map**: A dynamic 3D globe visualization that maps risks geographically, allowing users to filter and view country-specific supply chain disruptions.
- **Risk Forecasting**: Time-series forecasting algorithms predict future risk trends and volume based on historical data.
- **News Digest & Feed**: A curated, easily readable feed of processed news articles, complete with LLM-generated summaries and risk indicators.
- **Modern UI/UX**: Built with React and Tailwind CSS, featuring an intuitive onboarding flow, personalized tag preferences, and dynamic charting.

## Architecture & Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite (`news_risk.db`)
- **AI/ML**: `transformers` for local sentiment models, Groq API (Llama 3.3 70B) for advanced text analysis and summarization.
- **Data Processing**: `pandas`, custom Python ingestion and forecasting scripts.

### Frontend
- **Framework**: React.js (built with Vite)
- **Styling**: Tailwind CSS
- **Visualizations**: D3.js, Chart.js, Recharts, and custom WebGL/Three.js implementations for the Interactive Globe.

## Prerequisites

1. **Node.js**: Install from [nodejs.org](https://nodejs.org/).
2. **Python**: Ensure Python 3.10+ is installed.
3. **Git LFS**: Required for downloading large model weights (`*.safetensors`). Install from [git-lfs.com](https://git-lfs.com/).

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Bharath230/news-sentiment-analysis.git
   cd news-sentiment-analysis
   ```

2. **Backend Setup**
   Ensure you have a virtual environment set up (recommended).
   ```bash
   pip install -r requirements.txt
   ```
   *Note: Ensure you configure your `.env` file with the necessary API keys (e.g., Groq API key) before running the backend.*

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

## Running the Application

### Option 1: Using the provided script (Windows)
Double-click `start_app.bat` in the root folder to launch both the frontend and backend servers simultaneously.

### Option 2: Run manually

**Backend**:
Open a terminal in the root directory and run:
```bash
python -m uvicorn src.api.main:app --reload --port 8000
```

**Frontend**:
Open a new terminal, navigate to the `frontend` directory, and run:
```bash
cd frontend
npm run dev
```

Finally, open [http://localhost:5173](http://localhost:5173) in your browser to view the dashboard.

## Project Structure

- `src/`: Python scripts for news ingestion, risk forecasting, model loader, and the FastAPI backend (`src/api`).
- `frontend/`: React application source code, components, pages, and assets.
- `models/`: Local machine learning model weights (tracked via Git LFS).
- `data/` & `results/`: Processed datasets, CSV exports, and visualization outputs like confusion matrices and forecasting plots.

## License
MIT License
