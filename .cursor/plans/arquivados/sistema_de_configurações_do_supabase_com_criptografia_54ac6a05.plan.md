---
name: Sistema de Configurações do Supabase com Criptografia
overview: Criar uma solução completa para armazenar configurações do Supabase (url_base, anon_key, service_role_key) no banco de dados com criptografia automática, permitindo que o n8n consulte facilmente essas credenciais através de funções RPC.
todos:
  - id: create-migration
    content: Criar migração 012_create_system_config_table.sql com tabela, índices, RLS e políticas de segurança
    status: completed
  - id: create-get-function
    content: Criar função get_system_config.sql que retorna configurações com descriptografia automática
    status: completed
  - id: create-set-function
    content: Criar função set_system_config.sql que salva/atualiza configurações com criptografia automática e validação de permissões
    status: completed
  - id: test-functions
    content: Testar as funções no SQL Editor do Supabase e verificar se criptografia/descriptografia funcionam corretamente
    status: pending
    note: Arquivos criados e prontos para execução. Teste deve ser feito manualmente no SQL Editor do Supabase seguindo a ordem de execução do plano.
---

# Plano: Sistema de Configurações do Supabase com Criptografia

## Objetivo

Criar uma solução centralizada para armazenar e gerenciar configurações do Supabase no banco de dados, com criptografia automática para valores sensíveis, facilitando o acesso pelo n8n através de funções RPC.

## Problema que Resolve

Atualmente, as credenciais do Supabase estão em variáveis de ambiente no frontend. Precisamos:

- Centralizar essas configurações no banco de dados
- Permitir que o n8n acesse facilmente via "Get Many Rows"
- Criptografar valores sensíveis (anon_key e service_role_key)
- Manter rastreabilidade de quem atualizou cada configuração

## Arquitetura da Solução

### 1. Tabela `system_config`

**Arquivo:** `sql/migrations/012_create_system_config_table.sql`

Estrutura:

- `key` (TEXT, PRIMARY KEY): Chave única da configuração (ex: 'supabase_url_base', 'supabase_anon_key')
- `value` (TEXT): Valor da configuração (criptografado se `is_encrypted = true`)
- `description` (TEXT): Descrição do que é essa configuração
- `is_encrypted` (BOOLEAN): Flag indicando se o valor está criptografado
- `updated_at` (TIMESTAMPTZ): Data da última atualização
- `updated_by` (UUID, FK auth.users): Usuário que fez a última atualização

**Segurança (RLS):**

- Apenas ADMINs podem inserir/atualizar configurações
- Sistema (Service Role) pode ler todas as configurações (para n8n)
- Políticas RLS garantem isolamento adequado

**Por que essa estrutura?**

- Chave-valor simples e flexível
- Permite adicionar novas configurações sem alterar schema
- Flag `is_encrypted` permite descriptografar automaticamente na leitura
- Rastreabilidade com `updated_by` e `updated_at`

### 2. Função RPC: `get_system_config()`

**Arquivo:** `sql/functions/get_system_config.sql`

**O que faz:**

- Retorna todas as configurações do sistema
- Descriptografa automaticamente valores onde `is_encrypted = true`
- Usa `SECURITY DEFINER` para bypass RLS quando necessário

**Como funciona:**

1. Busca a chave de criptografia via `get_encryption_key()`
2. Para cada registro, verifica se `is_encrypted = true`
3. Se criptografado, chama `decrypt_token()` antes de retornar
4. Retorna tabela com valores já descriptografados

**Uso no n8n (APENAS LEITURA):**

- Node Supabase → Operation: "Execute Function"
- Function Name: `get_system_config`
- Retorna todas as configurações prontas para uso (já descriptografadas)
- **Nota:** O n8n apenas consulta, não insere/atualiza configurações

### 3. Função RPC: `set_system_config()`

**Arquivo:** `sql/functions/set_system_config.sql`

**O que faz:**

- Salva ou atualiza uma configuração
- Criptografa automaticamente se `is_encrypted = true`
- Valida que apenas ADMINs podem modificar
- **Uso:** Apenas via SQL Editor do Supabase (não será usado no n8n)

**Parâmetros:**

- `p_key`: Chave da configuração
- `p_value`: Valor (será criptografado se necessário)
- `p_description`: Descrição opcional
- `p_is_encrypted`: Se deve criptografar (default: false)

**Como funciona:**

1. Verifica se usuário é ADMIN via `is_admin()`
2. Se `p_is_encrypted = true`, criptografa o valor usando `encrypt_token()`
3. Usa `INSERT ... ON CONFLICT DO UPDATE` para inserir ou atualizar
4. Registra quem atualizou em `updated_by`

**Retorno:**

- JSONB com `success`, `key` e `message`

## Fluxo de Criptografia

### Ao Salvar (set_system_config):

```
Valor em texto plano → encrypt_token() → Valor criptografado (base64) → Banco de dados
```

### Ao Ler (get_system_config):

```
Valor criptografado (base64) → decrypt_token() → Valor em texto plano → Retornado ao n8n
```

**Tecnologia:**

