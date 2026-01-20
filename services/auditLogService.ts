/**
 * Serviço para gerenciar logs de auditoria
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LogEntry } from '../types';

export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  status?: 'SUCCESS' | 'ERROR' | 'WARNING';
  entityType?: 'TENANT' | 'CREDENTIAL' | 'FLOW' | 'MAPPING' | 'SYNC_JOB' | 'USER';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const auditLogService = {
  /**
   * Lista logs de auditoria com filtros opcionais
   */
  async list(filters?: AuditLogFilters): Promise<LogEntry[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id(full_name),
          tenants:tenant_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar logs de auditoria:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((log: any) => ({
        id: log.id,
        timestamp: log.created_at,
        user: log.profiles?.full_name || 'Sistema',
        action: log.action,
        status: log.status as 'SUCCESS' | 'ERROR' | 'WARNING',
        details: log.details || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      throw error;
    }
  },

  /**
   * Cria um novo log de auditoria (via função RPC)
   */
  async create(log: {
    tenantId?: string;
    userId?: string;
    action: string;
    entityType?: 'TENANT' | 'CREDENTIAL' | 'FLOW' | 'MAPPING' | 'SYNC_JOB' | 'USER';
    entityId?: string;
    status: 'SUCCESS' | 'ERROR' | 'WARNING';
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase.rpc('create_audit_log', {
        p_tenant_id: log.tenantId || null,
        p_user_id: log.userId || null,
        p_action: log.action,
        p_entity_type: log.entityType || null,
        p_entity_id: log.entityId || null,
        p_status: log.status,
        p_details: log.details || null,
        p_ip_address: log.ipAddress || null,
        p_user_agent: log.userAgent || null,
      });

      if (error) {
        console.error('Erro ao criar log de auditoria:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro ao criar log de auditoria:', error);
      throw error;
    }
  },

  /**
   * Busca log por ID
   */
  async getById(id: string): Promise<LogEntry | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id(full_name),
          tenants:tenant_id(name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar log:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        timestamp: data.created_at,
        user: data.profiles?.full_name || 'Sistema',
        action: data.action,
        status: data.status as 'SUCCESS' | 'ERROR' | 'WARNING',
        details: data.details || '',
      };
    } catch (error) {
      console.error('Erro ao buscar log:', error);
      throw error;
    }
  },
};

