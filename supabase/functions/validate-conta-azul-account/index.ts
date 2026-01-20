// Supabase Edge Function para validar se uma conta existe no Conta Azul
// Esta função faz a chamada à API Conta Azul server-side e retorna apenas boolean
// ⚠️ SEGURANÇA: NUNCA retorna tokens, credenciais ou detalhes de autenticação
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy validate-conta-azul-account
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - SYSTEM_API_KEY: API Key para autenticação das requisições (opcional)
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_KEY = Deno.env.get('SYSTEM_API_KEY') || '';
const CA_API_BASE_URL = 'https://api-v2.contaazul.com/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    
    if (API_KEY && API_KEY !== '') {
      if (!apiKey || apiKey !== API_KEY) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não autorizado. API Key inválida.' 
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

    const { tenant_id, account_id } = await req.json().catch(() => ({}));

    if (!tenant_id || !account_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tenant_id e account_id são obrigatórios' 
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

    // ⚠️ SEGURANÇA: Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenant_id) || !uuidRegex.test(account_id)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tenant_id ou account_id inválido. Formato UUID esperado.' 
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

    // ⚠️ SEGURANÇA: Validar acesso ao tenant
    const { data: credWithToken, error: credError } = await supabase.rpc('get_tenant_credential_decrypted', {
      p_tenant_id: tenant_id,
      p_platform: 'CONTA_AZUL',
    });

    if (credError || !credWithToken || credWithToken.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          exists: false,
          error: 'Credencial não encontrada ou acesso negado' 
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

    const cred = credWithToken[0];

    if (!cred.is_active || !cred.access_token || cred.access_token.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          exists: false,
          error: 'Credencial inválida ou inativa' 
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

    // ⚠️ SEGURANÇA: Token será usado apenas server-side
    const accessToken = cred.access_token;

    // Buscar todas as contas do tenant para validar se account_id pertence ao tenant
    const accountsResponse = await fetch(`${CA_API_BASE_URL}/conta-financeira?apenas_ativo=true&tamanho_pagina=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          exists: false,
          error: 'Erro ao validar conta' 
        }),
        {
          status: accountsResponse.status >= 500 ? 500 : 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.itens || [];
    
    // ⚠️ SEGURANÇA: Verificar que account_id pertence ao tenant (isolamento)
    const accountExists = accounts.some((account: any) => account.id === account_id);

    // ⚠️ SEGURANÇA: Retornar apenas boolean, sem detalhes
    return new Response(
      JSON.stringify({ 
        success: true,
        exists: accountExists,
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
        exists: false,
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
