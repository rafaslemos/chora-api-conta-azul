// Edge Function leve para setup inicial
// Responsável por validar configurações e orquestrar o processo de setup
// As migrations são executadas em 3 fases:
// 1. run-migrations: Estrutura base (schemas, app_core, triggers, RLS, app_config)
// 2. run-migrations-integrations: Tabelas de integração (entidades Conta Azul, financeiro, vendas)
// 3. run-migrations-dw: Data Warehouse (dimensões, fatos, calendário)
// teste
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SetupRequest {
  supabase_url: string;
  supabase_anon_key: string;
  service_role_key: string;
  db_password?: string;
  ca_client_id: string;
  ca_client_secret: string;
  system_api_key: string;
}

interface MigrationResult {
  executed: string[];
  errors: string[];
}

interface SetupResponse {
  success: boolean;
  message?: string;
  error?: string;
  step?: string;
  requires_db_password?: boolean;
  next_steps?: {
    manual_steps?: string[];
    secrets_to_configure?: Record<string, string>;
  };
  migrations_result?: {
    phase1_base?: MigrationResult;
    phase2_integrations?: MigrationResult;
    phase3_dw?: MigrationResult;
  };
}

// Função auxiliar para chamar uma função de migration
async function callMigrationFunction(
  baseUrl: string,
  functionName: string,
  serviceRoleKey: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; result?: MigrationResult; error?: string }> {
  const url = `${baseUrl}/functions/v1/${functionName}`;
  console.log(`[setup-config] Chamando ${functionName}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[setup-config] ${functionName} status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[setup-config] Erro em ${functionName}:`, errorText);
      return { success: false, error: `${functionName}: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    console.log(`[setup-config] ${functionName} resultado:`, result.success);
    
    return {
      success: result.success,
      result: result.migrations_result,
      error: result.error,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[setup-config] Exceção em ${functionName}:`, errorMsg);
    return { success: false, error: `${functionName}: ${errorMsg}` };
  }
}

