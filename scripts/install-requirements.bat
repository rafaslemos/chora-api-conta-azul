@echo off
REM Script de instalação de dependências para Windows
REM Equivalente ao pip install -r requirements.txt do Python
REM Para Node.js/npm

setlocal enabledelayedexpansion

echo ========================================
echo   Instalando Dependencias do Projeto
echo ========================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao esta instalado!
    echo Por favor, instale Node.js ^>= 18.0.0:
    echo   https://nodejs.org/
    echo.
    echo Ou use nvm-windows:
    echo   https://github.com/coreybutler/nvm-windows
    exit /b 1
)

REM Verificar versão do Node.js
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=%

echo [OK] Node.js encontrado: v%NODE_VERSION%

REM Extrair versão major (assumindo formato v18.x.x)
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% lss 18 (
    echo [ERRO] Versao do Node.js muito antiga!
    echo Requerido: ^>= 18.0.0
    echo Encontrado: %NODE_VERSION%
    echo.
    echo Por favor, atualize o Node.js:
    echo   nvm install 18.0.0
    echo   nvm use 18.0.0
    exit /b 1
)

REM Verificar se npm está instalado
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] npm nao esta instalado!
    echo npm geralmente vem com Node.js.
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm encontrado: v%NPM_VERSION%
echo.

REM Verificar se .nvmrc existe
if exist .nvmrc (
    set /p NVM_VERSION=<.nvmrc
    echo [INFO] Versao especificada no .nvmrc: %NVM_VERSION%
    echo [DICA] Execute 'nvm use' para usar a versao correta
    echo.
)

REM Verificar se package.json existe
if not exist package.json (
    echo [ERRO] package.json nao encontrado!
    echo Certifique-se de estar na raiz do projeto.
    exit /b 1
)

echo [INFO] Instalando dependencias...
echo.

REM Instalar dependências
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   [ERRO] Erro ao instalar dependencias
    echo ========================================
    echo.
    echo Troubleshooting:
    echo   - Limpe o cache: npm cache clean --force
    echo   - Remova node_modules: rmdir /s /q node_modules ^&^& del package-lock.json
    echo   - Reinstale: npm install
    exit /b 1
)

echo.
echo ========================================
echo   [OK] Instalacao concluida com sucesso!
echo ========================================
echo.
echo Proximos passos:
echo   1. Configure as variaveis de ambiente (.env.local)
echo   2. Execute: npm run dev
echo.

endlocal
