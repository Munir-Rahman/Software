@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo The app has not been installed yet. Run SETUP-CLIPORA.cmd first.
  pause
  exit /b 1
)
echo.
echo Starting Clipora... Open http://127.0.0.1:5173 in your browser.
echo Close this window or press Ctrl+C to stop the app.
call npm.cmd run dev
if errorlevel 1 (
  echo The app stopped with an error. Inspect the logs above.
  pause
)
