---
name: Corrigir acesso a dados no Node 21
overview: Corrigir o body do Node 21 para acessar corretamente os dados do Node 18 (Consolidar Resultados do Batch), garantindo que valores numéricos e strings sejam tratados corretamente e evitando valores undefined no JSON.
todos:
  - id: update-node21-body
    content: Atualizar o body do Node 21 para usar valores padrão e operadores de coalescência, evitando valores undefined
    status: pending
  - id: add-debugging-note
    content: Adicionar nota sobre como verificar a conexão entre nodes e debug de dados
    status: pending
---

# Plano: Corrigir Acesso a Dados no Node 21

## Problema Identificado

O Node 21 (HTTP Request - Atualizar Sync Job) está recebendo valores `undefined` no body do request, mesmo que o Node 18 (Function - Consolidar Resultados do Batch) retorne os dados corretamente:

**Output do Node 18:**

```json
{
  "sync_job_id": "0476aad5-4c54-4daf-8b70-6b1a02bb05dc",
  "total_inseridos": 10,
  "total_erros_api": 0,
  "total_erros_insercao": 0,
  "total_processados": 10,
  "sucesso": true
}
```

**Body do Node 21 (atual):**

```json
{
  "p_id": "[undefined]",
  "p_status": "ERROR",
  "p_items_processed": [undefined],
  "p_error_message": "Erros: undefined API, undefined inserção"
}
```

## Causa

O problema ocorre porque:

1. Expressões numéricas como `{{ $json.total_inseridos }}` podem não ser interpretadas corretamente quando o valor é `undefined` ou quando há problemas de acesso ao node anterior
2. O n8n pode estar acessando dados de um node diferente ou os dados podem não estar sendo passados corretamente entre os nodes
3. Valores `undefined` estão sendo convertidos para a string literal `"[undefined]" `ou `undefined` no JSON

## Solução

Atualizar o body do Node 21 para:

1. Usar valores padrão quando os campos forem `undefined` ou `null`
2. Garantir que valores numéricos sejam sempre números válidos (não strings)
3. Usar operadores de coalescência (`??` ou `||`) nas expressões para valores padrão
4. Adicionar validação para garantir que os valores existam antes de usar

## Tarefas

### 1. Atualizar Body do Node 21

**Arquivo:** `doc/olist/fluxo_2_detalhamento_pedidos.md` (linhas 989-998)

**Mudanças:**

- Adicionar valores padrão para todos os campos numéricos
- Usar operadores de coalescência para evitar `undefined`
- Garantir que `sync_job_id` seja sempre uma string válida ou `null`
- Corrigir a expressão de `p_error_message` para lidar com valores `undefined`

**Body atualizado:**

```json
{
  "p_id": "{{ $json.sync_job_id || null }}",
  "p_status": "{{ $json.sucesso ? 'SUCCESS' : (($json.total_inseridos || 0) > 0 ? 'PARTIAL' : 'ERROR') }}",
  "p_items_processed": {{ $json.total_inseridos || 0 }},
  "p_finished_at": "{{ (() => { const now = new Date(); return now.toISOString(); })() }}",
  "p_error_message": {{ ($json.sucesso || false) ? null : JSON.stringify(`Erros: ${$json.total_erros_api || 0} API, ${$json.total_erros_insercao || 0} inserção`) }},
  "p_details": {{ JSON.stringify({ total_processados: $json.total_processados || 0, total_inseridos: $json.total_inseridos || 0 }) }}
}
```

### 2. Verificar Conexão entre Nodes

Verificar se o Node 21 está conectado corretamente ao Node 18 no fluxo do n8n. Se houver nodes intermediários, pode ser necessário ajustar a referência.

### 3. Adicionar Nota sobre Debugging

Adicionar uma nota no documento explicando como verificar se os dados estão sendo passados corretamente entre os nodes.

## Notas Importantes

- O operador `||` no n8n funciona como coalescência: `$json.campo || 0` retorna `0` se `campo` for `undefined`, `null`, `0`, `false`, ou string vazia
- Para valores numéricos, sempre usar `|| 0` para garantir que seja um número válido
- Para strings, usar `|| null` ou `|| ''` conforme apropriado
- O campo `p_error_message` deve ser `null` (sem aspas) quando não houver erro, não a string `"null"`