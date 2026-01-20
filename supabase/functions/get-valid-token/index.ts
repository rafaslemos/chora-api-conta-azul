// Supabase Edge Function para obter token válido da Conta Azul
// Usado por workflows do n8n para obter token válido (sempre renova o token)
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy get-valid-token
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - SYSTEM_API_KEY: API Key para autenticação das requisições
// - CA_CLIENT_ID: (opcional) Client ID da Conta Azul
// - CA_CLIENT_SECRET: (opcional) Client Secret da Conta Azul
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Nota: A validação de credencial (existência, status, plataforma) será feita pela RPC
    // get_tenant_credential_decrypted que já valida acesso e status

    // Sempre renovar o token (sem verificar expiração)
    // Buscar refresh_token usando credential_id
    const { data: credWithRefresh, error: refreshError } = await supabase.rpc('app_core.get_tenant_credential_decrypted', {
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
          error: 'Refresh token não encontrado. O token expirou e não há refresh_token salvo. É necessário reautenticar na Conta Azul através da aplicação web.' 
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

    const refreshToken = cred.refresh_token;

    // Renovar token usando API da Conta Azul
    const CA_CLIENT_ID = Deno.env.get('CA_CLIENT_ID') || '4ja4m506f6f6s4t02g1q6hace7';
    const CA_CLIENT_SECRET = Deno.env.get('CA_CLIENT_SECRET') || 'cad4070fd552ffeibjrafju6nenchlf5v9qv0emcf8belpi7nu7';
    const CA_TOKEN_URL = 'https://auth.contaazul.com/oauth2/token';
    
    const credentials = btoa(`${CA_CLIENT_ID}:${CA_CLIENT_SECRET}`);
    
    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const refreshResponse = await fetch(CA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: refreshBody,
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      
      // Se refresh_token também expirou, marcar credencial como inativa
      if (refreshResponse.status === 400 || refreshResponse.status === 401) {
        await supabase.rpc('app_core.update_tenant_credential', {
          p_credential_id: credential_id,
          p_is_active: false,
        });
      }

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
    const { error: updateError } = await supabase.rpc('app_core.update_tenant_credential', {
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

