-- ============================================================================
-- Migração: Adicionar campo config JSONB na tabela tenant_credentials
-- ============================================================================
-- Esta migração adiciona o campo config para armazenar configurações
-- específicas da plataforma (ex: plano Olist)
-- ============================================================================

-- Adicionar campo config à tabela tenant_credentials
ALTER TABLE public.tenant_credentials
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.tenant_credentials.config IS 'Configurações específicas da plataforma em formato JSON (ex: plano Olist, rate limits, etc)';

