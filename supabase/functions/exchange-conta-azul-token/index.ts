// Supabase Edge Function para trocar authorization code por tokens da Conta Azul
// Esta função faz a troca de tokens server-side para manter o CLIENT_SECRET seguro
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy exchange-conta-azul-token
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - CA_CLIENT_ID: Client ID da Conta Azul
// - CA_CLIENT_SECRET: Client Secret da Conta Azul
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

    // Obter credenciais da Conta Azul das variáveis de ambiente
    const CA_CLIENT_ID = Deno.env.get('CA_CLIENT_ID') || '';
    const CA_CLIENT_SECRET = Deno.env.get('CA_CLIENT_SECRET') || '';

    if (!CA_CLIENT_ID || !CA_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração da Conta Azul não encontrada. Verifique as variáveis de ambiente CA_CLIENT_ID e CA_CLIENT_SECRET.' 
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Nota: A validação de acesso ao tenant será feita pela RPC app_core.create_tenant_credential
    // que tem RLS. Por enquanto, apenas validar formato UUID
    // O Service Role Key bypassa RLS, mas a RPC ainda pode fazer verificações internas

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tenant não encontrado ou acesso negado' 
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

    const tokenResponse = await fetch(CA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

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

    // Salvar credenciais no banco usando RPC
    const { data: credentialData, error: saveError } = await supabase.rpc('app_core.create_tenant_credential', {
      p_tenant_id: tenant_id,
      p_platform: 'CONTA_AZUL',
      p_credential_name: credential_name.trim(),
      p_access_token: tokenData.access_token,
      p_refresh_token: tokenData.refresh_token,
      p_is_active: true,
      p_config: {},
      p_expires_in: tokenData.expires_in || null,
    });

    if (saveError) {
      console.error('Erro ao salvar credencial:', saveError);
      
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

    // Criar log de auditoria
    await supabase.rpc('app_core.create_audit_log', {
      p_tenant_id: tenant_id,
      p_credential_id: credentialData?.[0]?.id || null,
      p_action: 'CREDENTIAL_CREATED',
      p_entity_type: 'CREDENTIAL',
      p_entity_id: credentialData?.[0]?.id || null,
      p_status: 'SUCCESS',
      p_details: JSON.stringify({ credential_name, platform: 'CONTA_AZUL' }),
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
