// Supabase Edge Function para buscar contas financeiras do Conta Azul
// Esta função faz a chamada à API Conta Azul server-side e retorna apenas dados públicos
// ⚠️ SEGURANÇA: NUNCA retorna tokens ou credenciais ao front-end
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy get-conta-azul-accounts
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - SYSTEM_API_KEY: API Key para autenticação das requisições (opcional)
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente
// Teste
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

    // ⚠️ SEGURANÇA: Validar formato UUID do credential_id
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

    // ⚠️ SEGURANÇA: Validar que credencial existe e usuário tem acesso (via RLS)
    // Buscar credencial descriptografada (função RPC já aplica RLS)
    const { data: credWithToken, error: credError } = await supabase.rpc('get_tenant_credential_decrypted', {
      p_credential_id: credential_id,
    });

    if (credError || !credWithToken || credWithToken.length === 0) {
      // ⚠️ SEGURANÇA: Retornar erro genérico, não expor detalhes
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credencial não encontrada ou acesso negado' 
        }),
        {
          status: 403, // Forbidden em vez de 404 para evitar enumeração
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const cred = credWithToken[0];

    if (!cred.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credencial está inativa' 
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

    if (!cred.access_token || cred.access_token.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token de acesso não encontrado' 
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

    // ⚠️ SEGURANÇA: Token será usado apenas server-side nesta Edge Function
    // NUNCA será retornado ao front-end
    const accessToken = cred.access_token;

    // Fazer chamada à API Conta Azul server-side
    const accountsResponse = await fetch(`${CA_API_BASE_URL}/conta-financeira?apenas_ativo=true&tamanho_pagina=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      // ⚠️ SEGURANÇA: Não expor detalhes de autenticação em erros
      const errorText = await accountsResponse.text().catch(() => 'Erro desconhecido');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao buscar contas do Conta Azul' 
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

    // ⚠️ SEGURANÇA CRÍTICA: Sanitizar resposta antes de retornar
    // Retornar apenas dados públicos (id, nome, tipo, banco, ativo)
    // NUNCA retornar tokens, credenciais ou headers de autenticação
    const sanitizedAccounts = (accountsData.itens || []).map((account: any) => ({
      id: account.id,
      nome: account.nome,
      tipo: account.tipo,
      banco: account.banco,
      ativo: account.ativo,
      conta_padrao: account.conta_padrao,
      // ⚠️ NUNCA incluir: access_token, refresh_token, Authorization, ou qualquer campo sensível
    }));

    return new Response(
      JSON.stringify({ 
        success: true,
        accounts: sanitizedAccounts,
        total: accountsData.itens_totais || sanitizedAccounts.length,
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
    // ⚠️ SEGURANÇA: Não expor detalhes do erro em produção
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
