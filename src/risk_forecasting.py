import os
import warnings
import pandas as pd
import matplotlib
matplotlib.use("Agg")          # non-interactive backend (safe for threads)
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from statsmodels.tsa.arima.model import ARIMA

warnings.filterwarnings("ignore", module="statsmodels")

# ---------------- PATH SETUP ----------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH = os.path.join(BASE_DIR, "results", "realtime_predictions.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "results", "risk_forecast.csv")
PLOT_RISK_SCORE_PATH = os.path.join(BASE_DIR, "results", "forecast_risk_score.png")
PLOT_SENTIMENT_PATH = os.path.join(BASE_DIR, "results", "forecast_sentiment.png")
PLOT_VOLUME_PATH = os.path.join(BASE_DIR, "results", "forecast_volume.png")

# ---------------- STYLING CONSTANTS ----------------
_BG_COLOR = "#1e293b"       # slate-800
_FIG_COLOR = "#0f172a"      # slate-900
_TEXT_COLOR = "#e2e8f0"      # slate-200
_GRID_COLOR = "#334155"      # slate-700
_TICK_COLOR = "#94a3b8"      # slate-400

MIN_DATA_POINTS = 3


def _trend_fallback(risk_ts, steps=3):
    """Smarter fallback: decay the last value toward the historical mean."""
    last_val = risk_ts.iloc[-1] if not risk_ts.empty else 0.5
    mean_val = risk_ts.mean() if len(risk_ts) > 1 else 0.5
    decay = 0.3  # how quickly we move toward the mean each step
    values = []
    current = last_val
    for _ in range(steps):
        current = current + decay * (mean_val - current)
        values.append(round(current, 4))
    start_time = risk_ts.index[-1] if not risk_ts.empty else pd.Timestamp.now()
    index = pd.date_range(start=start_time, periods=steps + 1, freq="10min")[1:]
    return values, index


def _style_ax(ax):
    """Apply dark-mode styling to an axes object."""
    ax.set_facecolor(_BG_COLOR)
    ax.title.set_color(_TEXT_COLOR)
    ax.yaxis.label.set_color(_TEXT_COLOR)
    ax.xaxis.label.set_color(_TEXT_COLOR)
    ax.tick_params(colors=_TICK_COLOR)
    for spine in ax.spines.values():
        spine.set_color(_GRID_COLOR)
    ax.grid(True, color=_GRID_COLOR, alpha=0.5)


def _format_xaxis(ax, all_timestamps):
    """Configure x-axis formatting for a given axes."""
    if all_timestamps:
        start_view = min(all_timestamps) - pd.Timedelta(hours=1)
        end_view = max(all_timestamps) + pd.Timedelta(hours=1)
        ax.set_xlim(start_view, end_view)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d\n%H:%M'))


