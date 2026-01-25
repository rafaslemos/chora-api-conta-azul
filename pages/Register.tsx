import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { signUp } from '../services/authService';
import { fetchCompanyDataByCnpj } from '../services/cnpjService';
import { validateCnpj, formatCnpj, cleanCnpj } from '../utils/cnpjValidator';
import { formatPhone, cleanPhone } from '../utils/phoneValidator';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useTimeout } from '../hooks/useTimeout';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { createTimeout } = useTimeout();

  // Estados do formulário
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    cnpj: '',
    phone: '',
    companyName: '',
    razaoSocial: '',
    endereco: {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    },
  });

  // Estados de validação e feedback
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cnpjMessage, setCnpjMessage] = useState('');
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Validar email
  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Validar senha
  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  // Buscar dados do CNPJ
  const handleCnpjBlur = async () => {
    const cnpj = formData.cnpj.trim();
    
    if (!cnpj) {
      return;
    }

    // Validar formato
    if (!validateCnpj(cnpj)) {
      setCnpjStatus('error');
      setCnpjMessage('CNPJ inválido. Verifique o formato e os dígitos verificadores.');
      setErrors({ ...errors, cnpj: 'CNPJ inválido' });
      return;
    }

    setIsLoadingCnpj(true);
    setCnpjStatus('idle');
    setCnpjMessage('');

    try {
      const companyData = await fetchCompanyDataByCnpj(cnpj);
      
      // Preencher campos automaticamente
      setFormData(prev => ({
        ...prev,
        companyName: companyData.nomeFantasia,
        razaoSocial: companyData.razaoSocial,
        phone: companyData.telefone || prev.phone,
        email: companyData.email && !prev.email ? companyData.email : prev.email,
        endereco: companyData.endereco,
      }));

      setCnpjStatus('success');
      setCnpjMessage('Dados da empresa carregados com sucesso!');
      setErrors({ ...errors, cnpj: '' });
    } catch (error) {
      setCnpjStatus('error');
      const message = error instanceof Error ? error.message : 'Erro ao buscar dados do CNPJ';
      setCnpjMessage(message);
      setErrors({ ...errors, cnpj: message });
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  // Formatar CNPJ enquanto digita
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatCnpj(value);
    setFormData(prev => ({ ...prev, cnpj: formatted }));
    setCnpjStatus('idle');
    setCnpjMessage('');
    setErrors({ ...errors, cnpj: '' });
  };

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Nome completo é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Senha deve ter no mínimo 8 caracteres';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    if (!formData.cnpj.trim()) {
      newErrors.cnpj = 'CNPJ é obrigatório';
    } else if (!validateCnpj(formData.cnpj)) {
      newErrors.cnpj = 'CNPJ inválido';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Nome da empresa é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        cnpj: cleanCnpj(formData.cnpj),
        phone: formData.phone ? cleanPhone(formData.phone) : undefined,
        companyName: formData.companyName,
      });

      setSubmitError('');
      setSubmitSuccess(true);
      createTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      console.error('Erro ao cadastrar:', error);
      
      let message = 'Erro ao realizar cadastro. Tente novamente.';
      
      if (error instanceof Error) {
        message = error.message;
        
        // Mensagens mais amigáveis para erros comuns
        if (error.message.includes('rate limit') || error.message.includes('aguarde') || error.message.includes('after') || error.message.includes('429')) {
          const match = error.message.match(/(\d+)\s*seconds?/i);
          const seconds = match ? match[1] : 'alguns';
          message = `Muitas tentativas. Por favor, aguarde ${seconds} segundos antes de tentar novamente.`;
        } else if (error.message.includes('already registered') || error.message.includes('already exists') || error.message.includes('User already registered')) {
          message = 'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.';
        } else if (error.message.includes('password') || error.message.includes('Password')) {
          message = 'A senha não atende aos requisitos de segurança. Use pelo menos 8 caracteres.';
        } else if (error.message.includes('email') || error.message.includes('Email')) {
          message = 'Email inválido. Verifique o endereço de email.';
        } else if (error.message.includes('Too Many Requests')) {
          message = 'Muitas tentativas. Por favor, aguarde alguns segundos antes de tentar novamente.';
        }
      }
      
      // Mostrar erro de forma mais amigável
      setSubmitError(message);
      
      // Scroll para o topo para mostrar o erro
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Limpar erro após 10 segundos
      createTimeout(() => setSubmitError(''), 10000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            C
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Criar sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Cadastre-se como parceiro na Plataforma Conector
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {/* Mensagem de sucesso */}
          {submitSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-green-800">Cadastro realizado com sucesso!</h3>
                  <p className="mt-1 text-sm text-green-700">
                    Verifique seu email para confirmar sua conta. Depois faça login.
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="mt-3"
                  >
                    Ir para o login
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de erro geral */}
          {submitError && !submitSuccess && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Erro ao cadastrar</h3>
                  <p className="mt-1 text-sm text-red-700">{submitError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError('')}
                  className="ml-4 text-red-400 hover:text-red-500"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
          
          {!submitSuccess && (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Nome Completo */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors ${
                    errors.fullName ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.fullName && (
                  <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Endereço de e-mail <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Mínimo de 8 caracteres
                </p>
              </div>
            </div>

            {/* Confirmar Senha */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Senha <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors ${
                    errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* CNPJ */}
            <div>
              <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700">
                CNPJ <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="cnpj"
                  name="cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  required
                  value={formData.cnpj}
                  onChange={handleCnpjChange}
                  onBlur={handleCnpjBlur}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors pr-10 ${
                    errors.cnpj ? 'border-red-300' : cnpjStatus === 'success' ? 'border-green-300' : 'border-gray-300'
                  }`}
                />
                {isLoadingCnpj && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                {cnpjStatus === 'success' && !isLoadingCnpj && (
                  <div className="absolute right-3 top-2.5">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                )}
                {cnpjStatus === 'error' && !isLoadingCnpj && (
                  <div className="absolute right-3 top-2.5">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                )}
                {errors.cnpj && (
                  <p className="mt-1 text-sm text-red-600">{errors.cnpj}</p>
                )}
                {cnpjMessage && (
                  <p className={`mt-1 text-sm flex items-center gap-1 ${
                    cnpjStatus === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {cnpjStatus === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {cnpjMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Nome da Empresa */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                Nome da Empresa <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors ${
                    errors.companyName ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
                )}
              </div>
            </div>

            {/* Razão Social (Readonly) */}
            {formData.razaoSocial && (
              <div>
                <label htmlFor="razaoSocial" className="block text-sm font-medium text-gray-700">
                  Razão Social
                </label>
                <div className="mt-1">
                  <input
                    id="razaoSocial"
                    name="razaoSocial"
                    type="text"
                    readOnly
                    value={formData.razaoSocial}
                    className="appearance-none block w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md shadow-sm text-gray-600 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {/* Telefone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Telefone
              </label>
              <div className="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setFormData(prev => ({ ...prev, phone: formatted }));
                  }}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Formato: (00) 00000-0000 ou (00) 0000-0000
                </p>
              </div>
            </div>

            {/* Endereço (Readonly, apenas visualização) */}
            {formData.endereco.logradouro && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço (preenchido automaticamente)
                </label>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    {formData.endereco.logradouro}, {formData.endereco.numero}
                  </p>
                  <p>
                    {formData.endereco.bairro} - {formData.endereco.cidade}/{formData.endereco.estado}
                  </p>
                  <p>CEP: {formData.endereco.cep}</p>
                </div>
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Criar Conta
              </Button>
            </div>
          </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-medium text-primary hover:text-primaryDark">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

