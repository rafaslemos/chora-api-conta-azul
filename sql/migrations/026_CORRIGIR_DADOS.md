# Como Corrigir Dados Não Criptografados

## Problema Identificado

Os dados `conta_azul_client_secret` e `system_api_key` foram salvos com `is_encrypted = true`, mas os valores **não estão realmente criptografados**. Quando `get_app_config` tenta descriptografar, falha silenciosamente ou retorna NULL.

## Solução

### Opção 1: Re-salvar com Criptografia Correta (RECOMENDADO)

1. **Verificar valores atuais:**
```sql
SELECT 
  key,
  value as valor_atual,  -- Isso mostra o valor não criptografado
  is_encrypted,
  LENGTH(value) as tamanho
FROM app_core.app_config
WHERE key IN ('conta_azul_client_secret', 'system_api_key')
ORDER BY key;
```

2. **Copiar os valores mostrados** (são os valores originais não criptografados)

3. **Re-salvar usando set_app_config** (vai criptografar automaticamente):
```sql
-- Substitua 'VALOR_DO_CLIENT_SECRET' pelo valor que você copiou acima
SELECT app_core.set_app_config(
  'conta_azul_client_secret',
  'VALOR_DO_CLIENT_SECRET',  -- Cole o valor que você copiou
  'Client Secret da Conta Azul (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);

-- Substitua 'VALOR_DA_API_KEY' pelo valor que você copiou acima
SELECT app_core.set_app_config(
  'system_api_key',
  'VALOR_DA_API_KEY',  -- Cole o valor que você copiou
  'API Key do sistema (criptografado)',
  true  -- is_encrypted = true (será criptografado automaticamente)
);
```

4. **Verificar se funcionou:**
```sql
-- Deve retornar os valores descriptografados corretamente
SELECT 
  app_core.get_app_config('conta_azul_client_secret') as client_secret,
  app_core.get_app_config('system_api_key') as api_key;
```

### Opção 2: Aplicar Migration 026 (Fallback Temporário)

A migration 026 melhora a função `get_app_config` para tratar erros de descriptografia e retornar o valor original como fallback. Isso permite que os dados funcionem mesmo sem re-salvar.

**Execute:**
```sql
-- Aplicar a correção da função get_app_config
-- (veja sql/migrations/026_fix_unencrypted_data.sql)
```

**Nota:** Esta é uma solução temporária. O ideal é re-salvar os dados com criptografia correta (Opção 1).

## Verificação Final

Após aplicar a correção:

1. Execute o script de diagnóstico: `sql/migrations/025_DIAGNOSTICO.sql`
2. Teste a autenticação da Conta Azul novamente
3. Verifique os logs da Edge Function para confirmar que não há mais erros

## Prevenção Futura

Para evitar este problema no futuro:
- Sempre use `set_app_config` para salvar configurações (não insira diretamente na tabela)
- A função `set_app_config` criptografa automaticamente quando `is_encrypted = true`
- Verifique se os valores estão realmente criptografados após salvar
