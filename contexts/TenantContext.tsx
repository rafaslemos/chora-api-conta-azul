import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Tenant } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
    const saved = localStorage.getItem('bpo_selected_tenant_id');
    return saved === 'ALL' ? null : saved || null;
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearTenants = useCallback(() => {
    setTenants([]);
    setSelectedTenantIdState(null);
    localStorage.removeItem('bpo_selected_tenant_id');
    setIsLoading(false);
  }, []);

  const loadTenants = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setIsLoading(true);
    try {
      const { tenantService } = await import('../services/tenantService');
      const data = await tenantService.list();
      setTenants(data);
      setSelectedTenantIdState((prev) => {
        if (prev && data.some((t) => t.id === prev)) return prev;
        if (data.length > 0) {
          localStorage.setItem('bpo_selected_tenant_id', data[0].id);
          return data[0].id;
        }
        return null;
      });
    } catch (error) {
      console.error('Erro ao carregar tenants:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      clearTenants();
      return;
    }

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadTenants();
      } else {
        clearTenants();
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadTenants();
      } else {
        clearTenants();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadTenants, clearTenants]);

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

