import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant } from '../types';

interface TenantContextType {
  selectedTenantId: string | null; // null = "Todos os Clientes"
  selectedTenant: Tenant | null;
  tenants: Tenant[];
  setSelectedTenantId: (tenantId: string | null) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(() => {
    // Carregar do localStorage se existir
    const saved = localStorage.getItem('bpo_selected_tenant_id');
    return saved === 'ALL' ? null : saved || null;
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar lista de tenants
  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const { tenantService } = await import('../services/tenantService');
      const data = await tenantService.list();
      setTenants(data);
      
      // Se não há tenant selecionado e há tenants disponíveis, selecionar o primeiro
      if (!selectedTenantId && data.length > 0) {
        setSelectedTenantIdState(data[0].id);
        localStorage.setItem('bpo_selected_tenant_id', data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setSelectedTenantId = (tenantId: string | null) => {
    setSelectedTenantIdState(tenantId);
    // Salvar no localStorage ('ALL' para representar "todos")
    if (tenantId === null) {
      localStorage.setItem('bpo_selected_tenant_id', 'ALL');
    } else {
      localStorage.setItem('bpo_selected_tenant_id', tenantId);
    }
  };

  const selectedTenant = selectedTenantId 
    ? tenants.find(t => t.id === selectedTenantId) || null
    : null;

  return (
    <TenantContext.Provider
      value={{
        selectedTenantId,
        selectedTenant,
        tenants,
        setSelectedTenantId,
        isLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

