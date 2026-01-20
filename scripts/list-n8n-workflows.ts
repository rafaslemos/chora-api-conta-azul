/**
 * Script para listar workflows do n8n com a tag "BPO-Automatizado"
 * 
 * Uso: npm run list-n8n-workflows
 * 
 * Requer variáveis de ambiente:
 * - VITE_N8N_URL: URL base do n8n (ex: http://localhost:5678)
 * - VITE_N8N_API_KEY: API Key do n8n
 * 
 * As variáveis podem estar em:
 * - Arquivo .env.local (carregado automaticamente)
 * - Variáveis de ambiente do sistema
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carregar variáveis de ambiente do .env.local
config({ path: resolve(process.cwd(), '.env.local') });
// Também tenta carregar .env como fallback
config({ path: resolve(process.cwd(), '.env') });

interface N8nWorkflow {
  id: string | number;
  name: string;
  active: boolean;
  tags?: string[] | { id: string; name: string }[];
  createdAt?: string;
  updatedAt?: string;
  nodes?: any[];
  connections?: any;
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
 * Lista todos os workflows do n8n
 */
async function listN8nWorkflows(): Promise<N8nWorkflow[]> {
  const n8nUrl = process.env.VITE_N8N_URL;
  const n8nApiKey = process.env.VITE_N8N_API_KEY;

  if (!n8nUrl || !n8nApiKey) {
    throw new Error('n8n não está configurado. Configure VITE_N8N_URL e VITE_N8N_API_KEY');
  }

  const response = await fetch(`${n8nUrl}/api/v1/workflows`, {
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': n8nApiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Erro de autenticação. Verifique se a API Key está correta.');
    }
    if (response.status === 404) {
      throw new Error('URL do n8n não encontrada. Verifique se a URL está correta.');
    }
    throw new Error(`Erro ao listar workflows: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Filtra workflows por tag
 */
function filterWorkflowsByTag(workflows: N8nWorkflow[], tag: string): N8nWorkflow[] {
  return workflows.filter((workflow) => {
    if (!workflow.tags || workflow.tags.length === 0) {
      return false;
    }

    // Tags podem ser array de strings ou array de objetos { id, name }
    const tagNames = workflow.tags.map((t: any) => 
      typeof t === 'string' ? t : t.name || t.id
    );

    return tagNames.includes(tag);
  });
}

/**
 * Formata data para exibição
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  } catch {
    return dateString;
  }
}

/**
 * Formata tags para exibição
 */
function formatTags(tags?: string[] | { id: string; name: string }[]): string {
  if (!tags || tags.length === 0) return 'Nenhuma';
  
  const tagNames = tags.map((t: any) => 
    typeof t === 'string' ? t : t.name || t.id
  );
  
  return tagNames.join(', ');
}

/**
 * Exibe informações dos workflows no console
 */
function displayWorkflows(workflows: N8nWorkflow[]): void {
  if (workflows.length === 0) {
    console.log('\n❌ Nenhum workflow com a tag "BPO-Automatizado" foi encontrado.\n');
    return;
  }

  const activeCount = workflows.filter(w => w.active).length;
  const inactiveCount = workflows.length - activeCount;

  console.log('\n' + '='.repeat(80));
  console.log('📋 WORKFLOWS N8N - TAG: BPO-Automatizado');
  console.log('='.repeat(80));
  console.log(`\n📊 Estatísticas:`);
  console.log(`   Total encontrados: ${workflows.length}`);
  console.log(`   ✅ Ativos: ${activeCount}`);
  console.log(`   ⏸️  Inativos: ${inactiveCount}`);
  console.log('\n' + '-'.repeat(80));

  workflows.forEach((workflow, index) => {
    const status = workflow.active ? '✅ ATIVO' : '⏸️  INATIVO';
    const statusColor = workflow.active ? '\x1b[32m' : '\x1b[33m';
    const resetColor = '\x1b[0m';

    console.log(`\n${index + 1}. ${workflow.name}`);
    console.log(`   ID: ${workflow.id}`);
    console.log(`   Status: ${statusColor}${status}${resetColor}`);
    console.log(`   Tags: ${formatTags(workflow.tags)}`);
    console.log(`   Criado em: ${formatDate(workflow.createdAt)}`);
    console.log(`   Atualizado em: ${formatDate(workflow.updatedAt)}`);
    
    if (workflow.nodes && workflow.nodes.length > 0) {
      console.log(`   Nós: ${workflow.nodes.length}`);
    }
    
    console.log('-'.repeat(80));
  });

  console.log('\n');
}

/**
 * Função principal
 */
async function main() {
  console.log('\n🔍 Conectando com n8n...\n');

  // Verificar configuração
  if (!isN8nConfigured()) {
    console.error('❌ Erro: n8n não está configurado.');
    console.error('\nConfigure as seguintes variáveis de ambiente:');
    console.error('  - VITE_N8N_URL: URL base do n8n (ex: http://localhost:5678)');
    console.error('  - VITE_N8N_API_KEY: API Key do n8n\n');
    process.exit(1);
  }

  const n8nUrl = process.env.VITE_N8N_URL!;
  console.log(`📍 URL do n8n: ${n8nUrl}`);
  console.log(`🔑 API Key: ${process.env.VITE_N8N_API_KEY ? '✅ Configurada' : '❌ Não configurada'}\n`);

  try {
    // Listar todos os workflows
    console.log('📥 Buscando workflows...');
    const allWorkflows = await listN8nWorkflows();
    console.log(`   Total de workflows no n8n: ${allWorkflows.length}`);

    // Filtrar por tag "BPO-Automatizado"
    console.log('🔍 Filtrando workflows com tag "BPO-Automatizado"...');
    const filteredWorkflows = filterWorkflowsByTag(allWorkflows, 'BPO-Automatizado');
    console.log(`   Workflows encontrados: ${filteredWorkflows.length}\n`);

    // Exibir resultados
    displayWorkflows(filteredWorkflows);

    // Resumo final
    if (filteredWorkflows.length > 0) {
      console.log('✅ Processo concluído com sucesso!\n');
    } else {
      console.log('ℹ️  Nenhum workflow com a tag "BPO-Automatizado" foi encontrado.');
      console.log('   Certifique-se de que os workflows no n8n possuem essa tag.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Erro ao conectar com n8n:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('autenticação') || error.message.includes('401')) {
      console.error('💡 Dica: Verifique se a API Key está correta.');
    } else if (error.message.includes('404') || error.message.includes('não encontrada')) {
      console.error('💡 Dica: Verifique se a URL do n8n está correta e acessível.');
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      console.error('💡 Dica: Verifique se o n8n está rodando e acessível.');
    }
    
    console.error('');
    process.exit(1);
  }
}

// Executar
main().catch((error) => {
  console.error('\n❌ Erro inesperado:', error);
  process.exit(1);
});

