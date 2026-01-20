# Planos Arquivados

Este diretório contém planos que não são mais relevantes para o projeto atual, mas são mantidos para referência histórica.

**Data de arquivamento:** 2025-01-20

## Motivos de Arquivamento

### 1. Planos Relacionados a OLIST/TINY (Removidos do Projeto)

Estes planos foram arquivados porque o projeto foi simplificado para ser exclusivo de Conta Azul, removendo suporte a outras plataformas:

- `de_para_olist_conta_azul.plan.md` - Mapeamento Olist → Conta Azul
- `persistir_planos_olist_no_banco_ed097ca7.plan.md` - Planos OLIST
- `planejamento_do_fluxo_1_-_pesquisar_pedidos_tiny_9dc8be09.plan.md` - Fluxo TINY

**Referência:** Implementação concluída em `remover_plataformas_não-conta_azul_1df496a5.plan.md`

### 2. Planos Relacionados a Workflows n8n

Estes planos são específicos para workflows do n8n e não fazem parte do código do projeto atual:

- `corrigir_acesso_a_dados_no_node_21_dbad04d3.plan.md` - Correção específica de workflow n8n
- `ajustar_nodes_para_usar_apenas_inserted_e3ad25b2.plan.md` - Ajustes em workflows n8n

**Nota:** Estes planos podem ser úteis para referência futura se workflows do n8n precisarem ser atualizados.

### 3. Planos Substituídos por Implementações Mais Recentes

Estes planos foram substituídos por implementações mais recentes e completas:

- `sistema_de_configurações_do_supabase_com_criptografia_54ac6a05.plan.md` - Substituído por `app_core.app_config` (migration 023)

**Referência:** Implementação atual em `salvar_client_id_e_secret_no_banco_de_dados_dd93f879.plan.md`

## Como Usar Este Diretório

- **Não edite** os planos arquivados
- **Não mova** planos de volta para a pasta principal sem revisão
- **Consulte** estes planos apenas para referência histórica
- **Use** os planos ativos em `.cursor/plans/` para trabalho atual
