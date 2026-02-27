@echo off
chcp 65001 >nul
echo ====================================================
echo   Project Komachi - 中古・中世日本語学習プラットフォーム
echo ====================================================
echo.

cd /d "%~dp0"

echo 起動中...
echo.

rem 仮想環境のPythonを使用
".\bin\env\env312\Scripts\python.exe" -m pip install flask -q 2>nul
".\bin\env\env312\Scripts\python.exe" run.py

pause
