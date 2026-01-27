/**
 * Funções de teste de conexão para Supabase e n8n
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { isN8nConfigured, getN8nUrl, listN8nWorkflows, testN8nConnectivity } from './n8n';

export interface ConnectionTestResult {
  service: 'supabase' | 'n8n';
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Testa a conexão com o Supabase
 */
export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      service: 'supabase',
      success: false,
      message: 'Supabase não está configurado. Use a página de setup para configurar.',
      timestamp,
    };
  }

  try {
    // Teste básico: verificar se consegue fazer uma query simples
    const { data, error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);

    // Se a tabela não existir, isso é esperado - o importante é que não seja erro de autenticação
    if (error) {
      // Erro 42P01 = tabela não existe (esperado)
      // Erro 42501 = permissão negada (problema de RLS ou chave)
      // Outros erros podem indicar problemas de conexão
      if (error.code === '42P01') {
        return {
          service: 'supabase',
          success: true,
          message: 'Conexão estabelecida com sucesso! (Tabela de teste não existe, mas a conexão funciona)',
          details: {
            url: localStorage.getItem('supabase_url') || null,
            hasAnonKey: !!localStorage.getItem('supabase_anon_key'),
            errorCode: error.code,
            errorMessage: error.message,
          },
          timestamp,
        };
      } else if (error.code === '42501' || error.message.includes('JWT')) {
        return {
          service: 'supabase',
          success: false,
          message: 'Erro de autenticação. Verifique se a chave anon está correta.',
          details: {
            errorCode: error.code,
            errorMessage: error.message,
          },
          timestamp,
        };
      } else {
        return {
          service: 'supabase',
          success: false,
          message: `Erro na conexão: ${error.message}`,
          details: {
            errorCode: error.code,
            errorMessage: error.message,
          },
          timestamp,
        };
      }
    }

    return {
      service: 'supabase',
      success: true,
      message: 'Conexão estabelecida com sucesso!',
      details: {
        url: localStorage.getItem('supabase_url') || null,
        hasAnonKey: !!localStorage.getItem('supabase_anon_key'),
        testQueryResult: data,
      },
      timestamp,
    };
  } catch (error: any) {
    return {
      service: 'supabase',
      success: false,
      message: `Erro inesperado: ${error.message || 'Erro desconhecido'}`,
      details: {
        error: error.toString(),
      },
      timestamp,
    };
  }
};

/**
 * Testa a conexão com o n8n
 */
export const testN8nConnection = async (): Promise<ConnectionTestResult> => {
  const timestamp = new Date().toISOString();

  if (!isN8nConfigured()) {
    return {
      service: 'n8n',
      success: false,
      message: 'n8n não está configurado. Verifique as variáveis VITE_N8N_URL e VITE_N8N_API_KEY.',
      timestamp,
    };
  }

  try {
    // Primeiro, testa conectividade básica
    const connectivityTest = await testN8nConnectivity();
    
    if (!connectivityTest.success) {
      return {
        service: 'n8n',
        success: false,
        message: connectivityTest.message,
        details: connectivityTest.details,
        timestamp,
      };
    }

    // Se conectividade OK, tenta listar workflows
    let workflows: any[] = [];
    try {
      workflows = await listN8nWorkflows();
    } catch (workflowError: any) {
      // Se falhar ao listar workflows mas conectividade está OK, pode ser problema de permissão
      return {
        service: 'n8n',
        success: false,
        message: 'Conectividade OK, mas erro ao acessar workflows. Verifique permissões da API Key.',
        details: {
          url: getN8nUrl(),
          hasApiKey: !!import.meta.env.VITE_N8N_API_KEY,
          error: workflowError.message,
        },
        timestamp,
      };
    }

    // Conta workflows ativos e inativos
    const activeWorkflows = workflows.filter((w: any) => w.active).length;
    const inactiveWorkflows = workflows.length - activeWorkflows;

    return {
      service: 'n8n',
      success: true,
      message: `Conexão estabelecida com sucesso! ${workflows.length} workflow(s) encontrado(s) (${activeWorkflows} ativos, ${inactiveWorkflows} inativos).`,
      details: {
        url: getN8nUrl(),
        hasApiKey: !!import.meta.env.VITE_N8N_API_KEY,
        webhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL || `${getN8nUrl()}/webhook`,
        workflowsCount: workflows.length,
        activeWorkflows,
        inactiveWorkflows,
        workflows: workflows.map((w: any) => ({
          id: w.id,
          name: w.name,
          active: w.active,
          tags: w.tags || [],
        })),
      },
      timestamp,
    };
  } catch (error: any) {
    // Verificar se é erro de autenticação
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return {
        service: 'n8n',
        success: false,
        message: 'Erro de autenticação. Verifique se a API Key está correta.',
        details: {
          error: error.message,
        },
        timestamp,
      };
    }

    // Verificar se é erro de conexão
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        service: 'n8n',
        success: false,
        message: 'Erro de conexão. Verifique se a URL do n8n está correta e acessível.',
        details: {
          url: getN8nUrl(),
          error: error.message,
        },
        timestamp,
      };
    }

    return {
      service: 'n8n',
      success: false,
      message: `Erro na conexão: ${error.message || 'Erro desconhecido'}`,
      details: {
        error: error.toString(),
      },
      timestamp,
    };
  }
};

/**
 * Testa ambas as conexões
 */
export const testAllConnections = async (): Promise<ConnectionTestResult[]> => {
  const results: ConnectionTestResult[] = [];

  // Testar Supabase
  const supabaseResult = await testSupabaseConnection();
  results.push(supabaseResult);

  // Testar n8n
  const n8nResult = await testN8nConnection();
  results.push(n8nResult);

  return results;
};

