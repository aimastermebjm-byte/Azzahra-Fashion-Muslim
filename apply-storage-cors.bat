@echo off
echo ========================================
echo Firebase Storage CORS Configuration
echo ========================================
echo.

REM Check if gcloud is installed
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Google Cloud SDK is not installed!
    echo.
    echo Please install Google Cloud SDK first:
    echo.
    echo 1. Download: https://cloud.google.com/sdk/docs/install-sdk#windows
    echo 2. Install GoogleCloudSDKInstaller.exe
    echo 3. Restart this script
    echo.
    echo OR download directly:
    echo https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
    echo.
    pause
    exit /b 1
)

echo Google Cloud SDK found!
echo.

REM Check authentication
echo Checking authentication...
gcloud auth list 2>nul | findstr "@" >nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo You are not logged in. Starting authentication...
    echo.
    gcloud auth login
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Authentication failed!
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Setting project...
gcloud config set project azzahra-fashion-muslim-ab416

echo.
echo Applying CORS configuration...
echo Target: gs://azzahra-fashion-muslim-ab416.firebasestorage.app
echo.
gsutil cors set cors.json gs://azzahra-fashion-muslim-ab416.firebasestorage.app

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo          SUCCESS!
    echo ========================================
    echo.
    echo CORS has been applied to Firebase Storage.
    echo.
    echo Verifying CORS configuration...
    echo.
    gsutil cors get gs://azzahra-fashion-muslim-ab416.firebasestorage.app
    echo.
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Clear browser cache (Ctrl+Shift+Delete)
    echo 2. Reload your app
    echo 3. Test AI Auto Upload
    echo.
    echo Expected result:
    echo   - Image fetch: SUCCESS
    echo   - Similarity: 95%%+ for same image
    echo   - Recommendation: RECOMMENDED FOR UPLOAD
    echo.
) else (
    echo.
    echo ========================================
    echo          ERROR!
    echo ========================================
    echo.
    echo Failed to apply CORS configuration.
    echo.
    echo Common issues:
    echo 1. Not authenticated - Run: gcloud auth login
    echo 2. Wrong project - Check project ID
    echo 3. No permission - Use owner account
    echo.
    echo Troubleshooting:
    echo   gcloud auth login
    echo   gcloud config set project azzahra-fashion-muslim-ab416
    echo   gsutil cors set cors.json gs://azzahra-fashion-muslim-ab416.firebasestorage.app
    echo.
)

echo.
pause
