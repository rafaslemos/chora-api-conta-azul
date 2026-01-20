# Supabase Edge Functions

Este diretório contém as Edge Functions do Supabase para resolver problemas de CORS e fazer requisições do servidor.

## Função: test-tiny-connection

Testa a conexão com a API Tiny fazendo requisição do servidor, evitando problemas de CORS.

## ⚠️ IMPORTANTE: A Edge Function precisa ser deployada!

O erro de CORS que você está vendo acontece porque a Edge Function ainda não foi deployada no Supabase. Siga as instruções abaixo para fazer o deploy.

### Como fazer o deploy:

#### Opção 1: Via Supabase CLI (Recomendado)

1. **Instalar Supabase CLI** (se ainda não tiver):
   ```bash
   npm install -g supabase
   ```

2. **Fazer login no Supabase**:
   ```bash
   supabase login
   ```

3. **Linkar ao projeto**:
   ```bash
   supabase link --project-ref seu-project-ref
   ```
   O `project-ref` pode ser encontrado:
   - Nas configurações do projeto no Supabase Dashboard
   - Na URL do seu projeto: `https://[project-ref].supabase.co`

4. **Fazer deploy da função**:
   ```bash
   supabase functions deploy test-tiny-connection
   ```

#### Opção 2: Via Supabase Dashboard

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Edge Functions** no menu lateral
4. Clique em **Create a new function**
5. Nome da função: `test-tiny-connection`
6. Cole o conteúdo completo do arquivo `supabase/functions/test-tiny-connection/index.ts`
7. Clique em **Deploy**

### Verificar se o deploy funcionou:

Após o deploy, você pode testar a função diretamente no Dashboard ou verificar se ela aparece na lista de Edge Functions.

### Estrutura de arquivos:

```
supabase/
  functions/
    test-tiny-connection/
      index.ts          # Função principal (contém headers CORS)
    _shared/
      cors.ts           # Headers CORS compartilhados (não usado mais)
```

### Uso:

A função é chamada automaticamente pelo `credentialService.testOlistConnection()` quando você testa uma conexão na página de Credenciais.

### Troubleshooting:

- **Erro de CORS persistente**: Certifique-se de que a função foi deployada corretamente
- **Função não encontrada**: Verifique se o nome da função está correto (`test-tiny-connection`)
- **Erro 404**: A função pode não ter sido deployada ou o nome está incorreto

