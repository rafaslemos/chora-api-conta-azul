# Chora API - Integração Conta Azul

Plataforma web para gerenciamento de integrações com a API da Conta Azul, permitindo que clientes (tenants) conectem múltiplas autenticações Conta Azul e acessem dados consolidados via Data Warehouse.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração Inicial](#configuração-inicial)
- [Executando o Projeto](#executando-o-projeto)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Deploy](#deploy)
- [Documentação Adicional](#documentação-adicional)
- [Troubleshooting](#troubleshooting)

## 🎯 Sobre o Projeto

Este projeto é uma aplicação web desenvolvida para gerenciar integrações exclusivamente com a API da Conta Azul. Principais funcionalidades:

- ✅ **Multi-autenticação**: Um cliente pode ter múltiplas autenticações Conta Azul
- ✅ **Nomenclatura de credenciais**: Cada credencial pode ser nomeada para identificação no DW
- ✅ **Data Warehouse**: Acesso read-only aos dados consolidados via API única por cliente
- ✅ **Setup automático**: Configuração inicial do banco de dados via interface web
- ✅ **Segurança**: Criptografia de tokens, RLS (Row Level Security), auditoria completa

## 🛠 Tecnologias

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Autenticação**: Supabase Auth + OAuth 2.0 (Conta Azul)
- **Banco de Dados**: PostgreSQL com schemas dedicados (`app_core`, `integrations`, `dw`)
- **Deploy**: Vercel (frontend) + Supabase (backend)

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** >= 18.0.0 (versão recomendada: 18.0.0, especificada no `.nvmrc`)
- **npm** (vem com Node.js) ou **yarn**
- **Git**
- **nvm** (opcional, mas recomendado para gerenciar versões do Node.js)
- Conta no **Supabase** (para criar um novo projeto)
- Credenciais da **Conta Azul** (Client ID e Client Secret)

### Verificar Instalação

```bash
# Verificar versão do Node.js
node --version  # Deve ser >= 18.0.0

# Verificar versão do npm
npm --version

# Se usar nvm, usar versão correta automaticamente
nvm use  # Lê o arquivo .nvmrc
```

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd chora-api-conta-azul
```

### 2. Instale as dependências

Você tem três opções para instalar as dependências:

#### Opção A: Instalação Automática (Recomendado)

```bash
# Linux/Mac
./scripts/install-requirements.sh

# Windows
scripts\install-requirements.bat

# Ou via npm (funciona em todos os sistemas)
npm run install:requirements
```

Este script verifica automaticamente:
- ✅ Se Node.js está instalado
- ✅ Se a versão é >= 18.0.0
- ✅ Se npm está disponível
- ✅ Instala todas as dependências

#### Opção B: Instalação Manual

```bash
# Usar versão correta do Node.js (se usar nvm)
nvm use  # ou nvm install 18.0.0

# Instalar dependências
npm install
```

#### Opção C: Usando requirements.txt (Referência)

O arquivo `requirements.txt` está disponível como referência (formato estilo Python), mas não é executável diretamente. Use `npm install` que lê o `package.json`.

**📚 Para mais detalhes sobre as dependências, consulte [`REQUIREMENTS.md`](REQUIREMENTS.md)**

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase (será configurado via setup automático ou manualmente)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui

# Conta Azul (opcional - pode ser configurado via setup)
VITE_CONTA_AZUL_REDIRECT_URI=http://localhost:3000/auth/conta-azul/callback
```

**⚠️ IMPORTANTE**: O arquivo `.env.local` não deve ser commitado no Git. Ele já está no `.gitignore`.

## ⚙️ Configuração Inicial

Você tem duas opções para configurar o projeto: **Setup Automático** (recomendado) ou **Setup Manual**.

### Opção 1: Setup Automático via App (Recomendado)

Esta é a forma mais simples e rápida de configurar o projeto. A tela `/setup` segue um fluxo em **3 fases** (1 → 2 → 3): verificação de variáveis de ambiente, validação do schema exposto e configuração completa. Veja [CHECKLIST_SETUP_PRATICO.md](doc/CHECKLIST_SETUP_PRATICO.md) para detalhes.

#### Passo 1: Criar Projeto no Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com/)
2. Clique em **"New Project"**
3. Configure:
   - **Name**: `contaazul-api` (ou outro nome)
   - **Database Password**: Anote em local seguro (será necessário)
   - **Region**: Escolha a região mais próxima
   - **Pricing Plan**: Escolha conforme necessidade
4. Aguarde a criação (pode levar alguns minutos)

#### Passo 2: Obter Credenciais do Supabase

Após criar o projeto, vá em **Settings > API** e copie:

- **Project URL** → será usado como `SUPABASE_URL`
- **anon/public key** → será usado como `SUPABASE_ANON_KEY`
- **service_role key** → será usado como `SERVICE_ROLE_KEY` (manter segredo!)

#### Passo 3: Executar o App e Acessar Setup

```bash
npm run dev
```

1. Abra o navegador em `http://localhost:3000`
2. Você será redirecionado automaticamente para `/setup`
3. Preencha o formulário com:
   - **Supabase URL**: URL do projeto
   - **Supabase Anon Key**: Chave pública
   - **Service Role Key**: Chave de serviço (usada apenas uma vez)
   - **Database Password**: Senha do PostgreSQL (opcional)
     - Se fornecido: migrations serão executadas automaticamente
     - Se não fornecido: você receberá as migrations SQL para executar manualmente
   - **Conta Azul Client ID**: Client ID da sua aplicação Conta Azul
   - **Conta Azul Client Secret**: Client Secret da sua aplicação Conta Azul
   - **System API Key**: Chave gerada automaticamente (ou personalize)

4. Clique em **"Executar Setup"**

#### Passo 4: Configurações Manuais Necessárias

Após o setup automático, você ainda precisa configurar manualmente:

**a) Exposed Schemas** (Settings > API > Exposed Schemas):
- Marque: `app_core`
- Marque: `dw`
- **NÃO** marque: `integrations`

**b) Edge Functions Secrets** (Settings > Edge Functions > Secrets):
```
CA_CLIENT_ID=seu_client_id_aqui
CA_CLIENT_SECRET=seu_client_secret_aqui
SYSTEM_API_KEY=chave_gerada_no_setup
```

**c) Deploy das Edge Functions**:

Use o fluxo **setup-config** + **run-migrations\*** (não `setup-database`). Veja [CHECKLIST_SETUP_PRATICO.md](doc/CHECKLIST_SETUP_PRATICO.md) para o passo a passo completo.

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Linkar ao projeto
supabase link --project-ref <seu-project-ref>

# Deploy das Edge Functions de setup (com --no-verify-jwt)
supabase functions deploy setup-config --no-verify-jwt
supabase functions deploy run-migrations --no-verify-jwt
supabase functions deploy run-migrations-integrations --no-verify-jwt
supabase functions deploy run-migrations-dw --no-verify-jwt

# Deploy das Edge Functions de operação
supabase functions deploy exchange-conta-azul-token
supabase functions deploy get-conta-azul-accounts
supabase functions deploy get-conta-azul-categories
supabase functions deploy get-valid-token
supabase functions deploy dw-api
```

**d) Configurar Redirect URLs**:

- **Supabase**: Settings > Authentication > URL Configuration
  - Adicione: `http://localhost:3000/auth/conta-azul/callback`
- **Conta Azul**: Portal do desenvolvedor
  - Adicione: `http://localhost:3000/auth/conta-azul/callback`

### Opção 2: Setup Manual

Se preferir configurar manualmente, siga o guia completo em [`doc/PROVISIONAMENTO_NOVO_SUPABASE.md`](doc/PROVISIONAMENTO_NOVO_SUPABASE.md).

## 🏃 Executando o Projeto

### Desenvolvimento

```bash
npm run dev
```

O app estará disponível em `http://localhost:3000` (porta configurada no `vite.config.ts`)

### Build para Produção

```bash
npm run build
```

Os arquivos de produção estarão na pasta `dist/`.

### Preview da Build

```bash
npm run preview
```

## 📁 Estrutura do Projeto

```
chora-api-conta-azul/
├── components/          # Componentes React reutilizáveis
│   ├── Layout.tsx      # Layout principal com navegação
│   └── ui/             # Componentes de UI (Button, Dropdown, etc.)
├── contexts/           # Contextos React (TenantContext)
├── hooks/              # Custom hooks
├── lib/                # Bibliotecas e utilitários
│   ├── supabase.ts    # Cliente Supabase configurável
│   └── n8n.ts         # Integração com n8n
├── pages/              # Páginas da aplicação
│   ├── SetupInitial.tsx    # Página de setup inicial
│   ├── Login.tsx           # Login
│   ├── Credentials.tsx      # Gerenciamento de credenciais
│   ├── Dashboard.tsx        # Dashboard principal
│   └── ...
├── services/           # Serviços de API e lógica de negócio
│   ├── setupService.ts      # Serviço de setup
│   ├── authService.ts       # Autenticação
│   ├── credentialService.ts # Gerenciamento de credenciais
│   └── ...
├── sql/                # Scripts SQL e migrations
│   └── migrations/    # Migrations em ordem (001-026)
├── supabase/
│   └── functions/     # Edge Functions do Supabase
│       ├── setup-config/            # Orquestrador do setup
│       ├── run-migrations/          # Fase 1: app_core, RLS, create_or_update_profile
│       ├── run-migrations-integrations/  # Fase 2: integrações Conta Azul
│       ├── run-migrations-dw/       # Fase 3: Data Warehouse
│       ├── exchange-conta-azul-token/ # OAuth token exchange
│       ├── get-valid-token/         # Obter token válido
│       └── dw-api/                  # API do Data Warehouse
├── utils/             # Utilitários
├── doc/               # Documentação adicional
└── README.md          # Este arquivo
```

## 🚢 Deploy

### Frontend (Vercel)

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CONTA_AZUL_REDIRECT_URI` (URL de produção)
3. Deploy automático será feito a cada push

### Backend (Supabase)

As Edge Functions já estão configuradas. Para deploy:

```bash
supabase functions deploy <nome-da-funcao>
```

### Configurações de Produção

**Supabase**:
- Configure Redirect URLs de produção em Authentication > URL Configuration
- Configure Exposed Schemas
- Configure Edge Functions Secrets

**Conta Azul**:
- Adicione a URL de produção como Redirect URI no portal do desenvolvedor

## 📚 Documentação Adicional

- [`doc/CHECKLIST_SETUP_PRATICO.md`](doc/CHECKLIST_SETUP_PRATICO.md) - **Checklist prático para setup do zero** (recomendado para novos ambientes)
- [`doc/PROVISIONAMENTO_NOVO_SUPABASE.md`](doc/PROVISIONAMENTO_NOVO_SUPABASE.md) - Guia completo de provisionamento
- [`doc/AUTENTICACAO_CONTA_AZUL.md`](doc/AUTENTICACAO_CONTA_AZUL.md) - Fluxo de autenticação OAuth com Conta Azul
- [`doc/DW_API_DOCUMENTACAO.md`](doc/DW_API_DOCUMENTACAO.md) - Documentação da API do Data Warehouse
- [`README_DATABASE.md`](README_DATABASE.md) - Estrutura do banco de dados
- [`sql/migrations/`](sql/migrations/) - Migrations SQL em ordem

## 🔧 Troubleshooting

### Erro: "Banco não configurado"

**Solução**: Acesse `/setup` e execute o setup automático ou configure manualmente seguindo [`doc/PROVISIONAMENTO_NOVO_SUPABASE.md`](doc/PROVISIONAMENTO_NOVO_SUPABASE.md).

### Erro: "SERVICE_ROLE_KEY inválido"

**Solução**: Verifique se copiou a chave correta em Settings > API > service_role key. Certifique-se de não ter espaços extras.

### Erro: "Edge Function não encontrada"

**Solução**: Faça deploy das Edge Functions de setup (`setup-config`, `run-migrations`, `run-migrations-integrations`, `run-migrations-dw`) com `--no-verify-jwt`. Veja [CHECKLIST_SETUP_PRATICO.md](doc/CHECKLIST_SETUP_PRATICO.md).

### Erro ao cadastrar usuário (404 em create_or_update_profile, etc.)

**Solução**: A RPC `app_core.create_or_update_profile` é criada na Fase 1 do setup (007_profile_rpc em `run-migrations`). Garanta que o setup foi executado com sucesso (incluindo `run-migrations`) antes de testar o cadastro.

### Erro: "Schema não encontrado"

**Solução**: Execute as migrations via setup automático (app) ou manualmente no SQL Editor do Supabase na ordem: 001, 002, 003, ... (veja [sql/migrations/](sql/migrations/)).

### Erro: "RLS bloqueando acesso"

**Solução**: 
- Verifique se os Exposed Schemas estão configurados (`app_core` e `dw`)
- Verifique se as políticas RLS foram criadas (migration 005)
- Teste com um usuário autenticado

### Erro: "OAuth redirect não funciona"

**Solução**:
- Verifique se a URL no `.env.local` corresponde exatamente à configurada na Conta Azul
- Certifique-se de que não há trailing slash (exceto raiz)
- Verifique se o projeto Supabase está ativo

### Erro: "CORS"

**Solução**: Certifique-se de que as Edge Functions foram deployadas e estão acessíveis.

### Variável `VITE_SKIP_DB_CHECK` (opcional, ex. Vercel)

Defina `VITE_SKIP_DB_CHECK=true` (no Vercel ou `.env`) **após** o setup estável e Exposed Schemas ok. O app deixa de consultar o banco nessa verificação. Não use antes do setup estar completo. Veja [CHECKLIST_SETUP_PRATICO.md](doc/CHECKLIST_SETUP_PRATICO.md).

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Testes
npm test              # Executar todos os testes
npm run test:watch    # Executar testes em modo watch
npm run test:ui       # Executar testes com UI interativa
npm run test:coverage # Gerar relatório de cobertura

# Listar workflows do n8n
npm run list-n8n-workflows

# Analisar workflows do n8n
npm run analyze-n8n-workflows

# Gerar constantes de migrations
npm run generate-migration-constants

# Gerar requirements.txt a partir do package.json
npm run generate:requirements
```

## 🔧 Melhorias Implementadas

### ✅ Sistema de Logging Centralizado

O projeto agora possui um sistema de logging centralizado (`services/logger.ts`) que:
- Suporta diferentes níveis de log (debug, info, warn, error)
- Formata logs de forma consistente
- Armazena histórico em desenvolvimento
- Pronto para integração com serviços de monitoramento (Sentry, etc.)

**Uso:**
```typescript
import { logger } from './services/logger';

logger.info('Operação concluída', { operationId: '123' });
logger.error('Erro na operação', error, { context: 'signup' });
```

### ✅ Correção de Race Condition no SignUp

O método `signUp` agora usa polling com retry ao invés de delays fixos, garantindo robustez mesmo em ambientes lentos ou sob carga.

### ✅ Correção de Memory Leaks

Todos os componentes React agora usam o hook `useTimeout` (`hooks/useTimeout.ts`) que gerencia timeouts com cleanup automático, prevenindo memory leaks e atualizações de estado após unmount.

**Arquivos corrigidos:**
- `pages/Login.tsx`
- `pages/Register.tsx`
- `pages/Integrations.tsx`
- `pages/Settings.tsx`
- `pages/Analytics.tsx`
- `pages/ResetPassword.tsx`
- `pages/OnboardingWizard.tsx`
- `pages/SetupInitial.tsx`

### ✅ Setup de Testes

O projeto agora possui configuração completa de testes com Vitest:
- Configuração em `vitest.config.ts`
- Setup de testes em `src/test/setup.ts`
- Mocks do Supabase em `src/test/mocks/supabase.ts`
- Exemplos de testes em `services/authService.test.ts` e `components/ui/Button.test.tsx`

**Executar testes:**
```bash
npm test              # Executar todos os testes
npm run test:watch    # Modo watch
npm run test:ui       # UI interativa
npm run test:coverage # Relatório de cobertura
```

### 📚 Guia de Melhorias

Para mais detalhes sobre como implementar melhorias adicionais, consulte [`doc/GUIA_MELHORIAS.md`](doc/GUIA_MELHORIAS.md).

## 🔐 Segurança

- ✅ Tokens são criptografados no banco de dados
- ✅ Row Level Security (RLS) habilitado em todas as tabelas
- ✅ Service Role Key usado apenas uma vez durante setup
- ✅ Secrets das Edge Functions não expostos no frontend
- ✅ Auditoria completa de ações

**⚠️ IMPORTANTE**: Em produção, altere a chave de criptografia padrão. Veja [`README_DATABASE.md`](README_DATABASE.md) para mais detalhes.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado e proprietário.

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a documentação em [`doc/`](doc/)
2. Verifique os logs no Supabase Dashboard
3. Abra uma issue no repositório

---

**Desenvolvido com ❤️ para integrações Conta Azul**
