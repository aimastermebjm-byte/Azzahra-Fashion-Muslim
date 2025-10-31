@echo off
echo Finding and stopping development servers...

:: Kill processes on common Vite/React ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Found process on port 3000, PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo Found process on port 5173, PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Found process on port 5000, PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4173') do (
    echo Found process on port 4173, PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Cleaning up Node.js processes...
:: Kill all Node.js processes except Claude Code
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr /v "claude-code"') do (
    set pid=%%i
    set pid=!pid:"=!
    echo Killing Node.js process PID: !pid!
    taskkill /PID !pid! /F >nul 2>&1
)

echo.
echo ✅ Development servers cleaned up!
echo You can now start a fresh development server with "npm run dev"