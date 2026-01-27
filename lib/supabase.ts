import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../services/logger';

// Chaves para localStorage
const STORAGE_KEY_URL = 'supabase_url';
const STORAGE_KEY_ANON_KEY = 'supabase_anon_key';

// Obter configuração do localStorage
// NOTA: Não usamos mais VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY para evitar duplicação
// A configuração é feita via página de setup e salva no localStorage
function getSupabaseConfig(): { url: string | null; anonKey: string | null } {
  const url = localStorage.getItem(STORAGE_KEY_URL) || null;
  const anonKey = localStorage.getItem(STORAGE_KEY_ANON_KEY) || null;
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
  
  // Recriar cliente com schema app_core
  supabaseClient = createClient(url, anonKey, {
    db: { schema: 'app_core' }
  });
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
    supabaseClient = createClient(config.url, config.anonKey, {
      db: { schema: 'app_core' }
    });
  }
} else {
  logger.warn('Supabase não configurado. Use a página de setup para configurar', undefined, 'lib/supabase.ts');
}

export const supabase = supabaseClient as SupabaseClient;

/**
 * Função de diagnóstico para verificar se o schema app_core está exposto
 * Retorna informações úteis para debug de erros 403
 */
export async function diagnoseSchemaAccess(): Promise<{
  schemaExposed: boolean;
  userAuthenticated: boolean;
  userId: string | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      schemaExposed: false,
      userAuthenticated: false,
      userId: null,
      error: 'Supabase não está configurado',
    };
  }

  try {
    // Verificar se usuário está autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const userAuthenticated = !authError && !!user;
    const userId = user?.id || null;

    // Tentar uma query simples para verificar se schema está exposto
    // Se retornar 403, provavelmente o schema não está exposto
    // Se retornar 200 ou 404 (sem dados), o schema está exposto
    const { error: queryError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const schemaExposed = queryError?.status !== 403;

    return {
      schemaExposed,
      userAuthenticated,
      userId,
      error: queryError?.status === 403
        ? 'Schema app_core não está exposto. Vá em Settings > API > Exposed Schemas no Supabase Dashboard e marque app_core.'
        : queryError?.message,
    };
  } catch (error: any) {
    return {
      schemaExposed: false,
      userAuthenticated: false,
      userId: null,
      error: error?.message || 'Erro desconhecido ao diagnosticar',
    };
  }
}

