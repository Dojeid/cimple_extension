@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo   Cimple File Explorer Icon Registration
echo ====================================================
echo.
echo This script will register .cimp files to show the Cimple logo
echo and open with VS Code in Windows File Explorer.
echo.

set /p confirm="Do you want to continue? (y/n): "
if /i "%confirm%" neq "y" goto :cancel

:: Get the directory of this script
set "BASE_DIR=%~dp0"
:: Remove trailing backslash if it exists
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

set "ICON_PATH=%BASE_DIR%\images\cimple_icon-removebg.ico"

:: Register the extension
reg add "HKCU\Software\Classes\.cimp" /ve /t REG_SZ /d "Cimple.File" /f
reg add "HKCU\Software\Classes\Cimple.File" /ve /t REG_SZ /d "Cimple Source File" /f
reg add "HKCU\Software\Classes\Cimple.File\DefaultIcon" /ve /t REG_SZ /d "\"%ICON_PATH%\"" /f

:: Look for VS Code - Try to find it in PATH or common locations
set "CODE_CMD=code"
where code >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "%LocalAppData%\Programs\Microsoft VS Code\Code.exe" (
        set "CODE_CMD=%LocalAppData%\Programs\Microsoft VS Code\Code.exe"
    )
)

reg add "HKCU\Software\Classes\Cimple.File\shell\open\command" /ve /t REG_SZ /d "\"%CODE_CMD%\" \"%%1\"" /f

echo.
echo Success! You may need to restart File Explorer to see changes.
echo.
pause
exit

:cancel
echo.
echo Registration cancelled.
pause
exit
