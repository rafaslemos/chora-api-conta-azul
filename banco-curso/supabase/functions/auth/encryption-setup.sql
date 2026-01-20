-- Configuração de Criptografia usando pgcrypto
-- Funções auxiliares para criptografar e descriptografar tokens

-- Habilitar extensão pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para obter chave de criptografia
-- Usa variável de ambiente ENCRYPTION_KEY ou chave padrão
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT AS $$
BEGIN
    -- Tenta obter da variável de ambiente, senão usa chave padrão
    -- IMPORTANTE: Em produção, configure ENCRYPTION_KEY no Supabase
    RETURN COALESCE(
        current_setting('app.encryption_key', true),
        'default-encryption-key-change-in-production-32chars!!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criptografar token
CREATE OR REPLACE FUNCTION encrypt_token(token_text TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    encryption_key := get_encryption_key();
    
    -- Criptografa usando pgp_sym_encrypt com algoritmo AES-256
    RETURN encode(
        pgp_sym_encrypt(
            token_text,
            encryption_key,
            'compress-algo=1, cipher-algo=aes256'
        ),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar token
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    encryption_key := get_encryption_key();
    
    -- Descriptografa usando pgp_sym_decrypt
    RETURN pgp_sym_decrypt(
        decode(encrypted_token, 'base64'),
        encryption_key
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de erro (token inválido, chave errada, etc)
        RAISE EXCEPTION 'Erro ao descriptografar token: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION encrypt_token IS 'Criptografa um token usando AES-256. Retorna token em base64.';
COMMENT ON FUNCTION decrypt_token IS 'Descriptografa um token criptografado. Retorna token em texto plano.';
COMMENT ON FUNCTION get_encryption_key IS 'Obtém chave de criptografia da variável de ambiente ou usa padrão.';

