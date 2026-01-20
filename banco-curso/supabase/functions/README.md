# Funções RPC do Supabase

Este diretório contém todas as funções RPC (Remote Procedure Calls) organizadas por módulo.

## Estrutura

### `auth/` - Autenticação OAuth 2.0
Funções relacionadas à autenticação e gerenciamento de tokens OAuth.

- **`encryption-setup.sql`** - Configuração de criptografia (pgcrypto)
- **`jwt-setup.sql`** - Configuração de JWT e funções auxiliares
- **`rpc-functions.sql`** - Funções RPC de autenticação:
  - `rpc_insert_credenciais_dev()` - Inserir credenciais OAuth
  - `rpc_get_latest_credencial()` - Buscar credencial mais recente
  - `rpc_insert_cliente()` - Inserir cliente e gerar API Key
  - `rpc_authenticate()` - Autenticar via API Key
  - `rpc_get_cliente_by_uuid()` - Buscar cliente por UUID
  - `rpc_get_credenciais_by_cliente_id()` - Buscar credenciais do cliente
  - `rpc_save_tokens()` - Salvar tokens OAuth
  - `rpc_get_token_by_cliente_id()` - Buscar token OAuth
  - `rpc_refresh_token()` - Renovar token OAuth
  - `rpc_list_credenciais()` - Listar credenciais
  - `rpc_list_tokens_expiring_soon()` - Listar tokens próximos de expirar
  - Funções `_simple` para processos internos (sem validação JWT)

### `coleta/` - Coleta de Dados
Funções relacionadas ao sistema de coleta de dados da API Conta Azul.

- **`rpc-coleta.sql`** - Funções RPC de coleta:
  - `rpc_get_token_data_for_refresh()` - Obter dados para renovação de token
  - `rpc_get_controle_carga()` - Buscar controle de carga
  - `rpc_update_controle_carga_full()` - Atualizar controle de carga FULL
  - `rpc_update_controle_carga_incremental()` - Atualizar controle de carga incremental
  - `rpc_list_all_clientes()` - Listar todos os clientes
  - `rpc_upsert_categorias()` - Upsert de categorias

## Ordem de Execução

### Para Autenticação:
1. `auth/encryption-setup.sql`
2. `auth/jwt-setup.sql`
3. `auth/rpc-functions.sql`

### Para Coleta de Dados:
1. Executar schemas em `schema/coleta/`
2. `coleta/rpc-coleta.sql`

## Notas

- Todas as funções usam `SECURITY DEFINER` para bypassar RLS quando necessário
- Funções que manipulam dados sensíveis validam JWT
- Funções `_simple` são para processos internos e não validam JWT
