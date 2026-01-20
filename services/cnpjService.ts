/**
 * Serviço reutilizável para consultar dados de empresas via CNPJ
 * 
 * Este serviço pode ser usado em:
 * - pages/Register.tsx (Cadastro de parceiros)
 * - pages/OnboardingWizard.tsx (Onboarding de clientes)
 * - pages/AdminTenants.tsx (Criação de tenants)
 * - Qualquer outra área que precise buscar dados por CNPJ
 */

import { cleanCnpj, validateCnpj } from '../utils/cnpjValidator';

export interface CompanyData {
  razaoSocial: string;
  nomeFantasia: string;
  email?: string;
  telefone?: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
}

interface CnpjaResponse {
  company: {
    name: string;
  };
  alias: string | null;
  emails?: Array<{
    address: string;
  }>;
  phones?: string[];
  address: {
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip: string;
  };
}

interface BrasilApiResponse {
  razao_social: string;
  nome_fantasia: string;
  email: string | null;
  ddd_telefone_1: string;
  telefone?: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

// Cache simples para evitar múltiplas chamadas do mesmo CNPJ
const cache = new Map<string, { data: CompanyData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Busca dados da empresa usando a API cnpja.com
 */
const fetchFromCnpja = async (cnpj: string): Promise<CompanyData> => {
  const response = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('CNPJ não encontrado na API cnpja.com');
    }
    throw new Error(`API cnpja.com retornou status ${response.status}`);
  }

  const data: CnpjaResponse[] = await response.json();
  
  // Verificar se a resposta é um array vazio ou se não tem dados
  if (!data || !Array.isArray(data) || data.length === 0 || !data[0]) {
    throw new Error('CNPJ não encontrado na API cnpja.com');
  }

  const company = data[0];
  
  // Verificar se a empresa tem dados mínimos
  if (!company.company || !company.company.name) {
    throw new Error('Dados incompletos na API cnpja.com');
  }

  return {
    razaoSocial: company.company.name,
    nomeFantasia: company.alias || company.company.name,
    email: company.emails && company.emails.length > 0 ? company.emails[0].address : undefined,
    telefone: company.phones && company.phones.length > 0 ? company.phones[0] : undefined,
    endereco: {
      logradouro: company.address.street || '',
      numero: company.address.number || 'S/N',
      bairro: company.address.district || '',
      cidade: company.address.city || '',
      estado: company.address.state || '',
      cep: company.address.zip || '',
    },
  };
};

/**
 * Busca dados da empresa usando a API brasilapi.com.br
 */
const fetchFromBrasilApi = async (cnpj: string): Promise<CompanyData> => {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('CNPJ não encontrado na API brasilapi.com.br');
    }
    throw new Error(`API brasilapi.com.br retornou status ${response.status}`);
  }

  const rawData = await response.json();
  
  // A API brasilapi pode retornar um objeto único ou um array
  let company: BrasilApiResponse;
  
  if (Array.isArray(rawData)) {
    if (rawData.length === 0 || !rawData[0]) {
      throw new Error('CNPJ não encontrado na API brasilapi.com.br');
    }
    company = rawData[0] as BrasilApiResponse;
  } else if (rawData && typeof rawData === 'object' && 'razao_social' in rawData) {
    // Retornou um objeto único
    company = rawData as BrasilApiResponse;
  } else {
    throw new Error('Formato de resposta inválido da API brasilapi.com.br');
  }
  
  // Verificar se a empresa tem dados mínimos
  if (!company.razao_social) {
    throw new Error('Dados incompletos na API brasilapi.com.br');
  }

  // Formatar telefone se disponível
  let telefone: string | undefined;
  const telefoneCompleto = company.telefone_1 || company.telefone;
  if (company.ddd_telefone_1 && telefoneCompleto) {
    telefone = `${company.ddd_telefone_1}${telefoneCompleto}`;
  } else if (company.ddd_telefone_1 && company.ddd_telefone_1 !== '00') {
    telefone = company.ddd_telefone_1;
  }

  return {
    razaoSocial: company.razao_social,
    nomeFantasia: company.nome_fantasia || company.razao_social,
    email: company.email || undefined,
    telefone,
    endereco: {
      logradouro: company.logradouro || '',
      numero: company.numero || 'S/N',
      bairro: company.bairro || '',
      cidade: company.municipio || '',
      estado: company.uf || '',
      cep: company.cep || '',
    },
  };
};

/**
 * Busca dados da empresa por CNPJ usando duas APIs como fallback
 * 
 * @param cnpj - CNPJ com ou sem formatação
 * @returns Dados da empresa padronizados
 * @throws Error se CNPJ for inválido ou não encontrado em ambas APIs
 */
export const fetchCompanyDataByCnpj = async (cnpj: string): Promise<CompanyData> => {
  // Limpar e validar CNPJ
  const cleaned = cleanCnpj(cnpj);
  
  if (!validateCnpj(cnpj)) {
    throw new Error('CNPJ inválido. Verifique o formato e os dígitos verificadores.');
  }

  // Verificar cache
  const cached = cache.get(cleaned);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  let lastError: Error | null = null;

  // Tentar primeira API (cnpja.com)
  try {
    const data = await Promise.race([
      fetchFromCnpja(cleaned),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na API cnpja.com')), 10000)
      )
    ]);
    
    // Salvar no cache
    cache.set(cleaned, { data, timestamp: Date.now() });
    
    return data;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error('Erro desconhecido na API cnpja.com');
    // Não logar warning se for apenas "não encontrado" - isso é esperado e vamos tentar a segunda API
    if (!lastError.message.includes('não encontrado')) {
      console.warn('Erro ao buscar na API cnpja.com, tentando brasilapi.com.br:', error);
    }
  }

  // Tentar segunda API (brasilapi.com.br)
  try {
    const data = await Promise.race([
      fetchFromBrasilApi(cleaned),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na API brasilapi.com.br')), 10000)
      )
    ]);
    
    // Salvar no cache
    cache.set(cleaned, { data, timestamp: Date.now() });
    
    return data;
  } catch (error) {
    const brasilApiError = error instanceof Error ? error : new Error('Erro desconhecido na API brasilapi.com.br');
    
    // Se ambas falharam, lançar erro combinado
    const errorMessage = lastError?.message.includes('não encontrado') && brasilApiError.message.includes('não encontrado')
      ? 'CNPJ não encontrado em nenhuma das APIs. Verifique se o CNPJ está correto e ativo.'
      : `Não foi possível buscar dados do CNPJ. ${lastError?.message || 'Erro na API 1'}. ${brasilApiError.message}. Verifique se o CNPJ está correto ou tente novamente mais tarde.`;
    
    throw new Error(errorMessage);
  }
};

/**
 * Limpa o cache de CNPJs
 */
export const clearCnpjCache = (): void => {
  cache.clear();
};

/**
 * Limpa entrada específica do cache
 */
export const clearCnpjCacheEntry = (cnpj: string): void => {
  const cleaned = cleanCnpj(cnpj);
  cache.delete(cleaned);
};

