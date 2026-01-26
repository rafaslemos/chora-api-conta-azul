-- ============================================================================
-- Script: Criptografar Dados Manualmente (Bypass set_app_config)
-- ============================================================================
-- Este script criptografa os dados diretamente usando UPDATE
-- Use se set_app_config não estiver funcionando
-- ============================================================================

-- ============================================================================
-- 1. Testar Função encrypt_token
-- ============================================================================
-- Primeiro, vamos testar se a função encrypt_token funciona:
SELECT 
    'Teste encrypt_token' as teste,
    app_core.encrypt_token(
        '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
        app_core.get_encryption_key()
    ) as valor_criptografado,
    CASE 
        WHEN app_core.encrypt_token(
            '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
            app_core.get_encryption_key()
        ) IS NOT NULL 
        THEN '✅ encrypt_token funciona'
        ELSE '❌ encrypt_token retorna NULL'
    END as status;

-- ============================================================================
-- 2. Criptografar conta_azul_client_secret Manualmente
-- ============================================================================
-- Atualiza diretamente na tabela com valor criptografado
UPDATE app_core.app_config
SET 
    value = app_core.encrypt_token(
        '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
        app_core.get_encryption_key()
    ),
    is_encrypted = true,
    updated_at = NOW()
WHERE key = 'conta_azul_client_secret';

-- ============================================================================
-- 3. Criptografar system_api_key Manualmente
-- ============================================================================
-- Atualiza diretamente na tabela com valor criptografado
UPDATE app_core.app_config
SET 
    value = app_core.encrypt_token(
        '1a827c089f984603a39306517c54b610',
        app_core.get_encryption_key()
    ),
    is_encrypted = true,
    updated_at = NOW()
WHERE key = 'system_api_key';

-- ============================================================================
-- 4. Verificar se Criptografia Funcionou
-- ============================================================================
SELECT 
    key,
    LEFT(value, 50) as value_preview,
    is_encrypted,
    LENGTH(value) as tamanho,
    CASE 
        WHEN value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
            '✅ CRIPTOGRAFADO (base64)'
        ELSE 
            '❌ AINDA NÃO CRIPTOGRAFADO'
    END as status_criptografia
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
ORDER BY key;

-- ============================================================================
-- 5. Testar Descriptografia
-- ============================================================================
-- Verificar se get_app_config retorna os valores originais descriptografados
SELECT 
    'conta_azul_client_secret' as key,
    app_core.get_app_config('conta_azul_client_secret') as valor_descriptografado,
    CASE 
        WHEN app_core.get_app_config('conta_azul_client_secret') = '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86'
        THEN '✅ OK - Valor correto'
        WHEN app_core.get_app_config('conta_azul_client_secret') IS NOT NULL 
        THEN '⚠️ Retorna valor mas pode estar diferente'
        ELSE '❌ NULL'
    END as status;

SELECT 
    'system_api_key' as key,
    app_core.get_app_config('system_api_key') as valor_descriptografado,
    CASE 
        WHEN app_core.get_app_config('system_api_key') = '1a827c089f984603a39306517c54b610'
        THEN '✅ OK - Valor correto'
        WHEN app_core.get_app_config('system_api_key') IS NOT NULL 
        THEN '⚠️ Retorna valor mas pode estar diferente'
        ELSE '❌ NULL'
    END as status;

-- ============================================================================
-- 6. Teste Completo: Criptografar e Descriptografar
-- ============================================================================
-- Teste completo para verificar se o ciclo funciona:
SELECT 
    'Teste Completo' as teste,
    'Valor original' as etapa,
    '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86' as valor;

SELECT 
    'Teste Completo' as teste,
    'Valor criptografado' as etapa,
    app_core.encrypt_token(
        '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
        app_core.get_encryption_key()
    ) as valor;

SELECT 
    'Teste Completo' as teste,
    'Valor descriptografado' as etapa,
    app_core.decrypt_token(
        app_core.encrypt_token(
            '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
            app_core.get_encryption_key()
        ),
        app_core.get_encryption_key()
    ) as valor,
    CASE 
        WHEN app_core.decrypt_token(
            app_core.encrypt_token(
                '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
                app_core.get_encryption_key()
            ),
            app_core.get_encryption_key()
        ) = '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86'
        THEN '✅ Criptografia/Descriptografia funciona perfeitamente'
        ELSE '❌ Problema na criptografia/descriptografia'
    END as status;