serve(async (req) => {
  // Responder OPTIONS imediatamente (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const startTime = Date.now();
  console.log('[setup-config] Iniciando...');

  try {
    // Parsear body
    const body: SetupRequest = await req.json().catch(() => ({}));
    console.log('[setup-config] Body parseado');

    // Validações básicas
    if (!body.supabase_url || !body.supabase_anon_key || !body.service_role_key) {
      return jsonResponse({
        success: false,
        error: 'supabase_url, supabase_anon_key e service_role_key são obrigatórios',
        step: 'validation',
      }, 400);
    }

    if (!body.ca_client_id || !body.ca_client_secret) {
      return jsonResponse({
        success: false,
        error: 'ca_client_id e ca_client_secret são obrigatórios',
        step: 'validation',
      }, 400);
    }

    console.log('[setup-config] Validações OK');

    // Extrair project-ref da URL
    const projectRefMatch = body.supabase_url.match(/https?:\/\/([^.]+)\.supabase\.co/);
    const projectRef = projectRefMatch ? projectRefMatch[1] : null;

    if (!projectRef) {
      return jsonResponse({
        success: false,
        error: 'URL do Supabase inválida. Esperado formato: https://xxxxx.supabase.co',
        step: 'validation',
      }, 400);
    }

    console.log(`[setup-config] Project ref: ${projectRef}`);

    // Criar cliente Supabase com service_role_key
    const supabase = createClient(body.supabase_url, body.service_role_key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: { schema: 'app_core' }
    });

    // Verificar se o banco já está configurado (tentar acessar app_core.profiles)
    console.log('[setup-config] Verificando estado do banco...');
    const { error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const dbAlreadyConfigured = !checkError || !checkError.message?.includes('does not exist');
    console.log(`[setup-config] Banco configurado: ${dbAlreadyConfigured}`);

    // Se não tiver db_password, retornar instruções para execução manual
    if (!body.db_password) {
      const dashboardBaseUrl = `https://supabase.com/dashboard/project/${projectRef}`;
      const sqlEditorLink = `${dashboardBaseUrl}/sql/new`;
      const exposedSchemasLink = `${dashboardBaseUrl}/settings/api`;
      const edgeFunctionsSecretsLink = `${dashboardBaseUrl}/settings/functions`;

      return jsonResponse({
        success: false,
        requires_db_password: true,
        error: 'A senha do banco PostgreSQL (db_password) é necessária para executar as migrations automaticamente.',
        message: 'Forneça a senha do PostgreSQL ou execute as migrations manualmente.',
        step: 'db_password_required',
        next_steps: {
          manual_steps: [
            `1. Acesse o SQL Editor: ${sqlEditorLink}`,
            '2. Execute as migrations SQL na ordem (001 a 025)',
            '3. Os arquivos SQL estão em: sql/migrations/',
            `4. Após executar, configure os schemas expostos em: ${exposedSchemasLink}`,
            '5. Adicione app_core, integrations e dw aos "Exposed Schemas"',
            `6. Configure os secrets em: ${edgeFunctionsSecretsLink}`,
          ],
          secrets_to_configure: {
            CA_CLIENT_ID: body.ca_client_id,
            CA_CLIENT_SECRET: body.ca_client_secret,
            CONTA_AZUL_CLIENT_ID: body.ca_client_id,
            CONTA_AZUL_CLIENT_SECRET: body.ca_client_secret,
            SYSTEM_API_KEY: body.system_api_key,
          },
        },
      }, 200);
    }

    // Tem db_password - executar migrations em 3 fases
    const migrationPayload = {
      supabase_url: body.supabase_url,
      service_role_key: body.service_role_key,
      db_password: body.db_password,
      ca_client_id: body.ca_client_id,
      ca_client_secret: body.ca_client_secret,
      system_api_key: body.system_api_key,
    };

    const allResults: {
      phase1_base?: MigrationResult;
      phase2_integrations?: MigrationResult;
      phase3_dw?: MigrationResult;
    } = {};
    const errors: string[] = [];

    // =====================================================
    // FASE 1: Migrations Base (schemas, app_core, etc.)
    // =====================================================
    console.log('[setup-config] === FASE 1: Migrations Base ===');
    const phase1 = await callMigrationFunction(
      body.supabase_url,
      'run-migrations',
      body.service_role_key,
      migrationPayload
    );
    
    if (phase1.result) {
      allResults.phase1_base = phase1.result;
    }
    if (!phase1.success) {
      errors.push(phase1.error || 'Erro na fase 1');
      // Retornar erro imediato na fase 1 (estrutura básica é crítica)
      return jsonResponse({
        success: false,
        error: `Erro na fase 1 (base): ${phase1.error}`,
        step: 'run_migrations_phase1',
        migrations_result: allResults,
      }, 500);
    }

    // =====================================================
    // FASE 2: Migrations de Integrations
    // =====================================================
    console.log('[setup-config] === FASE 2: Migrations Integrations ===');
    const phase2 = await callMigrationFunction(
      body.supabase_url,
      'run-migrations-integrations',
      body.service_role_key,
      migrationPayload
    );
    
    if (phase2.result) {
      allResults.phase2_integrations = phase2.result;
    }
    if (!phase2.success) {
      errors.push(phase2.error || 'Erro na fase 2');
      // Continuar mesmo com erro (estrutura básica já existe)
      console.warn('[setup-config] Fase 2 falhou, continuando para fase 3...');
    }

    // =====================================================
    // FASE 3: Migrations do Data Warehouse
    // =====================================================
    console.log('[setup-config] === FASE 3: Migrations DW ===');
    const phase3 = await callMigrationFunction(
      body.supabase_url,
      'run-migrations-dw',
      body.service_role_key,
      migrationPayload
    );
    
    if (phase3.result) {
      allResults.phase3_dw = phase3.result;
    }
    if (!phase3.success) {
      errors.push(phase3.error || 'Erro na fase 3');
      console.warn('[setup-config] Fase 3 falhou.');
    }

    const elapsed = Date.now() - startTime;
    console.log(`[setup-config] Concluído em ${elapsed}ms`);

    // Determinar sucesso geral
    const overallSuccess = phase1.success; // Fase 1 é obrigatória
    const partialSuccess = phase1.success && (!phase2.success || !phase3.success);

    if (overallSuccess) {
      return jsonResponse({
        success: true,
        message: partialSuccess 
          ? 'Setup concluído parcialmente. Estrutura básica OK. Algumas migrations adicionais falharam.'
          : 'Setup concluído com sucesso! Todas as migrations executadas.',
        step: 'complete',
        migrations_result: allResults,
        next_steps: {
          manual_steps: [
            'Configure os "Exposed Schemas" no Supabase (Settings > API)',
            'Adicione: app_core, dw (NÃO adicione integrations ou integrations_conta_azul)',
            partialSuccess ? 'Verifique os erros nas migrations e execute manualmente se necessário' : '',
            'Faça logout e login novamente no app',
          ].filter(Boolean),
        },
      }, 200);
    } else {
      return jsonResponse({
        success: false,
        error: errors.join('; '),
        step: 'run_migrations',
        migrations_result: allResults,
      }, 500);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[setup-config] Exceção:', errorMessage);

    return jsonResponse({
      success: false,
      error: errorMessage,
      step: 'exception',
    }, 500);
  }
});

function jsonResponse(data: SetupResponse, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
