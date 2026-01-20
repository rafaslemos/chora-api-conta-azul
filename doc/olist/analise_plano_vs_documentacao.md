# Análise: Plano vs Documentação - Fluxo 1 Pesquisar Pedidos Tiny

## 📋 Resumo Executivo

O plano está **mais alinhado com a estrutura real do banco de dados** do que a documentação atual. A documentação precisa ser atualizada para refletir a arquitetura correta.

---

## ✅ Pontos Corretos no Plano

### 1. Estrutura de Banco de Dados
- ✅ Uso correto de `tenant_id` e `partner_id` (conforme schema)
- ✅ JOIN entre `tenants` e `tenant_credentials` (correto)
- ✅ Filtro `tenants.status = 'ACTIVE'` (correto)
- ✅ Filtro `tenant_credentials.platform = 'OLIST'` (correto)
- ✅ Filtro `tenant_credentials.is_active = true` (correto)

### 2. Edge Function para Token
- ✅ Criação de Edge Function `get-tiny-token` para descriptografar token
- ✅ Uso de RPC `get_tenant_credential_decrypted` (padrão já existente)
- ✅ Retorno inclui `primeira_execucao` e `data_ultima_execucao` do tenant

### 3. Campos a Adicionar
- ✅ `primeira_execucao BOOLEAN DEFAULT TRUE` em `tenants`
- ✅ `data_ultima_execucao DATE` em `tenants`

### 4. Tabela `pedidos_tiny`
- ✅ Campos corretos: `tenant_id`, `partner_id`, `id_pedido_tiny`, etc.
- ✅ Unique constraint `(tenant_id, id_pedido_tiny)` (correto)
- ✅ Campos `consultado` e `data_consulta` para Fluxo 2

---

## ❌ Inconsistências na Documentação

### 1. Nomenclatura de Campos (CRÍTICO)

**Documentação atual:**
```javascript
id_tenant, id_partner, token_tiny, limite_por_minuto, ativo
```

**Schema real:**
- `tenants.id` (UUID, não `id_tenant`)
- `tenants.partner_id` (UUID, não `id_partner`)
- `tenant_credentials.access_token` (criptografado, não `token_tiny` em tenants)
- Não existe campo `ativo` em tenants (existe `status`)
- Não existe campo `limite_por_minuto` em tenants (deve vir de `config.plan`)

**Correção necessária:**
- Usar `tenant_id` e `partner_id` (ou `tenants.id` e `tenants.partner_id`)
- Token deve vir de `tenant_credentials.access_token` (descriptografado via Edge Function)
- Usar `tenants.status = 'ACTIVE'` ao invés de `ativo = true`

### 2. Query Inicial (CRÍTICO)

**Documentação atual:**
```sql
SELECT id_tenant, id_partner, token_tiny, limite_por_minuto, ativo, 
       primeira_execucao, data_ultima_execucao
FROM tenants
WHERE ativo = true
```

**Problemas:**
- ❌ Campo `ativo` não existe (deve ser `status`)
- ❌ Campo `token_tiny` não existe em `tenants` (está em `tenant_credentials.access_token`)
- ❌ Campo `limite_por_minuto` não existe (deve ser calculado de `config.plan`)
- ❌ Não faz JOIN com `tenant_credentials`

**Query correta (conforme plano):**
```sql
SELECT 
  t.id as tenant_id,
  t.partner_id,
  tc.access_token, -- Será descriptografado via Edge Function
  t.primeira_execucao,
  t.data_ultima_execucao,
  tc.config->>'plan' as plan -- Para calcular limite_por_minuto
FROM tenants t
INNER JOIN tenant_credentials tc ON tc.tenant_id = t.id
WHERE t.status = 'ACTIVE'
  AND tc.platform = 'OLIST'
  AND tc.is_active = true
```

### 3. Obtenção do Token (CRÍTICO)

**Documentação atual:**
- Espera `token_tiny` diretamente na query
- Não menciona descriptografia

**Realidade:**
- Token está em `tenant_credentials.access_token` (criptografado)
- Precisa usar Edge Function `get-tiny-token` ou RPC `get_tenant_credential_decrypted`
- O plano está correto ao mencionar Edge Function

