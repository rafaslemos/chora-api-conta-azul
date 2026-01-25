/**
 * Serviço para setup inicial do banco de dados
 */

export interface SetupConfig {
  supabase_url: string;
  supabase_anon_key: string;
  service_role_key: string;
  db_password?: string; // Senha do PostgreSQL (opcional - se não fornecido, migrations devem ser executadas manualmente)
  ca_client_id: string;
  ca_client_secret: string;
  system_api_key: string;
}

export interface SetupResult {
  success: boolean;
  message?: string;
  error?: string;
  migrations_executed?: string[];
  migrations_results?: Array<{
    migration: string;
    success: boolean;
    error?: string;
  }>;
  migrations_sql?: Array<{
    name: string;
    sql: string;
  }>;
  requires_db_password?: boolean;
  next_steps?: {
    manual_steps?: string[];
    manual_setup?: string[];
    secrets_to_configure?: Record<string, string>;
  };
}

// ============================================================================
// Sistema de logs para setup
// ============================================================================
export type SetupLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface SetupLogEntry {
  timestamp: Date;
  level: SetupLogLevel;
  message: string;
  details?: string;
}

export type SetupLogCallback = (entry: SetupLogEntry) => void;

let logCallback: SetupLogCallback | null = null;

/**
 * Registra um callback para receber logs do setup em tempo real
 */
export function onSetupLog(callback: SetupLogCallback | null): void {
  logCallback = callback;
}

function emitLog(level: SetupLogLevel, message: string, details?: string): void {
  const entry: SetupLogEntry = {
    timestamp: new Date(),
    level,
    message,
    details,
  };
  // Console log para debugging
  const prefix = `[SETUP ${level.toUpperCase()}]`;
  if (details) {
    console.log(prefix, message, details);
  } else {
    console.log(prefix, message);
  }
  // Emitir para callback registrado
  if (logCallback) {
    logCallback(entry);
  }
}

export type DatabaseCheckHint = 'exposed_schemas' | 'function_not_found';

export interface DatabaseCheckResult {
  configured: boolean;
  hint?: DatabaseCheckHint;
}

/** Passos manuais reutilizáveis quando Edge Functions não estão acessíveis (deploy, Verify JWT). */
export const EDGE_FUNCTIONS_MANUAL_STEPS: string[] = [
  'Faça deploy das funções: supabase functions deploy setup-config --no-verify-jwt && supabase functions deploy run-migrations --no-verify-jwt && supabase functions deploy run-migrations-integrations --no-verify-jwt && supabase functions deploy run-migrations-dw --no-verify-jwt',
  'No painel do Supabase, abra Edge Functions e desative "Verify JWT" nas quatro funções (setup-config, run-migrations, run-migrations-integrations, run-migrations-dw)',
  'Clique em "Verificar novamente" e, em seguida, tente o setup novamente',
];

/**
 * Verifica se a Edge Function setup-config está acessível (OPTIONS para checar CORS/existência).
 * Uso: validação antes de "Executar Setup" no Passo 3.
 */
