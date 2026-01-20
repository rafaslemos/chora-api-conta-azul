import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Verifica se o Supabase está configurado
 */
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

/**
 * Cliente do Supabase
 * Retorna null se não estiver configurado
 */
let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!);
} else {
  console.warn('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
}

export const supabase = supabaseClient as SupabaseClient;

