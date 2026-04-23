@echo off
setlocal

python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Gagal install dependencies.
  pause
  exit /b 1
)

python -m PyInstaller --noconfirm --onefile --windowed --name PNGToWebP main.py
if errorlevel 1 (
  echo Build EXE gagal.
  pause
  exit /b 1
)

echo.
echo Build selesai. File EXE ada di: dist\PNGToWebP.exe
pause
