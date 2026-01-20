/**
 * Serviço para mapear e sincronizar workflows do n8n com fluxos de integração
 */

import { n8nService, N8nWorkflow } from './n8nService';
import { IntegrationFlow, PlatformType } from '../types';

export interface MappedFlow extends IntegrationFlow {
  n8nWorkflowId: string;
  n8nWorkflowName: string;
  lastSync?: string;
  executionCount?: number;
}

export const flowMappingService = {
  /**
   * Busca e mapeia todos os workflows do n8n com a tag "bpo-automatizado"
   */
  async mapBpoAutomatedFlows(): Promise<MappedFlow[]> {
    try {
      const workflows = await n8nService.listWorkflowsByTag('bpo-automatizado');
      
      return workflows.map((workflow) => {
        // Analisa os nós do workflow para determinar origem e destino
        const { source, destination } = this.analyzeWorkflowNodes(workflow);
        
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
          lastSync: workflow.updatedAt,
        };
      });
    } catch (error) {
      console.error('Erro ao mapear fluxos do n8n:', error);
      throw error;
    }
  },

  /**
   * Analisa os nós de um workflow para determinar origem e destino
   */
  analyzeWorkflowNodes(workflow: N8nWorkflow): { source: PlatformType; destination: PlatformType } {
    // Apenas Conta Azul suportado
    const source: PlatformType = 'CONTA_AZUL';
    const destination: PlatformType = 'CONTA_AZUL';

    return { source, destination };
  },

  /**
   * Sincroniza workflows do n8n com os fluxos do sistema
   */
  async syncN8nWorkflows(): Promise<{
    mapped: MappedFlow[];
    total: number;
    active: number;
    inactive: number;
  }> {
    try {
      const mappedFlows = await this.mapBpoAutomatedFlows();
      
      return {
        mapped: mappedFlows,
        total: mappedFlows.length,
        active: mappedFlows.filter((f) => f.active).length,
        inactive: mappedFlows.filter((f) => !f.active).length,
      };
    } catch (error) {
      console.error('Erro ao sincronizar workflows:', error);
      throw error;
    }
  },

  /**
   * Obtém estatísticas dos workflows mapeados
   */
  async getMappedFlowsStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    bySource: Record<string, number>;
    byDestination: Record<string, number>;
  }> {
    try {
      const mappedFlows = await this.mapBpoAutomatedFlows();
      
      const bySource: Record<string, number> = {};
      const byDestination: Record<string, number> = {};

      mappedFlows.forEach((flow) => {
        bySource[flow.source] = (bySource[flow.source] || 0) + 1;
        byDestination[flow.destination] = (byDestination[flow.destination] || 0) + 1;
      });

      return {
        total: mappedFlows.length,
        active: mappedFlows.filter((f) => f.active).length,
        inactive: mappedFlows.filter((f) => !f.active).length,
        bySource,
        byDestination,
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  },
};

