import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Página intermediária para redirecionar de /auth/reset-password (sem hash) para /#/auth/reset-password (com hash)
 * Necessária porque o Supabase não preserva hash no redirect_to dos emails
 */
const ResetPasswordRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Extrair parâmetros da URL
    const token = searchParams.get('token') || searchParams.get('access_token');
    const type = searchParams.get('type');

    // Construir nova URL com hash para HashRouter
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (type) params.set('type', type);

    const hashPath = '/auth/reset-password';
    const queryString = params.toString();
    const newUrl = `/#${hashPath}${queryString ? `?${queryString}` : ''}`;

    // Redirecionar para a rota com hash
    window.location.replace(newUrl);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            C
          </div>
        </div>
        <h2 className="mt-6 text-xl font-semibold text-gray-900">Redirecionando...</h2>
        <p className="mt-2 text-sm text-gray-600">Aguarde um momento.</p>
        <div className="mt-6 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordRedirect;
