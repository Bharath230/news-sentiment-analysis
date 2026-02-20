"""
Thread-safe module for tracking pipeline progress.
Used by run_pipeline() to emit status updates and by the SSE endpoint to read them.
"""
import threading
from datetime import datetime

_lock = threading.Lock()

_status = {
    "state": "idle",       # idle | running | done | error
    "message": "",
    "progress": 0,         # 0-100
    "updated_at": None,
}


def update_status(message: str, progress: int, state: str = "running"):
    """Called from the pipeline to broadcast the current stage."""
    with _lock:
        _status["state"] = state
        _status["message"] = message
        _status["progress"] = min(max(progress, 0), 100)
        _status["updated_at"] = datetime.now().isoformat()


def get_status() -> dict:
    """Read-only snapshot used by the SSE endpoint."""
    with _lock:
        return dict(_status)


def reset():
    """Reset to idle (called before a new pipeline run)."""
    with _lock:
        _status["state"] = "idle"
        _status["message"] = ""
        _status["progress"] = 0
        _status["updated_at"] = None
