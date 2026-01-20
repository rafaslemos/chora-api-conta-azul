---
name: Ajustar nodes para usar apenas inserted
overview: Ajustar os nodes 19, 21 e 22 para usar apenas 'inserted' ao invés de 'total_validos' quando se referir à quantidade de pedidos processados/inseridos.
todos:
  - id: fix-node19-status
    content: Ajustar Node 19 p_status para considerar inserted
    status: pending
  - id: fix-node21-items
    content: Ajustar Node 21 p_items_processed para usar inserted
    status: pending
  - id: fix-node21-details
    content: Ajustar Node 21 p_details.total_pedidos para usar inserted
    status: pending
  - id: fix-node22-details
    content: Ajustar Node 22 p_details.total_pedidos para usar inserted
    status: pending
---

# Ajustar Nodes para Usar Apenas Inserted

## Problema Identificado

Alguns nodes ainda estão usando `total_validos` quando deveriam usar apenas `inserted` para contar pedidos novos inseridos:

1. **Node 19** (linha 1475): `p_status` usa `total_validos > 0` - pode usar `inserted > 0` para ser mais preciso
2. **Node 21** (linha 1553): `p_items_processed` usa `total_validos` - deve usar `inserted`
3. **Node 21** (linha 1556): `p_details.total_pedidos` usa `total_validos` - deve usar `inserted`
4. **Node 22** (linha 1593): `p_details.total_pedidos` usa `total_validos` - deve usar `inserted`

## Correções Necessárias

### Arquivo: `doc/olist/fluxo_1_n8n_detalhado.md`

1. **Node 19** (linha ~1475): Ajustar `p_status` para usar `inserted`:

- De: `"p_status": "{{ $json.total_validos > 0 ? 'SUCCESS' : ... }}"`
- Para: `"p_status": "{{ $json.inserted > 0 || $json.total_validos > 0 ? 'SUCCESS' : ... }}"`
- Ou simplesmente: `"p_status": "{{ ($json.inserted > 0 || $json.updated > 0) ? 'SUCCESS' : ... }}"`

2. **Node 21** (linha ~1553): Ajustar `p_items_processed`:

- De: `"p_items_processed": {{ $json.total_validos || 0 }}`
- Para: `"p_items_processed": {{ $json.inserted || 0 }}`

3. **Node 21** (linha ~1556): Ajustar `p_details.total_pedidos`:

- De: `total_pedidos: $json.total_validos`
- Para: `total_pedidos: $json.inserted`

4. **Node 22** (linha ~1593): Ajustar `p_details.total_pedidos`:

- De: `total_pedidos: $json.total_validos`
- Para: `total_pedidos: $json.inserted`

**Nota:** O Node 17 pode manter `total_validos` pois é apenas uma verificação condicional antes da inserção.