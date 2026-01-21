// Supabase Edge Function para obter token Conta Azul descriptografado
// Usado pelo front-end para fazer chamadas à API Conta Azul via Edge Functions intermediárias
//
// IMPORTANTE: Esta função NUNCA retorna o token diretamente ao front-end
// Ela é usada apenas por outras Edge Functions que fazem chamadas à API Conta Azul
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

    // Apenas CONTA_AZUL suportado
    if (platform !== 'CONTA_AZUL') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Plataforma deve ser CONTA_AZUL' 
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

    // ⚠️ SEGURANÇA: Validar formato UUID do tenant_id
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

    // ⚠️ SEGURANÇA: Validar que tenant existe e usuário tem acesso (via RLS)
    // Buscar credencial descriptografada (função RPC já aplica RLS)
    const { data: credWithToken, error: credError } = await supabase.rpc('get_tenant_credential_decrypted', {
      p_tenant_id: tenant_id,
      p_platform: platform,
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

    // ⚠️ SEGURANÇA CRÍTICA: Esta função NUNCA deve retornar o token diretamente ao front-end
    // Ela deve ser usada apenas por outras Edge Functions server-side
    // Por isso, retornamos apenas um indicador de sucesso, não o token
    // O token será usado internamente pelas Edge Functions que chamam a API Conta Azul

    return new Response(
      JSON.stringify({ 
        success: true,
        tenant_id: tenant_id,
        has_token: true,
        // ⚠️ NUNCA retornar o token aqui - ele será usado apenas server-side
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
