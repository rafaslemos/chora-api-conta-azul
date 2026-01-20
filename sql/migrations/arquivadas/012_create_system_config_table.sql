-- ============================================================================
-- Migração: Criar tabela system_config
-- ============================================================================
-- Esta migração cria a tabela para armazenar configurações globais do sistema
-- como credenciais do Supabase (url_base, anon_key, service_role_key)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- Comentários
COMMENT ON TABLE public.system_config IS 'Configurações globais do sistema (Supabase, n8n, etc.)';
COMMENT ON COLUMN public.system_config.key IS 'Chave única da configuração (ex: supabase_url_base, supabase_anon_key, supabase_service_role_key)';
COMMENT ON COLUMN public.system_config.value IS 'Valor da configuração (criptografado se is_encrypted = true)';
COMMENT ON COLUMN public.system_config.is_encrypted IS 'Indica se o valor está criptografado no banco';
COMMENT ON COLUMN public.system_config.updated_by IS 'Usuário que fez a última atualização';

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(key);

-- Habilitar RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Admins can view all system config" ON public.system_config;
DROP POLICY IF EXISTS "Admins can insert system config" ON public.system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON public.system_config;
DROP POLICY IF EXISTS "System can read system config" ON public.system_config;

-- Política: Apenas ADMIN pode ver configurações
CREATE POLICY "Admins can view all system config"
    ON public.system_config FOR SELECT
    USING (public.is_admin(auth.uid()));

-- Política: Sistema pode ler configurações (para n8n via Service Role)
CREATE POLICY "System can read system config"
    ON public.system_config FOR SELECT
    USING (true);

-- Política: Apenas ADMIN pode inserir configurações
CREATE POLICY "Admins can insert system config"
    ON public.system_config FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- Política: Apenas ADMIN pode atualizar configurações
CREATE POLICY "Admins can update system config"
    ON public.system_config FOR UPDATE
    USING (public.is_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_config_updated_at
    BEFORE UPDATE ON public.system_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
