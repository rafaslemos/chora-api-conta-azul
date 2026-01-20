# Requirements - Dependências do Projeto

Este documento lista todas as dependências do projeto, seus propósitos e versões requeridas.

## Versão do Node.js

- **Requerida**: >= 18.0.0
- **Recomendada**: 18.0.0 (especificada no `.nvmrc`)
- **Uso**: Execute `nvm use` para usar a versão correta automaticamente

## Dependências de Produção

### React e Ecossistema

- **react** (^19.2.1)
  - Biblioteca principal para construção de interfaces de usuário
  - Framework base do frontend

- **react-dom** (^19.2.1)
  - Renderizador React para DOM
  - Necessário para renderizar componentes React no navegador

- **react-router-dom** (^7.10.1)
  - Roteamento para aplicações React
  - Gerencia navegação e rotas da aplicação

### UI e Estilização

- **recharts** (^3.5.1)
  - Biblioteca de gráficos para React
  - Usado para visualizações de dados (Analytics)

- **lucide-react** (^0.556.0)
  - Biblioteca de ícones para React
  - Fornece ícones SVG otimizados

- **framer-motion** (^12.23.25)
  - Biblioteca de animações para React
  - Usado para transições e animações suaves na UI

### Backend e Autenticação

- **@supabase/supabase-js** (2.39.3)
  - Cliente JavaScript oficial do Supabase
  - Gerencia autenticação, banco de dados e Edge Functions
  - Versão fixa (sem ^) para garantir compatibilidade

## Dependências de Desenvolvimento

### TypeScript e Tipos

- **typescript** (~5.8.2)
  - Superset do JavaScript com tipagem estática
  - Compilador TypeScript

- **@types/node** (^22.14.0)
  - Definições de tipos TypeScript para Node.js
  - Tipos para APIs do Node.js

- **@types/react** (^18.2.0)
  - Definições de tipos TypeScript para React
  - Tipos para componentes e hooks React

- **@types/react-dom** (^18.2.0)
  - Definições de tipos TypeScript para react-dom
  - Tipos para renderização no DOM

### Build e Desenvolvimento

- **vite** (^6.2.0)
  - Build tool e dev server extremamente rápido
  - Substitui webpack/create-react-app
  - HMR (Hot Module Replacement) nativo

- **@vitejs/plugin-react** (^5.0.0)
  - Plugin oficial do Vite para React
  - Suporte a JSX e Fast Refresh

- **tsx** (^4.19.2)
  - Executor TypeScript para Node.js
  - Permite executar arquivos .ts diretamente
  - Usado nos scripts de build

### Testes

- **vitest** (^2.1.8)
  - Framework de testes rápido baseado em Vite
  - Compatível com Jest/Chai
  - Suporta ESM nativo

- **@vitest/ui** (^2.1.8)
  - Interface web para visualizar testes
  - Executado com `npm run test:ui`

- **@testing-library/react** (^16.1.0)
  - Utilitários para testar componentes React
  - Foco em testes que simulam uso real

- **@testing-library/jest-dom** (^6.6.3)
  - Matchers customizados do Jest para DOM
  - Ex: `expect(element).toBeInTheDocument()`

- **@testing-library/user-event** (^14.5.2)
  - Simulação de interações do usuário
  - Mais realista que `fireEvent`

- **jsdom** (^25.0.1)
  - Implementação de DOM em Node.js
  - Necessário para testar componentes React

### Estilização

- **tailwindcss** (^3.4.0)
  - Framework CSS utility-first
  - Estilização rápida e consistente

- **postcss** (^8.4.0)
  - Ferramenta para transformar CSS
  - Usado pelo Tailwind CSS

- **autoprefixer** (^10.4.0)
  - Adiciona prefixos de vendor automaticamente
  - Compatibilidade com navegadores antigos

### Utilitários

- **dotenv** (^16.4.7)
  - Carrega variáveis de ambiente de arquivos .env
  - Usado em scripts Node.js

## Instalação

### Método 1: Instalação Automática (Recomendado)

```bash
# Linux/Mac
./scripts/install-requirements.sh

# Windows
scripts\install-requirements.bat

# Ou via npm
npm run install:requirements
```

### Método 2: Instalação Manual

```bash
# 1. Usar versão correta do Node.js
nvm use  # ou nvm install 18.0.0

# 2. Instalar dependências
npm install
```

### Método 3: Usando requirements.txt

O arquivo `requirements.txt` pode ser usado como referência, mas não é executável diretamente. Use `npm install` que lê o `package.json`.

## Verificação de Instalação

Após instalar, verifique se tudo está correto:

```bash
# Verificar versão do Node.js
node --version  # Deve ser >= 18.0.0

# Verificar se dependências foram instaladas
npm list --depth=0

# Executar testes
npm test
```

## Atualização de Dependências

### Atualizar todas as dependências

```bash
npm update
```

### Atualizar dependência específica

```bash
npm install nome-do-pacote@latest
```

### Verificar dependências desatualizadas

```bash
npm outdated
```

## Gerar requirements.txt

Para regenerar o arquivo `requirements.txt` a partir do `package.json`:

```bash
npm run generate:requirements
```

## Compatibilidade

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0 (vem com Node.js 18+)
- **Sistemas Operacionais**: Windows, Linux, macOS

## Notas Importantes

1. **Versões fixas**: `@supabase/supabase-js` usa versão fixa (sem ^) para garantir compatibilidade com Edge Functions
2. **TypeScript**: Versão ~5.8.2 (compatível com 5.8.x)
3. **React 19**: Versão mais recente, requer Node.js 18+
4. **Vite 6**: Versão mais recente do Vite, muito mais rápido que versões anteriores

## Troubleshooting

### Erro: "Cannot find module"

```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Node version mismatch"

```bash
# Usar versão correta do Node.js
nvm use
# ou
nvm install 18.0.0
nvm use 18.0.0
```

### Erro: "Permission denied" (Linux/Mac)

```bash
# Não usar sudo com npm
# Se necessário, corrigir permissões:
sudo chown -R $(whoami) ~/.npm
```
