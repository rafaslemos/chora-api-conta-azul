# Ordem de Criação e Dependências do Schema

Este documento explica a ordem correta de criação e as dependências entre os objetos do banco de dados.

## Ordem de Execução

O schema está organizado na seguinte ordem, que deve ser respeitada:

### 1. Extensões (Linhas 14-22)
- `pgcrypto` - Para criptografia
- `uuid-ossp` - Para geração de UUIDs
- **Sem dependências**

### 2. Tabelas (Linhas 24-178)

#### Ordem de criação (respeitando foreign keys):

1. **profiles** (Linhas 31-41)
   - Referencia: `auth.users(id)` (tabela do Supabase Auth)
   - **Sem dependências de outras tabelas públicas**

2. **tenants** (Linhas 49-61)
   - Referencia: `public.profiles(id)` via `partner_id`
   - **Depende de**: `profiles`

3. **tenant_credentials** (Linhas 69-84)
   - Referencia: `public.tenants(id)`
   - **Depende de**: `tenants`

4. **integration_flows** (Linhas 93-104)
   - Referencia: `public.tenants(id)`
   - **Depende de**: `tenants`

5. **mapping_rules** (Linhas 112-123)
   - Referencia: `public.tenants(id)`
   - **Depende de**: `tenants`

6. **sync_jobs** (Linhas 130-142)
   - Referencia: `public.tenants(id)`
   - **Depende de**: `tenants`

7. **audit_logs** (Linhas 150-162)
   - Referencia: `public.tenants(id)` e `auth.users(id)`
   - **Depende de**: `tenants` (opcional, pode ser NULL)

8. **user_sessions** (Linhas 169-176)
   - Referencia: `auth.users(id)`
   - **Sem dependências de tabelas públicas**

### 3. Funções (Linhas 180-305)

#### Ordem de criação:

1. **handle_new_user()** (Linhas 187-198)
   - `SECURITY DEFINER` - Bypassa RLS
   - Usada por: Trigger `on_auth_user_created`
   - **Depende de**: Tabela `profiles`

2. **update_updated_at_column()** (Linhas 205-211)
   - Função genérica para triggers
   - **Sem dependências**

3. **encrypt_token()** (Linhas 219-227)
   - `SECURITY DEFINER` - Bypassa RLS
   - Usa extensão `pgcrypto`
   - **Depende de**: Extensão `pgcrypto`

4. **decrypt_token()** (Linhas 234-242)
   - `SECURITY DEFINER` - Bypassa RLS
   - Usa extensão `pgcrypto`
   - **Depende de**: Extensão `pgcrypto`

5. **is_admin()** (Linhas 249-257)
   - `SECURITY DEFINER STABLE` - Bypassa RLS
   - Usada por: Todas as políticas RLS que verificam ADMIN
   - **Depende de**: Tabela `profiles`
   - **CRÍTICO**: Evita recursão infinita nas políticas RLS

6. **create_audit_log()** (Linhas 264-303)
   - `SECURITY DEFINER` - Bypassa RLS
   - **Depende de**: Tabela `audit_logs`

### 4. Triggers (Linhas 307-347)

#### Ordem de criação:

1. **on_auth_user_created** (Linhas 312-316)
   - Tabela: `auth.users`
   - Função: `handle_new_user()`
   - **Depende de**: Função `handle_new_user()` e tabela `profiles`

2. **update_profiles_updated_at** (Linhas 319-322)
   - Tabela: `profiles`
   - Função: `update_updated_at_column()`
   - **Depende de**: Função `update_updated_at_column()`

3. **update_tenants_updated_at** (Linhas 324-327)
   - Tabela: `tenants`
   - Função: `update_updated_at_column()`
   - **Depende de**: Função `update_updated_at_column()`

4. **update_tenant_credentials_updated_at** (Linhas 329-332)
   - Tabela: `tenant_credentials`
   - Função: `update_updated_at_column()`
   - **Depende de**: Função `update_updated_at_column()`

5. **update_integration_flows_updated_at** (Linhas 334-337)
   - Tabela: `integration_flows`
   - Função: `update_updated_at_column()`
   - **Depende de**: Função `update_updated_at_column()`

6. **update_mapping_rules_updated_at** (Linhas 339-342)
   - Tabela: `mapping_rules`
   - Função: `update_updated_at_column()`
   - **Depende de**: Função `update_updated_at_column()`

