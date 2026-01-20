# Guia Rápido: Como Chamar RPCs do Supabase no n8n

## Método Único: HTTP Request Node

No n8n, **não existe node Supabase nativo** para chamar RPCs. Use sempre o node **HTTP Request**.

---

## Passo a Passo Completo

### 1. Adicionar HTTP Request Node

Adicione um node "HTTP Request" ao seu workflow.

### 2. Configurar Método e URL

- **Method:** `POST`
- **URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/[nome_da_funcao]`

**Exemplos de URL:**
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/create_sync_job`
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/insert_pedidos_tiny_batch`
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/update_platform_execution`

### 3. Configurar Authentication

**Aba "Authentication":**
- Selecione: **Generic Credential Type**
- Escolha: **HTTP Header Auth**
- Configure a credencial:
  - **Name:** `apikey`
  - **Value:** `{{ $env.SUPABASE_ANON_KEY }}`

**Onde encontrar a Anon Key:**
- Dashboard Supabase → Settings → API → `anon` `public` key

### 4. Adicionar Headers Adicionais

**Aba "Options" → "Headers":**

Adicione os seguintes headers:

| Name | Value |
|------|-------|
| `Authorization` | `Bearer {{ $env.SUPABASE_ANON_KEY }}` |
| `Content-Type` | `application/json` |

**Nota:** O header `apikey` já foi configurado na Authentication, então não precisa adicionar novamente aqui.

### 5. Configurar Body

**Aba "Body":**
- **Send Body:** `true` (marcar checkbox)
- **Body Content Type:** `JSON`
- **JSON Body:** (cole o JSON abaixo)

---

## Exemplos Práticos

### Exemplo 1: Chamar `create_sync_job`

**URL:**
```
https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_sync_job
```

**JSON Body:**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_type": "PEDIDOS_PESQUISA",
  "p_details": "Iniciando pesquisa de pedidos Tiny"
}
```

**Resposta:**
```json
"550e8400-e29b-41d4-a716-446655440000"
```

**Como usar o resultado:**
- Acessar: `{{ $json }}` ou `{{ $('Nome do Node').item.json }}`
- Salvar em variável com Set node se necessário

---

### Exemplo 2: Chamar `insert_pedidos_tiny_batch`

**URL:**
```
https://[SEU_PROJETO].supabase.co/rest/v1/rpc/insert_pedidos_tiny_batch
```

**JSON Body:**
```json
{
  "p_pedidos": {{ JSON.stringify($json.pedidos_validados) }}
}
```

**Nota:** Use `JSON.stringify()` para converter array JavaScript em JSON string.

**Resposta:**
```json
{
  "inserted": 145,
  "updated": 5,
  "errors": 0,
  "total": 150
}
```

**Como usar o resultado:**
- `{{ $json.inserted }}` - quantidade inserida
- `{{ $json.updated }}` - quantidade atualizada
- `{{ $json.errors }}` - quantidade de erros

---

### Exemplo 3: Chamar `create_platform_execution`

**URL:**
```
https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_platform_execution
```

**JSON Body:**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_platform": "TINY",
  "p_execution_type": "PEDIDOS_PESQUISA",
  "p_execution_date": "2024-12-30",
  "p_is_initial_load": true
}
```

**Resposta:**
```json
"550e8400-e29b-41d4-a716-446655440000"
```

**Nota:** A função retorna UUID diretamente (string). Se já existir uma execução para a mesma data, atualiza e retorna o ID existente (idempotência).

---

### Exemplo 4: Chamar `update_platform_execution`

**URL:**
```
https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_platform_execution
```

**JSON Body:**
```json
{
  "p_id": "{{ $json.execution_id }}",
  "p_status": "SUCCESS",
  "p_total_pages": 5,
  "p_total_items": 150,
  "p_total_requests": 5,
  "p_successful_requests": 5,
  "p_failed_requests": 0
}
```

**Resposta:**
```json
[]
```

**Nota:** Esta função retorna `VOID`, então retorna array vazio.

---

## Checklist de Configuração

Antes de executar, verifique:

