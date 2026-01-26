# Troubleshooting: Problemas com Configuração Conta Azul

## Problema Persistente

Mesmo após aplicar a migration 025, o erro continua:
- `Configuração da Conta Azul não encontrada`
- `500 Internal Server Error`

## Checklist de Diagnóstico

### 1. Verificar se a Migration 025 foi Aplicada

Execute no SQL Editor:

```sql
-- Verificar permissões de schema
SELECT 
  nspname as schema_name,
  has_schema_privilege('service_role', nspname, 'USAGE') as tem_permissao
FROM pg_namespace
WHERE nspname IN ('app_core', 'dw', 'integrations', 'integrations_conta_azul');
```

**Resultado esperado:** Todas devem retornar `true`

**Se alguma retornar `false`:**
- Execute a migration 025 novamente (veja `025_APLICAR_CORRECAO.md`)

### 2. Verificar se os Dados Estão na Tabela

Execute:

```sql
SELECT 
  key,
  CASE 
    WHEN is_encrypted THEN '[ENCRYPTED]'
    ELSE LEFT(value, 50) || '...'
  END as value_preview,
  is_encrypted,
  LENGTH(value) as tamanho,
  created_at,
  updated_at
FROM app_core.app_config
WHERE key IN ('conta_azul_client_id', 'conta_azul_client_secret')
ORDER BY key;
```

**Resultado esperado:**
- `conta_azul_client_id` deve existir e não estar vazio
- `conta_azul_client_secret` deve existir e não estar vazio
- `is_encrypted` deve ser `false` para client_id e `true` para client_secret

**Se os dados não existirem:**
- Execute o setup novamente ou insira manualmente via `set_app_config`

### 3. Testar Funções RPC Diretamente

Execute:

```sql
-- Teste 1: get_app_config direto
SELECT 
  'get_app_config(client_id)' as teste,
  app_core.get_app_config('conta_azul_client_id') as resultado,
  CASE 
    WHEN app_core.get_app_config('conta_azul_client_id') IS NOT NULL 
    THEN '✅ OK' 
    ELSE '❌ NULL' 
  END as status;

-- Teste 2: get_conta_azul_client_id
SELECT 
  'get_conta_azul_client_id()' as teste,
  app_core.get_conta_azul_client_id() as resultado,
  CASE 
    WHEN app_core.get_conta_azul_client_id() IS NOT NULL 
    THEN '✅ OK' 
    ELSE '❌ NULL' 
  END as status;

-- Teste 3: get_conta_azul_client_secret (pode retornar NULL se não for Service Role)
SELECT 
  'get_conta_azul_client_secret()' as teste,
  app_core.get_conta_azul_client_secret() as resultado,
  CASE 
    WHEN app_core.get_conta_azul_client_secret() IS NOT NULL 
    THEN '✅ OK' 
    ELSE '⚠️ NULL (pode ser normal se não for Service Role)' 
  END as status;
```

**Resultado esperado:**
- `get_app_config` e `get_conta_azul_client_id` devem retornar valores não-nulos
- `get_conta_azul_client_secret` pode retornar NULL se executado como usuário normal (não Service Role)

### 4. Verificar Permissões EXECUTE nas Funções

Execute:

```sql
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as tem_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'app_core'
  AND p.proname IN ('get_app_config', 'get_conta_azul_client_id', 'get_conta_azul_client_secret')
ORDER BY p.proname;
```

**Resultado esperado:** Todas devem ter `tem_execute = true`

### 5. Verificar Cache do PostgREST

O PostgREST (que gerencia as chamadas RPC) mantém um cache de schema. Se as funções foram criadas recentemente ou as permissões foram alteradas, o cache pode estar desatualizado.

**Soluções:**

**Opção A: Reiniciar o Projeto (Recomendado)**
1. Acesse Supabase Dashboard → Settings → General
2. Clique em "Restart Project"
3. Aguarde alguns minutos
4. Teste novamente

**Opção B: Aguardar Atualização Automática**
- O cache do PostgREST é atualizado automaticamente, mas pode levar alguns minutos
- Aguarde 5-10 minutos e teste novamente

**Opção C: Recarregar Schema Manualmente (via API)**
- Não há endpoint público para isso, mas o restart do projeto força o recarregamento

### 6. Verificar Logs da Edge Function

1. Acesse Supabase Dashboard → Edge Functions → `exchange-conta-azul-token` → Logs
2. Procure pelos logs detalhados que adicionamos:
   - `[exchange-conta-azul-token] Teste direto get_app_config(conta_azul_client_id)`
   - `[exchange-conta-azul-token] RPC get_conta_azul_client_id response`

**O que verificar:**
- Se ainda aparece erro `42501`: Permissões não foram aplicadas ou cache não atualizou
- Se aparece erro `PGRST202`: Função não encontrada no cache do PostgREST
- Se `hasData: false` mas sem erro: Dados não estão na tabela ou função retorna NULL

### 7. Verificar se o Schema está Exposto

1. Acesse Supabase Dashboard → Settings → API → Exposed Schemas
2. Verifique se `app_core` está marcado
3. Se não estiver, marque e salve

**Nota:** Isso é necessário para o PostgREST expor as funções RPC do schema.

## Soluções por Problema

### Problema: Erro 42501 ainda aparece

**Causa:** Permissões não foram aplicadas ou cache não atualizou

**Solução:**
1. Execute a migration 025 novamente
2. Reinicie o projeto no Supabase Dashboard
3. Aguarde 5 minutos
4. Teste novamente

### Problema: Erro PGRST202 (função não encontrada)

**Causa:** Cache do PostgREST desatualizado

**Solução:**
1. Reinicie o projeto no Supabase Dashboard
2. Aguarde alguns minutos
3. Teste novamente

### Problema: Funções retornam NULL mas dados existem

**Causa:** Problema com descriptografia ou função get_app_config

**Solução:**
1. Verifique se `get_encryption_key()` está funcionando:
```sql
SELECT app_core.get_encryption_key() as encryption_key;
```

2. Teste descriptografia manual:
```sql
SELECT 
  app_core.decrypt_token(
    (SELECT value FROM app_core.app_config WHERE key = 'conta_azul_client_secret'),
    app_core.get_encryption_key()
  ) as decrypted_secret;
```

### Problema: Dados não existem na tabela

**Causa:** Setup não foi executado ou dados não foram salvos

**Solução:**
1. Execute o setup novamente via app ou Edge Function setup-config
2. Ou insira manualmente:
```sql
SELECT app_core.set_app_config('conta_azul_client_id', 'SEU_CLIENT_ID', 'Client ID da Conta Azul', false);
SELECT app_core.set_app_config('conta_azul_client_secret', 'SEU_CLIENT_SECRET', 'Client Secret da Conta Azul', true);
```

## Script de Diagnóstico Completo

Execute o arquivo `025_DIAGNOSTICO.sql` para uma verificação completa de todos os itens acima.

## Próximos Passos

Após resolver o problema:

1. ✅ Teste a autenticação novamente
2. ✅ Verifique os logs da Edge Function
3. ✅ Confirme que não há mais erros 42501 ou PGRST202

Se o problema persistir após seguir todos os passos acima, verifique:
- Versão do Supabase (algumas versões podem ter bugs conhecidos)
- Se há outras Edge Functions com problemas similares
- Logs completos do Supabase para erros adicionais
