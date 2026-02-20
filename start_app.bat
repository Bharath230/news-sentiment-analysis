@echo off
echo Starting Supply Chain Risk Dashboard...

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

:: Install dependencies if node_modules missing
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

:: Start Backend
echo Starting Backend Server (Port 8000)...
start "Backend Server" cmd /k "python -m uvicorn src.api.main:app --reload --port 8000"

:: Start Frontend
echo Starting Frontend Server (Port 5173)...
cd frontend
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo Once ready, open http://localhost:5173 in your browser.
echo.
pause
