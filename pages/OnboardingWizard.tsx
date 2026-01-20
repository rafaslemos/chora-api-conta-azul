import React, { useState } from 'react';
import { useTimeout } from '../hooks/useTimeout';
import { 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Key, 
  Calculator, 
  Settings, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import Button from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

type Step = 1 | 2 | 3;

const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { createTimeout } = useTimeout();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Dados da Empresa
  const [companyData, setCompanyData] = useState({
    name: '',
    cnpj: '',
    responsibleName: '',
    responsibleEmail: ''
  });

  // Step 2: ContaAzul
  const [contaAzulConfig, setContaAzulConfig] = useState({
    accountPlan: '',
    folder: ''
  });
  const [isTestingCa, setIsTestingCa] = useState(false);
  const [caTestResult, setCaTestResult] = useState<'success' | 'error' | null>(null);

  // Step 3: Mapeamento (renumerado de Step 4)
  const [mappingRules, setMappingRules] = useState({
    defaultAccount: '',
    marketplaceAccount: '',
    feesAccount: ''
  });

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const testContaAzulConnection = async () => {
    setIsTestingCa(true);
    setCaTestResult(null);
    // Simular teste de conexão
    createTimeout(() => {
      setIsTestingCa(false);
      setCaTestResult('success');
    }, 2000);
  };

  const handleFinish = async () => {
    setIsLoading(true);
    // Simular criação do tenant e configuração
    createTimeout(() => {
      setIsLoading(false);
      navigate('/admin/tenants');
    }, 2000);
  };

  const isStepValid = (step: Step): boolean => {
    switch (step) {
      case 1:
        return companyData.name !== '' && companyData.cnpj !== '' && 
               companyData.responsibleName !== '' && companyData.responsibleEmail !== '';
      case 2:
        return contaAzulConfig.accountPlan !== '' && caTestResult === 'success';
      case 3:
        return mappingRules.defaultAccount !== '';
      default:
        return false;
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: 'Empresa', icon: Building2 },
      { number: 2, label: 'ContaAzul', icon: Key },
      { number: 3, label: 'Mapeamento', icon: Settings }
    ];

    return (
      <div className="flex items-center justify-center mb-10">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;
          
          return (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
                  isCompleted 
                    ? 'bg-green-50 border-green-200 text-green-600' 
                    : isActive 
                      ? 'bg-primary border-primary text-white' 
                      : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}>
                  {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                </div>
                <span className={`mt-2 text-xs font-semibold ${
                  isActive ? 'text-primary' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 ${isCompleted ? 'bg-green-200' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Dados da Empresa</h3>
              <p className="text-sm text-gray-500 mt-2">Informe os dados básicos da empresa que será integrada</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({...companyData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Ex: Acme Corp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={companyData.cnpj}
                  onChange={(e) => setCompanyData({...companyData, cnpj: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Responsável *
                  </label>
                  <input
                    type="text"
                    value={companyData.responsibleName}
                    onChange={(e) => setCompanyData({...companyData, responsibleName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="João Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail do Responsável *
                  </label>
                  <input
                    type="email"
                    value={companyData.responsibleEmail}
                    onChange={(e) => setCompanyData({...companyData, responsibleEmail: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="joao@empresa.com"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Configurar ContaAzul</h3>
              <p className="text-sm text-gray-500 mt-2">Conecte sua conta ContaAzul para criar lançamentos financeiros</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
              <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Autenticação OAuth 2.0</p>
                <p className="text-xs">Você será redirecionado para autorizar o acesso. O token será renovado automaticamente.</p>
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                variant="secondary" 
                className="w-full justify-center border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={testContaAzulConnection}
              >
                <RefreshCw size={16} className="mr-2" />
                Autorizar ContaAzul (OAuth)
              </Button>

              {caTestResult === 'success' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-3">
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-medium">ContaAzul autorizada com sucesso!</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Plano de Contas
                      </label>
                      <select
                        value={contaAzulConfig.accountPlan}
                        onChange={(e) => setContaAzulConfig({...contaAzulConfig, accountPlan: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="">Selecione um plano de contas</option>
                        <option value="plan1">Plano Padrão</option>
                        <option value="plan2">Plano Personalizado</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pasta Contábil
                      </label>
                      <select
                        value={contaAzulConfig.folder}
                        onChange={(e) => setContaAzulConfig({...contaAzulConfig, folder: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="">Selecione uma pasta</option>
                        <option value="folder1">Vendas Online</option>
                        <option value="folder2">Marketplaces</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {caTestResult === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">Falha na autorização. Tente novamente.</span>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Mapeamento Inicial</h3>
              <p className="text-sm text-gray-500 mt-2">Configure as regras básicas de mapeamento de contas</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-4">
                Você poderá criar regras mais detalhadas depois na página de Mapeamentos. Por enquanto, configure as contas padrão.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conta Padrão para Receitas *
                  </label>
                  <select
                    value={mappingRules.defaultAccount}
                    onChange={(e) => setMappingRules({...mappingRules, defaultAccount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Selecione uma conta</option>
                    <option value="3.1.01.001">3.1.01.001 - Receita de Vendas</option>
                    <option value="3.1.01.002">3.1.01.002 - Receita de Marketplace</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conta para Taxas de Marketplace
                  </label>
                  <select
                    value={mappingRules.marketplaceAccount}
                    onChange={(e) => setMappingRules({...mappingRules, marketplaceAccount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Selecione uma conta</option>
                    <option value="4.1.01.001">4.1.01.001 - Taxas de Marketplace</option>
                    <option value="4.1.01.002">4.1.01.002 - Comissões</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conta para Taxas e Impostos
                  </label>
                  <select
                    value={mappingRules.feesAccount}
                    onChange={(e) => setMappingRules({...mappingRules, feesAccount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Selecione uma conta</option>
                    <option value="4.1.02.001">4.1.02.001 - Impostos sobre Vendas</option>
                    <option value="4.1.02.002">4.1.02.002 - Taxas Administrativas</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-900 mb-1">Pronto para finalizar!</p>
                  <p className="text-xs text-green-700">
                    Após concluir, o primeiro sync será agendado automaticamente para processar os pedidos pendentes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8">
          {renderStepIndicator()}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
            <Button
              variant="secondary"
              onClick={currentStep === 1 ? () => navigate('/admin/tenants') : handlePrevious}
              disabled={isLoading}
            >
              <ChevronLeft size={16} className="mr-2" />
              {currentStep === 1 ? 'Cancelar' : 'Anterior'}
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid(currentStep) || isLoading}
              >
                Próximo
                <ChevronRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                isLoading={isLoading}
                disabled={!isStepValid(currentStep)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 size={16} className="mr-2" />
                Finalizar Cadastro
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;

