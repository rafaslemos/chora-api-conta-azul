import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../services/logger';

// Chaves para localStorage
const STORAGE_KEY_URL = 'supabase_url';
const STORAGE_KEY_ANON_KEY = 'supabase_anon_key';

// Obter configuração do localStorage ou variáveis de ambiente
function getSupabaseConfig(): { url: string | null; anonKey: string | null } {
  const url = localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || null;
  const anonKey = localStorage.getItem(STORAGE_KEY_ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || null;
  return { url, anonKey };
}

// Variáveis de ambiente (fallback)
const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();

/**
 * Verifica se o Supabase está configurado
 */
export const isSupabaseConfigured = (): boolean => {
  const config = getSupabaseConfig();
  return !!(config.url && config.anonKey);
};

/**
 * Atualiza a configuração do Supabase dinamicamente
 */
export function updateSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_ANON_KEY, anonKey);
  
  // Recriar cliente
  supabaseClient = createClient(url, anonKey);
}

/**
 * Limpa a configuração do Supabase (remove do localStorage)
 */
export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON_KEY);
  supabaseClient = null;
}

/**
 * Cliente do Supabase
 * Retorna null se não estiver configurado
 */
let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  const config = getSupabaseConfig();
  if (config.url && config.anonKey) {
    supabaseClient = createClient(config.url, config.anonKey);
  }
} else {
  logger.warn('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ou use a página de setup', undefined, 'lib/supabase.ts');
}

export const supabase = supabaseClient as SupabaseClient;

