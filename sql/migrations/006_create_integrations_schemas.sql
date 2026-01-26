-- ============================================================================
-- Migration 006: Criar Schema de Integração Conta Azul
-- ============================================================================
-- Cria o schema específico para dados da Conta Azul.
-- Nota: O schema 'integrations' (compartilhado) já foi criado na migration 001.
-- ============================================================================

-- Criar schema integrations_conta_azul (específico da Conta Azul)
CREATE SCHEMA IF NOT EXISTS integrations_conta_azul;

COMMENT ON SCHEMA integrations_conta_azul IS 'Schema específico para dados coletados da API Conta Azul (categorias, pessoas, produtos, vendas, contas financeiras, etc.)';

-- Conceder permissões básicas
GRANT USAGE ON SCHEMA integrations_conta_azul TO authenticated;
GRANT USAGE ON SCHEMA integrations_conta_azul TO anon;
GRANT USAGE ON SCHEMA integrations_conta_azul TO service_role; -- Necessário caso Edge Functions precisem acessar RPCs

-- Nota: As permissões específicas de SELECT/INSERT/UPDATE/DELETE serão configuradas
-- através de RLS (Row Level Security) nas migrations de RLS