### 5. Índices (Linhas 349-388)

- Todos usam `IF NOT EXISTS`, então podem ser executados múltiplas vezes
- **Dependem de**: Tabelas correspondentes
- Podem ser criados em qualquer ordem após as tabelas

### 6. Row Level Security (RLS) (Linhas 390-397)

- Habilita RLS em todas as tabelas
- **Depende de**: Tabelas existentes
- **IMPORTANTE**: RLS deve ser habilitado ANTES de criar as políticas

### 7. Políticas RLS (Linhas 404-684)

#### Ordem de criação (por tabela):

1. **profiles** (Linhas 408-442)
   - Políticas: SELECT (2), UPDATE (1), INSERT (2)
   - **Depende de**: Função `is_admin()`

2. **tenants** (Linhas 444-474)
   - Políticas: SELECT (1), INSERT (1), UPDATE (1), DELETE (1)
   - **Depende de**: Função `is_admin()`

3. **tenant_credentials** (Linhas 476-517)
   - Políticas: SELECT (1), INSERT (1), UPDATE (1), DELETE (1)
   - **Depende de**: Função `is_admin()` e tabela `tenants`

4. **integration_flows** (Linhas 519-564)
   - Políticas: SELECT (1), INSERT (1), UPDATE (1), DELETE (1)
   - **Depende de**: Função `is_admin()` e tabela `tenants`

5. **mapping_rules** (Linhas 566-611)
   - Políticas: SELECT (1), INSERT (1), UPDATE (1), DELETE (1)
   - **Depende de**: Função `is_admin()` e tabela `tenants`

6. **sync_jobs** (Linhas 613-642)
   - Políticas: SELECT (1), INSERT (1), UPDATE (1)
   - **Depende de**: Função `is_admin()` e tabela `tenants`

7. **audit_logs** (Linhas 644-670)
   - Políticas: SELECT (1), INSERT (1), DELETE (1)
   - **Depende de**: Função `is_admin()` e tabela `tenants`

8. **user_sessions** (Linhas 672-684)
   - Políticas: SELECT (1), INSERT (1)
   - **Sem dependências de funções**

## Dependências Críticas

### Função `is_admin()`
- **CRÍTICA**: Usada por TODAS as políticas RLS que verificam ADMIN
- Deve ser `SECURITY DEFINER` para evitar recursão infinita
- Deve ser criada ANTES das políticas RLS

### Tabela `profiles`
- **CRÍTICA**: Referenciada por `tenants` via `partner_id`
- Deve ser criada ANTES de `tenants`

### Tabela `tenants`
- **CRÍTICA**: Referenciada por múltiplas tabelas
- Deve ser criada ANTES de:
  - `tenant_credentials`
  - `integration_flows`
  - `mapping_rules`
  - `sync_jobs`
  - `audit_logs` (opcional)

## Idempotência

O schema foi projetado para ser **idempotente** (pode ser executado múltiplas vezes):

- ✅ Tabelas: `CREATE TABLE IF NOT EXISTS`
- ✅ Funções: `CREATE OR REPLACE FUNCTION`
- ✅ Triggers: `DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER`
- ✅ Índices: `CREATE INDEX IF NOT EXISTS`
- ✅ Políticas: `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
- ✅ Extensões: `CREATE EXTENSION IF NOT EXISTS`

## Problemas Comuns

### Erro: "trigger already exists"
- **Solução**: O schema já inclui `DROP TRIGGER IF EXISTS` antes de cada `CREATE TRIGGER`

### Erro: "policy already exists"
- **Solução**: O schema já inclui `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`

### Erro: "relation does not exist"
- **Causa**: Tentativa de criar objeto que depende de outro que não existe
- **Solução**: Execute o schema completo na ordem correta

### Erro: "infinite recursion detected in policy"
- **Causa**: Política RLS tentando verificar `is_admin()` que por sua vez acessa a mesma tabela
- **Solução**: A função `is_admin()` deve ser `SECURITY DEFINER` (já está no schema)

## Verificação Pós-Aplicação

Execute estas queries para verificar se tudo foi criado corretamente:

```sql
-- Verificar tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar funções
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Verificar triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;

-- Verificar políticas RLS
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'tenants', 'tenant_credentials', 
    'integration_flows', 'mapping_rules', 'sync_jobs', 
    'audit_logs', 'user_sessions'
);
```

