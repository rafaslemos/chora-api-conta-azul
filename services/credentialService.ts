import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TenantCredential } from '../types';

export interface ContaAzulCredentials {
  access_token: string | null;  // Permite null para criar credencial sem tokens
  refresh_token?: string | null;
  expires_in?: number;
  is_active?: boolean;
}

export interface TestConnectionResult {
  valid: boolean;
  error?: string;
}

export const credentialService = {
  /**
   * Lista todas as credenciais de um tenant para uma plataforma específica
   * Retorna credenciais SEM tokens descriptografados (tokens aparecem como null)
   */
  async list(tenantId: string, platform: string = 'CONTA_AZUL'): Promise<TenantCredential[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      // Buscar credenciais do schema app_core (incluindo revogadas para permitir reautenticação)
      const { data, error } = await supabase
        .from('tenant_credentials')
        .select('id, tenant_id, platform, credential_name, is_active, last_sync_at, last_authenticated_at, revoked_at, webhook_url, config, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('platform', platform)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar credenciais do Supabase:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Mapear sem tokens (eles estão criptografados no banco)
      return data.map((item: any) => ({
        id: item.id,
        tenantId: item.tenant_id,
        platform: item.platform,
        credentialName: item.credential_name,
        accessToken: undefined, // Tokens não são retornados por segurança
        refreshToken: undefined,
        tokenExpiresAt: undefined,
        apiKey: undefined,
        apiSecret: undefined,
        webhookUrl: item.webhook_url,
        isActive: item.is_active,
        lastSyncAt: item.last_sync_at,
        lastAuthenticatedAt: item.last_authenticated_at,
        revokedAt: item.revoked_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        config: item.config || {},
      }));
    } catch (error) {
      console.error('Erro ao buscar credenciais:', error);
      throw error;
    }
  },

  /**
   * Busca uma credencial específica por ID
   * Retorna credencial SEM tokens descriptografados (tokens aparecem como null)
   */
  async getById(credentialId: string): Promise<TenantCredential | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase
        .from('tenant_credentials')
        .select('id, tenant_id, platform, credential_name, is_active, last_sync_at, last_authenticated_at, revoked_at, webhook_url, config, created_at, updated_at')
        .eq('id', credentialId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Erro ao buscar credencial do Supabase:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        tenantId: data.tenant_id,
        platform: data.platform,
        credentialName: data.credential_name,
        accessToken: undefined,
        refreshToken: undefined,
        tokenExpiresAt: undefined,
        apiKey: undefined,
        apiSecret: undefined,
        webhookUrl: data.webhook_url,
        isActive: data.is_active,
        lastSyncAt: data.last_sync_at,
        lastAuthenticatedAt: data.last_authenticated_at,
        revokedAt: data.revoked_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        config: data.config || {},
      };
    } catch (error) {
      console.error('Erro ao buscar credencial:', error);
      throw error;
    }
  },

  /**
   * Obtém credencial com token descriptografado (apenas quando necessário para uso)
   * ATENÇÃO: Use apenas quando realmente precisar do token (ex: para fazer requisição à API)
   */
  async getDecrypted(credentialId: string): Promise<TenantCredential | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase.rpc('get_tenant_credential_decrypted', {
        p_credential_id: credentialId,
      });

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('Acesso negado')) {
          return null;
        }
        console.error('Erro ao buscar credencial descriptografada:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const cred = data[0];
      return {
        id: cred.id,
        tenantId: cred.tenant_id,
        platform: cred.platform,
        credentialName: cred.credential_name,
        accessToken: cred.access_token,
        refreshToken: cred.refresh_token,
        tokenExpiresAt: cred.token_expires_at,
        apiKey: cred.api_key,
        apiSecret: cred.api_secret,
        webhookUrl: cred.webhook_url,
        isActive: cred.is_active,
        lastSyncAt: cred.last_sync_at,
        lastAuthenticatedAt: cred.last_authenticated_at,
        revokedAt: cred.revoked_at,
        createdAt: cred.created_at,
        updatedAt: cred.updated_at,
        config: cred.config || {},
      };
    } catch (error) {
      console.error('Erro ao buscar credencial descriptografada:', error);
      throw error;
    }
  },

  /**
   * Cria uma nova credencial (com criptografia automática via RPC)
   */
  async create(
    tenantId: string, 
    platform: string, 
    credentialName: string,
    credentials: ContaAzulCredentials
  ): Promise<TenantCredential> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    if (platform !== 'CONTA_AZUL') {
      throw new Error('Apenas plataforma CONTA_AZUL é suportada');
    }

    try {
      const { data, error } = await supabase.rpc('create_tenant_credential', {
        p_tenant_id: tenantId,
        p_platform: platform,
        p_credential_name: credentialName.trim(),
        p_access_token: credentials.access_token ?? null,
        p_refresh_token: credentials.refresh_token ?? null,
        p_api_key: null,
        p_api_secret: null,
        p_webhook_url: null,
        p_is_active: credentials.is_active !== undefined ? credentials.is_active : true,
        p_config: {},
        p_expires_in: credentials.expires_in ?? null,
      });

      if (error) {
        console.error('Erro ao criar credencial no Supabase:', {
          message: error.message,
          details: error.details,
          code: error.code,
          hint: error.hint,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Credencial não foi criada');
      }

      // Buscar credencial criada (sem tokens descriptografados)
      const created = await this.getById(data[0].id);
      if (!created) {
        throw new Error('Credencial criada mas não encontrada');
      }

      return created;
    } catch (error) {
      const err = error as { message?: string; details?: string; code?: string };
      console.error('Erro ao criar credencial:', err?.message ?? err?.details ?? err?.code ?? error);
      throw error;
    }
  },

  /**
   * Atualiza uma credencial existente (com criptografia automática via RPC)
   */
  async update(credentialId: string, credentials: Partial<ContaAzulCredentials>): Promise<TenantCredential> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const updateParams: any = {
        p_credential_id: credentialId,
      };

      if (credentials.access_token !== undefined) {
        updateParams.p_access_token = credentials.access_token;
      }
      if (credentials.refresh_token !== undefined) {
        updateParams.p_refresh_token = credentials.refresh_token;
      }
      if (credentials.is_active !== undefined) {
        updateParams.p_is_active = credentials.is_active;
      }
      if (credentials.expires_in !== undefined) {
        updateParams.p_expires_in = credentials.expires_in;
      }

      const { data, error } = await supabase.rpc('update_tenant_credential', updateParams);

      if (error) {
        console.error('Erro ao atualizar credencial no Supabase:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Credencial não foi atualizada');
      }

      // Buscar credencial atualizada (sem tokens descriptografados)
      const updated = await this.getById(credentialId);
      if (!updated) {
        throw new Error('Credencial atualizada mas não encontrada');
      }

      return updated;
    } catch (error) {
      console.error('Erro ao atualizar credencial:', error);
      throw error;
    }
  },

  /**
   * Deleta uma credencial (soft delete: marca como revogada)
   */
  async delete(credentialId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      // Soft delete: marcar como revogada e zerar tokens
      const { error } = await supabase
        .from('tenant_credentials')
        .update({
          revoked_at: new Date().toISOString(),
          is_active: false,
          access_token: null,
          refresh_token: null,
        })
        .eq('id', credentialId);

      if (error) {
        console.error('Erro ao deletar credencial do Supabase:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro ao deletar credencial:', error);
      throw error;
    }
  },

  /**
   * Verifica se o token está expirado
   */
  async isTokenExpired(credentialId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase
        .from('tenant_credentials')
        .select('token_expires_at')
        .eq('id', credentialId)
        .single();

      if (error || !data) {
        return true; // Se não encontrou, considerar como expirado
      }

      if (data.token_expires_at) {
        const expiresAt = new Date(data.token_expires_at);
        return expiresAt < new Date();
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar expiração do token:', error);
      return true;
    }
  },
};
