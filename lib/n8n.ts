/**
 * Configuração e utilitários para integração com n8n
 * n8n é usado para orquestração de workflows e integrações
 */

const n8nUrl = import.meta.env.VITE_N8N_URL;
const n8nApiKey = import.meta.env.VITE_N8N_API_KEY;
const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

/**
 * Verifica se o n8n está configurado
 */
export const isN8nConfigured = (): boolean => {
  return !!(n8nUrl && n8nApiKey);
};

/**
 * Retorna a URL base do n8n
 */
export const getN8nUrl = (): string | null => {
  return n8nUrl || null;
};

/**
 * Retorna a API Key do n8n
 */
export const getN8nApiKey = (): string | null => {
  return n8nApiKey || null;
};

/**
 * Retorna a URL do webhook do n8n
 */
export const getN8nWebhookUrl = (): string | null => {
  return n8nWebhookUrl || n8nUrl ? `${n8nUrl}/webhook` : null;
};

/**
 * Executa um workflow do n8n via API
 */
export const executeN8nWorkflow = async (
  workflowId: string,
  data: Record<string, any>
): Promise<any> => {
  if (!isN8nConfigured()) {
    throw new Error('n8n não está configurado. Configure VITE_N8N_URL e VITE_N8N_API_KEY');
  }

  const response = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': n8nApiKey!,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Erro ao executar workflow: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Dispara um webhook do n8n
 */
export const triggerN8nWebhook = async (
  webhookPath: string,
  data: Record<string, any>
): Promise<any> => {
  const webhookUrl = getN8nWebhookUrl();
  if (!webhookUrl) {
    throw new Error('n8n webhook URL não configurado');
  }

  const response = await fetch(`${webhookUrl}/${webhookPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Erro ao disparar webhook: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Lista workflows disponíveis no n8n
 */
export const listN8nWorkflows = async (): Promise<any[]> => {
  if (!isN8nConfigured()) {
    throw new Error('n8n não está configurado');
  }

  const response = await fetch(`${n8nUrl}/api/v1/workflows`, {
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': n8nApiKey!,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao listar workflows: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || [];
};

/**
 * Obtém um workflow específico por ID
 */
export const getN8nWorkflow = async (workflowId: string): Promise<any> => {
  if (!isN8nConfigured()) {
    throw new Error('n8n não está configurado');
  }

  const response = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': n8nApiKey!,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar workflow: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Ativa ou desativa um workflow
 */
export const toggleN8nWorkflow = async (
  workflowId: string,
  active: boolean
): Promise<any> => {
  if (!isN8nConfigured()) {
    throw new Error('n8n não está configurado');
  }

  const workflow = await getN8nWorkflow(workflowId);
  
  const response = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': n8nApiKey!,
    },
    body: JSON.stringify({
      ...workflow,
      active,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao atualizar workflow: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Obtém execuções de um workflow
 */
export const getN8nWorkflowExecutions = async (
  workflowId: string,
  limit: number = 10
): Promise<any[]> => {
  if (!isN8nConfigured()) {
    throw new Error('n8n não está configurado');
  }

  const response = await fetch(
    `${n8nUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': n8nApiKey!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar execuções: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || [];
};

/**
 * Testa a conectividade básica com o n8n
 */
export const testN8nConnectivity = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  if (!isN8nConfigured()) {
    return {
      success: false,
      message: 'n8n não está configurado',
    };
  }

  try {
    // Tenta fazer uma requisição simples para verificar conectividade
    const response = await fetch(`${n8nUrl}/healthz`, {
      method: 'GET',
    });

    if (response.ok) {
      return {
        success: true,
        message: 'n8n está acessível',
        details: {
          url: n8nUrl,
          status: response.status,
        },
      };
    }

    // Se healthz não funcionar, tenta listar workflows
    await listN8nWorkflows();
    return {
      success: true,
      message: 'Conexão com n8n estabelecida',
      details: {
        url: n8nUrl,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao conectar: ${error.message}`,
      details: {
        error: error.toString(),
      },
    };
  }
};

