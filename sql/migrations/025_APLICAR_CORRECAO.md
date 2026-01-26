# Como Aplicar a Correção da Migration 025

## Problema
As Edge Functions não conseguem acessar funções RPC no schema `app_core` porque o `service_role` não tem permissão `USAGE` no schema.

**Erro observado:**
- `42501: permission denied for schema app_core`
- `PGRST202: Could not find the function app_core.get_conta_azul_client_secret`

## Solução

A migration 025 adiciona `GRANT USAGE ON SCHEMA app_core TO service_role;`

## Opções para Aplicar

### Opção 1: Via SQL Editor do Supabase (RECOMENDADO - Mais Rápido)

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole e execute o seguinte SQL:

```sql
-- Migration 025: Corrigir Permissões de Schema para service_role
-- Adiciona GRANT USAGE nos schemas para service_role
-- Necessário para Edge Functions acessarem funções RPC nos schemas

-- Schema app_core: usado por todas as Edge Functions principais
GRANT USAGE ON SCHEMA app_core TO service_role;

-- Schema dw: usado pela Edge Function dw-api (dw.hash_api_key, dw.validate_api_key)
GRANT USAGE ON SCHEMA dw TO service_role;

-- Schema integrations: usado por RPCs de controle de carga
GRANT USAGE ON SCHEMA integrations TO service_role;

-- Schema integrations_conta_azul: usado por RPCs de upsert de dados
GRANT USAGE ON SCHEMA integrations_conta_azul TO service_role;
```

4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Verifique se a mensagem de sucesso aparece

### Opção 2: Via Edge Function run-migrations

Se você preferir usar a Edge Function (útil para ambientes automatizados):

1. A migration 025 já está incluída no array de migrations
2. Chame a Edge Function `run-migrations` normalmente
3. A migration será executada automaticamente

### Opção 3: Via CLI do Supabase (se estiver usando localmente)

```bash
supabase db reset
# ou
psql -h db.[seu-projeto].supabase.co -U postgres -d postgres -f sql/migrations/025_fix_service_role_schema_permissions.sql
```

## Verificação

Após aplicar a correção, teste novamente a autenticação da Conta Azul. O erro `42501` não deve mais aparecer.

Para verificar se a permissão foi aplicada:

```sql
SELECT 
  nspname as schema_name,
  rolname as role_name
FROM pg_namespace n
JOIN pg_namespace_acl na ON n.oid = na.nspacl
JOIN pg_roles r ON na.grantee = r.oid
WHERE nspname = 'app_core' 
  AND rolname = 'service_role';
```

## Nota Importante

Esta correção também foi aplicada nas migrations futuras:
- `sql/migrations/001_create_schemas.sql` - Atualizado (app_core, integrations, dw)
- `sql/migrations/006_create_integrations_schemas.sql` - Atualizado (integrations_conta_azul)
- `supabase/functions/setup-database/index.ts` - MIGRATION_001 e MIGRATION_006 atualizados
- `supabase/functions/run-migrations/index.ts` - MIGRATION_001_SCHEMAS atualizado
- `supabase/functions/run-migrations-integrations/index.ts` - MIGRATION_006 atualizado

Projetos novos criados após essas atualizações já terão todas as permissões corretas desde o início.

## Schemas Corrigidos

A migration 025 adiciona `GRANT USAGE` para `service_role` nos seguintes schemas:

1. **app_core** - Usado por todas as Edge Functions principais (exchange-conta-azul-token, get-valid-token, etc.)
2. **dw** - Usado pela Edge Function dw-api para chamar `dw.hash_api_key` e `dw.validate_api_key`
3. **integrations** - Usado por RPCs de controle de carga (caso Edge Functions futuras precisem)
4. **integrations_conta_azul** - Usado por RPCs de upsert de dados (caso Edge Functions futuras precisem)
