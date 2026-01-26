-- ============================================================================
-- Migration 025: Corrigir Permissões de Schema para service_role
-- ============================================================================
-- Adiciona GRANT USAGE no schema app_core para service_role
-- Necessário para Edge Functions acessarem funções RPC no schema app_core
-- 
-- PROBLEMA IDENTIFICADO:
-- As Edge Functions usam service_role para chamar RPCs no schema app_core,
-- mas o service_role não tinha permissão USAGE no schema, causando erro 42501
-- "permission denied for schema app_core"
-- ============================================================================

-- Conceder permissão de uso do schema app_core para service_role
-- Isso permite que Edge Functions (que usam service_role) chamem funções RPC
-- no schema app_core, como get_app_config, get_conta_azul_client_id, etc.
GRANT USAGE ON SCHEMA app_core TO service_role;

-- Conceder permissão de uso do schema dw para service_role
-- Necessário para Edge Function dw-api chamar RPCs como dw.hash_api_key e dw.validate_api_key
GRANT USAGE ON SCHEMA dw TO service_role;

-- Conceder permissão de uso dos schemas integrations para service_role
-- Necessário caso Edge Functions futuras precisem chamar RPCs nesses schemas
-- (ex: integrations.rpc_get_controle_carga, integrations_conta_azul.rpc_upsert_categorias)
GRANT USAGE ON SCHEMA integrations TO service_role;
GRANT USAGE ON SCHEMA integrations_conta_azul TO service_role;

-- Comentários para documentação
COMMENT ON SCHEMA app_core IS 'Schema principal da aplicação: autenticação, tenants, credenciais e auditoria. service_role tem USAGE para permitir Edge Functions acessarem RPCs.';
COMMENT ON SCHEMA dw IS 'Schema do Data Warehouse: dados consolidados para consumo via API. service_role tem USAGE para permitir Edge Functions (dw-api) acessarem RPCs.';
