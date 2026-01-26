-- ============================================================================
-- Script: Diagnóstico - Dados Não Criptografados
-- ============================================================================
-- Verifica se a migration 026 foi aplicada e o estado atual dos dados
-- ============================================================================

-- ============================================================================
-- 1. Verificar se a Migration 026 foi Aplicada
-- ============================================================================
-- Verifica se get_app_config tem tratamento de erro de descriptografia
SELECT 
    'Verificação Migration 026' as teste,
    CASE 
        WHEN pg_get_functiondef(
            (SELECT oid FROM pg_proc p 
             JOIN pg_namespace n ON p.pronamespace = n.oid 
             WHERE n.nspname = 'app_core' AND p.proname = 'get_app_config')
        ) LIKE '%EXCEPTION%WHEN OTHERS%' 
        THEN '✅ Migration 026 APLICADA (tem tratamento de erro)'
        ELSE '❌ Migration 026 NÃO APLICADA (sem tratamento de erro)'
    END as status;

-- ============================================================================
-- 2. Ver Código Completo da Função get_app_config
-- ============================================================================
SELECT 
    'Código da Função get_app_config' as info,
    pg_get_functiondef(
        (SELECT oid FROM pg_proc p 
         JOIN pg_namespace n ON p.pronamespace = n.oid 
         WHERE n.nspname = 'app_core' AND p.proname = 'get_app_config')
    ) as function_code;

-- ============================================================================
-- 3. Verificar Estado dos Dados na Tabela
-- ============================================================================
SELECT 
    key,
    CASE 
        WHEN is_encrypted THEN 
            CASE 
                -- Verificar se parece criptografado (base64 geralmente tem caracteres específicos)
                WHEN value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
                    'Parece criptografado (base64)'
                ELSE 
                    '⚠️ NÃO CRIPTOGRAFADO (texto plano)'
            END
        ELSE 
            'Não criptografado (is_encrypted = false)'
    END as estado_criptografia,
    LEFT(value, 50) as value_preview,
    is_encrypted,
    LENGTH(value) as tamanho
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key', 'conta_azul_client_id')
ORDER BY key;

-- ============================================================================
-- 4. Testar Função get_app_config
-- ============================================================================
SELECT 
    'Teste get_app_config' as teste,
    'conta_azul_client_secret' as key,
    app_core.get_app_config('conta_azul_client_secret') as valor_retornado,
    CASE 
        WHEN app_core.get_app_config('conta_azul_client_secret') IS NOT NULL 
        THEN '✅ Retorna valor'
        ELSE '❌ Retorna NULL'
    END as status;

SELECT 
    'Teste get_app_config' as teste,
    'system_api_key' as key,
    app_core.get_app_config('system_api_key') as valor_retornado,
    CASE 
        WHEN app_core.get_app_config('system_api_key') IS NOT NULL 
        THEN '✅ Retorna valor'
        ELSE '❌ Retorna NULL'
    END as status;

-- ============================================================================
-- 5. Testar Descriptografia Manual (para diagnóstico)
-- ============================================================================
-- Isso vai falhar se o valor não estiver criptografado
SELECT 
    'Teste Descriptografia Manual' as teste,
    'conta_azul_client_secret' as key,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM app_core.app_config 
            WHERE key = 'conta_azul_client_secret' AND is_encrypted = true
        ) THEN
            CASE 
                WHEN (
                    SELECT app_core.decrypt_token(
                        (SELECT value FROM app_core.app_config WHERE key = 'conta_azul_client_secret'),
                        app_core.get_encryption_key()
                    )
                ) IS NOT NULL
                THEN '✅ Descriptografia funciona (valor está criptografado)'
                ELSE '❌ Descriptografia falha (valor NÃO está criptografado)'
            END
        ELSE 
            'N/A (is_encrypted = false)'
    END as resultado;

-- ============================================================================
-- 6. Verificar se set_app_config Criptografa Corretamente
-- ============================================================================
-- Teste: verificar se set_app_config realmente criptografa quando is_encrypted = true
-- (Não vamos executar, apenas mostrar o código)
SELECT 
    'Verificação set_app_config' as info,
    CASE 
        WHEN pg_get_functiondef(
            (SELECT oid FROM pg_proc p 
             JOIN pg_namespace n ON p.pronamespace = n.oid 
             WHERE n.nspname = 'app_core' AND p.proname = 'set_app_config')
        ) LIKE '%encrypt_token%' 
        THEN '✅ set_app_config tem lógica de criptografia'
        ELSE '❌ set_app_config NÃO tem lógica de criptografia'
    END as status;

-- ============================================================================
-- 7. Resumo e Recomendações
-- ============================================================================
SELECT 
    'RESUMO' as secao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM app_core.app_config 
            WHERE key IN ('conta_azul_client_secret', 'system_api_key')
            AND is_encrypted = true
            AND value NOT SIMILAR TO '[A-Za-z0-9+/=]{20,}'
        ) THEN 
            '⚠️ PROBLEMA: Dados marcados como criptografados mas não estão criptografados. ' ||
            'Aplique migration 026 e/ou re-salve os dados usando set_app_config.'
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'app_core' 
            AND p.proname = 'get_app_config'
            AND pg_get_functiondef(p.oid) NOT LIKE '%EXCEPTION%WHEN OTHERS%'
        ) THEN 
            '⚠️ PROBLEMA: Migration 026 não foi aplicada. ' ||
            'A função get_app_config não tem tratamento de erro de descriptografia.'
        ELSE 
            '✅ Tudo OK: Migration 026 aplicada e dados estão corretos.'
    END as recomendacao;