- [ ] URL está correta: `/rest/v1/rpc/[nome_funcao]`
- [ ] Método é `POST`
- [ ] Authentication configurado com `apikey` header
- [ ] Header `Authorization: Bearer [anon-key]` adicionado
- [ ] Header `Content-Type: application/json` adicionado
- [ ] Body JSON configurado com todos os parâmetros necessários
- [ ] Parâmetros usam prefixo `p_` (ex: `p_tenant_id`, `p_type`)
- [ ] Arrays convertidos com `JSON.stringify()` quando necessário

---

## Troubleshooting

### Erro: "function does not exist"

**Causa:** A função RPC não foi criada no banco de dados.

**Solução:**
1. Execute o arquivo SQL da função no Supabase
2. Verifique se o nome da função está correto na URL
3. Verifique se a função está no schema `public`

### Erro: "permission denied"

**Causa:** Problema com autenticação ou RLS.

**Solução:**
1. Verifique se está usando a anon key correta
2. Verifique se os headers estão configurados corretamente
3. Verifique as políticas RLS da função (deve ter `SECURITY DEFINER`)

### Erro: "column does not exist"

**Causa:** Parâmetro com nome incorreto.

**Solução:**
1. Verifique se os parâmetros usam o prefixo `p_` (ex: `p_tenant_id`)
2. Verifique se o nome do parâmetro na função SQL corresponde ao nome no JSON

### Resposta vazia ou null

**Causa:** Função retorna `VOID` ou não retorna dados.

**Solução:**
- É normal para funções que retornam `VOID`
- Verifique no banco se a operação foi executada
- Funções `UPDATE`/`DELETE` geralmente retornam array vazio

---

## Diferenças Importantes

### RPC vs Edge Function

| Aspecto | RPC | Edge Function |
|---------|-----|---------------|
| **URL** | `/rest/v1/rpc/nome_funcao` | `/functions/v1/nome-funcao` |
| **Tipo** | Função PostgreSQL | Função Deno/TypeScript |
| **Arquivo** | `sql/functions/nome.sql` | `supabase/functions/nome/index.ts` |
| **Autenticação** | `apikey` + `Authorization` headers | `Authorization: Bearer` header |
| **Body** | Parâmetros da função | JSON customizado |

---

## Referência Rápida de RPCs Criadas

| Função | Arquivo | Retorno | Parâmetros |
|--------|---------|---------|------------|
| `create_sync_job` | `sql/functions/create_sync_job.sql` | UUID | `p_tenant_id`, `p_type`, `p_details` |
| `update_sync_job` | `sql/functions/update_sync_job.sql` | VOID | `p_id`, `p_status`, `p_items_processed`, `p_finished_at`, `p_error_message`, `p_details` |
| `create_platform_execution` | `sql/functions/create_platform_execution.sql` | UUID | `p_tenant_id`, `p_platform`, `p_execution_type`, `p_execution_date`, `p_is_initial_load` |
| `insert_pedidos_tiny_batch` | `sql/functions/insert_pedidos_tiny_batch.sql` | JSONB | `p_pedidos[]` |
| `update_platform_execution` | `sql/functions/update_platform_execution.sql` | VOID | `p_id`, `p_status`, `p_total_pages`, etc. |
| `update_tenant_credential_execution` | `sql/functions/update_tenant_credential_execution.sql` | VOID | `p_tenant_id`, `p_platform`, `p_primeira_execucao`, `p_data_ultima_execucao` |
| `get_tenant_credential_decrypted` | `sql/functions/manage_tenant_credentials.sql` | TABLE | `p_tenant_id`, `p_platform` |

---

## Dicas Finais

1. **Sempre teste a RPC isoladamente** antes de usar no fluxo completo
2. **Use Set nodes** para salvar valores importantes (como IDs) em variáveis nomeadas
3. **Valide respostas** com IF nodes antes de usar em nodes seguintes
4. **Configure Continue On Fail** em nodes não críticos para não interromper o fluxo
5. **Use JSON.stringify()** para arrays e objetos complexos no body

