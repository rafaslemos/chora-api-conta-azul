export enum SyncStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface SyncJob {
  id: string;
  type: 'ORDER_SYNC' | 'PRODUCT_SYNC' | 'FEES_SYNC';
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string;
  details: string;
  itemsProcessed: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  details: string;
}

export interface MappingRule {
  id: string;
  name: string;
  conditionField: 'SKU' | 'CATEGORY' | 'MARKETPLACE' | 'PRODUCT_NAME';
  conditionValue: string;
  targetAccount: string;
  priority: number;
  lancamentoType?: 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE';
  contaPadrao?: boolean;
  isActive?: boolean;
  config?: Record<string, any>;
}

export interface TenantContaAzulConfig {
  id: string;
  tenantId: string;
  contaReceitaPadrao?: string;
  contaDespesaPadrao?: string;
  contaTaxaPadrao?: string;
  contaFretePadrao?: string;
  criarClientesAutomaticamente: boolean;
  config?: Record<string, any>;
}

export interface DashboardStats {
  totalRevenue: number;
  pendingSyncs: number;
  errorRate: number;
  receivables: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  marketplace: string;
}

// Novos tipos para Fluxos e Credenciais
export type PlatformType = 'CONTA_AZUL';

export interface IntegrationFlow {
  id: string;
  name: string;
  source: PlatformType;
  destination: PlatformType;
  active: boolean;
  config: {
    syncProducts?: boolean;
    createCustomers?: boolean;
    consolidateSales?: boolean;
    autoApprove?: boolean;
  };
}

export interface CredentialStatus {
  platform: PlatformType;
  isConnected: boolean;
  lastCheck: string;
}

export interface TenantCredential {
  id: string;
  tenantId: string;
  platform: PlatformType;
  credentialName?: string; // Nome amigável da credencial (ex: "Matriz SP", "Filial RJ")
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastAuthenticatedAt?: string; // Data da última autenticação OAuth
  revokedAt?: string; // Data em que a credencial foi revogada (null = ativa)
  createdAt: string;
  updatedAt: string;
  config?: Record<string, any>; // JSONB para configurações específicas da plataforma
}

// Multi-tenant Types
export interface Tenant {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  phone?: string;
  address?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  plan: 'BASIC' | 'PRO' | 'ENTERPRISE';
  joinedAt: string;
  connections: {
    contaAzul: boolean;
  };
}