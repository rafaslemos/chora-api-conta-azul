# Resumo: Correção do Setup Inicial - Criptografia

## Problema Identificado

Durante o setup inicial, os dados `conta_azul_client_secret` e `system_api_key` eram salvos **sem criptografia**, mesmo com `is_encrypted = true`.

### Causa Raiz

A migration 006 (`MIGRATION_006_APP_CONFIG`) no arquivo `supabase/functions/run-migrations/index.ts` criava uma versão **ANTIGA** da função `set_app_config` que **não criptografava** os valores, mesmo quando `is_encrypted = true`.

**Código problemático (versão antiga):**
```sql
CREATE OR REPLACE FUNCTION app_core.set_app_config(...)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO app_core.app_config (key, value, description, is_encrypted)
    VALUES (p_key, p_value, p_description, p_is_encrypted)
    -- ❌ PROBLEMA: Salva p_value diretamente, sem criptografar!
    ON CONFLICT (key) DO UPDATE
    SET value = p_value,  -- ❌ Salva valor original, não criptografado
    ...
END;
```

### Fluxo do Problema

1. **Setup inicial executa migrations:**
   - Migration 006 cria `set_app_config` **sem criptografia**
   - Migration 006 é executada ANTES de salvar os dados

2. **Dados são salvos (linha 676-677 do run-migrations):**
   ```typescript
   SELECT app_core.set_app_config('conta_azul_client_secret', '...', '...', true);
   ```
   - Chama `set_app_config` com `is_encrypted = true`
   - Mas a função **não criptografa** (versão antiga da migration 006)
   - Salva valor original sem criptografia

3. **Migration 024 não é executada:**
   - A migration 024 tem a versão **correta** com criptografia
   - Mas ela **NÃO está no array MIGRATIONS** do `run-migrations/index.ts`
   - Então nunca executa para atualizar a função

## Solução Implementada

### Correção na Migration 006

Atualizamos `MIGRATION_006_APP_CONFIG` em `supabase/functions/run-migrations/index.ts` para ter a versão **correta** de `set_app_config` com criptografia desde o início.

**Código corrigido:**
```sql
CREATE OR REPLACE FUNCTION app_core.set_app_config(...)
RETURNS JSONB AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_value TEXT;
    v_final_value TEXT;
    v_user_id UUID;
BEGIN
    -- Verificar permissões...
    
    -- Obter chave de criptografia
    v_encryption_key := app_core.get_encryption_key();
    
    -- ✅ Criptografar valor se necessário
    IF p_is_encrypted THEN
        v_encrypted_value := app_core.encrypt_token(p_value, v_encryption_key);
        v_final_value := v_encrypted_value;  -- ✅ Salva valor criptografado
    ELSE
        v_final_value := p_value;
    END IF;
    
    -- Inserir ou atualizar com valor criptografado
    INSERT INTO app_core.app_config (key, value, description, is_encrypted, updated_by)
    VALUES (p_key, v_final_value, p_description, p_is_encrypted, v_user_id)
    ...
END;
```

### Mudanças Realizadas

1. **Atualizada função `set_app_config`:**
   - Agora criptografa automaticamente quando `is_encrypted = true`
   - Usa `encrypt_token` para criptografar antes de salvar
   - Mantém verificação de permissões (Service Role ou ADMIN)

2. **Atualizada estrutura da tabela `app_config`:**
   - Removido campo `id` (usando `key` como PRIMARY KEY)
   - Adicionado campo `updated_by`
   - Atualizadas políticas RLS para serem mais granulares

3. **Adicionada função `get_conta_azul_client_secret`:**
   - Função wrapper para buscar client secret com verificação de permissões
   - Retorna NULL se não for Service Role ou ADMIN

4. **Melhorados comentários:**
   - Adicionados comentários nas funções
   - Documentação clara sobre comportamento de criptografia

## Arquivos Modificados

1. **`supabase/functions/run-migrations/index.ts`**
   - Atualizada `MIGRATION_006_APP_CONFIG` (linhas 280-470)
   - Função `set_app_config` agora tem lógica de criptografia
   - Estrutura da tabela `app_config` atualizada
   - Políticas RLS atualizadas
   - Função `get_conta_azul_client_secret` adicionada

## Resultado

### Antes da Correção

- Setup inicial salvava dados **sem criptografia**
- Mesmo com `is_encrypted = true`, valores eram salvos em texto plano
- Necessário re-salvar manualmente após setup

### Depois da Correção

- Setup inicial **criptografa automaticamente** quando `is_encrypted = true`
- Dados sensíveis são salvos criptografados desde o início
- Não é necessário re-salvar manualmente

## Verificação

Para verificar se a correção está funcionando em novos setups:

1. Execute um novo setup
2. Verifique os dados na tabela:
   ```sql
   SELECT 
       key,
       LEFT(value, 50) as value_preview,
       is_encrypted,
       CASE 
           WHEN value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
               '✅ CRIPTOGRAFADO'
           ELSE 
               '❌ NÃO CRIPTOGRAFADO'
       END as status
   FROM app_core.app_config
   WHERE key IN ('conta_azul_client_secret', 'system_api_key');
   ```

3. **Resultado esperado:** Ambos devem mostrar `✅ CRIPTOGRAFADO`

## Nota para Dados Existentes

Se você já tem um banco configurado com dados não criptografados:

1. Use o script `029_CRIPTOGRAFAR_MANUAL.sql` para criptografar os dados existentes
2. Ou re-execute o setup em um banco novo para testar a correção

## Prevenção Futura

- A migration 006 agora sempre cria `set_app_config` com criptografia
- Novos setups já funcionarão corretamente
- Não será necessário executar migration adicional
