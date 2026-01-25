import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

function parseHashParams(hash: string): Record<string, string> {
  const cleaned = hash.replace(/^#/, '');
  const idx = cleaned.indexOf('?');
  const query = idx >= 0 ? cleaned.slice(idx + 1) : cleaned;
  const parts = query.split('&');
  const params: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return params;
}

const AuthConfirm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      navigate('/login', { replace: true, state: { confirmError: true } });
      return;
    }

    const fromSearch = searchParams.get('access_token') || searchParams.get('token');
    const typeFromSearch = searchParams.get('type');
    const hash = window.location.hash || '';
    const hashParams = parseHashParams(hash);
    const fromHash = hashParams.access_token || hashParams['#access_token'] || hashParams.token;
    const hasAccessToken = !!(fromSearch || fromHash);
    const typeSignup = typeFromSearch === 'signup' || hashParams.type === 'signup';

    const run = async () => {
      // Supabase processa #access_token=... ao carregar. Aguardar um pouco e checar sessão.
      await new Promise((r) => setTimeout(r, 800));
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setStatus('success');
        // Limpar hash para evitar reuso
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.hash = '#/auth/confirm';
          window.history.replaceState(null, '', url.toString());
        }
        navigate('/login', { replace: true, state: { emailConfirmed: true } });
        return;
      }

      if (hasAccessToken && typeSignup) {
        // Tokens presentes mas ainda sem sessão; dar mais uma chance
        await new Promise((r) => setTimeout(r, 1200));
        const {
          data: { session: s2 },
        } = await supabase.auth.getSession();
        if (s2) {
          setStatus('success');
          navigate('/login', { replace: true, state: { emailConfirmed: true } });
          return;
        }
      }

      setStatus('error');
      navigate('/login', { replace: true, state: { confirmError: true } });
    };

    run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            C
          </div>
        </div>
        <h2 className="mt-6 text-xl font-semibold text-gray-900">Confirmando seu email...</h2>
        <p className="mt-2 text-sm text-gray-600">
          {status === 'checking' && 'Aguarde um momento.'}
          {status === 'success' && 'Email confirmado. Redirecionando para login...'}
          {status === 'error' && 'Redirecionando...'}
        </p>
        {status === 'checking' && (
          <div className="mt-6 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthConfirm;
