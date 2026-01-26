// Supabase Edge Function para trocar authorization code por tokens da Conta Azul
// Esta função faz a troca de tokens server-side para manter o CLIENT_SECRET seguro
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy exchange-conta-azul-token
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - CA_CLIENT_ID ou CONTA_AZUL_CLIENT_ID: Client ID da Conta Azul
// - CA_CLIENT_SECRET ou CONTA_AZUL_CLIENT_SECRET: Client Secret da Conta Azul
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CA_TOKEN_URL = 'https://auth.contaazul.com/oauth2/token';
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
    const { code, redirect_uri, tenant_id, credential_name } = await req.json().catch(() => ({}));

    // Validações
    if (!code) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'code é obrigatório' 
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

    if (!redirect_uri) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'redirect_uri é obrigatório' 
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

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tenant_id é obrigatório' 
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

    if (!credential_name || credential_name.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'credential_name é obrigatório' 
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

    // Validar formato UUID do tenant_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenant_id)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tenant_id inválido. Formato UUID esperado.' 
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

    // Criar cliente Supabase primeiro (necessário para buscar configurações)
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

    // Buscar credenciais da Conta Azul do banco de dados (com fallback para env vars)
    let CA_CLIENT_ID: string | null = null;
    let CA_CLIENT_SECRET: string | null = null;
    let configSource = 'unknown';

    try {
      // Teste alternativo: buscar diretamente via get_app_config para diagnóstico
      const { data: directClientIdTest, error: directClientIdError } = await supabase.rpc('get_app_config', {
        p_key: 'conta_azul_client_id'
      });
      console.log('[exchange-conta-azul-token] Teste direto get_app_config(conta_azul_client_id):', {
        hasData: directClientIdTest !== null && directClientIdTest !== undefined,
        dataType: typeof directClientIdTest,
        dataLength: typeof directClientIdTest === 'string' ? directClientIdTest.length : 'N/A',
        hasError: !!directClientIdError,
        error: directClientIdError,
      });
      
      // Buscar Client ID do banco
      const { data: clientIdData, error: clientIdError } = await supabase.rpc('get_conta_azul_client_id');
      
      console.log('[exchange-conta-azul-token] RPC get_conta_azul_client_id response:', {
        hasData: clientIdData !== null && clientIdData !== undefined,
        dataType: typeof clientIdData,
        dataValue: clientIdData ? (typeof clientIdData === 'string' ? `${clientIdData.substring(0, 10)}...` : String(clientIdData)) : null,
        dataLength: typeof clientIdData === 'string' ? clientIdData.length : 'N/A',
        hasError: !!clientIdError,
        error: clientIdError,
      });
      
      if (clientIdError) {
        console.warn('Erro ao buscar Client ID do banco:', clientIdError);
      } else if (clientIdData !== null && clientIdData !== undefined && clientIdData !== '') {
        // Verificar se é string válida (não vazia)
        const clientIdStr = String(clientIdData).trim();
        if (clientIdStr.length > 0) {
          CA_CLIENT_ID = clientIdStr;
          configSource = 'database';
          console.log('[exchange-conta-azul-token] Client ID obtido do banco (tamanho:', clientIdStr.length, 'caracteres)');
        } else {
          console.warn('[exchange-conta-azul-token] Client ID retornado do banco está vazio');
        }
      } else {
        console.warn('[exchange-conta-azul-token] Client ID não encontrado no banco (data é null/undefined/vazio)');
      }
      
      // Teste alternativo: buscar diretamente via get_app_config para diagnóstico
      const { data: directClientSecretTest, error: directClientSecretError } = await supabase.rpc('get_app_config', {
        p_key: 'conta_azul_client_secret'
      });
      console.log('[exchange-conta-azul-token] Teste direto get_app_config(conta_azul_client_secret):', {
        hasData: directClientSecretTest !== null && directClientSecretTest !== undefined,
        dataType: typeof directClientSecretTest,
        dataLength: typeof directClientSecretTest === 'string' ? directClientSecretTest.length : 'N/A',
        hasError: !!directClientSecretError,
        error: directClientSecretError,
      });
      
      // Buscar Client Secret do banco
      const { data: clientSecretData, error: clientSecretError } = await supabase.rpc('get_conta_azul_client_secret');
      
      console.log('[exchange-conta-azul-token] RPC get_conta_azul_client_secret response:', {
        hasData: clientSecretData !== null && clientSecretData !== undefined,
        dataType: typeof clientSecretData,
        dataValue: clientSecretData ? (typeof clientSecretData === 'string' ? `${clientSecretData.substring(0, 10)}...` : '[HIDDEN]') : null,
        dataLength: typeof clientSecretData === 'string' ? clientSecretData.length : 'N/A',
        hasError: !!clientSecretError,
        error: clientSecretError,
      });
      
      if (clientSecretError) {
        console.warn('Erro ao buscar Client Secret do banco:', clientSecretError);
      } else if (clientSecretData !== null && clientSecretData !== undefined && clientSecretData !== '') {
        // Verificar se é string válida (não vazia)
        const clientSecretStr = String(clientSecretData).trim();
        if (clientSecretStr.length > 0) {
          CA_CLIENT_SECRET = clientSecretStr;
          if (configSource === 'unknown') {
            configSource = 'database';
          }
          console.log('[exchange-conta-azul-token] Client Secret obtido do banco (tamanho:', clientSecretStr.length, 'caracteres)');
        } else {
          console.warn('[exchange-conta-azul-token] Client Secret retornado do banco está vazio');
        }
      } else {
        console.warn('[exchange-conta-azul-token] Client Secret não encontrado no banco (data é null/undefined/vazio)');
      }
    } catch (error) {
      console.error('Erro ao buscar configurações do banco, usando fallback:', error);
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
          error: 'Configuração da Conta Azul não encontrada. Verifique se as configurações foram salvas no banco de dados (app_core.app_config) ou configure as variáveis de ambiente CA_CLIENT_ID/CA_CLIENT_SECRET ou CONTA_AZUL_CLIENT_ID/CONTA_AZUL_CLIENT_SECRET no Supabase Dashboard (Settings > Edge Functions > Secrets).' 
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
    
    console.log(`[exchange-conta-azul-token] Credenciais obtidas de: ${configSource}`);

    // Validar que tenant existe e está ativo antes de criar credencial
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tenant não encontrado' 
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

    // Verificar se tenant está ativo (status = 'ACTIVE')
    if (tenant.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Tenant está ${tenant.status === 'INACTIVE' ? 'inativo' : 'suspenso'}` 
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Trocar code por tokens na API da Conta Azul
    const credentials = btoa(`${CA_CLIENT_ID}:${CA_CLIENT_SECRET}`);
    
    const body = new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri,
    });

    let tokenResponse: Response;
    try {
      tokenResponse = await fetchWithTimeout(CA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
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

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao trocar token:', errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao autenticar na Conta Azul: ${tokenResponse.status}` 
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

    const tokenData = await tokenResponse.json();

    // Verificar se já existe credencial com mesmo nome para este tenant
    const { data: existingCredential, error: checkError } = await supabase
      .from('tenant_credentials')
      .select('id, revoked_at, is_active')
      .eq('tenant_id', tenant_id)
      .eq('platform', 'CONTA_AZUL')
      .eq('credential_name', credential_name.trim())
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Erro ao verificar credencial existente:', checkError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao verificar credencial existente' 
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

    let credentialData;
    let saveError;

    // Se credencial existe e está revogada, atualizar (reautenticação)
    if (existingCredential && existingCredential.revoked_at !== null) {
      console.log('Credencial revogada encontrada, atualizando para reautenticação:', existingCredential.id);
      
      const { data: updatedCredential, error: updateError } = await supabase.rpc('update_tenant_credential', {
        p_credential_id: existingCredential.id,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_is_active: true,
        p_expires_in: tokenData.expires_in || null,
      });

      credentialData = updatedCredential;
      saveError = updateError;

      if (saveError) {
        console.error('Erro ao atualizar credencial para reautenticação:', saveError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao atualizar credencial no banco de dados' 
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
    }
    // Se credencial existe e NÃO está revogada, retornar erro
    else if (existingCredential && existingCredential.revoked_at === null) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Já existe uma credencial ativa com o nome "${credential_name}" para este tenant. Escolha outro nome ou revogue a credencial existente primeiro.` 
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
    // Se não existe, criar nova credencial
    else {
      const { data: createdCredential, error: createError } = await supabase.rpc('create_tenant_credential', {
        p_tenant_id: tenant_id,
        p_platform: 'CONTA_AZUL',
        p_credential_name: credential_name.trim(),
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_is_active: true,
        p_config: {},
        p_expires_in: tokenData.expires_in || null,
      });

      credentialData = createdCredential;
      saveError = createError;

      if (saveError) {
        console.error('Erro ao criar credencial:', saveError);
        
        // Se for erro de nome duplicado, informar
        if (saveError.message && saveError.message.includes('unique')) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Já existe uma credencial com o nome "${credential_name}" para este tenant. Escolha outro nome.` 
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

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao salvar credencial no banco de dados' 
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
    }

    // Criar log de auditoria
    const isReauthentication = existingCredential && existingCredential.revoked_at !== null;
    await supabase.rpc('create_audit_log', {
      p_tenant_id: tenant_id,
      p_credential_id: credentialData?.[0]?.id || null,
      p_action: isReauthentication ? 'CREDENTIAL_REAUTHENTICATED' : 'CREDENTIAL_CREATED',
      p_entity_type: 'CREDENTIAL',
      p_entity_id: credentialData?.[0]?.id || null,
      p_status: 'SUCCESS',
      p_details: JSON.stringify({ 
        credential_name, 
        platform: 'CONTA_AZUL',
        is_reauthentication: isReauthentication 
      }),
    }).catch(err => console.error('Erro ao criar log de auditoria:', err));

    // Retornar sucesso (sem retornar os tokens por segurança)
    return new Response(
      JSON.stringify({ 
        success: true,
        credential_id: credentialData?.[0]?.id,
        credential_name: credentialData?.[0]?.credential_name,
        tenant_id: tenant_id,
        message: 'Autenticação concluída com sucesso'
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
        error: 'Erro ao processar requisição' 
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
