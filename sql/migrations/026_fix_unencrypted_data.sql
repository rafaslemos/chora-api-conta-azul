-- ============================================================================
-- Migration 026: Corrigir Dados Não Criptografados Marcados como Criptografados
-- ============================================================================
-- PROBLEMA IDENTIFICADO:
-- Os dados conta_azul_client_secret e system_api_key foram salvos com
-- is_encrypted = true, mas os valores não estão realmente criptografados.
-- Quando get_app_config tenta descriptografar, falha ou retorna NULL.
-- ============================================================================

-- ============================================================================
-- Passo 1: Melhorar get_app_config para Tratar Erros de Descriptografia
-- ============================================================================
-- Atualizar função get_app_config para tratar caso onde is_encrypted = true
-- mas o valor não está realmente criptografado (fallback para retornar o valor como está)
-- Isso permite que dados antigos (não criptografados) ainda funcionem

CREATE OR REPLACE FUNCTION app_core.get_app_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_encryption_key TEXT;
    v_config_value TEXT;
    v_is_encrypted BOOLEAN;
    v_decrypted_value TEXT;
BEGIN
    -- Buscar configuração
    SELECT value, is_encrypted INTO v_config_value, v_is_encrypted
    FROM app_core.app_config
    WHERE key = p_key;

    -- Se não encontrou, retornar NULL
    IF v_config_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se não está criptografado, retornar direto
    IF NOT v_is_encrypted THEN
        RETURN v_config_value;
    END IF;

    -- Se está criptografado, tentar descriptografar
    BEGIN
        v_encryption_key := app_core.get_encryption_key();
        v_decrypted_value := app_core.decrypt_token(v_config_value, v_encryption_key);
        RETURN v_decrypted_value;
    EXCEPTION
        WHEN OTHERS THEN
            -- Se falhar a descriptografia (valor não está realmente criptografado),
            -- retornar o valor original como fallback
            -- Isso permite que dados antigos (não criptografados) ainda funcionem
            RAISE WARNING 'Erro ao descriptografar %: %. Retornando valor original como fallback.', p_key, SQLERRM;
            RETURN v_config_value;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_app_config IS 'Retorna uma configuração do sistema, descriptografando automaticamente se is_encrypted = true. Trata erros de descriptografia retornando o valor original como fallback (para dados antigos não criptografados).';

-- ============================================================================
-- Passo 2: Instruções para Re-salvar Dados com Criptografia Correta
-- ============================================================================
-- IMPORTANTE: A função acima permite que dados não criptografados funcionem,
-- mas o ideal é re-salvar os dados com criptografia correta.
--
-- Para re-salvar:
-- 1. Execute: SELECT value FROM app_core.app_config WHERE key = 'conta_azul_client_secret';
-- 2. Copie o valor retornado (é o valor original não criptografado)
-- 3. Execute: SELECT app_core.set_app_config('conta_azul_client_secret', 'VALOR_COPIADO', 'Client Secret da Conta Azul', true);
-- 4. Repita para system_api_key
--
-- Veja o arquivo 026_CORRIGIR_DADOS.md para instruções detalhadas
