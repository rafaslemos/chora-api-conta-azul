-- ============================================================================
-- Script: Criptografar Dados Diretamente
-- ============================================================================
-- Execute este script para criptografar conta_azul_client_secret e system_api_key
-- ============================================================================

-- ============================================================================
-- 1. Criptografar conta_azul_client_secret
-- ============================================================================
-- A função set_app_config vai criptografar automaticamente quando is_encrypted = true
SELECT app_core.set_app_config(
  'conta_azul_client_secret',
  '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',  -- Valor original
  'Client Secret da Conta Azul (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);

-- ============================================================================
-- 2. Criptografar system_api_key
-- ============================================================================
-- A função set_app_config vai criptografar automaticamente quando is_encrypted = true
SELECT app_core.set_app_config(
  'system_api_key',
  '1a827c089f984603a39306517c54b610',  -- Valor original
  'API Key do sistema (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);

-- ============================================================================
-- 3. Verificar se Criptografia Funcionou
-- ============================================================================
-- Execute esta query após executar as queries acima para verificar:
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
-- 4. Testar se get_app_config Retorna Valores Descriptografados
-- ============================================================================
-- Execute esta query para confirmar que get_app_config funciona:
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
