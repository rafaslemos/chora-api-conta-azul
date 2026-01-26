-- ============================================================================
-- Script de Diagnóstico: Verificar Permissões e Configurações
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para diagnosticar problemas
-- com as configurações da Conta Azul
-- ============================================================================

-- 1. Verificar se as permissões de schema foram aplicadas
SELECT 
  'Permissões de Schema' as categoria,
  nspname as schema_name,
  rolname as role_name,
  CASE 
    WHEN has_schema_privilege(rolname, nspname, 'USAGE') THEN '✅ TEM PERMISSÃO'
    ELSE '❌ SEM PERMISSÃO'
  END as status
FROM pg_namespace n
CROSS JOIN pg_roles r
WHERE nspname IN ('app_core', 'dw', 'integrations', 'integrations_conta_azul')
  AND rolname = 'service_role'
ORDER BY nspname;

-- 2. Verificar se os dados estão na tabela app_config
SELECT 
  'Dados em app_config' as categoria,
  key,
  CASE 
    WHEN is_encrypted THEN '[ENCRYPTED - ' || LENGTH(value) || ' chars]'
    ELSE LEFT(value, 30) || '... (' || LENGTH(value) || ' chars)'
  END as value_preview,
  is_encrypted,
  description,
  created_at,
  updated_at
FROM app_core.app_config
WHERE key IN ('conta_azul_client_id', 'conta_azul_client_secret')
ORDER BY key;

-- 3. Testar se as funções RPC estão acessíveis
SELECT 
  'Teste RPC get_conta_azul_client_id' as categoria,
  app_core.get_conta_azul_client_id() as resultado,
  CASE 
    WHEN app_core.get_conta_azul_client_id() IS NOT NULL THEN '✅ FUNCIONANDO'
    ELSE '❌ RETORNA NULL'
  END as status;

SELECT 
  'Teste RPC get_app_config(client_id)' as categoria,
  app_core.get_app_config('conta_azul_client_id') as resultado,
  CASE 
    WHEN app_core.get_app_config('conta_azul_client_id') IS NOT NULL THEN '✅ FUNCIONANDO'
    ELSE '❌ RETORNA NULL'
  END as status;

-- 4. Verificar se as funções RPC existem e têm permissões
SELECT 
  'Funções RPC' as categoria,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  r.rolname as role_name,
  CASE 
    WHEN has_function_privilege(r.rolname, p.oid, 'EXECUTE') THEN '✅ TEM EXECUTE'
    ELSE '❌ SEM EXECUTE'
  END as execute_permission
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'app_core'
  AND p.proname IN ('get_app_config', 'get_conta_azul_client_id', 'get_conta_azul_client_secret')
  AND r.rolname = 'service_role'
ORDER BY p.proname;

-- 5. Verificar se o schema app_core está exposto (via informação do PostgREST)
-- Nota: Isso não pode ser verificado diretamente via SQL, mas podemos verificar
-- se as funções estão acessíveis
SELECT 
  'Resumo' as categoria,
  COUNT(DISTINCT nspname) FILTER (WHERE has_schema_privilege('service_role', nspname, 'USAGE')) as schemas_com_permissao,
  COUNT(DISTINCT nspname) as total_schemas_verificados,
  CASE 
    WHEN COUNT(DISTINCT nspname) FILTER (WHERE has_schema_privilege('service_role', nspname, 'USAGE')) = COUNT(DISTINCT nspname) 
    THEN '✅ TODAS AS PERMISSÕES OK'
    ELSE '❌ FALTAM PERMISSÕES'
  END as status_geral
FROM pg_namespace
WHERE nspname IN ('app_core', 'dw', 'integrations', 'integrations_conta_azul');
