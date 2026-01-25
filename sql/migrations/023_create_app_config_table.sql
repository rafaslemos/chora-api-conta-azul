-- ============================================================================
-- Migration 023: Criar Tabela de Configurações Globais do App
-- ============================================================================
-- Tabela para armazenar configurações globais como Client ID e Client Secret
-- da Conta Azul, permitindo configuração via setup e acesso centralizado
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: app_config (configurações globais)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Comentários
COMMENT ON TABLE app_core.app_config IS 'Configurações globais do sistema (Client ID/Secret Conta Azul, API Keys, etc.)';
COMMENT ON COLUMN app_core.app_config.key IS 'Chave única da configuração (ex: conta_azul_client_id, conta_azul_client_secret, system_api_key)';
COMMENT ON COLUMN app_core.app_config.value IS 'Valor da configuração (criptografado se is_encrypted = true)';
COMMENT ON COLUMN app_core.app_config.is_encrypted IS 'Indica se o valor está criptografado no banco';
COMMENT ON COLUMN app_core.app_config.updated_by IS 'Usuário que fez a última atualização';

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_core.app_config(key);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_app_config_updated_at
    BEFORE UPDATE ON app_core.app_config
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE app_core.app_config ENABLE ROW LEVEL SECURITY;

-- Permissões GRANT na tabela app_config (necessárias mesmo com RLS)
GRANT SELECT ON app_core.app_config TO authenticated;
GRANT SELECT ON app_core.app_config TO anon; -- Anon pode precisar acessar Client ID público

-- ----------------------------------------------------------------------------
-- Políticas RLS
-- ----------------------------------------------------------------------------

-- Política: Apenas ADMIN pode ver todas as configurações
DROP POLICY IF EXISTS "Admins can view all app config" ON app_core.app_config;
CREATE POLICY "Admins can view all app config"
    ON app_core.app_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Política: Usuários autenticados podem ver configurações públicas (is_encrypted = false)
DROP POLICY IF EXISTS "Authenticated can view public config" ON app_core.app_config;
CREATE POLICY "Authenticated can view public config"
    ON app_core.app_config FOR SELECT
    USING (
        auth.role() = 'authenticated' AND is_encrypted = FALSE
    );

-- Política: Anon pode ver apenas configurações públicas específicas (Client ID)
DROP POLICY IF EXISTS "Anon can view public client id" ON app_core.app_config;
CREATE POLICY "Anon can view public client id"
    ON app_core.app_config FOR SELECT
    USING (
        auth.role() = 'anon' AND key = 'conta_azul_client_id' AND is_encrypted = FALSE
    );

-- Política: Apenas ADMIN pode inserir configurações
DROP POLICY IF EXISTS "Admins can insert app config" ON app_core.app_config;
CREATE POLICY "Admins can insert app config"
    ON app_core.app_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_core.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Política: Apenas ADMIN pode atualizar configurações
DROP POLICY IF EXISTS "Admins can update app config" ON app_core.app_config;
CREATE POLICY "Admins can update app config"
    ON app_core.app_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Nota: Service Role (usado pelo setup-database) pode bypassar RLS usando SECURITY DEFINER nas funções RPC
