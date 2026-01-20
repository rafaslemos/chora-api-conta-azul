-- Configuração JWT
-- Funções para gerar e validar JWT tokens
-- Nota: pgjwt pode não estar disponível, então vamos usar uma abordagem híbrida
-- A validação completa será feita no código JavaScript, mas criamos funções auxiliares aqui

-- Função auxiliar para gerar hash da API Key (usando crypt do pgcrypto)
CREATE OR REPLACE FUNCTION hash_api_key(api_key TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Usa crypt do pgcrypto para gerar hash seguro
    -- Usa blowfish (bf) com 10 rounds (padrão seguro)
    RETURN crypt(api_key, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para verificar API Key
CREATE OR REPLACE FUNCTION verify_api_key(api_key TEXT, api_key_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Compara API Key com hash usando crypt
    RETURN (crypt(api_key, api_key_hash) = api_key_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar cliente por API Key
CREATE OR REPLACE FUNCTION get_cliente_by_api_key(api_key TEXT)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    email TEXT,
    api_key_hash TEXT,
    credenciais_dev_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.nome,
        c.email,
        c.api_key_hash,
        c.credenciais_dev_id,
        c.created_at
    FROM clientes c
    WHERE verify_api_key(api_key, c.api_key_hash) = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION hash_api_key IS 'Gera hash seguro da API Key usando blowfish. Retorna hash para armazenamento.';
COMMENT ON FUNCTION verify_api_key IS 'Verifica se API Key corresponde ao hash armazenado. Retorna true se válido.';
COMMENT ON FUNCTION get_cliente_by_api_key IS 'Busca cliente por API Key. Retorna dados do cliente se API Key for válida.';

-- ============================================
-- Funções Auxiliares para Geração de JWT
-- ============================================

-- Função para codificar string em base64url
DROP FUNCTION IF EXISTS base64url_encode(TEXT);
CREATE OR REPLACE FUNCTION base64url_encode(str TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Codifica em base64 e converte para base64url
    -- Remove padding (=) e substitui caracteres especiais
    RETURN trim(trailing '=' from
        replace(
            replace(
                encode(convert_to(str, 'UTF8'), 'base64'),
                '+', '-'
            ),
            '/', '_'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para decodificar string de base64url
DROP FUNCTION IF EXISTS base64url_decode(TEXT);
CREATE OR REPLACE FUNCTION base64url_decode(str TEXT)
RETURNS TEXT AS $$
DECLARE
    base64_str TEXT;
BEGIN
    -- Converte base64url para base64
    base64_str := replace(replace(str, '-', '+'), '_', '/');
    
    -- Adiciona padding se necessário
    WHILE length(base64_str) % 4 != 0 LOOP
        base64_str := base64_str || '=';
    END LOOP;
    
    -- Decodifica
    RETURN convert_from(decode(base64_str, 'base64'), 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar hash SHA256 simples (para api_key_hash no payload)
DROP FUNCTION IF EXISTS hash_string_simple(TEXT);
CREATE OR REPLACE FUNCTION hash_string_simple(str TEXT)
RETURNS TEXT AS $$
DECLARE
    v_hash_hex TEXT;
BEGIN
    -- Gera hash SHA256 e converte para hexadecimal
    v_hash_hex := encode(digest(str, 'sha256'), 'hex');
    
    -- Retorna primeiros 16 caracteres
    RETURN substring(v_hash_hex, 1, 16);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar HMAC-SHA256
DROP FUNCTION IF EXISTS hmac_sha256(TEXT, TEXT);
CREATE OR REPLACE FUNCTION hmac_sha256(data TEXT, secret TEXT)
RETURNS TEXT AS $$
DECLARE
    v_hmac_result BYTEA;
BEGIN
    -- Gera HMAC-SHA256 (retorna bytea)
    v_hmac_result := hmac(data, secret, 'sha256');
    
    -- Converte bytea para base64 e depois para base64url
    RETURN trim(trailing '=' from
        replace(
            replace(
                encode(v_hmac_result, 'base64'),
                '+', '-'
            ),
            '/', '_'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função principal para gerar JWT token
DROP FUNCTION IF EXISTS generate_jwt_token(UUID, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION generate_jwt_token(
    cliente_id UUID,
    api_key TEXT,
    expires_in_hours INTEGER DEFAULT 24
)
RETURNS TEXT AS $$
DECLARE
    v_header TEXT;
    v_payload TEXT;
    v_encoded_header TEXT;
    v_encoded_payload TEXT;
    v_signature TEXT;
    v_now BIGINT;
BEGIN
    -- Calcular timestamp atual
    v_now := extract(epoch from now())::BIGINT;
    
    -- Criar header JWT
    v_header := json_build_object(
        'alg', 'HS256',
        'typ', 'JWT'
    )::text;
    
    -- Criar payload JWT
    v_payload := json_build_object(
        'cliente_id', cliente_id::text,
        'api_key_hash', hash_string_simple(api_key),
        'iat', v_now,
        'exp', v_now + (expires_in_hours * 3600)
    )::text;
    
    -- Codificar header e payload em base64url
    v_encoded_header := base64url_encode(v_header);
    v_encoded_payload := base64url_encode(v_payload);
    
    -- Criar assinatura HMAC-SHA256
    v_signature := hmac_sha256(v_encoded_header || '.' || v_encoded_payload, api_key);
    
    -- Retornar JWT completo
    RETURN v_encoded_header || '.' || v_encoded_payload || '.' || v_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION base64url_encode IS 'Codifica string em base64url (base64 com substituições para URL-safe)';
COMMENT ON FUNCTION base64url_decode IS 'Decodifica string de base64url para texto';
COMMENT ON FUNCTION hash_string_simple IS 'Gera hash SHA256 simples (primeiros 16 caracteres) para uso no payload JWT';
COMMENT ON FUNCTION hmac_sha256 IS 'Gera assinatura HMAC-SHA256 e codifica em base64url';
COMMENT ON FUNCTION generate_jwt_token IS 'Gera JWT token completo assinado com API Key usando HMAC-SHA256';

