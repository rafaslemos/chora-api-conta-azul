-- ============================================================================
-- Migration 001: Criar Schemas Dedicados
-- ============================================================================
-- Este script cria os schemas dedicados para organização do banco de dados:
-- - app_core: Tabelas e funções principais da aplicação (auth, tenants, credenciais)
-- - integrations: Tabelas e funções de integração (se necessário no futuro)
-- - dw: Tabelas e views do Data Warehouse para consumo via API
-- ============================================================================

-- Criar schema app_core (tabelas principais da aplicação)
CREATE SCHEMA IF NOT EXISTS app_core;

COMMENT ON SCHEMA app_core IS 'Schema principal da aplicação: autenticação, tenants, credenciais e auditoria';

-- Criar schema integrations (para integrações futuras, se necessário)
CREATE SCHEMA IF NOT EXISTS integrations;

COMMENT ON SCHEMA integrations IS 'Schema para integrações e fluxos de dados';

-- Criar schema dw (Data Warehouse)
CREATE SCHEMA IF NOT EXISTS dw;

COMMENT ON SCHEMA dw IS 'Schema do Data Warehouse: dados consolidados para consumo via API';

-- Conceder permissões básicas (ajustar conforme necessário)
GRANT USAGE ON SCHEMA app_core TO authenticated;
GRANT USAGE ON SCHEMA app_core TO anon;
GRANT USAGE ON SCHEMA app_core TO service_role; -- Necessário para Edge Functions acessarem RPCs
GRANT USAGE ON SCHEMA integrations TO authenticated;
GRANT USAGE ON SCHEMA integrations TO service_role; -- Necessário caso Edge Functions precisem acessar RPCs
GRANT USAGE ON SCHEMA dw TO authenticated;
GRANT USAGE ON SCHEMA dw TO anon;
GRANT USAGE ON SCHEMA dw TO service_role; -- Necessário para Edge Function dw-api acessar RPCs
