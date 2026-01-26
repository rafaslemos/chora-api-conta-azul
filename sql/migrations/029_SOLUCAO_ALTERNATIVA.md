# Solução Alternativa: Criptografar Manualmente

## Problema

A função `set_app_config` não está criptografando os valores, mantendo o valor original.

## Possíveis Causas

1. **Função `encrypt_token` pode estar falhando silenciosamente**
2. **Problema com a chave de criptografia**
3. **RLS pode estar bloqueando o UPDATE**
4. **A função pode estar retornando erro mas não sendo mostrado**

## Solução: Criptografar Manualmente

Use o script `029_CRIPTOGRAFAR_MANUAL.sql` que faz UPDATE direto na tabela, bypassando a função `set_app_config`.

### Passo a Passo

1. **Execute o script de diagnóstico primeiro:**
   - Abra `029_DIAGNOSTICO_CRIPTOGRAFIA.sql`
   - Execute todas as queries
   - Verifique os resultados

2. **Se as funções de criptografia funcionarem:**
   - Execute `029_CRIPTOGRAFAR_MANUAL.sql`
   - Este script faz UPDATE direto na tabela
   - Criptografa usando `encrypt_token` diretamente

3. **Verificar se funcionou:**
   - Execute as queries de verificação no final do script
   - Deve mostrar `✅ CRIPTOGRAFADO (base64)`
   - Deve mostrar `✅ OK - Valor correto` nos testes

## Como Funciona o Script Manual

O script `029_CRIPTOGRAFAR_MANUAL.sql` faz:

```sql
UPDATE app_core.app_config
SET 
    value = app_core.encrypt_token(
        'valor_original',
        app_core.get_encryption_key()
    ),
    is_encrypted = true,
    updated_at = NOW()
WHERE key = 'conta_azul_client_secret';
```

Isso bypassa a função `set_app_config` e criptografa diretamente.

## Se Ainda Não Funcionar

Se o script manual também não funcionar, pode ser:

1. **Problema com `encrypt_token`:** Verifique os resultados do diagnóstico
2. **Problema com `get_encryption_key`:** Verifique se retorna uma chave válida
3. **Problema com RLS:** Pode precisar executar como Service Role

## Próximos Passos

1. Execute `029_DIAGNOSTICO_CRIPTOGRAFIA.sql` para entender o problema
2. Execute `029_CRIPTOGRAFAR_MANUAL.sql` para criptografar manualmente
3. Verifique os resultados
4. Se ainda não funcionar, compartilhe os resultados do diagnóstico
