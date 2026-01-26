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
    const { code, redirect_uri, tenant_id, credential_id, credential_name } = await req.json().catch(() => ({}));

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

    // Validar que credential_id OU credential_name foi fornecido (novo fluxo usa credential_id)
    if (!credential_id && (!credential_name || credential_name.trim() === '')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'credential_id ou credential_name é obrigatório' 
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

    // Se credential_id foi fornecido, validar formato UUID
    if (credential_id && !uuidRegex.test(credential_id)) {
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
    // Usar RPC get_tenant_by_id primeiro (mais robusto, bypassa RLS/cache do PostgREST)
    console.log(`[exchange-conta-azul-token] Validando tenant via RPC: ${tenant_id}`);
    
    let tenant = null;
    let tenantError = null;
    let usedRpc = false;
    let usedFallback = false;
    
    // Tentar primeiro usar RPC (mais robusto)
    const { data: tenantRpcData, error: tenantRpcError } = await supabase.rpc('get_tenant_by_id', {
      p_tenant_id: tenant_id
    });

    console.log('[exchange-conta-azul-token] Resultado RPC get_tenant_by_id:', {
      hasData: !!tenantRpcData,
      dataType: Array.isArray(tenantRpcData) ? 'array' : typeof tenantRpcData,
      dataLength: Array.isArray(tenantRpcData) ? tenantRpcData.length : 'N/A',
      hasError: !!tenantRpcError,
      errorCode: tenantRpcError?.code,
      errorMessage: tenantRpcError?.message,
      errorDetails: tenantRpcError?.details,
      errorHint: tenantRpcError?.hint
    });

    // Verificar se RPC funcionou
    if (tenantRpcError) {
      // Se for erro de função não encontrada (PGRST202), usar fallback imediatamente
      if (tenantRpcError.code === 'PGRST202' || tenantRpcError.message?.includes('not found') || tenantRpcError.message?.includes('does not exist')) {
        console.warn('[exchange-conta-azul-token] Função RPC não encontrada no cache do PostgREST (PGRST202), usando fallback. Isso pode acontecer logo após criar a função. Cache será atualizado automaticamente.');
      } else {
        console.warn('[exchange-conta-azul-token] RPC retornou erro, tentando busca direta como fallback:', {
          code: tenantRpcError.code,
          message: tenantRpcError.message,
          details: tenantRpcError.details,
          hint: tenantRpcError.hint
        });
      }
      
      // Fallback para busca direta
      usedFallback = true;
      const { data: directTenant, error: directError } = await supabase
        .from('tenants')
        .select('id, name, status')
        .eq('id', tenant_id)
        .maybeSingle();
      
      console.log('[exchange-conta-azul-token] Resultado busca direta (fallback):', {
        hasData: !!directTenant,
        hasError: !!directError,
        errorCode: directError?.code,
        errorMessage: directError?.message,
        errorDetails: directError?.details,
        errorHint: directError?.hint,
        tenantId: tenant_id,
        tenantName: directTenant?.name,
        tenantStatus: directTenant?.status
      });
      
      tenant = directTenant;
      tenantError = directError;
    } else if (tenantRpcData) {
      // RPC retornou dados
      usedRpc = true;
      if (Array.isArray(tenantRpcData)) {
        if (tenantRpcData.length > 0) {
          tenant = tenantRpcData[0];
        } else {
          // Array vazio - tenant não encontrado, tentar fallback
          console.warn('[exchange-conta-azul-token] RPC retornou array vazio, tentando fallback para confirmar se tenant existe');
          usedFallback = true;
          const { data: directTenant, error: directError } = await supabase
            .from('tenants')
            .select('id, name, status')
            .eq('id', tenant_id)
            .maybeSingle();
          
          console.log('[exchange-conta-azul-token] Resultado busca direta (fallback após array vazio):', {
            hasData: !!directTenant,
            hasError: !!directError,
            errorCode: directError?.code,
            errorMessage: directError?.message,
            tenantId: tenant_id
          });
          
          tenant = directTenant;
          tenantError = directError;
        }
      } else if (!Array.isArray(tenantRpcData)) {
        // RPC pode retornar objeto único em alguns casos
        tenant = tenantRpcData;
      }
    }

    // Se ainda não temos tenant, verificar se houve erro
    if (!tenant && tenantError) {
      console.error('[exchange-conta-azul-token] Erro detalhado ao buscar tenant:', {
        code: tenantError.code,
        message: tenantError.message,
        details: tenantError.details,
        hint: tenantError.hint,
        tenantId: tenant_id,
        usedRpc: usedRpc,
        usedFallback: usedFallback,
        rpcErrorCode: tenantRpcError?.code,
        rpcErrorMessage: tenantRpcError?.message
      });
      
      // Se for erro de permissão ou não encontrado, retornar erro específico
      if (tenantError.code === 'PGRST116' || tenantError.message?.includes('No rows')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Tenant não encontrado',
            details: `Tenant com ID ${tenant_id} não existe no banco de dados. Método usado: ${usedRpc ? 'RPC' : usedFallback ? 'busca direta (fallback)' : 'desconhecido'}`
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
      
      // Outros erros (permissão, etc)
      const methodInfo = usedRpc ? 'RPC get_tenant_by_id' : usedFallback ? 'busca direta (fallback)' : 'desconhecido';
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao validar tenant',
          details: `Erro ao buscar tenant: ${tenantError.message || 'Erro desconhecido'}. Código: ${tenantError.code || 'N/A'}. Método usado: ${methodInfo}. Verifique os logs do Supabase para mais detalhes.`
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

    if (!tenant) {
      const methodInfo = usedRpc ? 'RPC retornou array vazio' : usedFallback ? 'fallback retornou null' : 'nenhum método foi executado';
      console.error('[exchange-conta-azul-token] Tenant não encontrado (data é null/undefined):', {
        tenantId: tenant_id,
        rpcReturnedData: !!tenantRpcData,
        rpcDataLength: Array.isArray(tenantRpcData) ? tenantRpcData.length : 'N/A',
        usedRpc: usedRpc,
        usedFallback: usedFallback,
        methodInfo: methodInfo
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tenant não encontrado',
          details: `Tenant com ID ${tenant_id} não existe no banco de dados. Método usado: ${methodInfo}`
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
    
    console.log(`[exchange-conta-azul-token] Tenant encontrado: ${tenant.name} (status: ${tenant.status})`);

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

    let credentialData;
    let saveError;
    let existingCredential = null;

    // NOVO FLUXO: Se credential_id foi fornecido, buscar e atualizar credencial existente
    if (credential_id) {
      console.log(`[exchange-conta-azul-token] Novo fluxo: Buscando credencial por ID: ${credential_id}`);
      
      const { data: foundCredential, error: credentialError } = await supabase
        .from('tenant_credentials')
        .select('id, tenant_id, platform, is_active, revoked_at, credential_name')
        .eq('id', credential_id)
        .maybeSingle();

      console.log('[exchange-conta-azul-token] Resultado busca credencial por ID:', {
        hasData: !!foundCredential,
        hasError: !!credentialError,
        errorCode: credentialError?.code,
        errorMessage: credentialError?.message,
        credentialId: foundCredential?.id,
        tenantId: foundCredential?.tenant_id,
        platform: foundCredential?.platform
      });

      if (credentialError && credentialError.code !== 'PGRST116') {
        console.error('[exchange-conta-azul-token] Erro ao buscar credencial por ID:', {
          code: credentialError.code,
          message: credentialError.message,
          details: credentialError.details,
          hint: credentialError.hint
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao buscar credencial existente',
            details: credentialError.message || 'Erro desconhecido ao buscar credencial'
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

      if (!foundCredential) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Credencial não encontrada',
            details: `Credencial com ID ${credential_id} não existe no banco de dados`
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

      // Verificar se credencial pertence ao tenant correto
      if (foundCredential.tenant_id !== tenant_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Credencial não pertence ao tenant',
            details: `Credencial ${credential_id} não pertence ao tenant ${tenant_id}`
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

      existingCredential = foundCredential;

      // Atualizar credencial com tokens
      console.log(`[exchange-conta-azul-token] Atualizando credencial ${credential_id} com tokens`);
      const { data: updatedCredential, error: updateError } = await supabase.rpc('update_tenant_credential', {
        p_credential_id: credential_id,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_is_active: true,  // Ativar após obter tokens
        p_expires_in: tokenData.expires_in || null,
      });

      credentialData = updatedCredential;
      saveError = updateError;

      if (saveError) {
        console.error('[exchange-conta-azul-token] Erro ao atualizar credencial:', saveError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao atualizar credencial no banco de dados',
            details: saveError.message || 'Erro desconhecido ao atualizar credencial'
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
    // FLUXO LEGADO: Se credential_name foi fornecido (compatibilidade)
    else if (credential_name) {
      console.log(`[exchange-conta-azul-token] Fluxo legado: Verificando credencial por nome: tenant_id=${tenant_id}, credential_name=${credential_name}`);
      
      const { data: foundCredential, error: checkError } = await supabase
        .from('tenant_credentials')
        .select('id, revoked_at, is_active')
        .eq('tenant_id', tenant_id)
        .eq('platform', 'CONTA_AZUL')
        .eq('credential_name', credential_name.trim())
        .maybeSingle();

      console.log('[exchange-conta-azul-token] Resultado busca credencial existente (legado):', {
        hasData: !!foundCredential,
        hasError: !!checkError,
        errorCode: checkError?.code,
        errorMessage: checkError?.message,
        credentialId: foundCredential?.id,
        isRevoked: foundCredential?.revoked_at !== null,
        isActive: foundCredential?.is_active
      });

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[exchange-conta-azul-token] Erro detalhado ao verificar credencial existente:', {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint,
          tenantId: tenant_id,
          credentialName: credential_name
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao verificar credencial existente',
            details: checkError.message || 'Erro desconhecido ao buscar credencial'
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

      existingCredential = foundCredential;

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
    }

    // Criar log de auditoria
    const finalCredentialId = credential_id || credentialData?.[0]?.id || null;
    const finalCredentialName = existingCredential?.credential_name || credential_name || 'N/A';
    const isReauthentication = existingCredential && existingCredential.revoked_at !== null;
    const action = credential_id ? 'CREDENTIAL_AUTHENTICATED' : (isReauthentication ? 'CREDENTIAL_REAUTHENTICATED' : 'CREDENTIAL_CREATED');
    
    await supabase.rpc('create_audit_log', {
      p_tenant_id: tenant_id,
      p_credential_id: finalCredentialId,
      p_action: action,
      p_entity_type: 'CREDENTIAL',
      p_entity_id: finalCredentialId,
      p_status: 'SUCCESS',
      p_details: JSON.stringify({ 
        credential_name: finalCredentialName, 
        credential_id: finalCredentialId,
        platform: 'CONTA_AZUL',
        is_reauthentication: isReauthentication,
        flow: credential_id ? 'new' : 'legacy'
      }),
    }).catch(err => console.error('Erro ao criar log de auditoria:', err));

    // Retornar sucesso (sem retornar os tokens por segurança)
    const finalCredentialId = credential_id || credentialData?.[0]?.id || null;
    const finalCredentialName = existingCredential?.credential_name || credentialData?.[0]?.credential_name || credential_name || 'N/A';
    
    return new Response(
      JSON.stringify({ 
        success: true,
        credential_id: finalCredentialId,
        credential_name: finalCredentialName,
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
