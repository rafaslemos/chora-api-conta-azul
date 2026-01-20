import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import Button from '../components/ui/Button';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Verificar se há token na URL ou se o Supabase já processou automaticamente
    const token = searchParams.get('token') || searchParams.get('access_token');
    const type = searchParams.get('type');

    // Verificar se há sessão ativa (o Supabase pode ter processado o token automaticamente)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Se há sessão, o token foi processado com sucesso
        setIsValidToken(true);
      } else if (token && type === 'recovery') {
        // Se há token na URL, ainda é válido
        setIsValidToken(true);
      } else {
        // Sem sessão e sem token válido
        setIsValidToken(false);
        setMessage({
          type: 'error',
          text: 'Link inválido ou expirado. Solicite um novo link de recuperação.',
        });
      }
    });
  }, [searchParams]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'A senha deve ter no mínimo 8 caracteres';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validações
    if (password !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'As senhas não coincidem.',
      });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setMessage({
        type: 'error',
        text: passwordError,
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      setMessage({
        type: 'error',
        text: 'Supabase não está configurado.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Atualizar senha usando o token da URL
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setMessage({
        type: 'success',
        text: 'Senha alterada com sucesso! Redirecionando para login...',
      });

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao atualizar senha:', error);
      let errorMessage = 'Erro ao atualizar senha. Tente novamente.';

      if (error.message.includes('expired') || error.message.includes('expirado')) {
        errorMessage = 'O link expirou. Solicite um novo link de recuperação.';
      } else if (error.message.includes('invalid') || error.message.includes('inválido')) {
        errorMessage = 'Link inválido. Solicite um novo link de recuperação.';
      }

      setMessage({
        type: 'error',
        text: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
            <div className="text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Link Inválido</h2>
              <p className="mt-2 text-sm text-gray-600">
                O link de recuperação é inválido ou expirou.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/login')}>Voltar para Login</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            C
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Redefinir Senha
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Digite sua nova senha abaixo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nova Senha
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirmar Nova Senha
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                  placeholder="Digite a senha novamente"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {message && (
              <div
                className={`p-4 rounded-md flex items-start ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                )}
                <p
                  className={`text-sm ${
                    message.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {message.text}
                </p>
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Redefinir Senha
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-primary hover:text-primaryDark"
            >
              Voltar para Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

