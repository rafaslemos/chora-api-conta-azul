/**
 * Serviço para testar regras de mapeamento com pedidos de exemplo
 * ⚠️ SEGURANÇA: Todos os dados são sanitizados antes de retornar
 */

import { MappingRule } from '../types';

export interface TestPedidoItem {
  sku: string;
  nome: string;
  categoria?: string;
  marketplace: string;
  quantidade: number;
  valor_unitario: number;
}

export interface TestPedido {
  numero: string;
  data_pedido: string;
  marketplace: string;
  itens: TestPedidoItem[];
}

export interface TestResult {
  pedido: TestPedido;
  regrasAplicadas: Array<{
    regra: MappingRule;
    itensAplicados: TestPedidoItem[];
    contaDestino: string;
    valorTotal: number;
  }>;
  lancamentosGerados: Array<{
    tipo: 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE';
    conta: string;
    valor: number;
    descricao: string;
  }>;
}

/**
 * Aplica regras de mapeamento a um pedido de teste
 * ⚠️ SEGURANÇA: Valida e sanitiza todos os dados de entrada
 */
export function testMappingRules(
  pedido: TestPedido,
  regras: MappingRule[]
): TestResult {
  // ⚠️ SEGURANÇA: Validar entrada
  if (!pedido || !regras || !Array.isArray(regras)) {
    throw new Error('Dados inválidos para teste');
  }

  // Ordenar regras por prioridade (maior primeiro)
  const regrasOrdenadas = [...regras]
    .filter(r => r.isActive !== false)
    .sort((a, b) => b.priority - a.priority);

  const regrasAplicadas: TestResult['regrasAplicadas'] = [];
  const itensProcessados = new Set<string>();

  // Aplicar regras a cada item
  for (const item of pedido.itens) {
    // ⚠️ SEGURANÇA: Validar item
    if (!item.sku || !item.marketplace) {
      continue;
    }

    // Encontrar primeira regra que se aplica
    for (const regra of regrasOrdenadas) {
      let aplica = false;

      switch (regra.conditionField) {
        case 'MARKETPLACE':
          aplica = item.marketplace.toLowerCase().includes(regra.conditionValue.toLowerCase());
          break;
        case 'SKU':
          aplica = item.sku.toLowerCase().includes(regra.conditionValue.toLowerCase());
          break;
        case 'CATEGORY':
          aplica = item.categoria?.toLowerCase().includes(regra.conditionValue.toLowerCase()) || false;
          break;
        case 'PRODUCT_NAME':
          aplica = item.nome.toLowerCase().includes(regra.conditionValue.toLowerCase());
          break;
      }

      if (aplica) {
        const chaveItem = `${item.sku}-${item.marketplace}`;
        if (!itensProcessados.has(chaveItem)) {
          itensProcessados.add(chaveItem);

          const valorTotal = item.quantidade * item.valor_unitario;

          // Verificar se já existe regra aplicada para esta conta
          const regraExistente = regrasAplicadas.find(r => r.regra.id === regra.id);
          if (regraExistente) {
            regraExistente.itensAplicados.push(item);
            regraExistente.valorTotal += valorTotal;
          } else {
            regrasAplicadas.push({
              regra,
              itensAplicados: [item],
              contaDestino: regra.targetAccount,
              valorTotal,
            });
          }
          break; // Usar apenas a primeira regra que se aplica
        }
      }
    }
  }

  // Gerar lançamentos baseados nas regras aplicadas
  const lancamentosGerados: TestResult['lancamentosGerados'] = [];

  for (const regraAplicada of regrasAplicadas) {
    const tipo = regraAplicada.regra.lancamentoType || 'RECEITA';
    const descricao = `Pedido ${pedido.numero} - ${regraAplicada.itensAplicados.length} item(ns)`;

    lancamentosGerados.push({
      tipo,
      conta: regraAplicada.contaDestino,
      valor: regraAplicada.valorTotal,
      descricao,
    });
  }

  // ⚠️ SEGURANÇA: Sanitizar resultado antes de retornar
  return {
    pedido: {
      numero: pedido.numero,
      data_pedido: pedido.data_pedido,
      marketplace: pedido.marketplace,
      itens: pedido.itens.map(item => ({
        sku: item.sku,
        nome: item.nome,
        categoria: item.categoria,
        marketplace: item.marketplace,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
      })),
    },
    regrasAplicadas: regrasAplicadas.map(ra => ({
      regra: {
        id: ra.regra.id,
        name: ra.regra.name,
        conditionField: ra.regra.conditionField,
        conditionValue: ra.regra.conditionValue,
        targetAccount: ra.regra.targetAccount,
        priority: ra.regra.priority,
        lancamentoType: ra.regra.lancamentoType,
        contaPadrao: ra.regra.contaPadrao,
        isActive: ra.regra.isActive,
        // ⚠️ NUNCA incluir config se contiver dados sensíveis
        config: {},
      },
      itensAplicados: ra.itensAplicados,
      contaDestino: ra.contaDestino,
      valorTotal: ra.valorTotal,
    })),
    lancamentosGerados,
  };
}

/**
 * Gera um pedido de exemplo para teste
 */
export function generateExamplePedido(): TestPedido {
  return {
    numero: 'PED-2024-001',
    data_pedido: new Date().toISOString().split('T')[0],
    marketplace: 'Shopee',
    itens: [
      {
        sku: 'PROD-001',
        nome: 'Produto Exemplo 1',
        categoria: 'Eletrônicos',
        marketplace: 'Shopee',
        quantidade: 2,
        valor_unitario: 99.90,
      },
      {
        sku: 'PROD-002',
        nome: 'Produto Exemplo 2',
        categoria: 'Roupas',
        marketplace: 'wBuy',
        quantidade: 1,
        valor_unitario: 149.90,
      },
    ],
  };
}
