// Supabase Edge Function para obter token válido da Conta Azul
// Usado por workflows do n8n para obter token válido (sempre renova o token)
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy get-valid-token
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - SYSTEM_API_KEY: API Key para autenticação das requisições
// - CA_CLIENT_ID ou CONTA_AZUL_CLIENT_ID: (opcional) Client ID da Conta Azul
// - CA_CLIENT_SECRET ou CONTA_AZUL_CLIENT_SECRET: (opcional) Client Secret da Conta Azul
//
// NOTA: As credenciais são buscadas primeiro no banco (app_core.app_config) via RPC.
// Se não encontradas no banco, usa fallback para variáveis de ambiente.
// Ambas as convenções de nomes são aceitas para compatibilidade.
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// API Key para autenticação (deve estar em variável de ambiente do Supabase)
const API_KEY = Deno.env.get('SYSTEM_API_KEY') || '';
const FETCH_TIMEOUT_MS = 15000; // 15 segundos

/**
 * Helper function para fazer fetch com timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timeout ao fazer requisição para ${url} após ${timeoutMs}ms`);
    }
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    // Verificar autenticação via API Key customizada
    // NOTA: O header 'Authorization: Bearer' é usado pelo Supabase (anon key) para acessar a Edge Function
    // Aqui verificamos apenas 'x-api-key' para a autenticação da aplicação (opcional)
    const apiKey = req.headers.get('x-api-key');
    
    // Se SYSTEM_API_KEY estiver configurada, validar
    // Se não estiver configurada, permitir acesso (útil para desenvolvimento/testes)
    if (API_KEY && API_KEY !== '') {
      if (!apiKey || apiKey !== API_KEY) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não autorizado. API Key inválida. Verifique o header x-api-key. Se não configurou SYSTEM_API_KEY no Supabase, deixe este header vazio ou remova a validação.' 
          }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }
    // Se SYSTEM_API_KEY não estiver configurada, permitir acesso sem validação de x-api-key

    const { credential_id } = await req.json().catch(() => ({}));

    if (!credential_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'credential_id é obrigatório' 
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validar formato UUID do credential_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(credential_id)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'credential_id inválido. Formato UUID esperado.' 
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração do Supabase não encontrada' 
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app_core' }
    });

    // Nota: A validação de credencial (existência, status, plataforma) será feita pela RPC
    // get_tenant_credential_decrypted que já valida acesso e status

    // Sempre renovar o token (sem verificar expiração)
    // Buscar refresh_token usando credential_id
    const { data: credWithRefresh, error: refreshError } = await supabase.rpc('get_tenant_credential_decrypted', {
      p_credential_id: credential_id,
    });

    if (refreshError) {
      console.error('Erro ao buscar credencial descriptografada:', refreshError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao buscar credencial: ${refreshError.message || 'Erro desconhecido'}` 
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!credWithRefresh || credWithRefresh.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credencial não encontrada. Configure as credenciais da Conta Azul primeiro.' 
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const cred = credWithRefresh[0];

    if (!cred.refresh_token || cred.refresh_token.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false,
          needs_reauth: true,
          credential_id: credential_id,
          credential_name: cred.credential_name,
          error: 'Credencial precisa ser reautenticada. Acesse a aplicação web para reautenticar.',
          details: 'Refresh token não encontrado. O token expirou e não há refresh_token salvo.'
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const refreshToken = cred.refresh_token;

    // Buscar credenciais da Conta Azul do banco de dados (com fallback para env vars)
    let CA_CLIENT_ID: string | null = null;
    let CA_CLIENT_SECRET: string | null = null;
    let configSource = 'unknown';

    try {
      // Buscar Client ID do banco
      const { data: clientIdData, error: clientIdError } = await supabase.rpc('get_conta_azul_client_id');
      if (!clientIdError && clientIdData) {
        CA_CLIENT_ID = clientIdData;
        configSource = 'database';
      } else if (clientIdError) {
        console.warn('Erro ao buscar Client ID do banco:', clientIdError);
      }
      
      // Buscar Client Secret do banco
      const { data: clientSecretData, error: clientSecretError } = await supabase.rpc('get_conta_azul_client_secret');
      if (!clientSecretError && clientSecretData) {
        CA_CLIENT_SECRET = clientSecretData;
        if (configSource === 'unknown') {
          configSource = 'database';
        }
      } else if (clientSecretError) {
        console.warn('Erro ao buscar Client Secret do banco:', clientSecretError);
      }
    } catch (error) {
      console.warn('Erro ao buscar configurações do banco, usando fallback:', error);
    }

    // Fallback para variáveis de ambiente se não encontrou no banco
    // Aceitar ambas as convenções: CA_CLIENT_ID e CONTA_AZUL_CLIENT_ID
    if (!CA_CLIENT_ID) {
      CA_CLIENT_ID = Deno.env.get('CA_CLIENT_ID') || Deno.env.get('CONTA_AZUL_CLIENT_ID') || null;
      if (CA_CLIENT_ID) {
        configSource = 'env_vars';
      }
    }
    
    if (!CA_CLIENT_SECRET) {
      CA_CLIENT_SECRET = Deno.env.get('CA_CLIENT_SECRET') || Deno.env.get('CONTA_AZUL_CLIENT_SECRET') || null;
      if (CA_CLIENT_SECRET && configSource === 'unknown') {
        configSource = 'env_vars';
      }
    }

    // Validação explícita: não permitir valores hardcoded ou ausentes
    if (!CA_CLIENT_ID || !CA_CLIENT_SECRET) {
      console.error('Configuração da Conta Azul não encontrada:', {
        client_id_found: !!CA_CLIENT_ID,
        client_secret_found: !!CA_CLIENT_SECRET,
        has_env_ca_client_id: !!Deno.env.get('CA_CLIENT_ID'),
        has_env_conta_azul_client_id: !!Deno.env.get('CONTA_AZUL_CLIENT_ID'),
        has_env_ca_client_secret: !!Deno.env.get('CA_CLIENT_SECRET'),
        has_env_conta_azul_client_secret: !!Deno.env.get('CONTA_AZUL_CLIENT_SECRET'),
        config_source: configSource,
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração da Conta Azul não encontrada. Verifique se as configurações foram salvas no banco de dados (app_core.app_config) ou configure as variáveis de ambiente CA_CLIENT_ID/CA_CLIENT_SECRET ou CONTA_AZUL_CLIENT_ID/CONTA_AZUL_CLIENT_SECRET no Supabase Dashboard (Settings > Edge Functions > Secrets). Nenhum valor padrão será usado por motivos de segurança.' 
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    console.log(`[get-valid-token] Credenciais obtidas de: ${configSource}`);

    const CA_TOKEN_URL = 'https://auth.contaazul.com/oauth2/token';
    
    const credentials = btoa(`${CA_CLIENT_ID}:${CA_CLIENT_SECRET}`);
    
    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    let refreshResponse: Response;
    try {
      refreshResponse = await fetchWithTimeout(CA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: refreshBody,
      }, FETCH_TIMEOUT_MS);
    } catch (error) {
      console.error('Erro ao fazer requisição para Conta Azul:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao comunicar com Conta Azul: ${errorMessage}` 
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      
      // Se refresh_token também expirou, marcar credencial como inativa
      if (refreshResponse.status === 400 || refreshResponse.status === 401) {
        await supabase.rpc('update_tenant_credential', {
          p_credential_id: credential_id,
          p_is_active: false,
        });

        // Criar log de auditoria quando refresh token falha
        await supabase.rpc('create_audit_log', {
          p_tenant_id: cred.tenant_id,
          p_credential_id: credential_id,
          p_action: 'CREDENTIAL_REFRESH_FAILED',
          p_entity_type: 'CREDENTIAL',
          p_entity_id: credential_id,
          p_status: 'ERROR',
          p_details: JSON.stringify({ 
            error: `Refresh token inválido: ${refreshResponse.status}`,
            credential_name: cred.credential_name 
          }),
        }).catch(err => console.error('Erro ao criar log de auditoria:', err));

        // Retornar resposta com flag de reautenticação necessária
        return new Response(
          JSON.stringify({ 
            success: false,
            needs_reauth: true,
            credential_id: credential_id,
            credential_name: cred.credential_name,
            error: 'Credencial precisa ser reautenticada. Acesse a aplicação web para reautenticar.',
            details: `Refresh token inválido ou expirado (status: ${refreshResponse.status})`
          }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Outros erros de refresh token
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao renovar token: ${refreshResponse.status} ${errorText}` 
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const newTokenData = await refreshResponse.json();

    // Atualizar credenciais no banco usando credential_id
    const { error: updateError } = await supabase.rpc('update_tenant_credential', {
      p_credential_id: credential_id,
      p_access_token: newTokenData.access_token,
      p_refresh_token: newTokenData.refresh_token,
      p_expires_in: newTokenData.expires_in,
    });

    if (updateError) {
      console.error('Erro ao atualizar credencial:', updateError);
      // Mesmo com erro de atualização, retornar o token novo
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (newTokenData.expires_in || 3600));

    return new Response(
      JSON.stringify({ 
        success: true,
        credential_id: credential_id,
        access_token: newTokenData.access_token,
        expires_at: expiresAt.toISOString(),
        expires_in: newTokenData.expires_in,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao processar requisição' 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

