---
name: Planejamento do Fluxo 1 - Pesquisar Pedidos Tiny
overview: ""
todos:
  - id: create_pedidos_table
    content: Criar tabela pedidos_tiny com índices e unique
    status: pending
  - id: add_tenant_fields
    content: Adicionar primeira_execucao e data_ultima_execucao em tenants
    status: pending
  - id: rate_limits_table
    content: Criar tabela limites_uso (opcional)
    status: pending
  - id: edge_function_token
    content: Criar Edge Function get-tiny-token para descriptografar token
    status: pending
  - id: flow_docs_review
    content: Revisar doc/olist/estrutura_fluxos.md pós-implementação
    status: pending
  - id: test_initial_daily
    content: Testar carga inicial e diária com tenant de exemplo
    status: pending
    dependencies:
      - create_pedidos_table
      - add_tenant_fields
      - edge_function_token
---

# Planejamento do Fluxo 1 - Pesquisar Pedidos Tiny

## Objetivo

Buscar pedidos da API Tiny para cada tenant ativo, com suporte a carga inicial (30 dias) e atualização diária, controlando paginação, limites de requisições e armazenamento no Supabase.

## Estrutura do Plano

### 1. Banco de Dados

#### 1.1 Adicionar campos na tabela `tenants`

- `primeira_execucao BOOLEAN DEFAULT TRUE`
- `data_ultima_execucao DATE`

#### 1.2 Criar tabela `pedidos_tiny`

- Campos: `id`, `tenant_id`, `partner_id`, `id_pedido_tiny`, `numero`, `data_pedido`, `situacao`, `valor_total`, `consultado`, `data_consulta`, `created_at`, `updated_at`
- Índices: `tenant_id`, `id_pedido_tiny`, `data_pedido`, `consultado`
- Unique: `(tenant_id, id_pedido_tiny)`
- RLS por tenant/partner

#### 1.3 Criar tabela `limites_uso` (opcional)

- Campos: `id`, `tenant_id`, `requisicoes_feitas`, `data_contagem`, `created_at`, `updated_at`
- Índices: `tenant_id`, `data_contagem`
- Ou usar `tenant_credentials.config` para armazenar contagem/limite

#### 1.4 Função RPC de inserção (opcional)

- `insert_pedidos_tiny` para upsert em lote
- Evitar duplicatas por `(tenant_id, id_pedido_tiny)`

### 2. Edge Function - Buscar Token Tiny

#### 2.1 Criar `supabase/functions/get-tiny-token/index.ts`

- Similar a `get-valid-token` (Conta Azul), mas para `OLIST`
- Usa RPC `get_tenant_credential_decrypted` para descriptografar token
- Retorna: `token`, `primeira_execucao`, `data_ultima_execucao`, `limite_por_minuto` (derivado do plano em `config`), `tenant_id`, `partner_id`
- Autenticação via `x-api-key` (opcional dev)

### 3. Query inicial (n8n)

- JOIN `tenants` + `tenant_credentials`
- Filtro: `tenants.status = 'ACTIVE'` AND `tenant_credentials.platform = 'OLIST'` AND `tenant_credentials.is_active = true`
- Campos: `id_tenant`, `id_partner`, `primeira_execucao`, `data_ultima_execucao`, `plan` (para limite)
- Token: obtido via Edge Function `get-tiny-token` (ou RPC se não usar Edge Function)

### 4. Etapas do Fluxo n8n (documento atualizado)

- **Start**
- **Supabase → Buscar Tenants Ativos** (com dados acima, token via Edge Function)
- **Split In Batches** (1)
- **Function → Calcular Período**
- Se `primeira_execucao = true`: últimos 30 dias a partir de ontem
- Caso contrário: apenas o dia anterior
- Formato `DD/MM/YYYY`
- **HTTP Request → Buscar Página 1 (Tiny)**
- POST `https://api.tiny.com.br/api2/pedidos.pesquisa.php` com `token`, `formato=JSON`, `dataInicial`, `dataFinal`, `pagina=1`
- Extrair `numero_paginas`
- **Function → Paginar Resultados**
- Loop 2..`numero_paginas`, consolidar pedidos
- Normalizar: `id_tenant`, `id_partner`, `numero`, `id_pedido_tiny`, `data_pedido`, `situacao`, `valor_total`, `consultado=false`, `data_consulta=null`
- **Supabase → Inserir Pedidos**
- Tabela `pedidos_tiny`, insert/upsert
- **Supabase → Atualizar Tenant**
- `primeira_execucao=false`, `data_ultima_execucao=today`
- **Supabase → Atualizar Contador de Requisições**
- Incrementa `requisicoes_feitas` (tabela `limites_uso` ou `config`)

### 5. Arquivos a Criar/Modificar

- `sql/migrations/007_create_pedidos_tiny_table.sql`
- `sql/migrations/008_add_execution_fields_to_tenants.sql`
- `sql/migrations/009_create_limites_uso_table.sql` (opcional)
- `supabase/functions/get-tiny-token/index.ts`
- Ajustes em `doc/olist/estrutura_fluxos.md` se necessário pós-implementação

### 6. Considerações

- Carga inicial vs diária conforme `primeira_execucao`
- Token precisa ser descriptografado (Edge Function ou RPC)
- Rate limiting por plano Olist (mapear `config.plan` → limite/min)
- Idempotência via unique `(tenant_id, id_pedido_tiny)`
- Pedidos iniciam com `consultado=false` para Fluxo 2
- Continuar processamento mesmo se um tenant falhar

### 7. Próximos Passos de Teste

- Testar com tenant de exemplo: carga inicial (30d) e diária (1d)
- Validar limites de requisição e paginação
- Validar escrita em `pedidos_tiny` e atualização de `primeira_execucao`/`data_ultima_execucao`
- Preparar Fluxo 2 (detalhar pedidos)