/**
 * Serviço para interagir com a API Conta Azul via Edge Functions
 * 
 * ⚠️ SEGURANÇA CRÍTICA: Todas as chamadas passam por Edge Functions server-side
 * NUNCA retorna tokens ou credenciais ao front-end
 * Todas as respostas são sanitizadas antes de retornar
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Helper para obter configuração do Supabase do localStorage
function getSupabaseConfig(): { url: string | null; anonKey: string | null } {
  return {
    url: localStorage.getItem('supabase_url'),
    anonKey: localStorage.getItem('supabase_anon_key'),
  };
}

// ⚠️ SEGURANÇA: Validar formato UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ⚠️ SEGURANÇA: Sanitizar dados antes de retornar
function sanitizeForLog(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  const sensitiveFields = ['access_token', 'refresh_token', 'Authorization', 'X-API-Key', 'token', 'password', 'secret', 'api_key', 'api_secret'];
  
  for (const key in data) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '***ENCRYPTED***';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = sanitizeForLog(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  
  return sanitized;
}

// ⚠️ SEGURANÇA: Validar e sanitizar tenantId
function validateAndSanitizeTenantId(tenantId: string): string {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenant_id é obrigatório e deve ser uma string');
  }
  
  // Remover espaços e caracteres especiais
  const sanitized = tenantId.trim().replace(/[^0-9a-f-]/gi, '');
  
  // Validar formato UUID
  if (!UUID_REGEX.test(sanitized)) {
    throw new Error('tenant_id inválido. Formato UUID esperado.');
  }
  
  return sanitized;
}

// ⚠️ SEGURANÇA: Validar e sanitizar accountId
function validateAndSanitizeAccountId(accountId: string): string {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('account_id é obrigatório e deve ser uma string');
  }
  
  const sanitized = accountId.trim().replace(/[^0-9a-f-]/gi, '');
  
  if (!UUID_REGEX.test(sanitized)) {
    throw new Error('account_id inválido. Formato UUID esperado.');
  }
  
  return sanitized;
}

export interface ContaAzulAccount {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  banco?: string;
  conta_padrao?: boolean;
}

export interface ContaAzulCategory {
  id: string;
  nome: string;
  tipo: string;
}

interface EdgeFunctionResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

// ⚠️ SEGURANÇA: Cache de contas com TTL e validação
const CACHE_KEY_PREFIX = 'ca_accounts_';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em milissegundos

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  tenantId: string;
}

function getCacheKey(tenantId: string, type: 'accounts' | 'categories'): string {
  return `${CACHE_KEY_PREFIX}${type}_${tenantId}`;
}

function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    
    // Verificar TTL
    if (now - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    // ⚠️ SEGURANÇA: Validar que dados não contêm tokens
    const sanitized = sanitizeForLog(entry.data);
    if (JSON.stringify(sanitized) !== JSON.stringify(entry.data)) {
      // Se sanitização alterou algo, cache está corrompido
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    console.error('Erro ao ler cache:', error);
    localStorage.removeItem(key);
    return null;
  }
}

function setCachedData<T>(key: string, data: T, tenantId: string): void {
  try {
    // ⚠️ SEGURANÇA: Sanitizar antes de cachear
    const sanitized = sanitizeForLog(data);
    
    const entry: CacheEntry<T> = {
      data: sanitized as T,
      timestamp: Date.now(),
      tenantId,
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Erro ao salvar cache:', error);
    // Não falhar se cache não funcionar
  }
}

function clearCache(tenantId: string): void {
  try {
    localStorage.removeItem(getCacheKey(tenantId, 'accounts'));
    localStorage.removeItem(getCacheKey(tenantId, 'categories'));
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
  }
}

export const contaAzulApiService = {
  /**
   * Busca contas financeiras do Conta Azul via Edge Function
   * ⚠️ SEGURANÇA: Resposta é sanitizada e não contém tokens
   */
  async getAccounts(tenantId: string): Promise<ContaAzulAccount[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    // ⚠️ SEGURANÇA: Validar e sanitizar tenantId
    const sanitizedTenantId = validateAndSanitizeTenantId(tenantId);

    // Verificar cache primeiro
    const cacheKey = getCacheKey(sanitizedTenantId, 'accounts');
    const cached = getCachedData<ContaAzulAccount[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Chamar Edge Function
      const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração do Supabase não encontrada');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/get-conta-azul-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ tenant_id: sanitizedTenantId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // ⚠️ SEGURANÇA: Não expor detalhes de erro
        throw new Error(errorData.error || 'Erro ao buscar contas do Conta Azul');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar contas');
      }

      // ⚠️ SEGURANÇA: Validar estrutura de resposta
      if (!Array.isArray(result.accounts)) {
        throw new Error('Resposta inválida da API');
      }

      // ⚠️ SEGURANÇA: Sanitizar resposta antes de usar
      const sanitizedAccounts = result.accounts.map((account: any) => ({
        id: account.id,
        nome: account.nome,
        tipo: account.tipo,
        ativo: account.ativo,
        banco: account.banco,
        conta_padrao: account.conta_padrao,
      }));

      // Validar que não há tokens na resposta
      const hasTokens = JSON.stringify(sanitizedAccounts).toLowerCase().includes('token') ||
                       JSON.stringify(sanitizedAccounts).toLowerCase().includes('authorization');
      
      if (hasTokens) {
        console.error('⚠️ SEGURANÇA: Resposta contém tokens!', sanitizeForLog(result));
        throw new Error('Resposta inválida: contém dados sensíveis');
      }

      // Cachear dados sanitizados
      setCachedData(cacheKey, sanitizedAccounts, sanitizedTenantId);

      return sanitizedAccounts;
    } catch (error) {
      // ⚠️ SEGURANÇA: Não logar detalhes que possam conter tokens
      console.error('Erro ao buscar contas:', error instanceof Error ? error.message : 'Erro desconhecido');
      throw error;
    }
  },

  /**
   * Busca categorias do Conta Azul via Edge Function
   * ⚠️ SEGURANÇA: Resposta é sanitizada e não contém tokens
   */
  async getCategories(tenantId: string): Promise<ContaAzulCategory[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    const sanitizedTenantId = validateAndSanitizeTenantId(tenantId);

    // Verificar cache
    const cacheKey = getCacheKey(sanitizedTenantId, 'categories');
    const cached = getCachedData<ContaAzulCategory[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração do Supabase não encontrada');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/get-conta-azul-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ tenant_id: sanitizedTenantId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao buscar categorias do Conta Azul');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar categorias');
      }

      if (!Array.isArray(result.categories)) {
        throw new Error('Resposta inválida da API');
      }

      const sanitizedCategories = result.categories.map((category: any) => ({
        id: category.id,
        nome: category.nome,
        tipo: category.tipo,
      }));

      // Validar que não há tokens
      const hasTokens = JSON.stringify(sanitizedCategories).toLowerCase().includes('token');
      if (hasTokens) {
        console.error('⚠️ SEGURANÇA: Resposta contém tokens!', sanitizeForLog(result));
        throw new Error('Resposta inválida: contém dados sensíveis');
      }

      setCachedData(cacheKey, sanitizedCategories, sanitizedTenantId);

      return sanitizedCategories;
    } catch (error) {
      console.error('Erro ao buscar categorias:', error instanceof Error ? error.message : 'Erro desconhecido');
      throw error;
    }
  },

  /**
   * Valida se uma conta existe no Conta Azul
   * ⚠️ SEGURANÇA: Retorna apenas boolean, sem detalhes
   */
  async validateAccount(tenantId: string, accountId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    const sanitizedTenantId = validateAndSanitizeTenantId(tenantId);
    const sanitizedAccountId = validateAndSanitizeAccountId(accountId);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração do Supabase não encontrada');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/validate-conta-azul-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ 
          tenant_id: sanitizedTenantId,
          account_id: sanitizedAccountId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao validar conta');
      }

      const result = await response.json();

      if (!result.success) {
        return false;
      }

      return result.exists === true;
    } catch (error) {
      console.error('Erro ao validar conta:', error instanceof Error ? error.message : 'Erro desconhecido');
      throw error;
    }
  },

  /**
   * Simula criação de lançamento (teste)
   * ⚠️ SEGURANÇA: Payload retornado é sanitizado, não contém tokens
   */
  async simulateLancamento(tenantId: string, payload: any): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    const sanitizedTenantId = validateAndSanitizeTenantId(tenantId);

    // ⚠️ SEGURANÇA: Validar tamanho do payload (prevenir DoS)
    const payloadSize = JSON.stringify(payload).length;
    const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      throw new Error('Payload muito grande. Tamanho máximo: 1MB');
    }

    // ⚠️ SEGURANÇA: Sanitizar payload de entrada (remover campos não esperados)
    const sanitizedPayload = {
      ...payload,
    };
    
    // Remover campos sensíveis se existirem
    delete sanitizedPayload.access_token;
    delete sanitizedPayload.refresh_token;
    delete sanitizedPayload.Authorization;
    delete sanitizedPayload['X-API-Key'];

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuração do Supabase não encontrada');
      }

      // ⚠️ NOTA: Esta função ainda precisa ser implementada como Edge Function
      // Por enquanto, retornar erro informando que não está implementada
      throw new Error('Simulação de lançamento ainda não implementada. Use Edge Function para fazer chamada real à API Conta Azul.');
    } catch (error) {
      console.error('Erro ao simular lançamento:', error instanceof Error ? error.message : 'Erro desconhecido');
      throw error;
    }
  },

  /**
   * Limpa cache de contas e categorias para um tenant
   * Útil quando credenciais mudarem
   */
  clearCache(tenantId: string): void {
    try {
      const sanitizedTenantId = validateAndSanitizeTenantId(tenantId);
      clearCache(sanitizedTenantId);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  },
};
