-- ============================================================================
-- Script: Verificar e Criptografar Dados Não Criptografados
-- ============================================================================
-- Este script verifica o estado atual dos dados e fornece instruções
-- para re-salvá-los com criptografia correta
-- ============================================================================

-- ============================================================================
-- 1. Verificar Estado Atual dos Dados
-- ============================================================================
SELECT 
    key,
    LEFT(value, 100) as value_preview,
    is_encrypted,
    LENGTH(value) as tamanho,
    CASE 
        WHEN is_encrypted = true AND value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
            '✅ JÁ CRIPTOGRAFADO'
        WHEN is_encrypted = true THEN 
            '⚠️ NÃO CRIPTOGRAFADO (precisa re-salvar)'
        ELSE 
            'ℹ️ Não deve ser criptografado'
    END as status
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key', 'conta_azul_client_id')
ORDER BY key;

-- ============================================================================
-- 2. IMPORTANTE: Copiar os Valores Atuais
-- ============================================================================
-- Execute esta query e COPIE os valores retornados (são os valores originais)
-- Você vai precisar deles para re-salvar com criptografia
SELECT 
    key,
    value as valor_original_para_copiar,  -- COPIE ESTE VALOR!
    is_encrypted,
    'Copie o valor acima e use no próximo passo' as instrucao
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
  AND is_encrypted = true
ORDER BY key;

-- ============================================================================
-- 3. Re-salvar com Criptografia Correta
-- ============================================================================
-- IMPORTANTE: Substitua 'VALOR_COPIADO_ACIMA' pelos valores que você copiou
-- na query anterior. A função set_app_config vai criptografar automaticamente.

-- Para conta_azul_client_secret:
/*
SELECT app_core.set_app_config(
  'conta_azul_client_secret',
  'VALOR_COPIADO_ACIMA',  -- Substitua pelo valor real copiado
  'Client Secret da Conta Azul (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);
*/

-- Para system_api_key:
/*
SELECT app_core.set_app_config(
  'system_api_key',
  'VALOR_COPIADO_ACIMA',  -- Substitua pelo valor real copiado
  'API Key do sistema (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);
*/

-- ============================================================================
-- 4. Verificar se Criptografia Funcionou
-- ============================================================================
-- Após re-salvar, execute esta query para verificar:
/*
SELECT 
    key,
    LEFT(value, 50) as value_preview,
    is_encrypted,
    CASE 
        WHEN value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
            '✅ CRIPTOGRAFADO (base64)'
        ELSE 
            '❌ AINDA NÃO CRIPTOGRAFADO'
    END as status_criptografia,
    -- Testar se get_app_config retorna o valor descriptografado
    CASE 
        WHEN app_core.get_app_config(key) IS NOT NULL THEN 
            '✅ get_app_config funciona'
        ELSE 
            '❌ get_app_config retorna NULL'
    END as status_funcao
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
ORDER BY key;
*/

-- ============================================================================
-- 5. Teste Final: Verificar se get_app_config Retorna Valores
-- ============================================================================
-- Execute esta query para confirmar que tudo está funcionando:
/*
SELECT 
    'conta_azul_client_secret' as key,
    app_core.get_app_config('conta_azul_client_secret') as valor_descriptografado,
    CASE 
        WHEN app_core.get_app_config('conta_azul_client_secret') IS NOT NULL 
        THEN '✅ OK'
        ELSE '❌ NULL'
    END as status;

SELECT 
    'system_api_key' as key,
    app_core.get_app_config('system_api_key') as valor_descriptografado,
    CASE 
        WHEN app_core.get_app_config('system_api_key') IS NOT NULL 
        THEN '✅ OK'
        ELSE '❌ NULL'
    END as status;
*/
