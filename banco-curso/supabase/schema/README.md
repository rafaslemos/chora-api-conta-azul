# Schemas do Supabase

Este diretório contém todos os schemas SQL organizados por módulo.

## Estrutura

### `auth/` - Autenticação OAuth 2.0
Tabelas relacionadas à autenticação e gerenciamento de tokens OAuth.

- **`schema.sql`** - Schema completo de autenticação:
  - `credenciais_dev` - Credenciais OAuth do Portal Dev
  - `clientes` - Clientes cadastrados com API Key
  - `tokens_oauth` - Tokens OAuth criptografados por cliente
  - Índices, triggers e RLS configurados

### `coleta/` - Coleta de Dados
Tabelas relacionadas ao sistema de coleta de dados da API Conta Azul.

- **`schema-coleta.sql`** - Tabelas de controle:
  - `controle_carga` - Controle de carga FULL e incremental por cliente e entidade
  - `config_periodicidade` - Configuração de periodicidade (uso futuro)
  
- **`schema-categorias.sql`** - Tabela de dados:
  - `categorias` - Categorias coletadas da API Conta Azul

## Ordem de Execução

### Para Autenticação:
1. `auth/schema.sql` (cria tabelas base e função `update_updated_at_column()`)

### Para Coleta de Dados:
1. `coleta/schema-coleta.sql` (tabelas de controle)
2. `coleta/schema-categorias.sql` (tabela de categorias)
3. Outras tabelas de entidades conforme necessário

## Dependências

- `auth/schema.sql` deve ser executado primeiro (cria função `update_updated_at_column()`)
- Tabelas em `coleta/` dependem de `clientes` (FK) criada em `auth/schema.sql`

## Notas

- Todas as tabelas usam UUID como chave primária
- Triggers automáticos para `updated_at`
- Índices otimizados para consultas frequentes
- RLS habilitado em tabelas sensíveis (`tokens_oauth`)
