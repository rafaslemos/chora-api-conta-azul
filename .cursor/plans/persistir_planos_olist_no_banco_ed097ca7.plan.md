---
name: Persistir planos OLIST no banco
overview: Criar tabela de planos OLIST no banco de dados e atualizar a aplicação para carregar planos do banco ao invés de valores hardcoded, permitindo que alterações futuras sejam feitas apenas no banco.
todos: []
---

# Persistir Planos OLIST no Banco de Dados

## Problema Identificado

1. Os planos OLIST estão hardcoded na aplicação (`pages/Integrations.tsx`) com valores fixos:

   - Básico (60 req/min)
   - Intermediário (120 req/min)
   - Avançado (300 req/min)

2. Os planos reais da OLIST são:

   - **Começar**: 0 req/min, 0 req em lote
   - **Crescer**: 30 req/min, 5 req em lote
   - **Evoluir**: 60 req/min, 5 req em lote
   - **Potencializar**: 120 req/min, 5 req em lote

3. Quando o parceiro altera o plano no select, a alteração não é persistida no banco.

4. A necessidade é que os planos sejam armazenados no banco de dados para que alterações futuras nos limites sejam feitas apenas no banco, sem necessidade de alterar código.

## Solução

1. **Criar tabela `olist_plans`** no banco de dados para armazenar os planos e seus limites
2. **Criar serviço `olistPlanService`** para buscar planos do banco
3. **Atualizar `pages/Integrations.tsx`** para:

   - Carregar planos do banco ao invés de hardcoded
   - Persistir o plano selecionado no `config.plan` da credencial
   - Persistir o email no `config.email` da credencial

4. **Criar migration SQL** para inserir os planos iniciais

## Implementação

### 1. Migration SQL: Criar tabela de planos OLIST

**Arquivo**: `sql/migrations/006_create_olist_plans.sql`

- Criar tabela `olist_plans` com campos:
  - `id` (UUID, PK)
  - `code` (TEXT, UNIQUE) - código do plano: 'COMECAR', 'CRESCER', 'EVOLUIR', 'POTENCIALIZAR'
  - `name` (TEXT) - nome do plano: 'Começar', 'Crescer', 'Evoluir', 'Potencializar'
  - `requests_per_minute` (INTEGER) - limite de requisições por minuto
  - `batch_requests` (INTEGER) - limite de requisições em lote
  - `is_active` (BOOLEAN) - se o plano está ativo
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- Inserir os 4 planos iniciais com os valores corretos

### 2. Serviço: `services/olistPlanService.ts`

- Função `list()`: retorna todos os planos ativos
- Função `getByCode(code: string)`: retorna um plano específico
- Interface `OlistPlan` com os campos da tabela

### 3. Atualizar `pages/Integrations.tsx`

- Importar `olistPlanService`
- Substituir valores hardcoded do select por planos carregados do banco
- Atualizar função `testOlist()` para:
  - Salvar `config.plan` (código do plano: 'COMECAR', 'CRESCER', etc.)
  - Salvar `config.email` (se fornecido)
  - Testar conexão após salvar
  - Mostrar feedback de sucesso/erro
- Atualizar `loadCredentials()` para carregar planos do banco

### 4. Atualizar `credentialService.ts`

- Garantir que `update()` suporte salvar `config.email` além de `config.plan`
- O campo `config` já é JSONB e suporta ambos

## Arquivos a Criar/Modificar

1. `sql/migrations/006_create_olist_plans.sql` - Migration para criar tabela e inserir planos
2. `services/olistPlanService.ts` - Serviço para buscar planos do banco
3. `pages/Integrations.tsx` - Carregar planos do banco e persistir seleção
4. `types.ts` - Adicionar interface `OlistPlan` (opcional, pode ser no serviço)

## Estrutura da Tabela

```sql
CREATE TABLE IF NOT EXISTS public.olist_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL CHECK (code IN ('COMECAR', 'CRESCER', 'EVOLUIR', 'POTENCIALIZAR')),
    name TEXT NOT NULL,
    requests_per_minute INTEGER NOT NULL DEFAULT 0,
    batch_requests INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

## Dados Iniciais

- **COMECAR**: 0 req/min, 0 req lote
- **CRESCER**: 30 req/min, 5 req lote
- **EVOLUIR**: 60 req/min, 5 req lote
- **POTENCIALIZAR**: 120 req/min, 5 req lote

## Notas

- O plano selecionado será salvo como código (ex: 'CRESCER') no `config.plan` da credencial
- Os limites do plano serão consultados do banco quando necessário para rate limiting
- Alterações futuras nos limites podem ser feitas diretamente no banco sem alterar código