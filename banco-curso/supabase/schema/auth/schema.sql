-- Schema do Supabase para Autenticação OAuth 2.0 Conta Azul
-- Criação das tabelas com RLS, índices e triggers

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: credenciais_dev
-- Armazena credenciais OAuth obtidas do Portal Dev
-- ============================================
CREATE TABLE IF NOT EXISTS credenciais_dev (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT NOT NULL UNIQUE,
    client_secret TEXT NOT NULL, -- Será criptografado via RPC
    redirect_uri TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para credenciais_dev
CREATE INDEX IF NOT EXISTS idx_credenciais_dev_client_id ON credenciais_dev(client_id);
CREATE INDEX IF NOT EXISTS idx_credenciais_dev_created_at ON credenciais_dev(created_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_credenciais_dev_updated_at ON credenciais_dev;
CREATE TRIGGER update_credenciais_dev_updated_at
    BEFORE UPDATE ON credenciais_dev
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: clientes
-- Armazena clientes cadastrados com API Key
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    nome_responsavel TEXT NOT NULL,
    contato TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    api_key_hash TEXT NOT NULL UNIQUE, -- Hash da API Key para validação
    credenciais_dev_id UUID NOT NULL REFERENCES credenciais_dev(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas se não existirem (para compatibilidade com tabelas existentes)
DO $$ 
BEGIN
    -- Adicionar nome_responsavel se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='nome_responsavel') THEN
        -- Se a tabela tem dados, adiciona como nullable primeiro, depois atualiza e torna NOT NULL
        IF EXISTS (SELECT 1 FROM clientes LIMIT 1) THEN
            ALTER TABLE clientes ADD COLUMN nome_responsavel TEXT;
            UPDATE clientes SET nome_responsavel = nome WHERE nome_responsavel IS NULL;
            ALTER TABLE clientes ALTER COLUMN nome_responsavel SET NOT NULL;
        ELSE
            ALTER TABLE clientes ADD COLUMN nome_responsavel TEXT NOT NULL;
        END IF;
    END IF;
    
    -- Adicionar contato se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='contato') THEN
        IF EXISTS (SELECT 1 FROM clientes LIMIT 1) THEN
            ALTER TABLE clientes ADD COLUMN contato TEXT;
            UPDATE clientes SET contato = COALESCE(email, '') WHERE contato IS NULL;
            ALTER TABLE clientes ALTER COLUMN contato SET NOT NULL;
        ELSE
            ALTER TABLE clientes ADD COLUMN contato TEXT NOT NULL;
        END IF;
    END IF;
    
    -- Adicionar telefone se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='telefone') THEN
        IF EXISTS (SELECT 1 FROM clientes LIMIT 1) THEN
            ALTER TABLE clientes ADD COLUMN telefone TEXT;
            UPDATE clientes SET telefone = '' WHERE telefone IS NULL;
            ALTER TABLE clientes ALTER COLUMN telefone SET NOT NULL;
        ELSE
            ALTER TABLE clientes ADD COLUMN telefone TEXT NOT NULL;
        END IF;
    END IF;
END $$;

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_credenciais_dev_id ON clientes(credenciais_dev_id);
CREATE INDEX IF NOT EXISTS idx_clientes_api_key_hash ON clientes(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON clientes(created_at DESC);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: tokens_oauth
-- Armazena tokens OAuth por cliente com criptografia e RLS
-- ============================================
CREATE TABLE IF NOT EXISTS tokens_oauth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- Criptografado via RPC
    refresh_token TEXT NOT NULL, -- Criptografado via RPC
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id) -- Um token por cliente
);

-- Índices para tokens_oauth
CREATE INDEX IF NOT EXISTS idx_tokens_oauth_cliente_id ON tokens_oauth(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tokens_oauth_expires_at ON tokens_oauth(expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_oauth_created_at ON tokens_oauth(created_at DESC);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_tokens_oauth_updated_at ON tokens_oauth;
CREATE TRIGGER update_tokens_oauth_updated_at
    BEFORE UPDATE ON tokens_oauth
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS na tabela tokens_oauth
ALTER TABLE tokens_oauth ENABLE ROW LEVEL SECURITY;

-- Política RLS: Bloquear acesso direto (apenas via RPC)
DROP POLICY IF EXISTS "block_direct_access_tokens_oauth" ON tokens_oauth;
CREATE POLICY "block_direct_access_tokens_oauth" 
    ON tokens_oauth 
    FOR ALL 
    USING (false);

-- Comentários nas tabelas
COMMENT ON TABLE credenciais_dev IS 'Armazena credenciais OAuth obtidas do Portal Dev da Conta Azul';
COMMENT ON TABLE clientes IS 'Armazena clientes cadastrados com API Key para autenticação JWT';
COMMENT ON TABLE tokens_oauth IS 'Armazena tokens OAuth criptografados por cliente. Acesso apenas via funções RPC.';

COMMENT ON COLUMN credenciais_dev.client_secret IS 'Será criptografado antes de inserir via RPC';
COMMENT ON COLUMN clientes.api_key_hash IS 'Hash da API Key gerada no cadastro. Usado para validação e geração de JWT';
COMMENT ON COLUMN tokens_oauth.access_token IS 'Token de acesso criptografado usando pgcrypto';
COMMENT ON COLUMN tokens_oauth.refresh_token IS 'Token de renovação criptografado usando pgcrypto';

