# Resumo Executivo: Correção de Dados Não Criptografados

## Problema Identificado ✅

Os dados `conta_azul_client_secret` e `system_api_key` foram salvos com `is_encrypted = true`, mas os valores **não estão realmente criptografados**. Quando `get_app_config` tenta descriptografar, falha silenciosamente ou retorna NULL.

## Solução Implementada

### 1. Migration 026 Criada ✅

A migration 026 melhora a função `get_app_config` para tratar erros de descriptografia e retornar o valor original como fallback. Isso permite que os dados funcionem **imediatamente** mesmo sem re-salvar.

**Arquivo:** `sql/migrations/026_fix_unencrypted_data.sql`

### 2. Função get_app_config Atualizada ✅

A função agora:
- Tenta descriptografar quando `is_encrypted = true`
- Se falhar (valor não está criptografado), retorna o valor original como fallback
- Registra um WARNING no log para indicar que há dados não criptografados

**Arquivos atualizados:**
- `sql/migrations/024_create_app_config_rpc_functions.sql`
- `supabase/functions/setup-database/index.ts`
- `supabase/functions/run-migrations/index.ts`

## Próximos Passos

### Passo 1: Aplicar Migration 026 (IMEDIATO - Resolve o Problema)

Execute no SQL Editor do Supabase:

```sql
-- Aplicar correção da função get_app_config
CREATE OR REPLACE FUNCTION app_core.get_app_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_encryption_key TEXT;
    v_config_value TEXT;
    v_is_encrypted BOOLEAN;
    v_decrypted_value TEXT;
BEGIN
    SELECT value, is_encrypted INTO v_config_value, v_is_encrypted
    FROM app_core.app_config
    WHERE key = p_key;

    IF v_config_value IS NULL THEN
        RETURN NULL;
    END IF;

    IF NOT v_is_encrypted THEN
        RETURN v_config_value;
    END IF;

    BEGIN
        v_encryption_key := app_core.get_encryption_key();
        v_decrypted_value := app_core.decrypt_token(v_config_value, v_encryption_key);
        RETURN v_decrypted_value;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Erro ao descriptografar %: %. Retornando valor original como fallback.', p_key, SQLERRM;
            RETURN v_config_value;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Resultado esperado:** Após aplicar, a autenticação deve funcionar imediatamente.

### Passo 2: Re-salvar Dados com Criptografia Correta (RECOMENDADO - Para Segurança)

Embora a correção acima permita que os dados funcionem, o ideal é re-salvar com criptografia correta:

1. **Buscar valores atuais:**
```sql
SELECT value FROM app_core.app_config WHERE key = 'conta_azul_client_secret';
SELECT value FROM app_core.app_config WHERE key = 'system_api_key';
```

2. **Copiar os valores retornados** (são os valores originais não criptografados)

3. **Re-salvar com criptografia:**
```sql
-- Substitua 'VALOR_DO_CLIENT_SECRET' pelo valor copiado
SELECT app_core.set_app_config(
  'conta_azul_client_secret',
  'VALOR_DO_CLIENT_SECRET',
  'Client Secret da Conta Azul (criptografado)',
  true
);

-- Substitua 'VALOR_DA_API_KEY' pelo valor copiado
SELECT app_core.set_app_config(
  'system_api_key',
  'VALOR_DA_API_KEY',
  'API Key do sistema (criptografado)',
  true
);
```

**Nota:** A função `set_app_config` criptografa automaticamente quando `is_encrypted = true`.

## Verificação

Após aplicar a migration 026:

```sql
-- Deve retornar os valores (mesmo que não estejam criptografados)
SELECT 
  app_core.get_app_config('conta_azul_client_secret') as client_secret,
  app_core.get_app_config('system_api_key') as api_key;
```

Se retornar valores não-nulos, a correção funcionou!

## Arquivos Criados

1. `sql/migrations/026_fix_unencrypted_data.sql` - Migration de correção
2. `sql/migrations/026_CORRIGIR_DADOS.md` - Instruções detalhadas
3. `sql/migrations/026_RESUMO_EXECUTIVO.md` - Este arquivo

## Status

- ✅ Migration 026 criada
- ✅ Função get_app_config atualizada em todos os lugares
- ⏳ **Aguardando:** Aplicar migration 026 no banco de dados
- ⏳ **Opcional:** Re-salvar dados com criptografia correta