def run_forecasting():
    """Run the full risk-forecasting pipeline: load data, fit model, save CSV & plots."""

    # ---------------- LOAD ----------------
    if not os.path.exists(INPUT_PATH):
        print(f"Data file not found at: {INPUT_PATH}")
        print("Please run 'src/realtime_news_ingestion.py' first to collect data.")
        return

    try:
        df = pd.read_csv(INPUT_PATH)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    if df.empty:
        print("Data file is empty. No forecasting possible yet.")
        return

    # Display stats
    if "Prob_Neg" in df.columns:
        print(f"Loaded {len(df)} data points with advanced features.")
        print(f"Avg Negative Prob: {df['Prob_Neg'].mean():.3f}")

    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    df.set_index("Timestamp", inplace=True)

    # ---------------- AGGREGATE FEATURES ----------------
    resampled = df.resample("10min").agg({
        "Risk_Score": "mean",
        "Prob_Neg": "mean",
        "Keyword_Count": "sum",
        "News_Full": "count"
    }).rename(columns={"News_Full": "Article_Count"}).dropna()

    risk_ts = resampled["Risk_Score"]
    print(f"Time series length after resampling: {len(risk_ts)}")

    # ---------------- MODEL ----------------
    if len(risk_ts) < MIN_DATA_POINTS:
        print(f"Warning: Not enough time steps for ARIMA (n={len(risk_ts)}). Using trend-based fallback.")
        forecast_values, forecast_index = _trend_fallback(risk_ts)
    else:
        try:
            model = ARIMA(risk_ts, order=(1, 1, 1))
            model_fit = model.fit()
            forecast_values = model_fit.forecast(steps=3)
            forecast_index = pd.date_range(start=risk_ts.index[-1], periods=4, freq="10min")[1:]
        except Exception as e:
            print(f"Error fitting ARIMA model: {e}")
            print("Falling back to trend-based forecast.")
            forecast_values, forecast_index = _trend_fallback(risk_ts)

    forecast_df = pd.DataFrame({
        "Timestamp": forecast_index,
        "Forecasted_Risk_Score": forecast_values
    })

    forecast_df.to_csv(OUTPUT_PATH, index=False)
    print("Risk forecast saved to:", OUTPUT_PATH)

    # ---------------- PLOTS ----------------
    all_timestamps = list(risk_ts.index) + list(forecast_df["Timestamp"])

    # Plot 1: Risk Score & Forecast
    fig1, ax1 = plt.subplots(figsize=(10, 4))
    fig1.patch.set_facecolor(_FIG_COLOR)
    _style_ax(ax1)
    ax1.plot(risk_ts.index, risk_ts, label="Historical Risk", marker='o', linestyle='-', color='#60a5fa')
    ax1.plot(forecast_df["Timestamp"], forecast_df["Forecasted_Risk_Score"], label="Forecast", color='#ef4444', linestyle='--')
    ax1.set_ylabel("Risk Score (0-1)")
    ax1.set_title("Supply Chain Risk Forecast")
    ax1.legend(facecolor=_BG_COLOR, edgecolor=_GRID_COLOR, labelcolor=_TEXT_COLOR)
    _format_xaxis(ax1, all_timestamps)
    fig1.tight_layout()
    fig1.savefig(PLOT_RISK_SCORE_PATH, facecolor=fig1.get_facecolor(), edgecolor='none')
    plt.close(fig1)
    print("Risk score forecast plot saved to:", PLOT_RISK_SCORE_PATH)

    # Plot 2: Negative Sentiment Intensity
    fig2, ax2 = plt.subplots(figsize=(10, 4))
    fig2.patch.set_facecolor(_FIG_COLOR)
    _style_ax(ax2)
    ax2.plot(resampled.index, resampled["Prob_Neg"], color='#f59e0b', marker='s')
    ax2.set_ylabel("Avg Negative Probability")
    ax2.set_title("Negative Sentiment Intensity")
    _format_xaxis(ax2, list(resampled.index))
    fig2.tight_layout()
    fig2.savefig(PLOT_SENTIMENT_PATH, facecolor=fig2.get_facecolor(), edgecolor='none')
    plt.close(fig2)
    print("Sentiment intensity plot saved to:", PLOT_SENTIMENT_PATH)

    # Plot 3: Volume & Keywords
    fig3, ax3 = plt.subplots(figsize=(10, 4))
    fig3.patch.set_facecolor(_FIG_COLOR)
    _style_ax(ax3)
    ax3.bar(resampled.index, resampled["Article_Count"], label="Total Articles", alpha=0.3, width=0.004, color='#818cf8')
    ax3.plot(resampled.index, resampled["Keyword_Count"], label="Supply Chain Keywords", color='#34d399', marker='^')
    ax3.set_ylabel("Count")
    ax3.set_title("News Volume & Keyword Buzz")
    ax3.legend(facecolor=_BG_COLOR, edgecolor=_GRID_COLOR, labelcolor=_TEXT_COLOR)
    _format_xaxis(ax3, list(resampled.index))
    fig3.tight_layout()
    fig3.savefig(PLOT_VOLUME_PATH, facecolor=fig3.get_facecolor(), edgecolor='none')
    plt.close(fig3)
    print("Volume & keyword plot saved to:", PLOT_VOLUME_PATH)


if __name__ == "__main__":
    run_forecasting()
