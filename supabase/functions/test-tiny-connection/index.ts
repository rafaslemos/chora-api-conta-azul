// Supabase Edge Function para testar conexão com API Tiny
// Resolve problema de CORS fazendo requisição do servidor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { token, dataInicial, dataFinal } = await req.json().catch(() => ({}));

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token não fornecido' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Construir URL da API Tiny
    const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${encodeURIComponent(token)}&formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;

    // Fazer requisição à API Tiny
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      
      // Verificar se a resposta indica erro de token inválido
      if (data.retorno?.status === 'Erro' && data.retorno?.codigo_erro === 1) {
        const errorMsg = data.retorno?.erros?.[0]?.erro || 'Token inválido';
        return new Response(
          JSON.stringify({ valid: false, error: errorMsg }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Status 200 e resposta válida = token válido
      return new Response(
        JSON.stringify({ valid: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token inválido ou sem permissão de acesso' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      return new Response(
        JSON.stringify({ valid: false, error: `Erro na API: ${response.status} - ${errorText}` }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error instanceof Error ? error.message : 'Erro ao conectar com a API' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

