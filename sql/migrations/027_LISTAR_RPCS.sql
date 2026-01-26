-- ============================================================================
-- Script: Listar Todas as Funções RPC Disponíveis no Supabase
-- ============================================================================
-- Este script lista todas as funções que podem ser chamadas via RPC
-- através do PostgREST (REST API do Supabase)
-- ============================================================================

-- ============================================================================
-- 1. Listar Todas as Funções RPC por Schema
-- ============================================================================
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE 
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        ELSE 'VOLATILE'
    END as volatility,
    obj_description(p.oid, 'pg_proc') as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_%'
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

-- ============================================================================
-- 2. Listar Apenas Funções RPC do Schema app_core
-- ============================================================================
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE 
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    obj_description(p.oid, 'pg_proc') as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'app_core'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- ============================================================================
-- 3. Listar Funções RPC com Permissões GRANT EXECUTE
-- ============================================================================
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    r.rolname as role_name,
    CASE 
        WHEN has_function_privilege(r.rolname, p.oid, 'EXECUTE') THEN '✅ SIM'
        ELSE '❌ NÃO'
    END as tem_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname IN ('app_core', 'integrations', 'integrations_conta_azul', 'dw', 'public')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
  AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
ORDER BY n.nspname, p.proname, r.rolname;

-- ============================================================================
-- 4. Listar Funções RPC de Configuração (app_core)
-- ============================================================================
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    obj_description(p.oid, 'pg_proc') as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'app_core'
  AND p.proname LIKE '%config%'
ORDER BY p.proname;

-- ============================================================================
-- 5. Verificar Código Fonte da Função get_app_config
-- ============================================================================
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'app_core'
  AND p.proname = 'get_app_config';
