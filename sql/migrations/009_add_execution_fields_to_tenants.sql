-- ============================================================================
-- Migração: Adicionar campos de controle de execução em tenant_credentials
-- ============================================================================
-- Esta migração adiciona campos para controlar carga inicial e última execução
-- por plataforma (cada tenant pode ter múltiplas plataformas)
-- ============================================================================

ALTER TABLE public.tenant_credentials
ADD COLUMN IF NOT EXISTS primeira_execucao BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS data_ultima_execucao DATE;

-- Comentários
COMMENT ON COLUMN public.tenant_credentials.primeira_execucao IS 'Indica se é a primeira execução desta plataforma (carga inicial de 30 dias)';
COMMENT ON COLUMN public.tenant_credentials.data_ultima_execucao IS 'Data da última execução bem-sucedida desta plataforma';

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_primeira_execucao ON public.tenant_credentials(primeira_execucao) WHERE primeira_execucao = TRUE;
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_data_ultima_execucao ON public.tenant_credentials(data_ultima_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_platform_primeira_execucao ON public.tenant_credentials(platform, primeira_execucao) WHERE primeira_execucao = TRUE;

