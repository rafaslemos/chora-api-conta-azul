/**
 * Serviço para gerenciar regras de mapeamento
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MappingRule } from '../types';

export const mappingRuleService = {
  /**
   * Lista regras de mapeamento por tenant
   */
  async list(tenantId: string): Promise<MappingRule[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase
        .from('mapping_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Erro ao buscar regras de mapeamento:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        conditionField: rule.condition_field as 'SKU' | 'CATEGORY' | 'MARKETPLACE' | 'PRODUCT_NAME',
        conditionValue: rule.condition_value,
        targetAccount: rule.target_account,
        priority: rule.priority || 0,
        lancamentoType: rule.lancamento_type as 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE' | undefined,
        contaPadrao: rule.conta_padrao || false,
        isActive: rule.is_active !== false,
        config: rule.config || {},
      }));
    } catch (error) {
      console.error('Erro ao buscar regras de mapeamento:', error);
      throw error;
    }
  },

  /**
   * Busca regra por ID
   */
  async getById(id: string): Promise<MappingRule | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('mapping_rules')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar regra:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        conditionField: data.condition_field as 'SKU' | 'CATEGORY' | 'MARKETPLACE' | 'PRODUCT_NAME',
        conditionValue: data.condition_value,
        targetAccount: data.target_account,
        priority: data.priority || 0,
        lancamentoType: data.lancamento_type as 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE' | undefined,
        contaPadrao: data.conta_padrao || false,
        isActive: data.is_active !== false,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao buscar regra:', error);
      throw error;
    }
  },

  /**
   * Cria uma nova regra
   */
  async create(rule: {
    tenantId: string;
    name: string;
    conditionField: 'CATEGORY' | 'MARKETPLACE' | 'SKU' | 'PRODUCT_NAME';
    conditionValue: string;
    targetAccount: string;
    priority?: number;
    lancamentoType?: 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE';
    contaPadrao?: boolean;
    config?: Record<string, any>;
  }): Promise<MappingRule> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('mapping_rules')
        .insert([{
          tenant_id: rule.tenantId,
          name: rule.name,
          condition_field: rule.conditionField,
          condition_value: rule.conditionValue,
          target_account: rule.targetAccount,
          priority: rule.priority || 0,
          lancamento_type: rule.lancamentoType || 'RECEITA',
          conta_padrao: rule.contaPadrao || false,
          config: rule.config || {},
          is_active: true,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar regra:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        conditionField: data.condition_field as 'SKU' | 'CATEGORY' | 'MARKETPLACE' | 'PRODUCT_NAME',
        conditionValue: data.condition_value,
        targetAccount: data.target_account,
        priority: data.priority || 0,
        lancamentoType: data.lancamento_type as 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE' | undefined,
        contaPadrao: data.conta_padrao || false,
        isActive: data.is_active !== false,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao criar regra:', error);
      throw error;
    }
  },

  /**
   * Atualiza uma regra
   */
  async update(id: string, updates: Partial<MappingRule>): Promise<MappingRule> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const updateData: any = {};

      if (updates.name) {
        updateData.name = updates.name;
      }
      if (updates.conditionField) {
        updateData.condition_field = updates.conditionField;
      }
      if (updates.conditionValue) {
        updateData.condition_value = updates.conditionValue;
      }
      if (updates.targetAccount) {
        updateData.target_account = updates.targetAccount;
      }
      if (updates.priority !== undefined) {
        updateData.priority = updates.priority;
      }
      if (updates.lancamentoType !== undefined) {
        updateData.lancamento_type = updates.lancamentoType;
      }
      if (updates.contaPadrao !== undefined) {
        updateData.conta_padrao = updates.contaPadrao;
      }
      if (updates.config !== undefined) {
        updateData.config = updates.config;
      }
      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      const { data, error } = await supabase
        .from('mapping_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar regra:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        conditionField: data.condition_field as 'SKU' | 'CATEGORY' | 'MARKETPLACE' | 'PRODUCT_NAME',
        conditionValue: data.condition_value,
        targetAccount: data.target_account,
        priority: data.priority || 0,
        lancamentoType: data.lancamento_type as 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE' | undefined,
        contaPadrao: data.conta_padrao || false,
        isActive: data.is_active !== false,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao atualizar regra:', error);
      throw error;
    }
  },

  /**
   * Deleta uma regra
   */
  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { error } = await supabase
        .from('mapping_rules')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar regra:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro ao deletar regra:', error);
      throw error;
    }
  },
};

