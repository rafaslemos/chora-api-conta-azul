import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Save, AlertCircle, Loader2, TestTube } from 'lucide-react';
import { mappingRuleService } from '../services/mappingRuleService';
import { MappingRule } from '../types';
import { tenantService } from '../services/tenantService';
import { contaAzulApiService } from '../services/contaAzulApiService';
import { testMappingRules, generateExamplePedido, TestResult } from '../services/mappingRuleTestService';
import Button from '../components/ui/Button';
import ContaAzulAccountSelector from '../components/ContaAzulAccountSelector';

const Mappings: React.FC = () => {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  
  // Estados do modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados do modal de teste
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    conditionField: 'MARKETPLACE' as 'SKU' | 'CATEGORY' | 'MARKETPLACE' | 'PRODUCT_NAME',
    conditionValue: '',
    targetAccount: '',
    priority: 0,
    lancamentoType: 'RECEITA' as 'RECEITA' | 'DESPESA' | 'TAXA' | 'FRETE' | undefined,
    contaPadrao: false,
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTenantAndRules();
  }, []);

  const loadTenantAndRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tenants = await tenantService.list();
      if (tenants.length > 0) {
        const tenantId = tenants[0].id;
        setCurrentTenantId(tenantId);
        const data = await mappingRuleService.list(tenantId);
        setRules(data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar regras:', err);
      setError(err.message || 'Erro ao carregar regras de mapeamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (rule?: MappingRule) => {
    if (rule) {
      setIsEditing(true);
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        conditionField: rule.conditionField,
        conditionValue: rule.conditionValue,
        targetAccount: rule.targetAccount,
        priority: rule.priority,
        lancamentoType: rule.lancamentoType,
        contaPadrao: rule.contaPadrao || false,
      });
    } else {
      setIsEditing(false);
      setEditingRule(null);
      setFormData({
        name: '',
        conditionField: 'MARKETPLACE',
        conditionValue: '',
        targetAccount: '',
        priority: 0,
        lancamentoType: 'RECEITA',
        contaPadrao: false,
      });
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditingRule(null);
    setFormErrors({});
  };

  // ⚠️ SEGURANÇA: Validar formulário antes de salvar
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validar nome
    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    } else if (formData.name.length > 100) {
      errors.name = 'Nome deve ter no máximo 100 caracteres';
    }

    // Validar conditionValue
    if (!formData.conditionValue.trim()) {
      errors.conditionValue = 'Valor da condição é obrigatório';
    } else if (formData.conditionValue.length > 255) {
      errors.conditionValue = 'Valor da condição deve ter no máximo 255 caracteres';
    }

    // ⚠️ SEGURANÇA: Validar que conditionValue não contém caracteres perigosos (XSS)
    const dangerousChars = /[<>'"&]/;
    if (dangerousChars.test(formData.conditionValue)) {
      errors.conditionValue = 'Valor da condição contém caracteres inválidos';
    }

    // Validar targetAccount
    if (!formData.targetAccount) {
      errors.targetAccount = 'Conta destino é obrigatória';
    } else {
      // ⚠️ SEGURANÇA: Validar formato UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(formData.targetAccount)) {
        errors.targetAccount = 'ID da conta inválido';
      }
    }

    // Validar prioridade
    if (formData.priority < 0 || formData.priority > 9999) {
      errors.priority = 'Prioridade deve estar entre 0 e 9999';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!currentTenantId) {
      setError('Tenant não selecionado');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // ⚠️ SEGURANÇA: Validar que conta existe antes de salvar
      const accountExists = await contaAzulApiService.validateAccount(currentTenantId, formData.targetAccount);
      if (!accountExists) {
        setFormErrors({ ...formErrors, targetAccount: 'Conta não encontrada no Conta Azul' });
        setIsSaving(false);
        return;
      }

      if (isEditing && editingRule) {
        // Atualizar regra existente
        const updated = await mappingRuleService.update(editingRule.id, {
          name: formData.name.trim(),
          conditionField: formData.conditionField,
          conditionValue: formData.conditionValue.trim(),
          targetAccount: formData.targetAccount,
          priority: formData.priority,
          lancamentoType: formData.lancamentoType,
          contaPadrao: formData.contaPadrao,
        });
        
        setRules(rules.map(r => r.id === editingRule.id ? updated : r));
      } else {
        // Criar nova regra
        const created = await mappingRuleService.create({
          tenantId: currentTenantId,
          name: formData.name.trim(),
          conditionField: formData.conditionField,
          conditionValue: formData.conditionValue.trim(),
          targetAccount: formData.targetAccount,
          priority: formData.priority,
        });
        
        setRules([...rules, created]);
      }

      handleCloseModal();
    } catch (err: any) {
      // ⚠️ SEGURANÇA: Não expor detalhes de erro que possam conter tokens
      const errorMessage = err.message || 'Erro ao salvar regra';
      setError(errorMessage);
      console.error('Erro ao salvar regra:', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta regra?')) {
      return;
    }

    try {
      await mappingRuleService.delete(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (err: any) {
      console.error('Erro ao deletar regra:', err);
      setError(err.message || 'Erro ao deletar regra');
    }
  };

  const handleTestRule = async (rule: MappingRule) => {
    if (!currentTenantId) {
      setError('Tenant não selecionado');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setIsTestModalOpen(true);

    try {
      // Carregar todas as regras do tenant
      const allRules = await mappingRuleService.list(currentTenantId);
      
      // Gerar pedido de exemplo
      const examplePedido = generateExamplePedido();
      
      // Testar regras
      const result = testMappingRules(examplePedido, allRules);
      
      // Filtrar apenas resultados da regra sendo testada (se especificada)
      if (rule) {
        const filteredResult: TestResult = {
          ...result,
          regrasAplicadas: result.regrasAplicadas.filter(ra => ra.regra.id === rule.id),
          lancamentosGerados: result.lancamentosGerados.filter(l => 
            result.regrasAplicadas.some(ra => ra.regra.id === rule.id && ra.contaDestino === l.conta)
          ),
        };
        setTestResult(filteredResult);
      } else {
        setTestResult(result);
      }
    } catch (err: any) {
      console.error('Erro ao testar regra:', err);
      setError(err.message || 'Erro ao testar regra');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Regras de Mapeamento</h1>
            <p className="text-gray-500">Configure como os produtos são convertidos em contas do Conta Azul</p>
          </div>
        </div>
        <div className="text-center py-12">
          <Loader2 size={32} className="animate-spin mx-auto text-primary mb-4" />
          <p className="text-gray-500">Carregando regras...</p>
        </div>
      </div>
    );
  }

  if (error && !isModalOpen) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Regras de Mapeamento</h1>
            <p className="text-gray-500">Configure como os produtos são convertidos em contas do Conta Azul</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regras de Mapeamento</h1>
          <p className="text-gray-500">Configure como os produtos são convertidos em contas do Conta Azul</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus size={18} className="mr-2" />
          Nova Regra
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 shadow-sm text-center">
          <p className="text-gray-500 mb-4">Nenhuma regra de mapeamento encontrada.</p>
          <Button onClick={() => handleOpenModal()}>
            <Plus size={18} className="mr-2" />
            Criar Primeira Regra
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome da Regra</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condição</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta Destino</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center w-16">{rule.priority}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rule.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono border border-gray-200">
                        SE {rule.conditionField} == "{rule.conditionValue}"
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rule.lancamentoType || 'RECEITA'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary font-medium">{rule.targetAccount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleTestRule(rule)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Testar regra"
                        >
                          <TestTube size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(rule)}
                          className="p-1 text-gray-400 hover:text-primary transition-colors"
                          title="Editar regra"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Deletar regra"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {isModalOpen && currentTenantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Editar Regra' : 'Nova Regra de Mapeamento'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-4 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Regra <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 100); // ⚠️ SEGURANÇA: Limitar tamanho
                    setFormData({ ...formData, name: value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Receitas Shopee"
                  maxLength={100}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Tipo de Lançamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Lançamento
                </label>
                <select
                  value={formData.lancamentoType || 'RECEITA'}
                  onChange={(e) => setFormData({ ...formData, lancamentoType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                  <option value="TAXA">Taxa</option>
                  <option value="FRETE">Frete</option>
                </select>
              </div>

              {/* Campo de Condição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campo de Condição <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.conditionField}
                  onChange={(e) => setFormData({ ...formData, conditionField: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="MARKETPLACE">Marketplace</option>
                  <option value="SKU">SKU</option>
                  <option value="CATEGORY">Categoria</option>
                  <option value="PRODUCT_NAME">Nome do Produto</option>
                </select>
              </div>

              {/* Valor da Condição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor da Condição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.conditionValue}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 255); // ⚠️ SEGURANÇA: Limitar tamanho
                    setFormData({ ...formData, conditionValue: value });
                    if (formErrors.conditionValue) setFormErrors({ ...formErrors, conditionValue: '' });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                    formErrors.conditionValue ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Shopee, wBuy, etc."
                  maxLength={255}
                />
                {formErrors.conditionValue && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.conditionValue}</p>
                )}
              </div>

              {/* Conta Destino */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conta Destino (Conta Azul) <span className="text-red-500">*</span>
                </label>
                <ContaAzulAccountSelector
                  tenantId={currentTenantId}
                  value={formData.targetAccount}
                  onChange={(accountId) => {
                    setFormData({ ...formData, targetAccount: accountId || '' });
                    if (formErrors.targetAccount) setFormErrors({ ...formErrors, targetAccount: '' });
                  }}
                  onError={(err) => setFormErrors({ ...formErrors, targetAccount: err })}
                />
                {formErrors.targetAccount && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.targetAccount}</p>
                )}
              </div>

              {/* Prioridade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(9999, parseInt(e.target.value) || 0));
                    setFormData({ ...formData, priority: value });
                    if (formErrors.priority) setFormErrors({ ...formErrors, priority: '' });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                    formErrors.priority ? 'border-red-300' : 'border-gray-300'
                  }`}
                  min={0}
                  max={9999}
                />
                <p className="mt-1 text-xs text-gray-500">Regras com maior prioridade são aplicadas primeiro</p>
                {formErrors.priority && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.priority}</p>
                )}
              </div>

              {/* Conta Padrão */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="contaPadrao"
                  checked={formData.contaPadrao}
                  onChange={(e) => setFormData({ ...formData, contaPadrao: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="contaPadrao" className="text-sm font-medium text-gray-700">
                  Usar como conta padrão (fallback quando nenhuma regra específica aplicar)
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <Button
                variant="secondary"
                onClick={handleCloseModal}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    {isEditing ? 'Atualizar' : 'Criar'} Regra
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Teste de Regra */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                Teste de Regra de Mapeamento
              </h2>
              <button
                onClick={() => {
                  setIsTestModalOpen(false);
                  setTestResult(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              {isTesting ? (
                <div className="text-center py-12">
                  <Loader2 size={32} className="animate-spin mx-auto text-primary mb-4" />
                  <p className="text-gray-500">Testando regra...</p>
                </div>
              ) : testResult ? (
                <div className="space-y-6">
                  {/* Pedido de Teste */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Pedido de Teste</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Número:</span>
                        <span className="text-sm font-medium">{testResult.pedido.numero}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Marketplace:</span>
                        <span className="text-sm font-medium">{testResult.pedido.marketplace}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Data:</span>
                        <span className="text-sm font-medium">{testResult.pedido.data_pedido}</span>
                      </div>
                    </div>
                  </div>

                  {/* Itens do Pedido */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
                    <div className="space-y-2">
                      {testResult.pedido.itens.map((item, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">SKU:</span>
                              <span className="ml-2 font-medium">{item.sku}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Nome:</span>
                              <span className="ml-2 font-medium">{item.nome}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Categoria:</span>
                              <span className="ml-2 font-medium">{item.categoria || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Marketplace:</span>
                              <span className="ml-2 font-medium">{item.marketplace}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Quantidade:</span>
                              <span className="ml-2 font-medium">{item.quantidade}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Valor Unitário:</span>
                              <span className="ml-2 font-medium">R$ {item.valor_unitario.toFixed(2)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-600">Valor Total:</span>
                              <span className="ml-2 font-bold text-primary">
                                R$ {(item.quantidade * item.valor_unitario).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Regras Aplicadas */}
                  {testResult.regrasAplicadas.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Regras Aplicadas</h3>
                      <div className="space-y-3">
                        {testResult.regrasAplicadas.map((ra, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">{ra.regra.name}</h4>
                                <p className="text-sm text-gray-600">
                                  Condição: {ra.regra.conditionField} == "{ra.regra.conditionValue}"
                                </p>
                              </div>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                Prioridade: {ra.regra.priority}
                              </span>
                            </div>
                            <div className="mt-3 space-y-1 text-sm">
                              <div>
                                <span className="text-gray-600">Conta Destino:</span>
                                <span className="ml-2 font-medium">{ra.contaDestino}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Itens Aplicados:</span>
                                <span className="ml-2 font-medium">{ra.itensAplicados.length}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Valor Total:</span>
                                <span className="ml-2 font-bold text-primary">
                                  R$ {ra.valorTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800">
                        Nenhuma regra aplicada a este pedido de teste.
                      </p>
                    </div>
                  )}

                  {/* Lançamentos Gerados */}
                  {testResult.lancamentosGerados.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Lançamentos que Seriam Gerados</h3>
                      <div className="space-y-2">
                        {testResult.lancamentosGerados.map((lancamento, index) => (
                          <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Tipo:</span>
                                <span className="ml-2 font-medium">{lancamento.tipo}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Conta:</span>
                                <span className="ml-2 font-medium">{lancamento.conta}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-600">Descrição:</span>
                                <span className="ml-2 font-medium">{lancamento.descricao}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-600">Valor:</span>
                                <span className="ml-2 font-bold text-green-700">
                                  R$ {lancamento.valor.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nenhum resultado de teste disponível</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <Button
                onClick={() => {
                  setIsTestModalOpen(false);
                  setTestResult(null);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mappings;
