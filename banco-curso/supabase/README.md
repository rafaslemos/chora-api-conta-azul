# Supabase - Banco de Dados

Este diretório contém todos os scripts SQL para configuração do banco de dados Supabase, organizados por módulo.

## Estrutura

```
supabase/
├── functions/          # Funções RPC (Remote Procedure Calls)
│   ├── auth/          # Funções de autenticação OAuth 2.0
│   └── coleta/        # Funções de coleta de dados
├── schema/            # Schemas SQL (tabelas, índices, triggers)
│   ├── auth/          # Schemas de autenticação
│   └── coleta/        # Schemas de coleta de dados
└── README.md          # Este arquivo
```

## Instalação

### 1. Autenticação (Obrigatório - Base do Sistema)

Execute na ordem:

```sql
-- 1. Configuração de criptografia e JWT
\i functions/auth/encryption-setup.sql
\i functions/auth/jwt-setup.sql

-- 2. Schema de autenticação (tabelas base)
\i schema/auth/schema.sql

-- 3. Funções RPC de autenticação
\i functions/auth/rpc-functions.sql
```

### 2. Coleta de Dados (Opcional)

Execute após instalar autenticação:

```sql
-- 1. Schemas de coleta (tabelas de controle e dados)
\i schema/coleta/schema-coleta.sql
\i schema/coleta/schema-categorias.sql

-- 2. Funções RPC de coleta
\i functions/coleta/rpc-coleta.sql
```

## Módulos

### Autenticação (`auth/`)
Sistema completo de autenticação OAuth 2.0 para integração com API Conta Azul.

**Tabelas:**
- `credenciais_dev` - Credenciais OAuth do Portal Dev
- `clientes` - Clientes cadastrados com API Key
- `tokens_oauth` - Tokens OAuth criptografados

**Funções RPC:**
- Gerenciamento de credenciais
- Autenticação via API Key
- Gerenciamento de tokens OAuth
- Renovação automática de tokens

### Coleta de Dados (`coleta/`)
Sistema de coleta e sincronização de dados da API Conta Azul.

**Tabelas:**
- `controle_carga` - Controle de carga FULL e incremental
- `config_periodicidade` - Configuração de periodicidade
- `categorias` - Categorias coletadas
- (outras tabelas de entidades conforme implementação)

**Funções RPC:**
- Controle de carga FULL/incremental
- Renovação de token para coletas
- Upsert de dados coletados

## Segurança

- **Criptografia**: `client_secret` e tokens OAuth são criptografados usando pgcrypto
- **RLS**: Row Level Security habilitado em tabelas sensíveis
- **JWT**: Validação JWT em funções RPC que manipulam dados sensíveis
- **SECURITY DEFINER**: Funções RPC usam `SECURITY DEFINER` para bypassar RLS quando necessário

## Documentação Detalhada

- [`functions/README.md`](functions/README.md) - Documentação das funções RPC
- [`schema/README.md`](schema/README.md) - Documentação dos schemas

## Notas Importantes

1. **Ordem de Execução**: Sempre execute os scripts de autenticação primeiro
2. **Dependências**: Schemas de coleta dependem de tabelas criadas em `auth/schema.sql`
3. **Funções Auxiliares**: `update_updated_at_column()` é criada em `auth/schema.sql` e usada em outros schemas
4. **Extensões**: `uuid-ossp` e `pgcrypto` são habilitadas automaticamente nos scripts
