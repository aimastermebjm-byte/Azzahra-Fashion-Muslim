@echo off
echo ========================================
echo STOPPING ALL NODE PROCESSES...
echo ========================================
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo CLEARING VITE CACHE...
echo ========================================
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"
if exist "dist" rmdir /s /q "dist"

echo.
echo ========================================
echo STARTING FRESH DEVELOPMENT SERVER...
echo ========================================
echo Server akan berjalan di: http://localhost:5173
echo.
echo ========================================
echo INSTRUKSI:
echo 1. Tunggu hingga server selesai loading
echo 2. Buka browser dan pergi ke http://localhost:5173
echo 3. Tekan CTRL+F5 untuk hard refresh (bukan F5 biasa!)
echo 4. Atau gunakan Incognito/Private window
echo 5. Jangan buka tab lain di port yang sama
echo ========================================
echo.

npm run dev