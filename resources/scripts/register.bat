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
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

set "ICON_PATH=%BASE_DIR%\images\cimple_icon-removebg.ico"

:: Check if icon exists
if not exist "%ICON_PATH%" (
    echo [ERROR] Icon not found at: "%ICON_PATH%"
    pause
    exit /b 1
)

:: Register the extension and file type
echo Registering .cimp file association...
reg add "HKCU\Software\Classes\.cimp" /ve /t REG_SZ /d "Cimple.File" /f >nul
reg add "HKCU\Software\Classes\Cimple.File" /ve /t REG_SZ /d "Cimple Source File" /f >nul
reg add "HKCU\Software\Classes\Cimple.File\DefaultIcon" /ve /t REG_SZ /d "\"%ICON_PATH%\"" /f >nul

:: --- Find VS Code ---
set "CODE_CMD="

:: 1. Is 'code' in the PATH?
where code >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "CODE_CMD=code"
    goto :found
)

:: 2. Registry Check (User)
for /f "tokens=2*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\VSCode" /v "DisplayIcon" 2^>nul') do (
    set "CODE_CMD=%%b"
    if defined CODE_CMD goto :found
)

:: 3. Registry Check (System)
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\VSCode" /v "DisplayIcon" 2^>nul') do (
    set "CODE_CMD=%%b"
    if defined CODE_CMD goto :found
)

:: 4. Common Paths (User)
if exist "%LocalAppData%\Programs\Microsoft VS Code\Code.exe" (
    set "CODE_CMD=%LocalAppData%\Programs\Microsoft VS Code\Code.exe"
    goto :found
)

:: 5. Common Paths (System)
if exist "%ProgramFiles%\Microsoft VS Code\Code.exe" (
    set "CODE_CMD=%ProgramFiles%\Microsoft VS Code\Code.exe"
    goto :found
)

echo [WARNING] Could not automatically find VS Code. 
echo You can still associate .cimp files manually by right-clicking one and choosing 'Open with...'.
goto :success

:found
echo Found VS Code at: "%CODE_CMD%"
reg add "HKCU\Software\Classes\Cimple.File\shell\open\command" /ve /t REG_SZ /d "\"%CODE_CMD%\" \"%%1\"" /f >nul

:success
echo.
echo ====================================================
echo   Success! 
echo ====================================================
echo Files with .cimp extension will now show the Cimple icon.
echo You may need to restart Windows Explorer to see the changes.
echo.
pause
exit /b 0

:cancel
echo.
echo Registration cancelled.
pause
exit /b 0

:cancel
echo.
echo Registration cancelled.
pause
exit
