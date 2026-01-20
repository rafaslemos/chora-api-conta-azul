import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { XCircle, Mail, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import { signIn } from '../services/authService';
import { resetPassword } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useTimeout } from '../hooks/useTimeout';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { createTimeout } = useTimeout();

  // Verificar se já está autenticado
  useEffect(() => {
    const checkAuth = async () => {
      if (!isSupabaseConfigured()) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Se já estiver autenticado, redirecionar para a rota de origem ou dashboard
        const from = (location.state as any)?.from || '/';
        navigate(from, { replace: true });
      }
    };

    checkAuth();
  }, [navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signIn(email, password);
      // Redirecionar para a rota que estava tentando acessar ou dashboard
      const from = (location.state as any)?.from || '/';
      navigate(from, { replace: true });
    } catch (error: any) {
      logger.error('Erro ao fazer login', error instanceof Error ? error : undefined, { context: 'auth' }, 'Login.tsx');
      alert(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetMessage(null);

    try {
      await resetPassword(resetEmail);
      setResetMessage({
        type: 'success',
        text: 'Email de recuperação enviado! Verifique sua caixa de entrada.',
      });
      createTimeout(() => {
        setShowResetModal(false);
        setResetEmail('');
        setResetMessage(null);
      }, 3000);
    } catch (error: any) {
      logger.error('Erro ao solicitar reset de senha', error instanceof Error ? error : undefined, { context: 'auth' }, 'Login.tsx');
      let message = 'Erro ao enviar email de recuperação. Tente novamente.';
      
      if (error.message.includes('rate limit') || error.message.includes('aguarde')) {
        const match = error.message.match(/after (\d+) seconds?/i);
        const seconds = match ? match[1] : 'alguns';
        message = `Por segurança, aguarde ${seconds} segundos antes de tentar novamente.`;
      } else if (
        error.message.includes('não encontrado') || 
        error.message.includes('não existe') ||
        error.message.includes('Email não encontrado') ||
        error.message.includes('not found')
      ) {
        message = 'Email não encontrado. Verifique o endereço digitado ou cadastre-se.';
      }
      
      setResetMessage({
        type: 'error',
        text: message,
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">C</div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Acesse sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Plataforma Conector Conta Azul
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Endereço de e-mail
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Lembrar-me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="font-medium text-primary hover:text-primaryDark"
                >
                  Esqueceu sua senha?
                </button>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Entrar
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link 
                to="/register" 
                className="font-medium text-primary hover:text-primaryDark"
              >
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Reset de Senha */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recuperar Senha</h3>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetEmail('');
                  setResetMessage(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Digite seu email e enviaremos um link para redefinir sua senha.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
              </div>

              {resetMessage && (
                <div
                  className={`p-3 rounded-md flex items-start ${
                    resetMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {resetMessage.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  )}
                  <p
                    className={`text-sm ${
                      resetMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {resetMessage.text}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetEmail('');
                    setResetMessage(null);
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isResetting} className="flex-1">
                  Enviar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;