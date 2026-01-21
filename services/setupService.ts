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

/**
 * Verifica se o banco de dados está configurado
 */
export async function checkDatabaseConfigured(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<boolean> {
  try {
    // Tentar fazer uma query simples para verificar se o schema app_core existe
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ p_user_id: '00000000-0000-0000-0000-000000000000' }),
    });

    // Se retornar erro de "function not found" ou "schema not found", banco não está configurado
    if (response.status === 404 || response.status === 400) {
      const errorText = await response.text();
      if (
        errorText.includes('does not exist') ||
        errorText.includes('schema') ||
        errorText.includes('function') ||
        errorText.includes('relation')
      ) {
        return false;
      }
    }

    // Se retornar sucesso (mesmo que seja false), banco está configurado
    return response.ok;
  } catch (error) {
    // Em caso de erro, assumir que banco não está configurado
    console.warn('Erro ao verificar se banco está configurado:', error);
    return false;
  }
}

/**
 * Executa o setup do banco de dados
 */
export async function executeSetup(config: SetupConfig): Promise<SetupResult> {
  try {
    // Obter URL da Edge Function
    const edgeFunctionUrl = `${config.supabase_url}/functions/v1/setup-database`;

    // Chamar Edge Function de setup
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

    const result: SetupResult = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Erro ao executar setup',
        ...result,
      };
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao executar setup';

    // Erro comum quando a Edge Function não está deployada ou bloqueada por CORS/JWT
    if (
      errorMessage.toLowerCase().includes('failed to fetch') ||
      errorMessage.toLowerCase().includes('fetch')
    ) {
      return {
        success: false,
        error:
          'Falha ao acessar a Edge Function `setup-database` (CORS/Preflight). Verifique se ela está deployada e com Verify JWT desativado.',
        next_steps: {
          manual_steps: [
            'Faça deploy da função: supabase functions deploy setup-database',
            'Se estiver usando o CLI, deploy com: supabase functions deploy setup-database --no-verify-jwt',
            'No painel do Supabase, abra Edge Functions > setup-database e desative "Verify JWT"',
            'Recarregue a página e tente o setup novamente',
          ],
        },
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
