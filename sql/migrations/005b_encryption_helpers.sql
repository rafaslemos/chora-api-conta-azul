-- ============================================================================
-- Migration 005b: Funções de criptografia (app_core)
-- ============================================================================
-- get_encryption_key, encrypt_token, decrypt_token.
-- Necessárias para 006 (app_config) e 032 (credenciais). Run-migrations
-- fica auto-contido: não depende do setup-database para criptografia.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Função: Obter chave de criptografia
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_encryption_key()
RETURNS TEXT AS $$
BEGIN
    -- Em produção, buscar do Supabase Vault:
    -- RETURN current_setting('app.settings.encryption_key', true);
    -- Por enquanto, usar chave padrão (DEVE SER ALTERADA EM PRODUÇÃO)
    RETURN COALESCE(
        current_setting('app.settings.encryption_key', true),
        'default_key_change_in_production'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_encryption_key() IS 'Retorna a chave de criptografia (deve vir do Supabase Vault em produção)';

-- ----------------------------------------------------------------------------
-- Função: Criptografar token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.encrypt_token(p_token TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_token IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt(p_token::bytea, p_key::bytea, 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION app_core.encrypt_token IS 'Criptografa um token usando AES com a chave fornecida';

-- ----------------------------------------------------------------------------
-- Função: Descriptografar token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.decrypt_token(p_encrypted_token TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_encrypted_token IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt(decode(p_encrypted_token, 'base64'), p_key::bytea, 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION app_core.decrypt_token IS 'Descriptografa um token usando AES com a chave fornecida';