export async function checkSetupConfigReachable(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<{ reachable: boolean }> {
  try {
    const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/setup-config`;
    const res = await fetch(url, { method: 'OPTIONS' });
    return { reachable: res.ok };
  } catch {
    return { reachable: false };
  }
}

/**
 * Retorna true se VITE_SKIP_DB_CHECK estiver definido e for 'true'.
 * Nesse caso, o app não chama checkDatabaseConfigured e trata como configurado (útil no Vercel).
 */
export function shouldSkipDbCheck(): boolean {
  return import.meta.env.VITE_SKIP_DB_CHECK === 'true';
}

/**
 * Verifica se o banco de dados está configurado e acessível via API (schema app_core exposto).
 * 406 = schema não exposto (Exposed Schemas); 404/400 com "does not exist" = função/schema inexistente.
 */
export async function checkDatabaseConfigured(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<DatabaseCheckResult> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept-Profile': 'app_core',
        'Content-Profile': 'app_core',
      },
      body: JSON.stringify({ p_user_id: '00000000-0000-0000-0000-000000000000' }),
    });

    if (response.status === 406) {
      return { configured: false, hint: 'exposed_schemas' };
    }

    if (response.status === 404 || response.status === 400) {
      const errorText = await response.text();
      if (
        errorText.includes('does not exist') ||
        errorText.includes('schema') ||
        errorText.includes('function') ||
        errorText.includes('relation')
      ) {
        return { configured: false, hint: 'function_not_found' };
      }
    }

    if (response.ok) {
      return { configured: true };
    }

    return { configured: false };
  } catch (error) {
    console.warn('Erro ao verificar se banco está configurado:', error);
    return { configured: false };
  }
}

/**
 * Executa o setup do banco de dados
 * Usa a nova Edge Function leve (setup-config) que orquestra o processo
 */
export async function executeSetup(config: SetupConfig): Promise<SetupResult> {
  emitLog('info', 'Iniciando setup do banco de dados...');

  try {
    // Usar a nova Edge Function leve (setup-config)
    const edgeFunctionUrl = `${config.supabase_url}/functions/v1/setup-config`;
    emitLog('info', 'URL da Edge Function', edgeFunctionUrl);

    emitLog('info', 'Enviando requisição POST para setup-config...');
    const startTime = Date.now();

    // Chamar Edge Function de setup (leve, responde rápido)
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabase_anon_key,
        'Authorization': `Bearer ${config.supabase_anon_key}`,
      },
      body: JSON.stringify({
        supabase_url: config.supabase_url,
        supabase_anon_key: config.supabase_anon_key,
        service_role_key: config.service_role_key,
        db_password: config.db_password,
        ca_client_id: config.ca_client_id,
        ca_client_secret: config.ca_client_secret,
        system_api_key: config.system_api_key,
      }),
    });

    const elapsed = Date.now() - startTime;
    emitLog('info', `Resposta recebida em ${elapsed}ms`, `Status: ${response.status} ${response.statusText}`);

    emitLog('info', 'Parseando resposta JSON...');
    let result: SetupResult;
    try {
      result = await response.json();
      emitLog('info', 'Resposta parseada com sucesso');
    } catch (parseError) {
      emitLog('error', 'Erro ao parsear resposta JSON', String(parseError));
      return {
        success: false,
        error: 'Resposta inválida da Edge Function (não é JSON válido)',
      };
    }

    // Log do step atual
    if ((result as any).step) {
      emitLog('info', `Etapa: ${(result as any).step}`);
    }

    if (!response.ok && response.status >= 500) {
      emitLog('error', 'Edge Function retornou erro', result.error || `HTTP ${response.status}`);
      return {
        success: false,
        error: result.error || 'Erro ao executar setup',
        ...result,
      };
    }

    if (result.success) {
      emitLog('success', 'Setup concluído com sucesso!', result.message);
    } else if (result.requires_db_password) {
      emitLog('warn', 'Senha do PostgreSQL necessária', 'Forneça a senha ou execute migrations manualmente');
    } else {
      emitLog('warn', 'Setup retornou sem sucesso', result.error || 'Sem detalhes');
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao executar setup';
    emitLog('error', 'Exceção durante o setup', errorMessage);

    // Erro comum quando a Edge Function não está deployada ou bloqueada por CORS/JWT
    if (
      errorMessage.toLowerCase().includes('failed to fetch') ||
      errorMessage.toLowerCase().includes('fetch')
    ) {
      emitLog('error', 'Provável erro de CORS/JWT', 'A requisição não conseguiu alcançar a Edge Function');
      return {
        success: false,
        error:
          'Falha ao acessar a Edge Function. Verifique se setup-config e run-migrations estão deployadas com Verify JWT desativado.',
        next_steps: { manual_steps: [...EDGE_FUNCTIONS_MANUAL_STEPS] },
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Gera uma API key aleatória segura
 */
export function generateSystemApiKey(): string {
  // Gerar chave aleatória de 32 caracteres usando crypto.randomUUID
  // Se não disponível, usar Math.random como fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    // Usar UUID v4 e remover hífens para ter 32 caracteres
    return crypto.randomUUID().replace(/-/g, '');
  } else {
    // Fallback: gerar string aleatória de 32 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
