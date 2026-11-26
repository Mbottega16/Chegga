@echo off
cd /d "%~dp0"
node "%~dp0scripts\launch-chegga.mjs" playtest
if errorlevel 1 pause
