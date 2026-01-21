// Edge Function leve para setup inicial
// Responsável por validar configurações e orquestrar o processo de setup
// As migrations pesadas são executadas em uma função separada (run-migrations)

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
    executed: string[];
    errors: string[];
  };
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
            CONTA_AZUL_CLIENT_ID: body.ca_client_id,
            CONTA_AZUL_CLIENT_SECRET: body.ca_client_secret,
            SYSTEM_API_KEY: body.system_api_key,
          },
        },
      }, 200);
    }

    // Tem db_password - chamar run-migrations
    console.log('[setup-config] Chamando run-migrations...');

    const migrationsUrl = `${body.supabase_url}/functions/v1/run-migrations`;
    const migrationsResponse = await fetch(migrationsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${body.service_role_key}`,
      },
      body: JSON.stringify({
        supabase_url: body.supabase_url,
        service_role_key: body.service_role_key,
        db_password: body.db_password,
        ca_client_id: body.ca_client_id,
        ca_client_secret: body.ca_client_secret,
        system_api_key: body.system_api_key,
      }),
    });

    console.log(`[setup-config] run-migrations status: ${migrationsResponse.status}`);

    if (!migrationsResponse.ok) {
      const errorText = await migrationsResponse.text();
      console.error('[setup-config] Erro em run-migrations:', errorText);
      return jsonResponse({
        success: false,
        error: `Erro ao executar migrations: ${migrationsResponse.status}`,
        step: 'run_migrations',
        message: errorText,
      }, 500);
    }

    const migrationsResult = await migrationsResponse.json();
    console.log('[setup-config] Resultado das migrations:', migrationsResult);

    const elapsed = Date.now() - startTime;
    console.log(`[setup-config] Concluído em ${elapsed}ms`);

    if (migrationsResult.success) {
      return jsonResponse({
        success: true,
        message: 'Setup concluído com sucesso!',
        step: 'complete',
        migrations_result: migrationsResult.migrations_result,
        next_steps: {
          manual_steps: [
            'Configure os "Exposed Schemas" no Supabase (Settings > API)',
            'Adicione: app_core, integrations, dw',
            'Faça logout e login novamente no app',
          ],
        },
      }, 200);
    } else {
      return jsonResponse({
        success: false,
        error: migrationsResult.error || 'Erro desconhecido nas migrations',
        step: 'run_migrations',
        migrations_result: migrationsResult.migrations_result,
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
