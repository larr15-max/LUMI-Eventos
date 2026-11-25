@echo off
REM LUMI - alternativa facil ao botao "Iniciar sem Depuracao" do VS Code
REM Duplo clique neste arquivo, depois acesse http://localhost:3000
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Falta instalar Node.js LTS: https://nodejs.org
  echo Feche e abra novamente o VS Code depois da instalacao.
  pause
  exit /b 1
)
node scripts\preparar.js
if errorlevel 1 (
  echo Nao foi possivel preparar o projeto.
  pause
  exit /b 1
)
echo.
echo ========================================
echo          LUMI EVENTOS
 echo  Abra http://localhost:3000
 echo  Para parar, feche esta janela ou Ctrl+C
 echo ========================================
echo.
node server.js
pause