### 4. Limite por Minuto

**Documentação atual:**
- Espera campo `limite_por_minuto` diretamente

**Realidade:**
- Limite deve ser calculado do plano em `tenant_credentials.config->>'plan'`
- Planos Olist: COMECAR, CRESCER, EVOLUIR, POTENCIALIZAR
- Cada plano tem um limite diferente (mapear conforme necessário)

**Correção:**
- Edge Function deve retornar `limite_por_minuto` calculado do plano
- Ou criar função/mapeamento para converter `plan` → `limite_por_minuto`

### 5. Tabela `limites_uso`

**Status:** Ambos concordam que é opcional
- Pode usar tabela `limites_uso` OU
- Armazenar contagem em `tenant_credentials.config`

**Recomendação:** Usar `config` para simplificar (conforme plano menciona como alternativa)

---

## 🔧 Correções Necessárias na Documentação

### Seção 1️⃣ - Supabase → Buscar Tenants Ativos

**Atual:**
```sql
SELECT id_tenant, id_partner, token_tiny, limite_por_minuto, ativo, 
       primeira_execucao, data_ultima_execucao
FROM tenants
WHERE ativo = true
```

**Corrigir para:**
```sql
SELECT 
  t.id as tenant_id,
  t.partner_id,
  t.primeira_execucao,
  t.data_ultima_execucao,
  tc.config->>'plan' as plan
FROM tenants t
INNER JOIN tenant_credentials tc ON tc.tenant_id = t.id
WHERE t.status = 'ACTIVE'
  AND tc.platform = 'OLIST'
  AND tc.is_active = true
```

**Nota:** O token será obtido via Edge Function `get-tiny-token` após esta query inicial.

### Seção 3️⃣ - Function → Calcular Período

**Atual:** Usa `$json.token_tiny`

**Corrigir para:** 
- Token será obtido via Edge Function antes desta etapa
- Ou adicionar etapa intermediária para buscar token via Edge Function

### Seção 8️⃣ - Atualizar Contador de Requisições

**Atual:** 
```sql
UPDATE limites_uso 
SET requisicoes_feitas = requisicoes_feitas + totalPaginas
WHERE id_tenant = {{ $json.id_tenant }}
```

**Corrigir para:**
- Se usar tabela `limites_uso`: usar `tenant_id` ao invés de `id_tenant`
- Se usar `config`: atualizar `tenant_credentials.config` via RPC

---

## 📝 Recomendações

### 1. Atualizar Documentação
- Corrigir nomenclatura de campos (`tenant_id` ao invés de `id_tenant`)
- Adicionar etapa de obtenção de token via Edge Function
- Corrigir query inicial com JOIN correto
- Remover referências a campos inexistentes (`ativo`, `token_tiny`, `limite_por_minuto`)

### 2. Implementar Edge Function
- Criar `supabase/functions/get-tiny-token/index.ts`
- Similar a `get-valid-token` mas para OLIST
- Retornar token descriptografado + dados do tenant

### 3. Migrations
- ✅ Criar migration para adicionar `primeira_execucao` e `data_ultima_execucao` em `tenants`
- ✅ Criar migration para tabela `pedidos_tiny`
- ⚠️ Decidir se cria `limites_uso` ou usa `config` (recomendado: usar `config`)

### 4. Fluxo n8n
- Adicionar node para chamar Edge Function `get-tiny-token` após buscar tenants
- Usar token retornado nas requisições à API Tiny
- Atualizar referências de campos conforme schema real

---

## ✅ Conclusão

O **plano está correto** e alinhado com a estrutura real do banco de dados. A **documentação precisa ser atualizada** para refletir:

1. Nomenclatura correta de campos (`tenant_id` vs `id_tenant`)
2. JOIN necessário com `tenant_credentials`
3. Uso de Edge Function para descriptografar token
4. Campos corretos (`status` vs `ativo`)
5. Cálculo de limite a partir do plano em `config`

**Prioridade:** Alta - A documentação atual levaria a erros na implementação do fluxo n8n.

