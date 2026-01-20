/**
 * Script para analisar detalhadamente workflows do n8n com a tag "BPO-Automatizado"
 * Analisa cada node individualmente e gera documentação completa
 * 
 * Uso: npm run analyze-n8n-workflows
 * 
 * Requer variáveis de ambiente:
 * - VITE_N8N_URL: URL base do n8n
 * - VITE_N8N_API_KEY: API Key do n8n
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

// Carregar variáveis de ambiente
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters?: Record<string, any>;
  webhookId?: string;
  credentials?: Record<string, any>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
}

interface N8nWorkflowSummary {
  id: string | number;
  name: string;
  active: boolean;
  tags?: string[] | { id: string; name: string }[];
  createdAt?: string;
  updatedAt?: string;
}

interface N8nWorkflowDetail extends N8nWorkflowSummary {
  nodes: N8nNode[];
  connections: Record<string, any>;
  settings?: Record<string, any>;
  staticData?: any;
  pinData?: any;
}

/**
 * Verifica se o n8n está configurado
 */
function isN8nConfigured(): boolean {
  const n8nUrl = process.env.VITE_N8N_URL;
  const n8nApiKey = process.env.VITE_N8N_API_KEY;
  return !!(n8nUrl && n8nApiKey);
}

/**
 * Lista workflows do n8n com tag específica
 */
