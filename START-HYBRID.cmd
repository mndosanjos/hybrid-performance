@echo off
cd /d "%~dp0"
set "HYBRID_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "HYBRID_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Install Node.js LTS and run npm install in this folder first.
  pause
  exit /b 1
)
echo Open http://localhost:5173 in your browser. Keep this window open.
"%HYBRID_NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1
pause
