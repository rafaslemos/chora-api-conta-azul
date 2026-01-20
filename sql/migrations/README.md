# Migrations do Banco de Dados

Este diretório contém todas as migrations SQL do projeto, organizadas em ordem numérica.

## Estrutura

### Migrations Ativas (001-020)

As migrations ativas são executadas automaticamente pela Edge Function `setup-database`:

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

### Migrations Adicionais (021-022)

- **021**: Expandir tabela mapping_rules
- **022**: Criar tabela tenant_conta_azul_config

## Pasta `arquivadas/`

Contém migrations antigas que foram substituídas ou não são mais necessárias:
- Migrations relacionadas a Olist (projeto antigo)
- Migrations relacionadas a Tiny ERP (projeto antigo)
- Migrations de ajustes pontuais que foram consolidadas

## Execução

### Automática (Recomendado)
As migrations são executadas automaticamente pela Edge Function `setup-database` quando o banco é configurado pela primeira vez.

### Manual
Se necessário, execute as migrations manualmente no SQL Editor do Supabase na ordem numérica (001, 002, 003, ...).

## Adicionar Nova Migration

1. Crie o arquivo SQL na pasta `sql/migrations/` com o padrão: `XXX_descricao.sql`
2. Execute o script `npm run generate-migration-constants` para embeder a migration na Edge Function
3. A migration será automaticamente incluída no processo de setup

## Ordem de Execução

⚠️ **IMPORTANTE**: As migrations devem ser executadas na ordem numérica (001, 002, 003, ...) pois há dependências entre elas.
