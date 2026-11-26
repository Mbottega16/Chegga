@echo off
cd /d "%~dp0"
node "%~dp0scripts\launch-chegga.mjs" default
if errorlevel 1 pause
