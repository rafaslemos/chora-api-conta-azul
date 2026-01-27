import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../services/logger';

// Obter configuração das variáveis de ambiente
// Usa apenas VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do Vercel
function getSupabaseConfig(): { url: string | null; anonKey: string | null } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || null;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || null;
  
  // Validar se não são apenas espaços em branco
  if (url === '' || anonKey === '') {
    return { url: null, anonKey: null };
  }
  
  return { url, anonKey };
}

/**
 * Verifica se o Supabase está configurado
 */
export const isSupabaseConfigured = (): boolean => {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return false;
  
  // Validar formato básico da URL
  try {
    new URL(config.url);
  } catch {
    return false;
  }
  
  return config.anonKey.length > 0;
};

/**
 * Atualiza o cliente do Supabase dinamicamente
 * Nota: Não salva mais no localStorage - usa apenas variáveis de ambiente
 */
export function updateSupabaseConfig(url: string, anonKey: string): void {
  // Apenas recriar cliente, não salvar no localStorage
  supabaseClient = createClient(url, anonKey, {
    db: { schema: 'app_core' }
  });
}

/**
 * Limpa o cliente do Supabase
 * Nota: Não limpa mais URL/Key do localStorage pois não usamos mais
 */
export function clearSupabaseConfig(): void {
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
  logger.warn('Supabase não configurado. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY', undefined, 'lib/supabase.ts');
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

