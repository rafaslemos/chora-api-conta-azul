import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { contaAzulApiService, ContaAzulAccount } from '../services/contaAzulApiService';
import { useDebounce } from '../hooks/useDebounce';

interface ContaAzulAccountSelectorProps {
  tenantId: string;
  value?: string;
  onChange: (accountId: string | null) => void;
  onError?: (error: string) => void;
  filterByType?: string;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Componente para seleção de contas do Conta Azul
 * ⚠️ SEGURANÇA: Todas as chamadas passam por Edge Functions, nunca expõe tokens
 */
const ContaAzulAccountSelector: React.FC<ContaAzulAccountSelectorProps> = ({
  tenantId,
  value,
  onChange,
  onError,
  filterByType,
  disabled = false,
  placeholder = 'Selecione uma conta...',
}) => {
  const [accounts, setAccounts] = useState<ContaAzulAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<ContaAzulAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<ContaAzulAccount | null>(null);

  // ⚠️ SEGURANÇA: Debounce para evitar múltiplas requisições (proteção contra race conditions)
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // ⚠️ SEGURANÇA: Validar tenantId antes de usar
  const validateTenantId = useCallback((id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }, []);

  // Carregar contas do Conta Azul
  const loadAccounts = useCallback(async () => {
    if (!tenantId || !validateTenantId(tenantId)) {
      setError('Tenant ID inválido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accountsData = await contaAzulApiService.getAccounts(tenantId);
      
      // ⚠️ SEGURANÇA: Validar que resposta não contém tokens
      const hasTokens = JSON.stringify(accountsData).toLowerCase().includes('token') ||
                       JSON.stringify(accountsData).toLowerCase().includes('authorization');
      
      if (hasTokens) {
        console.error('⚠️ SEGURANÇA: Resposta contém tokens!');
        throw new Error('Resposta inválida da API');
      }

      // Filtrar por tipo se especificado
      let filtered = accountsData;
      if (filterByType) {
        filtered = accountsData.filter(acc => acc.tipo === filterByType && acc.ativo);
      } else {
        filtered = accountsData.filter(acc => acc.ativo);
      }

      setAccounts(filtered);
      setFilteredAccounts(filtered);

      // Selecionar conta se value foi fornecido
      if (value) {
        const account = filtered.find(acc => acc.id === value);
        if (account) {
          setSelectedAccount(account);
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar contas do Conta Azul';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      // ⚠️ SEGURANÇA: Não logar detalhes que possam conter tokens
      console.error('Erro ao carregar contas:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, filterByType, value, validateTenantId, onError]);

  // Carregar contas quando componente montar ou tenantId mudar
  useEffect(() => {
    if (tenantId && validateTenantId(tenantId)) {
      loadAccounts();
    }
  }, [tenantId, loadAccounts, validateTenantId]);

  // Filtrar contas baseado no termo de busca
  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setFilteredAccounts(accounts);
      return;
    }

    const term = debouncedSearchTerm.toLowerCase();
    const filtered = accounts.filter(account => 
      account.nome.toLowerCase().includes(term) ||
      account.tipo.toLowerCase().includes(term) ||
      (account.banco && account.banco.toLowerCase().includes(term))
    );
    setFilteredAccounts(filtered);
  }, [debouncedSearchTerm, accounts]);

  const handleSelectAccount = (account: ContaAzulAccount) => {
    setSelectedAccount(account);
    onChange(account.id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    setSelectedAccount(null);
    onChange(null);
    setSearchTerm('');
  };

  // ⚠️ SEGURANÇA: Sanitizar texto antes de exibir (proteção XSS)
  const sanitizeText = (text: string): string => {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  return (
    <div className="relative">
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          className={`
            w-full px-3 py-2 text-left border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-primary focus:border-primary
            disabled:bg-gray-50 disabled:cursor-not-allowed
            ${isOpen ? 'ring-2 ring-primary border-primary' : ''}
          `}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              <span>Carregando contas...</span>
            </div>
          ) : selectedAccount ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{selectedAccount.nome}</div>
                <div className="text-xs text-gray-500">{selectedAccount.tipo}</div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {/* Busca */}
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    // ⚠️ SEGURANÇA: Validar tamanho máximo (prevenir DoS)
                    const value = e.target.value.slice(0, 100);
                    setSearchTerm(value);
                  }}
                  placeholder="Buscar conta..."
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de contas */}
            <div className="py-1">
              {error ? (
                <div className="px-3 py-2 text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  {searchTerm ? 'Nenhuma conta encontrada' : 'Nenhuma conta disponível'}
                </div>
              ) : (
                filteredAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleSelectAccount(account)}
                    className={`
                      w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors
                      ${value === account.id ? 'bg-blue-50' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: sanitizeText(account.nome) }} />
                        <div className="text-xs text-gray-500">
                          {account.tipo}
                          {account.banco && ` • ${account.banco}`}
                        </div>
                      </div>
                      {value === account.id && (
                        <CheckCircle2 size={16} className="text-primary" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fechar dropdown ao clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ContaAzulAccountSelector;
