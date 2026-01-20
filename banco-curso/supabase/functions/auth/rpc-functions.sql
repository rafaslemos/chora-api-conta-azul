-- Funções RPC para todas as operações
-- Todas as funções que manipulam dados sensíveis validam JWT
-- As funções usam SECURITY DEFINER para bypassar RLS quando necessário

-- ============================================
-- RPC: Inserir Credenciais Dev
-- ============================================
DROP FUNCTION IF EXISTS rpc_insert_credenciais_dev(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION rpc_insert_credenciais_dev(
    p_client_id TEXT,
    p_client_secret TEXT,
    p_redirect_uri TEXT
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
    v_encrypted_secret TEXT;
BEGIN
    -- Criptografar client_secret antes de inserir
    v_encrypted_secret := encrypt_token(p_client_secret);
    
    -- Inserir credenciais
    INSERT INTO credenciais_dev (client_id, client_secret, redirect_uri)
    VALUES (p_client_id, v_encrypted_secret, p_redirect_uri)
    RETURNING id INTO v_id;
    
    -- Retornar sucesso com ID
    RETURN json_build_object(
        'success', true,
        'id', v_id,
        'message', 'Credenciais cadastradas com sucesso'
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'client_id já existe'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Credencial Mais Recente
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_latest_credencial();
CREATE OR REPLACE FUNCTION rpc_get_latest_credencial()
RETURNS JSON AS $$
DECLARE
    v_credencial RECORD;
BEGIN
    -- Buscar a credencial mais recente
    SELECT id, client_id, redirect_uri, created_at
    INTO v_credencial
    FROM credenciais_dev
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Se não encontrou, retornar erro
    IF v_credencial.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Nenhuma credencial encontrada. Cadastre uma credencial primeiro.'
        );
    END IF;
    
    -- Retornar credencial
    RETURN json_build_object(
        'success', true,
        'id', v_credencial.id,
        'client_id', v_credencial.client_id,
        'redirect_uri', v_credencial.redirect_uri,
        'created_at', v_credencial.created_at
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Inserir Cliente (gera API Key e JWT)
-- ============================================
-- Remover versões antigas com assinaturas diferentes
DROP FUNCTION IF EXISTS rpc_insert_cliente(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS rpc_insert_cliente(TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION rpc_insert_cliente(
    p_nome TEXT,
    p_nome_responsavel TEXT,
    p_contato TEXT,
    p_telefone TEXT,
    p_email TEXT,
    p_credenciais_dev_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_cliente_id UUID;
    v_api_key TEXT;
    v_api_key_hash TEXT;
    v_jwt_token TEXT;
BEGIN
    -- Gerar UUID para cliente
    v_cliente_id := uuid_generate_v4();
    
    -- Gerar API Key (formato: ca_ + UUID aleatório de 32 caracteres)
    v_api_key := 'ca_' || replace(uuid_generate_v4()::TEXT, '-', '') || replace(uuid_generate_v4()::TEXT, '-', '');
    v_api_key := substring(v_api_key, 1, 35); -- Garantir tamanho fixo
    
    -- Gerar hash da API Key
    v_api_key_hash := hash_api_key(v_api_key);
    
    -- Inserir cliente
    INSERT INTO clientes (id, nome, nome_responsavel, contato, telefone, email, api_key_hash, credenciais_dev_id)
    VALUES (v_cliente_id, p_nome, p_nome_responsavel, p_contato, p_telefone, p_email, v_api_key_hash, p_credenciais_dev_id);
    
    -- Gerar JWT token usando a API Key como secret
    v_jwt_token := generate_jwt_token(v_cliente_id, v_api_key, 24);
    
    -- Retornar dados do cliente com API Key e JWT (exibida apenas uma vez)
    RETURN json_build_object(
        'success', true,
        'cliente_id', v_cliente_id,
        'api_key', v_api_key, -- Exibida apenas uma vez!
        'jwt_token', v_jwt_token, -- JWT gerado no PostgreSQL
        'message', 'Cliente cadastrado com sucesso. Guarde a API Key com segurança!'
    );
EXCEPTION
    WHEN foreign_key_violation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'credenciais_dev_id não encontrado'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Autenticar via API Key (gera JWT)
-- ============================================
DROP FUNCTION IF EXISTS rpc_authenticate(TEXT);
CREATE OR REPLACE FUNCTION rpc_authenticate(p_api_key TEXT)
RETURNS JSON AS $$
DECLARE
    v_cliente RECORD;
BEGIN
    -- Buscar cliente por API Key
    SELECT * INTO v_cliente
    FROM get_cliente_by_api_key(p_api_key);
    
    -- Se não encontrou, retornar erro
    IF v_cliente.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'API Key inválida'
        );
    END IF;
    
    -- Retornar dados do cliente (JWT será gerado no código JavaScript)
    RETURN json_build_object(
        'success', true,
        'cliente_id', v_cliente.id,
        'nome', v_cliente.nome,
        'email', v_cliente.email,
        'api_key_hash', v_cliente.api_key_hash, -- Para gerar JWT no código
        'message', 'Autenticação bem-sucedida'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Cliente por UUID (com validação JWT)
-- Nota: Validação completa de JWT será feita no código
-- Aqui apenas validamos que o cliente_id do JWT corresponde ao UUID
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_cliente_by_uuid(UUID, UUID);
CREATE OR REPLACE FUNCTION rpc_get_cliente_by_uuid(
    p_cliente_uuid UUID,
    p_jwt_cliente_id UUID -- Cliente ID extraído do JWT no código
)
RETURNS JSON AS $$
DECLARE
    v_cliente RECORD;
BEGIN
    -- Validar que o cliente_id do JWT corresponde ao UUID
    IF p_jwt_cliente_id != p_cliente_uuid THEN
        RETURN json_build_object(
            'success', false,
            'error', 'JWT não autorizado para este cliente'
        );
    END IF;
    
    -- Buscar cliente
    SELECT id, nome, email, credenciais_dev_id, created_at
    INTO v_cliente
    FROM clientes
    WHERE id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_cliente.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cliente não encontrado'
        );
    END IF;
    
    -- Retornar dados do cliente (sem api_key_hash)
    RETURN json_build_object(
        'success', true,
        'cliente', json_build_object(
            'id', v_cliente.id,
            'nome', v_cliente.nome,
            'email', v_cliente.email,
            'credenciais_dev_id', v_cliente.credenciais_dev_id,
            'created_at', v_cliente.created_at
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Credenciais por Cliente ID (com validação JWT)
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_credenciais_by_cliente_id(UUID, UUID);
CREATE OR REPLACE FUNCTION rpc_get_credenciais_by_cliente_id(
    p_cliente_uuid UUID,
    p_jwt_cliente_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_credenciais RECORD;
    v_decrypted_secret TEXT;
BEGIN
    -- Validar JWT
    IF p_jwt_cliente_id != p_cliente_uuid THEN
        RETURN json_build_object(
            'success', false,
            'error', 'JWT não autorizado para este cliente'
        );
    END IF;
    
    -- Buscar credenciais associadas ao cliente
    SELECT cd.id, cd.client_id, cd.client_secret, cd.redirect_uri
    INTO v_credenciais
    FROM credenciais_dev cd
    INNER JOIN clientes c ON c.credenciais_dev_id = cd.id
    WHERE c.id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_credenciais.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Credenciais não encontradas para este cliente'
        );
    END IF;
    
    -- Descriptografar client_secret
    v_decrypted_secret := decrypt_token(v_credenciais.client_secret);
    
    -- Retornar credenciais descriptografadas
    RETURN json_build_object(
        'success', true,
        'credenciais', json_build_object(
            'id', v_credenciais.id,
            'client_id', v_credenciais.client_id,
            'client_secret', v_decrypted_secret,
            'redirect_uri', v_credenciais.redirect_uri
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Salvar Tokens OAuth (com validação JWT e criptografia)
-- ============================================
DROP FUNCTION IF EXISTS rpc_save_tokens(UUID, TEXT, TEXT, INTEGER, UUID);
CREATE OR REPLACE FUNCTION rpc_save_tokens(
    p_cliente_uuid UUID,
    p_access_token TEXT,
    p_refresh_token TEXT,
    p_expires_in INTEGER,
    p_jwt_cliente_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_token_id UUID;
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Validar JWT
    IF p_jwt_cliente_id != p_cliente_uuid THEN
        RETURN json_build_object(
            'success', false,
            'error', 'JWT não autorizado para este cliente'
        );
    END IF;
    
    -- Criptografar tokens
    v_encrypted_access_token := encrypt_token(p_access_token);
    v_encrypted_refresh_token := encrypt_token(p_refresh_token);
    
    -- Calcular expires_at
    v_expires_at := NOW() + (COALESCE(p_expires_in, 3600) || ' seconds')::INTERVAL;
    
    -- UPSERT na tabela tokens_oauth
    INSERT INTO tokens_oauth (
        cliente_id,
        access_token,
        refresh_token,
        expires_at,
        token_type
    )
    VALUES (
        p_cliente_uuid,
        v_encrypted_access_token,
        v_encrypted_refresh_token,
        v_expires_at,
        'Bearer'
    )
    ON CONFLICT (cliente_id) DO UPDATE
    SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        token_type = EXCLUDED.token_type,
        updated_at = NOW()
    RETURNING id INTO v_token_id;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'token_id', v_token_id,
        'expires_at', v_expires_at,
        'message', 'Tokens salvos com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Token por Cliente ID (com validação JWT e descriptografia)
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_token_by_cliente_id(UUID, UUID);
CREATE OR REPLACE FUNCTION rpc_get_token_by_cliente_id(
    p_cliente_uuid UUID,
    p_jwt_cliente_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_token RECORD;
    v_decrypted_access_token TEXT;
    v_decrypted_refresh_token TEXT;
BEGIN
    -- Validar JWT
    IF p_jwt_cliente_id != p_cliente_uuid THEN
        RETURN json_build_object(
            'success', false,
            'error', 'JWT não autorizado para este cliente'
        );
    END IF;
    
    -- Buscar token
    SELECT id, access_token, refresh_token, expires_at, token_type
    INTO v_token
    FROM tokens_oauth
    WHERE cliente_id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_token.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Token não encontrado para este cliente'
        );
    END IF;
    
    -- Verificar se token não expirou
    IF v_token.expires_at <= NOW() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Token expirado',
            'expires_at', v_token.expires_at
        );
    END IF;
    
    -- Descriptografar tokens
    v_decrypted_access_token := decrypt_token(v_token.access_token);
    v_decrypted_refresh_token := decrypt_token(v_token.refresh_token);
    
    -- Retornar tokens descriptografados
    RETURN json_build_object(
        'success', true,
        'token', json_build_object(
            'id', v_token.id,
            'access_token', v_decrypted_access_token,
            'refresh_token', v_decrypted_refresh_token,
            'expires_at', v_token.expires_at,
            'token_type', v_token.token_type
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Renovar Token (com validação JWT e criptografia)
-- ============================================
DROP FUNCTION IF EXISTS rpc_refresh_token(UUID, TEXT, TEXT, INTEGER, UUID);
CREATE OR REPLACE FUNCTION rpc_refresh_token(
    p_cliente_uuid UUID,
    p_new_access_token TEXT,
    p_new_refresh_token TEXT,
    p_expires_in INTEGER,
    p_jwt_cliente_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Validar JWT
    IF p_jwt_cliente_id != p_cliente_uuid THEN
        RETURN json_build_object(
            'success', false,
            'error', 'JWT não autorizado para este cliente'
        );
    END IF;
    
    -- Criptografar novos tokens
    v_encrypted_access_token := encrypt_token(p_new_access_token);
    v_encrypted_refresh_token := encrypt_token(p_new_refresh_token);
    
    -- Calcular expires_at
    v_expires_at := NOW() + (COALESCE(p_expires_in, 3600) || ' seconds')::INTERVAL;
    
    -- Atualizar tokens
    UPDATE tokens_oauth
    SET
        access_token = v_encrypted_access_token,
        refresh_token = v_encrypted_refresh_token,
        expires_at = v_expires_at,
        updated_at = NOW()
    WHERE cliente_id = p_cliente_uuid;
    
    -- Verificar se atualizou
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Token não encontrado para este cliente'
        );
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'expires_at', v_expires_at,
        'message', 'Token renovado com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Listar Credenciais (com validação JWT)
-- ============================================
DROP FUNCTION IF EXISTS rpc_list_credenciais(UUID);
CREATE OR REPLACE FUNCTION rpc_list_credenciais(p_jwt_cliente_id UUID)
RETURNS JSON AS $$
DECLARE
    v_credenciais JSON;
BEGIN
    -- Validar JWT (qualquer cliente autenticado pode listar)
    -- A validação básica é que o JWT seja válido (feito no código)
    
    -- Listar credenciais (sem secret)
    SELECT json_agg(
        json_build_object(
            'id', id,
            'client_id', client_id,
            'redirect_uri', redirect_uri,
            'created_at', created_at
        )
        ORDER BY created_at DESC
    )
    INTO v_credenciais
    FROM credenciais_dev;
    
    -- Retornar lista
    RETURN json_build_object(
        'success', true,
        'credenciais', COALESCE(v_credenciais, '[]'::json)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Listar Tokens Próximos de Expirar
-- ============================================
DROP FUNCTION IF EXISTS rpc_list_tokens_expiring_soon(INTEGER);
CREATE OR REPLACE FUNCTION rpc_list_tokens_expiring_soon(
    p_minutes_before_expiry INTEGER DEFAULT 10
)
RETURNS JSON AS $$
DECLARE
    v_tokens JSON;
BEGIN
    -- Buscar tokens que expiram em breve
    SELECT json_agg(
        json_build_object(
            'cliente_id', cliente_id,
            'expires_at', expires_at
        )
    )
    INTO v_tokens
    FROM tokens_oauth
    WHERE expires_at <= NOW() + (p_minutes_before_expiry || ' minutes')::INTERVAL
    AND expires_at > NOW(); -- Ainda não expirados
    
    -- Retornar lista
    RETURN json_build_object(
        'success', true,
        'tokens', COALESCE(v_tokens, '[]'::json),
        'count', COALESCE(json_array_length(v_tokens), 0)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÕES RPC SEM VALIDAÇÃO JWT
-- Para uso em processos internos (callback-oauth, token-refresh)
-- Protegidas pela API key do Supabase nos headers HTTP
-- ============================================

-- ============================================
-- RPC: Buscar Cliente por UUID (sem validação JWT)
-- Para uso no callback-oauth
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_cliente_by_uuid_simple(UUID);
CREATE OR REPLACE FUNCTION rpc_get_cliente_by_uuid_simple(
    p_cliente_uuid UUID
)
RETURNS JSON AS $$
DECLARE
    v_cliente RECORD;
    v_contato_final TEXT;
BEGIN
    -- Buscar cliente
    SELECT id, nome, contato, email, credenciais_dev_id, created_at
    INTO v_cliente
    FROM clientes
    WHERE id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_cliente.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cliente não encontrado'
        );
    END IF;
    
    -- Usar contato se disponível, senão usar email
    v_contato_final := COALESCE(NULLIF(TRIM(v_cliente.contato), ''), v_cliente.email);
    
    -- Retornar dados do cliente
    RETURN json_build_object(
        'success', true,
        'cliente', json_build_object(
            'id', v_cliente.id,
            'nome', v_cliente.nome,
            'contato', v_contato_final,
            'email', v_cliente.email,
            'credenciais_dev_id', v_cliente.credenciais_dev_id,
            'created_at', v_cliente.created_at
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Credenciais por Cliente ID (sem validação JWT)
-- Para uso no callback-oauth
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_credenciais_by_cliente_id_simple(UUID);
CREATE OR REPLACE FUNCTION rpc_get_credenciais_by_cliente_id_simple(
    p_cliente_uuid UUID
)
RETURNS JSON AS $$
DECLARE
    v_credenciais RECORD;
    v_decrypted_secret TEXT;
BEGIN
    -- Buscar credenciais associadas ao cliente
    SELECT cd.id, cd.client_id, cd.client_secret, cd.redirect_uri
    INTO v_credenciais
    FROM credenciais_dev cd
    INNER JOIN clientes c ON c.credenciais_dev_id = cd.id
    WHERE c.id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_credenciais.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Credenciais não encontradas para este cliente'
        );
    END IF;
    
    -- Descriptografar client_secret
    v_decrypted_secret := decrypt_token(v_credenciais.client_secret);
    
    -- Retornar credenciais descriptografadas
    RETURN json_build_object(
        'success', true,
        'credenciais', json_build_object(
            'id', v_credenciais.id,
            'client_id', v_credenciais.client_id,
            'client_secret', v_decrypted_secret,
            'redirect_uri', v_credenciais.redirect_uri
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Salvar Tokens OAuth (sem validação JWT)
-- Para uso no callback-oauth
-- ============================================
DROP FUNCTION IF EXISTS rpc_save_tokens_simple(UUID, TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION rpc_save_tokens_simple(
    p_cliente_uuid UUID,
    p_access_token TEXT,
    p_refresh_token TEXT,
    p_expires_in INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_token_id UUID;
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Criptografar tokens
    v_encrypted_access_token := encrypt_token(p_access_token);
    v_encrypted_refresh_token := encrypt_token(p_refresh_token);
    
    -- Calcular expires_at
    v_expires_at := NOW() + (COALESCE(p_expires_in, 3600) || ' seconds')::INTERVAL;
    
    -- UPSERT na tabela tokens_oauth
    INSERT INTO tokens_oauth (
        cliente_id,
        access_token,
        refresh_token,
        expires_at,
        token_type
    )
    VALUES (
        p_cliente_uuid,
        v_encrypted_access_token,
        v_encrypted_refresh_token,
        v_expires_at,
        'Bearer'
    )
    ON CONFLICT (cliente_id) 
    DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING id INTO v_token_id;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'token_id', v_token_id,
        'expires_at', v_expires_at,
        'message', 'Tokens salvos com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Token por Cliente ID (sem validação JWT)
-- Para uso no token-refresh
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_token_by_cliente_id_simple(UUID);
CREATE OR REPLACE FUNCTION rpc_get_token_by_cliente_id_simple(
    p_cliente_uuid UUID
)
RETURNS JSON AS $$
DECLARE
    v_token RECORD;
    v_decrypted_access_token TEXT;
    v_decrypted_refresh_token TEXT;
BEGIN
    -- Buscar token
    SELECT id, access_token, refresh_token, expires_at, token_type
    INTO v_token
    FROM tokens_oauth
    WHERE cliente_id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_token.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Token não encontrado para este cliente'
        );
    END IF;
    
    -- Descriptografar tokens
    v_decrypted_access_token := decrypt_token(v_token.access_token);
    v_decrypted_refresh_token := decrypt_token(v_token.refresh_token);
    
    -- Retornar tokens descriptografados
    RETURN json_build_object(
        'success', true,
        'token', json_build_object(
            'id', v_token.id,
            'access_token', v_decrypted_access_token,
            'refresh_token', v_decrypted_refresh_token,
            'expires_at', v_token.expires_at,
            'token_type', v_token.token_type
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Credenciais por Cliente ID para Refresh (sem validação JWT)
-- Para uso no token-refresh
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_credenciais_by_cliente_id_for_refresh(UUID);
CREATE OR REPLACE FUNCTION rpc_get_credenciais_by_cliente_id_for_refresh(
    p_cliente_uuid UUID
)
RETURNS JSON AS $$
DECLARE
    v_credenciais RECORD;
    v_decrypted_secret TEXT;
BEGIN
    -- Buscar credenciais associadas ao cliente
    SELECT cd.id, cd.client_id, cd.client_secret, cd.redirect_uri
    INTO v_credenciais
    FROM credenciais_dev cd
    INNER JOIN clientes c ON c.credenciais_dev_id = cd.id
    WHERE c.id = p_cliente_uuid;
    
    -- Se não encontrou, retornar erro
    IF v_credenciais.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Credenciais não encontradas para este cliente'
        );
    END IF;
    
    -- Descriptografar client_secret
    v_decrypted_secret := decrypt_token(v_credenciais.client_secret);
    
    -- Retornar credenciais descriptografadas
    RETURN json_build_object(
        'success', true,
        'credenciais', json_build_object(
            'id', v_credenciais.id,
            'client_id', v_credenciais.client_id,
            'client_secret', v_decrypted_secret,
            'redirect_uri', v_credenciais.redirect_uri
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Renovar Token (sem validação JWT)
-- Para uso no token-refresh
-- ============================================
DROP FUNCTION IF EXISTS rpc_refresh_token_simple(UUID, TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION rpc_refresh_token_simple(
    p_cliente_uuid UUID,
    p_new_access_token TEXT,
    p_new_refresh_token TEXT,
    p_expires_in INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Criptografar novos tokens
    v_encrypted_access_token := encrypt_token(p_new_access_token);
    v_encrypted_refresh_token := encrypt_token(p_new_refresh_token);
    
    -- Calcular expires_at
    v_expires_at := NOW() + (COALESCE(p_expires_in, 3600) || ' seconds')::INTERVAL;
    
    -- Atualizar tokens
    UPDATE tokens_oauth
    SET
        access_token = v_encrypted_access_token,
        refresh_token = v_encrypted_refresh_token,
        expires_at = v_expires_at,
        updated_at = NOW()
    WHERE cliente_id = p_cliente_uuid;
    
    -- Verificar se atualizou
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Token não encontrado para este cliente'
        );
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'expires_at', v_expires_at,
        'message', 'Token renovado com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION rpc_insert_credenciais_dev IS 'Insere credenciais OAuth criptografando client_secret';
COMMENT ON FUNCTION rpc_get_latest_credencial IS 'Retorna a credencial OAuth mais recente cadastrada';
COMMENT ON FUNCTION rpc_insert_cliente IS 'Insere cliente gerando API Key e hash. Retorna API Key (exibida apenas uma vez)';
COMMENT ON FUNCTION rpc_authenticate IS 'Autentica cliente via API Key. Retorna dados para gerar JWT no código';
COMMENT ON FUNCTION rpc_get_cliente_by_uuid IS 'Busca cliente por UUID validando JWT';
COMMENT ON FUNCTION rpc_get_credenciais_by_cliente_id IS 'Busca credenciais do cliente descriptografando client_secret';
COMMENT ON FUNCTION rpc_save_tokens IS 'Salva tokens OAuth criptografados validando JWT';
COMMENT ON FUNCTION rpc_get_token_by_cliente_id IS 'Busca token OAuth descriptografado validando JWT e expiração';
COMMENT ON FUNCTION rpc_refresh_token IS 'Renova token OAuth criptografando novos tokens e validando JWT';
COMMENT ON FUNCTION rpc_list_credenciais IS 'Lista credenciais cadastradas (sem secrets)';
COMMENT ON FUNCTION rpc_list_tokens_expiring_soon IS 'Lista tokens próximos de expirar para renovação automática';
COMMENT ON FUNCTION rpc_get_cliente_by_uuid_simple IS 'Busca cliente por UUID sem validação JWT (para processos internos)';
COMMENT ON FUNCTION rpc_get_credenciais_by_cliente_id_simple IS 'Busca credenciais do cliente sem validação JWT (para callback-oauth)';
COMMENT ON FUNCTION rpc_save_tokens_simple IS 'Salva tokens OAuth sem validação JWT (para callback-oauth)';
COMMENT ON FUNCTION rpc_get_token_by_cliente_id_simple IS 'Busca token OAuth sem validação JWT (para token-refresh)';
COMMENT ON FUNCTION rpc_get_credenciais_by_cliente_id_for_refresh IS 'Busca credenciais para renovação de token sem validação JWT';
COMMENT ON FUNCTION rpc_refresh_token_simple IS 'Renova token OAuth sem validação JWT (para token-refresh)';

