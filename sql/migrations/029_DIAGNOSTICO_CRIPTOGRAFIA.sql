-- ============================================================================
-- Script: Diagnóstico de Criptografia
-- ============================================================================
-- Verifica por que set_app_config não está criptografando
-- ============================================================================

-- ============================================================================
-- 1. Verificar Código da Função set_app_config
-- ============================================================================
SELECT 
    'Código set_app_config' as info,
    pg_get_functiondef(
        (SELECT oid FROM pg_proc p 
         JOIN pg_namespace n ON p.pronamespace = n.oid 
         WHERE n.nspname = 'app_core' AND p.proname = 'set_app_config')
    ) as function_code;

-- ============================================================================
-- 2. Testar set_app_config e Ver Retorno
-- ============================================================================
-- Execute e veja o retorno (deve mostrar success: true ou error)
SELECT app_core.set_app_config(
  'conta_azul_client_secret',
  '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
  'Client Secret da Conta Azul (criptografado)',
  true
) as resultado_set_app_config;

-- ============================================================================
-- 3. Verificar se Valor Foi Atualizado
-- ============================================================================
-- Verificar se o valor na tabela mudou após executar set_app_config
SELECT 
    key,
    value as valor_atual_na_tabela,
    LEFT(value, 50) as preview,
    is_encrypted,
    LENGTH(value) as tamanho,
    CASE 
        WHEN value = '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86' THEN 
            '❌ VALOR NÃO FOI CRIPTOGRAFADO (ainda é o original)'
        WHEN value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
            '✅ VALOR FOI CRIPTOGRAFADO'
        ELSE 
            '⚠️ VALOR MUDOU MAS NÃO PARECE CRIPTOGRAFADO'
    END as status
FROM app_core.app_config
WHERE key = 'conta_azul_client_secret';

-- ============================================================================
-- 4. Testar Funções de Criptografia Individualmente
-- ============================================================================
-- Testar get_encryption_key
SELECT 
    'get_encryption_key' as teste,
    app_core.get_encryption_key() as chave,
    CASE 
        WHEN app_core.get_encryption_key() IS NOT NULL 
        THEN '✅ OK'
        ELSE '❌ NULL'
    END as status;

-- Testar encrypt_token
SELECT 
    'encrypt_token' as teste,
    app_core.encrypt_token(
        'teste',
        app_core.get_encryption_key()
    ) as valor_criptografado,
    CASE 
        WHEN app_core.encrypt_token(
            'teste',
            app_core.get_encryption_key()
        ) IS NOT NULL 
        THEN '✅ OK'
        ELSE '❌ NULL'
    END as status;

-- Testar decrypt_token (descriptografar o valor acima)
SELECT 
    'decrypt_token' as teste,
    app_core.decrypt_token(
        app_core.encrypt_token(
            'teste',
            app_core.get_encryption_key()
        ),
        app_core.get_encryption_key()
    ) as valor_descriptografado,
    CASE 
        WHEN app_core.decrypt_token(
            app_core.encrypt_token(
                'teste',
                app_core.get_encryption_key()
            ),
            app_core.get_encryption_key()
        ) = 'teste'
        THEN '✅ OK - Criptografia/Descriptografia funciona'
        ELSE '❌ FALHOU'
    END as status;

-- ============================================================================
-- 5. Verificar Permissões RLS
-- ============================================================================
-- Verificar se há políticas RLS que podem estar bloqueando
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'app_core' 
  AND tablename = 'app_config';

-- ============================================================================
-- 6. Tentar UPDATE Direto (Bypass RLS)
-- ============================================================================
-- Se set_app_config não funcionar, podemos tentar UPDATE direto
-- (mas isso pode falhar por RLS - use apenas para teste)
/*
UPDATE app_core.app_config
SET 
    value = app_core.encrypt_token(
        '1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86',
        app_core.get_encryption_key()
    ),
    is_encrypted = true
WHERE key = 'conta_azul_client_secret';
*/
