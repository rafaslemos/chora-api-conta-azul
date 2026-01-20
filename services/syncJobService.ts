/**
 * Serviço para gerenciar jobs de sincronização
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SyncJob, SyncStatus } from '../types';

export const syncJobService = {
  /**
   * Lista jobs de sincronização
   */
  async list(tenantId?: string): Promise<SyncJob[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      let query = supabase
        .from('sync_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar jobs de sincronização:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((job: any) => ({
        id: job.id,
        type: job.type as 'ORDER_SYNC' | 'PRODUCT_SYNC' | 'FEES_SYNC',
        status: job.status as SyncStatus,
        startedAt: job.started_at || job.created_at,
        finishedAt: job.finished_at || undefined,
        details: job.details || job.error_message || '',
        itemsProcessed: job.items_processed || 0,
      }));
    } catch (error) {
      console.error('Erro ao buscar jobs de sincronização:', error);
      throw error;
    }
  },

  /**
   * Busca job por ID
   */
  async getById(id: string): Promise<SyncJob | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar job:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        type: data.type as 'ORDER_SYNC' | 'PRODUCT_SYNC' | 'FEES_SYNC',
        status: data.status as SyncStatus,
        startedAt: data.started_at || data.created_at,
        finishedAt: data.finished_at || undefined,
        details: data.details || data.error_message || '',
        itemsProcessed: data.items_processed || 0,
      };
    } catch (error) {
      console.error('Erro ao buscar job:', error);
      throw error;
    }
  },

  /**
   * Cria um novo job
   */
  async create(job: {
    tenantId: string;
    type: 'ORDER_SYNC' | 'PRODUCT_SYNC' | 'FEES_SYNC' | 'CUSTOMER_SYNC';
    details?: string;
  }): Promise<SyncJob> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('sync_jobs')
        .insert([{
          tenant_id: job.tenantId,
          type: job.type,
          status: 'PENDING',
          details: job.details || null,
          items_processed: 0,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar job:', error);
        throw error;
      }

      return {
        id: data.id,
        type: data.type as 'ORDER_SYNC' | 'PRODUCT_SYNC' | 'FEES_SYNC',
        status: data.status as SyncStatus,
        startedAt: data.started_at || data.created_at,
        finishedAt: data.finished_at || undefined,
        details: data.details || '',
        itemsProcessed: data.items_processed || 0,
      };
    } catch (error) {
      console.error('Erro ao criar job:', error);
      throw error;
    }
  },

  /**
   * Atualiza um job
   */
  async update(id: string, updates: {
    status?: SyncStatus;
    itemsProcessed?: number;
    details?: string;
    errorMessage?: string;
    finishedAt?: string;
  }): Promise<SyncJob> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const updateData: any = {};

      if (updates.status) {
        updateData.status = updates.status;
      }
      if (updates.itemsProcessed !== undefined) {
        updateData.items_processed = updates.itemsProcessed;
      }
      if (updates.details) {
        updateData.details = updates.details;
      }
      if (updates.errorMessage) {
        updateData.error_message = updates.errorMessage;
      }
      if (updates.finishedAt) {
        updateData.finished_at = updates.finishedAt;
      }

      const { data, error } = await supabase
        .from('sync_jobs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar job:', error);
        throw error;
      }

      return {
        id: data.id,
        type: data.type as 'ORDER_SYNC' | 'PRODUCT_SYNC' | 'FEES_SYNC',
        status: data.status as SyncStatus,
        startedAt: data.started_at || data.created_at,
        finishedAt: data.finished_at || undefined,
        details: data.details || data.error_message || '',
        itemsProcessed: data.items_processed || 0,
      };
    } catch (error) {
      console.error('Erro ao atualizar job:', error);
      throw error;
    }
  },

  /**
   * Obtém estatísticas de jobs
   */
  async getStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    running: number;
    success: number;
    error: number;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      let query = supabase
        .from('sync_jobs')
        .select('status');

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        pending: 0,
        running: 0,
        success: 0,
        error: 0,
      };

      data?.forEach((job: any) => {
        switch (job.status) {
          case 'PENDING':
            stats.pending++;
            break;
          case 'RUNNING':
            stats.running++;
            break;
          case 'SUCCESS':
            stats.success++;
            break;
          case 'ERROR':
            stats.error++;
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  },
};

