// Supabase Edge Function para receber webhooks da Conta Azul
// Esta função processa webhooks de revogação de tokens
//
// IMPORTANTE: Esta função precisa ser deployada no Supabase antes de ser usada
// Comando de deploy: supabase functions deploy conta-azul-webhook
//
// Variáveis de ambiente necessárias (configurar no Supabase Dashboard):
// - WEBHOOK_SECRET: Secret para validar webhooks (opcional, mas recomendado)
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') || '';

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
    // Validar método HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Método não permitido. Use POST.' 
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

    // Validar webhook secret (se configurado)
    if (WEBHOOK_SECRET && WEBHOOK_SECRET !== '') {
      const webhookSecret = req.headers.get('x-webhook-secret');
      if (!webhookSecret || webhookSecret !== WEBHOOK_SECRET) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Webhook secret inválido' 
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

    // Parse do body
    const body = await req.json().catch(() => ({}));
    const { credential_id, tenant_id, account_id, reason, event_type } = body;

    // Validar que temos pelo menos um identificador
    if (!credential_id && !tenant_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'credential_id ou tenant_id é obrigatório' 
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app_core' }
    });

    // Se credential_id foi fornecido, usar diretamente
    let finalCredentialId: string | null = null;

    if (credential_id) {
      // Validar formato UUID
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
      finalCredentialId = credential_id;
    } else if (tenant_id) {
      // Buscar credencial por tenant_id (e account_id se fornecido)
      // Por enquanto, vamos buscar a primeira credencial ativa do tenant
      // TODO: Implementar busca por account_id quando tivermos esse campo
      console.log(`[conta-azul-webhook] Buscando credencial ativa para tenant: ${tenant_id}`);
      
      const { data: credentials, error: credError } = await supabase
        .from('tenant_credentials')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('platform', 'CONTA_AZUL')
        .is('revoked_at', null)
        .limit(1);

      console.log('[conta-azul-webhook] Resultado busca credencial por tenant_id:', {
        hasData: !!credentials,
        dataLength: credentials?.length || 0,
        hasError: !!credError,
        errorCode: credError?.code,
        errorMessage: credError?.message,
        errorDetails: credError?.details,
        errorHint: credError?.hint,
        tenantId: tenant_id,
        credentialId: credentials?.[0]?.id
      });

      if (credError) {
        console.error('[conta-azul-webhook] Erro detalhado ao buscar credencial:', {
          code: credError.code,
          message: credError.message,
          details: credError.details,
          hint: credError.hint,
          tenantId: tenant_id
        });
        
        // Se for erro de permissão ou não encontrado, retornar erro específico
        if (credError.code === 'PGRST116' || credError.message?.includes('No rows')) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Credencial não encontrada para o tenant especificado',
              details: `Nenhuma credencial ativa encontrada para tenant ${tenant_id}`
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
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao buscar credencial',
            details: credError.message || 'Erro desconhecido ao buscar credencial do tenant'
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

      if (!credentials || credentials.length === 0) {
        console.warn(`[conta-azul-webhook] Nenhuma credencial ativa encontrada para tenant: ${tenant_id}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Credencial não encontrada para o tenant especificado',
            details: `Nenhuma credencial ativa encontrada para tenant ${tenant_id}`
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

      finalCredentialId = credentials[0].id;
      console.log(`[conta-azul-webhook] Credencial encontrada: ${finalCredentialId}`);
    }

    if (!finalCredentialId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível identificar a credencial a ser revogada' 
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

    // Revogar credencial usando função RPC
    const { data: revokedCredential, error: revokeError } = await supabase.rpc('revoke_tenant_credential', {
      p_credential_id: finalCredentialId,
      p_reason: reason || `Webhook: ${event_type || 'TOKEN_REVOKED'}`,
    });

    if (revokeError) {
      console.error('Erro ao revogar credencial:', revokeError);
      
      // Se credencial já estava revogada, retornar sucesso (idempotente)
      if (revokeError.message && revokeError.message.includes('não encontrada')) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Credencial já estava revogada ou não existe',
            credential_id: finalCredentialId
          }),
          {
            status: 200,
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
          error: 'Erro ao revogar credencial no banco de dados' 
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

    // Retornar sucesso
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Credencial revogada com sucesso',
        credential_id: revokedCredential?.[0]?.id || finalCredentialId,
        credential_name: revokedCredential?.[0]?.credential_name,
        revoked_at: revokedCredential?.[0]?.revoked_at
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
        error: 'Erro ao processar webhook' 
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
