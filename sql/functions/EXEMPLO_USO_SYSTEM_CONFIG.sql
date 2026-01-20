-- ============================================================================
-- EXEMPLO DE USO: Sistema de Configurações do Supabase
-- ============================================================================
-- Este arquivo contém exemplos de como usar as funções de configuração
-- ============================================================================

-- ============================================================================
-- 1. INSERIR/ATUALIZAR CONFIGURAÇÕES (via SQL Editor do Supabase)
-- ============================================================================
-- IMPORTANTE: Execute como usuário ADMIN autenticado

-- URL base (não precisa criptografar - é pública)
SELECT public.set_system_config(
    'supabase_url_base',
    'https://lfuzyaqqdygnlnslhrmw.supabase.co',
    'URL base do projeto Supabase',
    false
);

-- Anon Key (criptografar - pode ser exposta no frontend mas por segurança criptografamos)
SELECT public.set_system_config(
    'supabase_anon_key',
    'SUA_ANON_KEY_AQUI',
    'Chave anon do Supabase (pode ser usada no frontend)',
    true
);

-- Service Role Key (MUITO SENSÍVEL - sempre criptografar)
SELECT public.set_system_config(
    'supabase_service_role_key',
    'SUA_SERVICE_ROLE_KEY_AQUI',
    'Chave service_role do Supabase (NUNCA expor no frontend)',
    true
);

-- ============================================================================
-- 2. CONSULTAR CONFIGURAÇÕES (para verificar se foram salvas corretamente)
-- ============================================================================

-- Consultar todas as configurações (já descriptografadas)
SELECT * FROM public.get_system_config();

-- Consultar uma configuração específica
SELECT * FROM public.get_system_config() WHERE key = 'supabase_url_base';

-- ============================================================================
-- 3. ATUALIZAR UMA CONFIGURAÇÃO EXISTENTE
-- ============================================================================

-- Atualizar URL base
SELECT public.set_system_config(
    'supabase_url_base',
    'https://nova-url.supabase.co',
    'Nova URL base do projeto Supabase',
    false
);

-- ============================================================================
-- 4. VERIFICAR CONFIGURAÇÕES DIRETAMENTE NA TABELA (valores criptografados)
-- ============================================================================
-- NOTA: Valores criptografados aparecerão como strings base64
-- Use get_system_config() para obter valores descriptografados

SELECT key, 
       CASE 
           WHEN is_encrypted THEN '[CRIPTOGRAFADO]' 
           ELSE value 
       END as value,
       description,
       is_encrypted,
       updated_at
FROM public.system_config
ORDER BY key;

-- ============================================================================
-- 5. USO NO N8N
-- ============================================================================
-- No n8n, use o node HTTP Request (NÃO use o node Supabase "Get many rows")
-- 
-- ⚠️ IMPORTANTE: 
-- - NÃO use "Get many rows" na tabela system_config diretamente
-- - Isso retornará valores criptografados que precisariam ser descriptografados manualmente
-- - Use SEMPRE a função RPC via HTTP Request que já descriptografa automaticamente
-- 
-- Configuração do node HTTP Request:
-- - Method: POST
-- - URL: https://[SEU-PROJETO].supabase.co/rest/v1/rpc/get_system_config
-- - Authentication: Header Auth
--   - Name: apikey
--   - Value: [SUA_ANON_KEY] (ou use service_role_key para bypass RLS)
--   - Name: Authorization (opcional, mas recomendado)
--   - Value: Bearer [SUA_ANON_KEY]
-- - Body: JSON (deixe vazio {} ou não envie body, pois a função não recebe parâmetros)
-- 
-- Exemplo de configuração JSON do node:
-- {
--   "parameters": {
--     "url": "https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/get_system_config",
--     "method": "POST",
--     "authentication": "genericCredentialType",
--     "sendBody": true,
--     "bodyParameters": {
--       "parameters": []
--     }
--   },
--   "type": "n8n-nodes-base.httpRequest"
-- }
-- 
-- O resultado será um array com todas as configurações já descriptografadas:
-- [
--   {
--     "key": "supabase_url_base",
--     "value": "https://lfuzyaqqdygnlnslhrmw.supabase.co",
--     "description": "URL base do projeto Supabase",
--     "is_encrypted": false,
--     "updated_at": "2024-01-15T10:30:00Z"
--   },
--   {
--     "key": "supabase_anon_key",
--     "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JÁ DESCRIPTOGRAFADO
--     "description": "Chave anon do Supabase",
--     "is_encrypted": true,
--     "updated_at": "2024-01-15T10:30:00Z"
--   },
--   {
--     "key": "supabase_service_role_key",
--     "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JÁ DESCRIPTOGRAFADO
--     "description": "Chave service_role do Supabase",
--     "is_encrypted": true,
--     "updated_at": "2024-01-15T10:30:00Z"
--   }
-- ]
