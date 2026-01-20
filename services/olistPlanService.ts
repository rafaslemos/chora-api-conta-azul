/**
 * Serviço para gerenciar planos OLIST
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface OlistPlan {
  id: string;
  code: 'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR';
  name: string;
  requestsPerMinute: number;
  batchRequests: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const olistPlanService = {
  /**
   * Lista todos os planos ativos
   */
  async list(): Promise<OlistPlan[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase
        .from('olist_plans')
        .select('*')
        .eq('is_active', true)
        .order('requests_per_minute', { ascending: true });

      if (error) {
        console.error('Erro ao buscar planos OLIST:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((plan: any) => ({
        id: plan.id,
        code: plan.code as 'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR',
        name: plan.name,
        requestsPerMinute: plan.requests_per_minute,
        batchRequests: plan.batch_requests,
        isActive: plan.is_active,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      }));
    } catch (error) {
      console.error('Erro ao buscar planos OLIST:', error);
      throw error;
    }
  },

  /**
   * Busca um plano específico por código
   */
  async getByCode(code: 'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR'): Promise<OlistPlan | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('olist_plans')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Não encontrado
          return null;
        }
        console.error('Erro ao buscar plano OLIST:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        code: data.code as 'COMECAR' | 'CRESCER' | 'EVOLUIR' | 'POTENCIALIZAR',
        name: data.name,
        requestsPerMinute: data.requests_per_minute,
        batchRequests: data.batch_requests,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('Erro ao buscar plano OLIST:', error);
      throw error;
    }
  },
};

