/**
 * Serviço para gerenciar fluxos de integração
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { IntegrationFlow } from '../types';

export const integrationFlowService = {
  /**
   * Lista fluxos de integração
   */
  async list(tenantId?: string): Promise<IntegrationFlow[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      let query = supabase
        .from('integration_flows')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar fluxos de integração:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((flow: any) => ({
        id: flow.id,
        name: flow.name,
        source: flow.source as IntegrationFlow['source'],
        destination: flow.destination as IntegrationFlow['destination'],
        active: flow.active || false,
        config: flow.config || {},
      }));
    } catch (error) {
      console.error('Erro ao buscar fluxos de integração:', error);
      throw error;
    }
  },

  /**
   * Busca fluxo por ID
   */
  async getById(id: string): Promise<IntegrationFlow | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('integration_flows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar fluxo:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        source: data.source as IntegrationFlow['source'],
        destination: data.destination as IntegrationFlow['destination'],
        active: data.active || false,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao buscar fluxo:', error);
      throw error;
    }
  },

  /**
   * Cria um novo fluxo
   */
  async create(flow: {
    tenantId: string;
    name: string;
    source: IntegrationFlow['source'];
    destination: IntegrationFlow['destination'];
    active?: boolean;
    config?: IntegrationFlow['config'];
    n8nWorkflowId?: string;
  }): Promise<IntegrationFlow> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('integration_flows')
        .insert([{
          tenant_id: flow.tenantId,
          name: flow.name,
          source: flow.source,
          destination: flow.destination,
          active: flow.active !== undefined ? flow.active : true,
          config: flow.config || {},
          n8n_workflow_id: flow.n8nWorkflowId || null,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar fluxo:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        source: data.source as IntegrationFlow['source'],
        destination: data.destination as IntegrationFlow['destination'],
        active: data.active || false,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao criar fluxo:', error);
      throw error;
    }
  },

  /**
   * Atualiza um fluxo
   */
  async update(id: string, updates: Partial<IntegrationFlow>): Promise<IntegrationFlow> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const updateData: any = {};

      if (updates.name) {
        updateData.name = updates.name;
      }
      if (updates.source) {
        updateData.source = updates.source;
      }
      if (updates.destination) {
        updateData.destination = updates.destination;
      }
      if (updates.active !== undefined) {
        updateData.active = updates.active;
      }
      if (updates.config) {
        updateData.config = updates.config;
      }

      const { data, error } = await supabase
        .from('integration_flows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar fluxo:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        source: data.source as IntegrationFlow['source'],
        destination: data.destination as IntegrationFlow['destination'],
        active: data.active || false,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao atualizar fluxo:', error);
      throw error;
    }
  },

  /**
   * Ativa ou desativa um fluxo
   */
  async toggle(id: string, active: boolean): Promise<IntegrationFlow> {
    return this.update(id, { active });
  },

  /**
   * Deleta um fluxo
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { error } = await supabase
        .from('integration_flows')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar fluxo:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro ao deletar fluxo:', error);
      throw error;
    }
  },
};