async function listN8nWorkflowsByTag(tag: string): Promise<N8nWorkflowSummary[]> {
  const n8nUrl = process.env.VITE_N8N_URL;
  const n8nApiKey = process.env.VITE_N8N_API_KEY;

  if (!n8nUrl || !n8nApiKey) {
    throw new Error('n8n não está configurado');
  }

  const response = await fetch(`${n8nUrl}/api/v1/workflows`, {
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': n8nApiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao listar workflows: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const allWorkflows = result.data || [];

  // Filtrar por tag
  return allWorkflows.filter((workflow: any) => {
    if (!workflow.tags || workflow.tags.length === 0) return false;
    const tagNames = workflow.tags.map((t: any) => 
      typeof t === 'string' ? t : t.name || t.id
    );
    return tagNames.includes(tag);
  });
}

/**
 * Busca detalhes completos de um workflow
 */
async function getWorkflowDetails(workflowId: string | number): Promise<N8nWorkflowDetail> {
  const n8nUrl = process.env.VITE_N8N_URL;
  const n8nApiKey = process.env.VITE_N8N_API_KEY;

  if (!n8nUrl || !n8nApiKey) {
    throw new Error('n8n não está configurado');
  }

  const response = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': n8nApiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar workflow ${workflowId}: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Extrai tipo base do node (remove prefixo n8n-nodes-base.)
 */
function getNodeTypeBase(nodeType: string): string {
  if (nodeType.startsWith('n8n-nodes-base.')) {
    return nodeType.replace('n8n-nodes-base.', '');
  }
  return nodeType;
}

/**
 * Formata parâmetros principais do node
 */
function formatNodeParameters(node: N8nNode): string {
  if (!node.parameters || Object.keys(node.parameters).length === 0) {
    return 'Nenhum parâmetro configurado';
  }

  const importantParams: string[] = [];
  
  // Parâmetros comuns importantes
  const commonParams = ['url', 'method', 'path', 'resource', 'operation', 'operationId', 
    'authentication', 'jsonParameters', 'options', 'assignments', 'values', 'conditions'];
  
  for (const key of commonParams) {
    if (node.parameters[key] !== undefined && node.parameters[key] !== null && node.parameters[key] !== '') {
      if (typeof node.parameters[key] === 'object') {
        importantParams.push(`- **${key}**: ${JSON.stringify(node.parameters[key]).substring(0, 100)}...`);
      } else {
        importantParams.push(`- **${key}**: ${String(node.parameters[key]).substring(0, 100)}`);
      }
    }
  }

  // Se não encontrou parâmetros comuns, pega os primeiros 5
  if (importantParams.length === 0) {
    const keys = Object.keys(node.parameters).slice(0, 5);
    for (const key of keys) {
      const value = node.parameters[key];
      if (value !== undefined && value !== null) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 80) : String(value).substring(0, 80);
        importantParams.push(`- **${key}**: ${valueStr}`);
      }
    }
  }

  return importantParams.join('\n') || 'Parâmetros configurados mas não detalhados';
}

/**
 * Analisa conexões do node
 */
function analyzeNodeConnections(nodeId: string, connections: Record<string, any>): {
  inputs: string[];
  outputs: string[];
} {
  const inputs: string[] = [];
  const outputs: string[] = [];

  // Analisar conexões de entrada
  for (const [sourceNodeId, connectionsData] of Object.entries(connections)) {
    if (typeof connectionsData === 'object' && connectionsData !== null) {
      for (const [outputIndex, targetConnections] of Object.entries(connectionsData)) {
        if (Array.isArray(targetConnections)) {
          for (const connection of targetConnections) {
            if (Array.isArray(connection) && connection.length > 0) {
              for (const target of connection) {
                if (target.node === nodeId) {
                  inputs.push(`${sourceNodeId} → [${outputIndex}]`);
                }
              }
            }
          }
        }
      }
    }
  }

  // Analisar conexões de saída
  const nodeConnections = connections[nodeId];
  if (nodeConnections && typeof nodeConnections === 'object') {
    for (const [outputIndex, targetConnections] of Object.entries(nodeConnections)) {
      if (Array.isArray(targetConnections)) {
        for (const connection of targetConnections) {
          if (Array.isArray(connection) && connection.length > 0) {
            for (const target of connection) {
              if (target.node) {
                outputs.push(`[${outputIndex}] → ${target.node}`);
              }
            }
          }
        }
      }
    }
  }

  return { inputs, outputs };
}

/**
 * Gera descrição do node baseado no tipo
 */
function getNodeDescription(node: N8nNode): string {
  const typeBase = getNodeTypeBase(node.type);
  
  const descriptions: Record<string, string> = {
    'httpRequest': 'Faz requisições HTTP para APIs externas',
    'webhook': 'Recebe dados via webhook HTTP',
    'set': 'Define/atualiza valores de campos',
    'if': 'Executa lógica condicional (IF/ELSE)',
    'switch': 'Roteia dados baseado em condições múltiplas',
    'code': 'Executa código JavaScript/Python personalizado',
    'function': 'Executa função JavaScript personalizada',
    'functionItem': 'Processa cada item com função JavaScript',
    'merge': 'Mescla múltiplos fluxos de dados',
    'splitInBatches': 'Divide dados em lotes para processamento',
    'wait': 'Aguarda um período de tempo ou evento',
    'scheduleTrigger': 'Dispara workflow em intervalos agendados',
    'cron': 'Dispara workflow baseado em expressão cron',
    'start': 'Node inicial do workflow',
    'noOp': 'Node sem operação (pass-through)',
    'stickyNote': 'Nota adesiva (apenas visual)',
    'executeWorkflow': 'Executa outro workflow',
    'readBinaryFile': 'Lê arquivo binário',
    'writeBinaryFile': 'Escreve arquivo binário',
    'postgres': 'Operações com banco de dados PostgreSQL',
    'mysql': 'Operações com banco de dados MySQL',
    'mongoDb': 'Operações com banco de dados MongoDB',
    'redis': 'Operações com Redis',
  };

  return descriptions[typeBase] || `Node do tipo ${typeBase}`;
}

/**
 * Gera documentação markdown de um workflow
 */
function generateWorkflowDocumentation(workflow: N8nWorkflowDetail, index: number): string {
  const status = workflow.active ? '✅ Ativo' : '⏸️ Inativo';
  const tags = workflow.tags?.map((t: any) => typeof t === 'string' ? t : t.name || t.id).join(', ') || 'Nenhuma';
  const n8nUrl = process.env.VITE_N8N_URL;
  const workflowUrl = n8nUrl ? `${n8nUrl}/workflow/${workflow.id}` : '';

  let doc = `## ${index}. ${workflow.name}\n\n`;
  doc += `**ID:** \`${workflow.id}\`  \n`;
  doc += `**Status:** ${status}  \n`;
  doc += `**Tags:** ${tags}  \n`;
  if (workflowUrl) {
    doc += `**URL:** [Abrir no n8n](${workflowUrl})  \n`;
  }
  doc += `**Criado em:** ${workflow.createdAt ? new Date(workflow.createdAt).toLocaleString('pt-BR') : 'N/A'}  \n`;
  doc += `**Atualizado em:** ${workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleString('pt-BR') : 'N/A'}  \n`;
  doc += `**Total de nodes:** ${workflow.nodes?.length || 0}  \n\n`;

  if (!workflow.nodes || workflow.nodes.length === 0) {
    doc += `⚠️ Este workflow não possui nodes configurados.\n\n`;
    return doc;
  }

  doc += `### Nodes do Workflow\n\n`;

  // Ordenar nodes por posição (topo para baixo, esquerda para direita)
  const sortedNodes = [...workflow.nodes].sort((a, b) => {
    if (a.position[1] !== b.position[1]) {
      return a.position[1] - b.position[1]; // Y primeiro
    }
    return a.position[0] - b.position[0]; // Depois X
  });

  sortedNodes.forEach((node, nodeIndex) => {
    const nodeTypeBase = getNodeTypeBase(node.type);
    const connections = analyzeNodeConnections(node.id, workflow.connections || {});
    const description = getNodeDescription(node);
    
    doc += `#### ${nodeIndex + 1}. ${node.name || 'Sem nome'}\n\n`;
    doc += `- **ID do Node:** \`${node.id}\`  \n`;
    doc += `- **Tipo:** \`${node.type}\` (${nodeTypeBase})  \n`;
    if (node.typeVersion) {
      doc += `- **Versão do Tipo:** ${node.typeVersion}  \n`;
    }
    doc += `- **Descrição:** ${description}  \n`;
    if (node.disabled) {
      doc += `- **Status:** ⚠️ Desabilitado  \n`;
    }
    if (node.notes) {
      doc += `- **Notas:** ${node.notes}  \n`;
    }
    if (node.webhookId) {
      doc += `- **Webhook ID:** \`${node.webhookId}\`  \n`;
    }
    
    // Conexões
    if (connections.inputs.length > 0) {
      doc += `- **Conexões de Entrada:**  \n`;
      connections.inputs.forEach(input => {
        doc += `  - ${input}  \n`;
      });
    } else {
      doc += `- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  \n`;
    }
    
    if (connections.outputs.length > 0) {
      doc += `- **Conexões de Saída:**  \n`;
      connections.outputs.forEach(output => {
        doc += `  - ${output}  \n`;
      });
    } else {
      doc += `- **Conexões de Saída:** Nenhuma (node final ou isolado)  \n`;
    }

    // Parâmetros
    doc += `- **Parâmetros Principais:**  \n`;
    doc += `${formatNodeParameters(node)}  \n`;

    // Credenciais
    if (node.credentials && Object.keys(node.credentials).length > 0) {
      doc += `- **Credenciais Utilizadas:** ${Object.keys(node.credentials).join(', ')}  \n`;
    }

    doc += `\n---\n\n`;
  });

  return doc;
}

/**
 * Função principal
 */
async function main() {
  console.log('\n🔍 Iniciando análise detalhada de workflows n8n...\n');

  if (!isN8nConfigured()) {
    console.error('❌ Erro: n8n não está configurado.');
    console.error('\nConfigure as seguintes variáveis de ambiente:');
    console.error('  - VITE_N8N_URL: URL base do n8n');
    console.error('  - VITE_N8N_API_KEY: API Key do n8n\n');
    process.exit(1);
  }

  const n8nUrl = process.env.VITE_N8N_URL!;
  console.log(`📍 URL do n8n: ${n8nUrl}\n`);

  try {
    // Listar workflows com tag BPO-Automatizado
    console.log('📥 Buscando workflows com tag "BPO-Automatizado"...');
    const workflows = await listN8nWorkflowsByTag('BPO-Automatizado');
    console.log(`   ✅ ${workflows.length} workflow(s) encontrado(s)\n`);

    if (workflows.length === 0) {
      console.log('⚠️  Nenhum workflow encontrado com a tag "BPO-Automatizado"');
      process.exit(0);
    }

    // Gerar documentação
    let documentation = `# Análise Detalhada de Workflows n8n - BPO-Automatizado\n\n`;
    documentation += `> **Gerado em:** ${new Date().toLocaleString('pt-BR')}  \n`;
    documentation += `> **Total de workflows analisados:** ${workflows.length}  \n`;
    documentation += `> **URL do n8n:** ${n8nUrl}  \n\n`;
    documentation += `---\n\n`;

    // Processar cada workflow
    for (let i = 0; i < workflows.length; i++) {
      const workflowSummary = workflows[i];
      console.log(`📊 Analisando workflow ${i + 1}/${workflows.length}: ${workflowSummary.name}...`);
      
      try {
        const workflowDetails = await getWorkflowDetails(workflowSummary.id);
        documentation += generateWorkflowDocumentation(workflowDetails, i + 1);
        documentation += `\n`;
        
        // Pequeno delay para não sobrecarregar a API
        if (i < workflows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`   ❌ Erro ao analisar workflow ${workflowSummary.name}: ${error.message}`);
        documentation += `## ${i + 1}. ${workflowSummary.name}\n\n`;
        documentation += `⚠️ **Erro ao carregar detalhes:** ${error.message}\n\n`;
      }
    }

    // Salvar documentação
    const outputPath = resolve(process.cwd(), 'doc/n8n/workflows-detailed.md');
    writeFileSync(outputPath, documentation, 'utf-8');
    
    console.log(`\n✅ Documentação gerada com sucesso!`);
    console.log(`   📄 Arquivo: ${outputPath}\n`);

  } catch (error: any) {
    console.error('\n❌ Erro ao analisar workflows:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }
}

// Executar
main().catch((error) => {
  console.error('\n❌ Erro inesperado:', error);
  process.exit(1);
});

