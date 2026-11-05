@echo off
setlocal
cd /d "%~dp0"
echo.
echo ======================================================
echo  Clipora setup - installs dependencies on this drive
 echo ======================================================
where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 22 or later is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
call npm.cmd install --no-audit --no-fund
if errorlevel 1 (
  echo ERROR: npm installation failed. Check your connection.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\setup-windows.ps1"
if errorlevel 1 (
  echo ERROR: Video tools could not be installed. Review the message above.
  pause
  exit /b 1
)
call npm.cmd run doctor
if errorlevel 1 (
  echo ERROR: Some dependencies are missing.
  pause
  exit /b 1
)
echo.
echo Setup complete. Run START-CLIPORA.cmd to launch the website.
pause
