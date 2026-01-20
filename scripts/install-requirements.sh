#!/bin/bash

# Script de instalação de dependências
# Equivalente ao pip install -r requirements.txt do Python
# Para Node.js/npm

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Instalando Dependências do Projeto${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não está instalado!${NC}"
    echo -e "${YELLOW}Por favor, instale Node.js >= 18.0.0:${NC}"
    echo "  https://nodejs.org/"
    echo ""
    echo "Ou use nvm:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "  nvm install 18.0.0"
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

echo -e "${GREEN}✓${NC} Node.js encontrado: v${NODE_VERSION}"

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}❌ Versão do Node.js muito antiga!${NC}"
    echo -e "${YELLOW}Requerido: >= 18.0.0${NC}"
    echo -e "${YELLOW}Encontrado: ${NODE_VERSION}${NC}"
    echo ""
    echo "Por favor, atualize o Node.js:"
    echo "  nvm install 18.0.0"
    echo "  nvm use 18.0.0"
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não está instalado!${NC}"
    echo -e "${YELLOW}npm geralmente vem com Node.js.${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓${NC} npm encontrado: v${NPM_VERSION}"
echo ""

# Verificar se .nvmrc existe e usar versão especificada
if [ -f ".nvmrc" ]; then
    NVM_VERSION=$(cat .nvmrc)
    echo -e "${BLUE}📌 Versão especificada no .nvmrc: ${NVM_VERSION}${NC}"
    
    # Verificar se nvm está disponível
    if command -v nvm &> /dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${YELLOW}💡 Dica: Execute 'nvm use' para usar a versão correta${NC}"
    fi
    echo ""
fi

# Verificar se package.json existe
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json não encontrado!${NC}"
    echo -e "${YELLOW}Certifique-se de estar na raiz do projeto.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Instalando dependências...${NC}"
echo ""

# Instalar dependências
if npm install; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ Instalação concluída com sucesso!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Próximos passos:${NC}"
    echo "  1. Configure as variáveis de ambiente (.env.local)"
    echo "  2. Execute: npm run dev"
    echo ""
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ❌ Erro ao instalar dependências${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  - Limpe o cache: npm cache clean --force"
    echo "  - Remova node_modules: rm -rf node_modules package-lock.json"
    echo "  - Reinstale: npm install"
    exit 1
fi