- Usa `pgcrypto` (já habilitado no Supabase)
- Função `pgp_sym_encrypt()` para criptografar
- Função `pgp_sym_decrypt()` para descriptografar
- Codificação base64 para armazenamento seguro

## Exemplo de Uso

### 1. Inserir/Atualizar Configurações (APENAS via SQL Editor do Supabase)

**IMPORTANTE:** A inserção e atualização de configurações será feita **exclusivamente via SQL Editor do Supabase**, não através do n8n. Administradores devem usar a função `set_system_config()` diretamente no SQL Editor.

```sql
-- URL base (não precisa criptografar - é pública)
SELECT public.set_system_config(
    'supabase_url_base',
    'https://lfuzyaqqdygnlnslhrmw.supabase.co',
    'URL base do projeto Supabase',
    false
);

-- Anon Key (criptografar - pode ser exposta no frontend mas por segurança criptografamos)
SELECT public.set_system_config(
    'supabase_anon_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Chave anon do Supabase (pode ser usada no frontend)',
    true
);

-- Service Role Key (MUITO SENSÍVEL - sempre criptografar)
SELECT public.set_system_config(
    'supabase_service_role_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Chave service_role do Supabase (NUNCA expor no frontend)',
    true
);
```

**Nota:** A função `set_system_config()` valida que apenas usuários ADMIN podem modificar configurações. Se executar sem estar autenticado como ADMIN, retornará erro.

### 2. Consultar no n8n (APENAS LEITURA)

**Opção A - Via Função RPC (Recomendado):**

- Node: Supabase
- Operation: Execute Function
- Function Name: `get_system_config`
- Resultado: Array com todas as configurações já descriptografadas

**Opção B - Via Get Many Rows:**

- Node: Supabase
- Operation: Get Many Rows
- Table: `system_config`
- ⚠️ Atenção: Valores criptografados virão criptografados (precisa descriptografar manualmente)

### 3. Usar no Workflow n8n

Após chamar `get_system_config()`, você terá um array como:

```json
[
  {
    "key": "supabase_url_base",
    "value": "https://lfuzyaqqdygnlnslhrmw.supabase.co",
    "description": "URL base do projeto Supabase",
    "is_encrypted": false
  },
  {
    "key": "supabase_anon_key",
    "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "description": "Chave anon do Supabase",
    "is_encrypted": true
  },
  {
    "key": "supabase_service_role_key",
    "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "description": "Chave service_role do Supabase",
    "is_encrypted": true
  }
]
```

Use um node "Set" ou "Function" para extrair os valores específicos que precisa.

## Arquivos a Criar

1. **`sql/migrations/012_create_system_config_table.sql`**

   - Cria tabela `system_config`
   - Define índices
   - Configura RLS e políticas
   - Cria trigger para `updated_at`

2. **`sql/functions/get_system_config.sql`**

   - Função RPC para buscar todas as configurações
   - Descriptografa automaticamente valores criptografados
   - Retorna tabela pronta para uso no n8n

3. **`sql/functions/set_system_config.sql`**

   - Função RPC para salvar/atualizar configurações
   - Criptografa automaticamente se necessário
   - Validação de permissões (apenas ADMIN)

## Dependências

- Função `get_encryption_key()` - já existe em `sql/functions/manage_tenant_credentials.sql`
- Função `encrypt_token()` - já existe em `sql/schema.sql`
- Função `decrypt_token()` - já existe em `sql/schema.sql`
- Função `is_admin()` - já existe em `sql/schema.sql`
- Função `update_updated_at_column()` - já existe em `sql/schema.sql`
- Extensão `pgcrypto` - já habilitada no schema

## Segurança

1. **Criptografia:**

   - Valores sensíveis são criptografados usando pgcrypto
   - Chave de criptografia vem de `get_encryption_key()` (configurável via Supabase Vault em produção)

2. **Acesso:**

   - Apenas ADMINs podem modificar configurações
   - Sistema (Service Role) pode ler para uso no n8n
   - RLS garante isolamento adequado

3. **Rastreabilidade:**

   - Campo `updated_by` registra quem modificou
   - Campo `updated_at` registra quando foi modificado

## Ordem de Execução

1. **Executar migração** `012_create_system_config_table.sql` no SQL Editor do Supabase
2. **Executar função** `get_system_config.sql` no SQL Editor
3. **Executar função** `set_system_config.sql` no SQL Editor
4. **Inserir configurações iniciais** usando `set_system_config()` diretamente no SQL Editor (como ADMIN)
5. **Testar consulta no n8n** usando `get_system_config()` via função RPC

**IMPORTANTE:**

- Inserção/atualização de configurações: **APENAS via SQL Editor do Supabase** (função `set_system_config()`)
- Consulta de configurações no n8n: **APENAS leitura** via função RPC `get_system_config()`

## Vantagens desta Abordagem

1. **Centralização:** Todas as configurações em um só lugar
2. **Segurança:** Criptografia automática para valores sensíveis
3. **Facilidade:** n8n pode consultar via função RPC simples
4. **Flexibilidade:** Fácil adicionar novas configurações sem alterar schema
5. **Rastreabilidade:** Sabe quem e quando modificou cada configuração
6. **Consistência:** Usa o mesmo padrão de criptografia já existente no projeto