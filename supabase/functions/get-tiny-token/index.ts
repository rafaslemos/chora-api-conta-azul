// Supabase Edge Function para obter token Tiny descriptografado
// Usado por workflows do n8n para obter token válido e limite do plano
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy get-tiny-token
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

    const { tenant_id, platform } = await req.json().catch(() => ({}));

    if (!tenant_id || !platform) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tenant_id e platform são obrigatórios' 
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

    // Apenas OLIST/TINY suportado
    if (platform !== 'OLIST' && platform !== 'TINY') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Plataforma deve ser OLIST ou TINY' 
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

    // Buscar credencial descriptografada
    const { data: credWithToken, error: credError } = await supabase.rpc('get_tenant_credential_decrypted', {
      p_tenant_id: tenant_id,
      p_platform: platform,
    });

    if (credError || !credWithToken || credWithToken.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Credencial não encontrada para tenant ${tenant_id} e plataforma ${platform}` 
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

    // Buscar dados do tenant (apenas partner_id)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, partner_id')
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

    // Buscar limite do plano
    const planCode = cred.config?.plan;
    let limitePorMinuto = 0;

    if (planCode) {
      const { data: plan, error: planError } = await supabase
        .from('olist_plans')
        .select('requests_per_minute')
        .eq('code', planCode)
        .eq('is_active', true)
        .single();

      if (!planError && plan) {
        limitePorMinuto = plan.requests_per_minute || 0;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        token: cred.access_token,
        tenant_id: tenant.id,
        partner_id: tenant.partner_id,
        primeira_execucao: cred.primeira_execucao ?? true,
        data_ultima_execucao: cred.data_ultima_execucao,
        limite_por_minuto: limitePorMinuto,
        plan_code: planCode
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

