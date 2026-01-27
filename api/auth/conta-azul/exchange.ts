import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Proxy para troca de code OAuth por token
 * 
 * Esta API:
 * 1. Valida o JWT do usuário (sessão Supabase)
 * 2. Repassa a requisição para a Edge Function usando service role
 * 3. Retorna a resposta da Edge Function para o cliente
 * 
 * Isso resolve o problema de CORS com preflight OPTIONS sem JWT
 * e mantém a Edge Function com verify_jwt = true para segurança
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Apenas POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  // Verificar variáveis de ambiente
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    
    console.error('[exchange] Variáveis de ambiente faltando:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceRoleKey: !!supabaseServiceRoleKey,
      missing,
    });
    
    res.status(500).json({ 
      error: 'Configuração do servidor incompleta',
      missing: missing,
      message: `Configure as seguintes variáveis no Vercel: ${missing.join(', ')}`
    });
    return;
  }

  // Extrair e validar JWT do header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  const userAccessToken = authHeader.replace('Bearer ', '');

  // Validar sessão do usuário usando anon key
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(userAccessToken);

  if (authError || !user) {
    console.warn('[exchange] JWT inválido ou expirado:', authError?.message);
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    return;
  }

  console.log('[exchange] Usuário autenticado:', { userId: user.id, email: user.email });

  // Validar body da requisição
  const { code, redirect_uri, tenant_id, credential_id, credential_name } = req.body;

  if (!code || !redirect_uri || !tenant_id) {
    res.status(400).json({ 
      error: 'Campos obrigatórios faltando: code, redirect_uri, tenant_id' 
    });
    return;
  }

  if (!credential_id && !credential_name) {
    res.status(400).json({ 
      error: 'É necessário fornecer credential_id ou credential_name' 
    });
    return;
  }

  // Preparar body para Edge Function
  const edgeFunctionBody: any = {
    code,
    redirect_uri,
    tenant_id,
  };

  if (credential_id) {
    edgeFunctionBody.credential_id = credential_id;
  } else {
    edgeFunctionBody.credential_name = credential_name;
  }

  // Chamar Edge Function com service role
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/exchange-conta-azul-token`;
  
  try {
    const edgeFunctionResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey,
      },
      body: JSON.stringify(edgeFunctionBody),
    });

    const responseData = await edgeFunctionResponse.json();

    // Repassar status e corpo da Edge Function
    res.status(edgeFunctionResponse.status).json(responseData);
  } catch (error) {
    console.error('[exchange] Erro ao chamar Edge Function:', error);
    res.status(500).json({ 
      error: 'Erro interno ao processar requisição',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
