@echo off
echo ========================================
echo Firebase Storage CORS Configuration
echo ========================================
echo.
echo This script will apply CORS settings to your Firebase Storage bucket.
echo CORS is required for AI Auto Upload to fetch product images.
echo.

REM Check if gsutil is installed
where gsutil >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: gsutil is not installed or not in PATH
    echo.
    echo Please install Google Cloud SDK:
    echo https://cloud.google.com/sdk/docs/install
    echo.
    pause
    exit /b 1
)

echo Applying CORS configuration...
echo.
gsutil cors set cors.json gs://azzahra-fashion-muslim-ab416.firebasestorage.app

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! CORS has been applied.
    echo ========================================
    echo.
    echo You can now use AI Auto Upload to compare product images.
    echo.
) else (
    echo.
    echo ERROR: Failed to apply CORS configuration
    echo.
    echo Please make sure you are authenticated with gcloud:
    echo   gcloud auth login
    echo.
)

pause
