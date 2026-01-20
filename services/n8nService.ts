/**
 * Serviço para gerenciar workflows e integrações do n8n
 */

import {
  isN8nConfigured,
  listN8nWorkflows,
  getN8nWorkflow,
  executeN8nWorkflow,
  triggerN8nWebhook,
  toggleN8nWorkflow,
  getN8nWorkflowExecutions,
  getN8nUrl,
} from '../lib/n8n';
import { IntegrationFlow, PlatformType } from '../types';

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  connections: any;
  settings?: any;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowData?: any;
  data?: any;
}

export const n8nService = {
  /**
   * Verifica se o n8n está configurado
   */
  isConfigured(): boolean {
    return isN8nConfigured();
  },

  /**
   * Lista todos os workflows disponíveis
   */
  async listWorkflows(): Promise<N8nWorkflow[]> {
    if (!isN8nConfigured()) {
      throw new Error('n8n não está configurado. Configure as variáveis de ambiente VITE_N8N_URL e VITE_N8N_API_KEY.');
    }

    try {
      const workflows = await listN8nWorkflows();
      
      // Se não houver workflows, retorna array vazio
      if (!workflows || workflows.length === 0) {
        return [];
      }

      return workflows.map((w: any) => ({
        id: w.id.toString(),
        name: w.name,
        active: w.active,
        nodes: w.nodes || [],
        connections: w.connections || {},
        settings: w.settings,
        tags: w.tags || [],
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
    } catch (error) {
      console.error('Erro ao listar workflows do n8n:', error);
      throw error;
    }
  },

  /**
   * Obtém um workflow específico
   */
  async getWorkflow(workflowId: string): Promise<N8nWorkflow> {
    if (!isN8nConfigured()) {
      throw new Error('n8n não está configurado');
    }

    try {
      const workflow = await getN8nWorkflow(workflowId);
      return {
        id: workflow.id.toString(),
        name: workflow.name,
        active: workflow.active,
        nodes: workflow.nodes || [],
        connections: workflow.connections || {},
        settings: workflow.settings,
        tags: workflow.tags || [],
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    } catch (error) {
      console.error(`Erro ao buscar workflow ${workflowId}:`, error);
      throw error;
    }
  },

  /**
   * Executa um workflow
   */
  async executeWorkflow(workflowId: string, data: Record<string, any> = {}): Promise<any> {
    if (!isN8nConfigured()) {
      throw new Error('n8n não está configurado');
    }

    try {
      return await executeN8nWorkflow(workflowId, data);
    } catch (error) {
      console.error(`Erro ao executar workflow ${workflowId}:`, error);
      throw error;
    }
  },

  /**
   * Dispara um webhook
   */
  async triggerWebhook(webhookPath: string, data: Record<string, any> = {}): Promise<any> {
    if (!isN8nConfigured()) {
      throw new Error('n8n não está configurado');
    }

    try {
      return await triggerN8nWebhook(webhookPath, data);
    } catch (error) {
      console.error(`Erro ao disparar webhook ${webhookPath}:`, error);
      throw error;
    }
  },

  /**
   * Ativa ou desativa um workflow
   */
  async toggleWorkflow(workflowId: string, active: boolean): Promise<N8nWorkflow> {
    if (!isN8nConfigured()) {
      throw new Error('n8n não está configurado. Configure as variáveis de ambiente VITE_N8N_URL e VITE_N8N_API_KEY.');
    }

    try {
      const workflow = await toggleN8nWorkflow(workflowId, active);
      return {
        id: workflow.id.toString(),
        name: workflow.name,
        active: workflow.active,
        nodes: workflow.nodes || [],
        connections: workflow.connections || {},
        settings: workflow.settings,
        tags: workflow.tags || [],
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    } catch (error) {
      console.error(`Erro ao atualizar workflow ${workflowId} no n8n:`, error);
      throw error;
    }
  },

  /**
   * Obtém execuções de um workflow
   */
  async getWorkflowExecutions(workflowId: string, limit: number = 10): Promise<N8nExecution[]> {
    if (!isN8nConfigured()) {
      console.warn('n8n não configurado. Retornando lista vazia.');
      return [];
    }

    try {
      const executions = await getN8nWorkflowExecutions(workflowId, limit);
      return executions.map((e: any) => ({
        id: e.id.toString(),
        workflowId: e.workflowId?.toString() || '',
        finished: e.finished || false,
        mode: e.mode || 'manual',
        retryOf: e.retryOf?.toString(),
        retrySuccessId: e.retrySuccessId?.toString(),
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
        workflowData: e.workflowData,
        data: e.data,
      }));
    } catch (error) {
      console.error(`Erro ao buscar execuções do workflow ${workflowId}:`, error);
      throw error;
    }
  },

  /**
   * Verifica se o n8n está configurado e acessível
   */
  isConfigured(): boolean {
    return isN8nConfigured();
  },

  /**
   * Retorna a URL do n8n
   */
  getUrl(): string | null {
    return getN8nUrl();
  },

  /**
   * Lista workflows filtrados por tag
   */
  async listWorkflowsByTag(tag: string): Promise<N8nWorkflow[]> {
    try {
      const allWorkflows = await this.listWorkflows();
      const filtered = allWorkflows.filter((workflow) => 
        workflow.tags && workflow.tags.includes(tag)
      );
      
      return filtered;
    } catch (error) {
      console.error(`Erro ao listar workflows com tag ${tag}:`, error);
      throw error;
    }
  },

  /**
   * Mapeia workflows do n8n para o formato de IntegrationFlow
   */
  async mapWorkflowsToIntegrationFlows(tag: string = 'bpo-automatizado'): Promise<IntegrationFlow[]> {
    const workflows = await this.listWorkflowsByTag(tag);
    
    return workflows.map((workflow) => {
      // Verifica se o workflow tem nós relacionados a Conta Azul
      const hasContaAzulNode = workflow.nodes.some((node: any) => 
        node.type.includes('contaazul') || 
        node.type.includes('conta-azul') ||
        node.name?.toLowerCase().includes('contaazul') ||
        node.name?.toLowerCase().includes('conta azul')
      );

      // Apenas Conta Azul suportado
      const source: PlatformType = 'CONTA_AZUL';
      const destination: PlatformType = 'CONTA_AZUL';

      return {
        id: `n8n-${workflow.id}`,
        name: workflow.name,
        source,
        destination,
        active: workflow.active,
        config: {
          syncProducts: true,
          createCustomers: true,
          consolidateSales: false,
        },
        n8nWorkflowId: workflow.id,
        n8nWorkflowName: workflow.name,
      } as IntegrationFlow & { n8nWorkflowId: string; n8nWorkflowName: string };
    });
  },
};

