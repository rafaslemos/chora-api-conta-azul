# Migrations do Banco de Dados

Este diretório contém todas as migrations SQL do projeto, organizadas em ordem numérica.

## Estrutura

### Migrations Ativas (001-020)

A execução é feita por **setup-config** → **run-migrations** (Fase 1), **run-migrations-integrations** (Fase 2), **run-migrations-dw** (Fase 3). A Edge Function `setup-database` é alternativa legada (não recomendada).

- **001-005**: Schemas e tabelas principais (`app_core`, `dw`)
- **006-007**: Schemas e tabelas compartilhadas de integrações
- **008-010**: Tabelas específicas da Conta Azul (entidades, financeiro, vendas)
- **011**: Funções RPC de integração Conta Azul
- **012**: Atualização de referências no DW
- **013**: Políticas RLS para integrações
- **014**: Dimensão calendário e função de carregamento
- **015**: Funções ETL de dimensões
- **016**: Funções ETL de fatos
- **017**: Views do Data Warehouse
- **018**: Ajustes do DW (constraints, verificações)
- **019**: Migrations adicionais (campos expandidos, ajustes)
- **020**: View unificada de contas financeiras

### Migrations Adicionais (021-026)

- **021**: Expandir tabela mapping_rules
- **022**: Criar tabela tenant_conta_azul_config
- **023**: Tabela app_config (também em run-migrations via 006_app_config)
- **024**: Funções RPC de app_config
- **025**: Função revoke credential
- **026**: RPC `app_core.create_or_update_profile` (cadastro de usuários). A lógica equivalente está embutida como **007_profile_rpc** em `run-migrations`.

## Pasta `arquivadas/`

Contém migrations antigas que foram substituídas ou não são mais necessárias:
- Migrations relacionadas a Olist (projeto antigo)
- Migrations relacionadas a Tiny ERP (projeto antigo)
- Migrations de ajustes pontuais que foram consolidadas

## Execução

### Automática (Recomendado)
As migrations são executadas automaticamente quando o banco é configurado pela primeira vez via app: **setup-config** chama **run-migrations** (Fase 1), **run-migrations-integrations** (Fase 2) e **run-migrations-dw** (Fase 3). O `run-migrations` contém migrations embutidas 001–007 (incluindo 007_profile_rpc); as demais fases usam migrations próprias.

### Manual
Se necessário, execute as migrations manualmente no SQL Editor do Supabase na ordem numérica (001, 002, 003, ...).

## Adicionar Nova Migration

1. Crie o arquivo SQL na pasta `sql/migrations/` com o padrão: `XXX_descricao.sql`
2. Execute o script `npm run generate-migration-constants` para embeder a migration na Edge Function `setup-database` (se aplicável). **Nota:** O `run-migrations` tem migrations próprias embutidas (001–007); alterações na Fase 1 exigem edição direta em `supabase/functions/run-migrations/index.ts`.
3. A migration será incluída no processo de setup conforme o fluxo usado (run-migrations* ou setup-database)

## Ordem de Execução

⚠️ **IMPORTANTE**: As migrations devem ser executadas na ordem numérica (001, 002, 003, ...) pois há dependências entre elas.
