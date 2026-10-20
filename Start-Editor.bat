@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Local.ps1" -OpenEditor
if errorlevel 1 (
  echo.
  echo Could not start the editor. See the error above.
  pause
  exit /b 1
)
endlocal
