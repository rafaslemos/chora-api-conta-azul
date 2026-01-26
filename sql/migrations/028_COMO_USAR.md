# Como Criptografar os Dados - Guia Simples

## Você Tem os Valores Originais

- **conta_azul_client_secret:** `1fft72kuidv4fitie112kmke75js3k1tvfgndol16tafhvm6rs86`
- **system_api_key:** `1a827c089f984603a39306517c54b610`

## Solução: Execute o Script Direto

Abra o arquivo `sql/migrations/028_CRIPTOGRAFAR_DADOS_DIRETO.sql` e execute no SQL Editor do Supabase.

O script já tem os valores que você forneceu e vai:
1. Criptografar `conta_azul_client_secret` automaticamente
2. Criptografar `system_api_key` automaticamente
3. Verificar se funcionou
4. Testar se `get_app_config` retorna os valores corretos

## Passo a Passo

### 1. Abrir SQL Editor no Supabase

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Clique em **New Query**

### 2. Copiar e Colar o Script

Abra o arquivo `sql/migrations/028_CRIPTOGRAFAR_DADOS_DIRETO.sql` e copie todo o conteúdo.

Cole no SQL Editor do Supabase.

### 3. Executar o Script

Clique em **Run** ou pressione `Ctrl+Enter`.

### 4. Verificar Resultados

Após executar, você verá:

**Na query 3 (Verificar se Criptografia Funcionou):**
- Ambos devem mostrar `✅ CRIPTOGRAFADO (base64)`
- O `value_preview` deve mostrar uma string longa em base64 (não os valores originais)

**Na query 4 (Testar get_app_config):**
- Ambos devem mostrar `✅ OK - Valor correto`
- Os valores descriptografados devem ser exatamente os valores originais que você forneceu

## Como Funciona

A função `set_app_config` faz o seguinte:

1. Recebe o valor original (não criptografado)
2. Verifica se `is_encrypted = true`
3. Se sim, chama `encrypt_token` para criptografar o valor
4. Salva o valor **criptografado** na tabela
5. Quando você chama `get_app_config`, ela descriptografa automaticamente

## Se Algo Der Errado

Se você ver `❌ AINDA NÃO CRIPTOGRAFADO` ou `❌ NULL`:

1. Verifique se executou as queries 1 e 2 (as que fazem `set_app_config`)
2. Verifique se não há erros no console do SQL Editor
3. Execute novamente apenas as queries 1 e 2
4. Depois execute as queries 3 e 4 novamente para verificar

## Pronto!

Após executar o script, seus dados estarão criptografados e a autenticação da Conta Azul deve funcionar corretamente.
