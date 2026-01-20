// Supabase Edge Function para API do Data Warehouse (read-only)
// Esta função permite acesso read-only ao DW via API key única por cliente
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy dw-api
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

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
    // Validar método (apenas GET)
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Método não permitido. Apenas GET é suportado.' 
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Obter API key do header
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API Key não fornecida. Use o header x-api-key ou Authorization: Bearer <key>' 
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

    // Gerar hash da API key usando a função SQL (garante compatibilidade)
    const { data: hashData, error: hashError } = await supabase.rpc('dw.hash_api_key', {
      p_key: apiKey,
    });

    if (hashError || !hashData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao processar API Key' 
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

    const keyHash = hashData;

    // Validar API key e obter tenant_id
    const { data: keyData, error: keyError } = await supabase.rpc('dw.validate_api_key', {
      p_key_hash: keyHash,
    });

    if (keyError || !keyData || keyData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API Key inválida ou não encontrada' 
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

    const keyInfo = keyData[0];

    if (!keyInfo.is_valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API Key inativa ou expirada' 
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

    const tenantId = keyInfo.tenant_id;

    // Atualizar last_used_at
    await supabase
      .from('dw_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyInfo.key_id)
      .catch(err => console.error('Erro ao atualizar last_used_at:', err));

    // Obter parâmetros da query string
    const url = new URL(req.url);
    const table = url.searchParams.get('table') || 'vw_conta_azul_credentials'; // Tabela/view padrão
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validar que a tabela/view é permitida (apenas views do schema dw)
    const allowedTables = ['vw_conta_azul_credentials']; // Lista de views permitidas
    if (!allowedTables.includes(table)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Tabela/view "${table}" não permitida. Tabelas permitidas: ${allowedTables.join(', ')}` 
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

    // Executar query read-only filtrando por tenant_id
    // Usar RPC ou query direta com RLS
    let queryResult: any;

    if (table === 'vw_conta_azul_credentials') {
      // Query na view que já filtra por tenant_id
      const { data, error } = await supabase
        .from('vw_conta_azul_credentials')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(limit)
        .offset(offset)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar dados:', error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao buscar dados do Data Warehouse' 
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

      queryResult = data;
    } else {
      // Para outras tabelas, usar query genérica (ajustar conforme necessário)
      queryResult = [];
    }

    // Retornar dados
    return new Response(
      JSON.stringify({ 
        success: true,
        tenant_id: tenantId,
        table: table,
        data: queryResult,
        count: queryResult?.length || 0,
        limit: limit,
        offset: offset,
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
