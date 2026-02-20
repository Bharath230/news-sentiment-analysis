# Supply Chain Risk Dashboard

## Prerequisites
1.  **Node.js**: Install from [nodejs.org](https://nodejs.org/).
2.  **Python**: Ensure Python 3.10+ is installed.

## Setup
1.  **Backend**:
    ```bash
    pip install -r requirements.txt
    ```
    (This is already done for you)

2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    ```
    (This is also done for you)

## Running the App
Double-click `start_app.bat` in the root folder.
Or run manually:

**Backend**:
```bash
python -m uvicorn src.api.main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the dashboard.
