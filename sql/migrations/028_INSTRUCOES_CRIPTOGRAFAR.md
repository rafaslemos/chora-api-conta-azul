# Instruções: Como Criptografar Dados Não Criptografados

## Situação Atual

A migration 026 foi aplicada com sucesso. A função `get_app_config` agora tem tratamento de erro que permite que dados não criptografados funcionem como fallback.

**Porém**, os dados `conta_azul_client_secret` e `system_api_key` ainda estão salvos **sem criptografia** na tabela, mesmo com `is_encrypted = true`.

## Por Que os Dados Continuam Descriptografados?

A migration 026 **não criptografa dados existentes**. Ela apenas:
- Melhora a função `get_app_config` para tratar erros de descriptografia
- Permite que dados não criptografados funcionem como fallback

**Para criptografar os dados**, você precisa **re-salvá-los** usando a função `set_app_config`, que criptografa automaticamente quando `is_encrypted = true`.

## Passo a Passo para Criptografar

### Passo 1: Verificar Estado Atual

Execute no SQL Editor:
```sql
SELECT 
    key,
    LEFT(value, 100) as value_preview,
    is_encrypted,
    LENGTH(value) as tamanho
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
ORDER BY key;
```

### Passo 2: Copiar Valores Originais

Execute esta query e **COPIE os valores retornados**:
```sql
SELECT 
    key,
    value as valor_original_para_copiar,  -- COPIE ESTE VALOR!
    is_encrypted
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
  AND is_encrypted = true
ORDER BY key;
```

**IMPORTANTE:** Os valores retornados são os valores **originais não criptografados**. Você vai precisar deles para re-salvar.

### Passo 3: Re-salvar com Criptografia

Substitua `'VALOR_DO_CLIENT_SECRET'` e `'VALOR_DA_API_KEY'` pelos valores que você copiou acima:

```sql
-- Re-salvar conta_azul_client_secret (será criptografado automaticamente)
SELECT app_core.set_app_config(
  'conta_azul_client_secret',
  'VALOR_DO_CLIENT_SECRET',  -- Cole o valor copiado aqui
  'Client Secret da Conta Azul (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);

-- Re-salvar system_api_key (será criptografado automaticamente)
SELECT app_core.set_app_config(
  'system_api_key',
  'VALOR_DA_API_KEY',  -- Cole o valor copiado aqui
  'API Key do sistema (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);
```

**Como funciona:**
- A função `set_app_config` verifica se `is_encrypted = true`
- Se sim, ela chama `encrypt_token` para criptografar o valor antes de salvar
- O valor criptografado é salvo na tabela

### Passo 4: Verificar se Funcionou

Execute esta query para verificar se os dados foram criptografados:

```sql
SELECT 
    key,
    LEFT(value, 50) as value_preview,
    is_encrypted,
    CASE 
        WHEN value ~ '^[A-Za-z0-9+/=]+$' AND LENGTH(value) > 20 THEN 
            '✅ CRIPTOGRAFADO (base64)'
        ELSE 
            '❌ AINDA NÃO CRIPTOGRAFADO'
    END as status_criptografia
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
ORDER BY key;
```

**Resultado esperado:** Ambos devem mostrar `✅ CRIPTOGRAFADO (base64)`

### Passo 5: Testar Função get_app_config

Execute para confirmar que `get_app_config` retorna os valores descriptografados:

```sql
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
```

**Resultado esperado:** Ambos devem retornar valores não-nulos e mostrar `✅ OK`

## Script Completo

Veja o arquivo `sql/migrations/028_VERIFICAR_E_CRIPTOGRAFAR_DADOS.sql` para um script completo com todas as queries acima.

## Por Que Isso é Necessário?

1. **Segurança:** Dados sensíveis devem estar criptografados no banco
2. **Consistência:** Todos os dados marcados como `is_encrypted = true` devem estar realmente criptografados
3. **Funcionamento Correto:** Embora a migration 026 permita fallback, o ideal é ter os dados corretamente criptografados

## Nota Importante

- A migration 026 permite que dados não criptografados funcionem **temporariamente**
- Mas o ideal é re-salvar com criptografia correta para segurança e consistência
- A função `set_app_config` faz a criptografia automaticamente quando `is_encrypted = true`
