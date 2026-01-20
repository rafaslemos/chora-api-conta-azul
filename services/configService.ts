// ============================================================================
// Serviço de Configurações Globais
// ============================================================================
// Gerencia configurações globais do sistema (Client ID, Secrets, etc.)
// com cache em memória para evitar múltiplas queries
// ============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from './logger';

// Cache em memória para configurações
const configCache: Map<string, { value: string | null; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Limpa o cache de configurações
 */
export function clearConfigCache(): void {
  configCache.clear();
  logger.debug('Cache de configurações limpo', undefined, 'configService');
}

/**
 * Obtém uma configuração do banco de dados
 * @param key Chave da configuração
 * @param useCache Se deve usar cache (padrão: true)
 * @returns Valor da configuração ou null se não encontrado
 */
export async function getAppConfig(
  key: string,
  useCache: boolean = true
): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.warn('Supabase não configurado, não é possível buscar configuração', { key }, 'configService');
    return null;
  }

  // Verificar cache
  if (useCache) {
    const cached = configCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug(`Configuração ${key} obtida do cache`, undefined, 'configService');
      return cached.value;
    }
  }

  try {
    const { data, error } = await supabase.rpc('app_core.get_app_config', {
      p_key: key,
    });

    if (error) {
      logger.error('Erro ao buscar configuração', error, { key }, 'configService');
      return null;
    }

    // Atualizar cache
    configCache.set(key, {
      value: data || null,
      timestamp: Date.now(),
    });

    logger.debug(`Configuração ${key} obtida do banco`, { found: data !== null }, 'configService');
    return data || null;
  } catch (error) {
    logger.error('Exceção ao buscar configuração', error, { key }, 'configService');
    return null;
  }
}

/**
 * Salva ou atualiza uma configuração no banco de dados
 * @param key Chave da configuração
 * @param value Valor da configuração
 * @param description Descrição da configuração
 * @param encrypted Se o valor deve ser criptografado
 * @returns true se salvou com sucesso, false caso contrário
 */
export async function setAppConfig(
  key: string,
  value: string,
  description?: string,
  encrypted: boolean = false
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.warn('Supabase não configurado, não é possível salvar configuração', { key }, 'configService');
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('app_core.set_app_config', {
      p_key: key,
      p_value: value,
      p_description: description || null,
      p_is_encrypted: encrypted,
    });

    if (error) {
      logger.error('Erro ao salvar configuração', error, { key }, 'configService');
      return false;
    }

    // Limpar cache para esta chave
    configCache.delete(key);

    logger.info(`Configuração ${key} salva com sucesso`, undefined, 'configService');
    return data?.success === true;
  } catch (error) {
    logger.error('Exceção ao salvar configuração', error, { key }, 'configService');
    return false;
  }
}

/**
 * Obtém o Client ID da Conta Azul (público, com cache)
 * @param useCache Se deve usar cache (padrão: true)
 * @returns Client ID ou null se não encontrado
 */
export async function getContaAzulClientId(useCache: boolean = true): Promise<string | null> {
  // Verificar cache primeiro
  if (useCache) {
    const cached = configCache.get('conta_azul_client_id');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Client ID obtido do cache', undefined, 'configService');
      return cached.value;
    }
  }

  if (!isSupabaseConfigured() || !supabase) {
    logger.warn('Supabase não configurado, usando fallback para Client ID', undefined, 'configService');
    // Fallback para env var ou valor padrão
    return import.meta.env.VITE_CONTA_AZUL_CLIENT_ID || '4ja4m506f6f6s4t02g1q6hace7';
  }

  try {
    const { data, error } = await supabase.rpc('app_core.get_conta_azul_client_id');

    if (error) {
      logger.warn('Erro ao buscar Client ID do banco, usando fallback', error, undefined, 'configService');
      // Fallback para env var ou valor padrão
      return import.meta.env.VITE_CONTA_AZUL_CLIENT_ID || '4ja4m506f6f6s4t02g1q6hace7';
    }

    const clientId = data || null;

    // Atualizar cache
    if (clientId) {
      configCache.set('conta_azul_client_id', {
        value: clientId,
        timestamp: Date.now(),
      });
    }

    // Se não encontrou no banco, usar fallback
    if (!clientId) {
      logger.warn('Client ID não encontrado no banco, usando fallback', undefined, 'configService');
      return import.meta.env.VITE_CONTA_AZUL_CLIENT_ID || '4ja4m506f6f6s4t02g1q6hace7';
    }

    logger.debug('Client ID obtido do banco', undefined, 'configService');
    return clientId;
  } catch (error) {
    logger.error('Exceção ao buscar Client ID', error, undefined, 'configService');
    // Fallback para env var ou valor padrão
    return import.meta.env.VITE_CONTA_AZUL_CLIENT_ID || '4ja4m506f6f6s4t02g1q6hace7';
  }
}

/**
 * Pré-carrega o Client ID no cache (útil para inicialização)
 */
export async function preloadClientId(): Promise<void> {
  await getContaAzulClientId(true);
}
