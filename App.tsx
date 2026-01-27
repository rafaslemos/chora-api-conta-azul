import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { TenantProvider } from './contexts/TenantContext';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import Logs from './pages/Logs';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import AdminTenants from './pages/AdminTenants';
import OnboardingWizard from './pages/OnboardingWizard';
import ContaAzulCallback from './pages/ContaAzulCallback';
import SetupInitial from './pages/SetupInitial';
import AuthConfirm from './pages/AuthConfirm';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { checkDatabaseConfigured, shouldSkipDbCheck } from './services/setupService';
import { logger } from './services/logger';

// Higher-order component to wrap private routes with Layout
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        // Verificar sessão atual
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          logger.error('Erro ao verificar sessão', error instanceof Error ? error : undefined, { context: 'auth' }, 'App.tsx');
          setIsAuthenticated(false);
        } else if (session) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        logger.error('Erro ao verificar autenticação', error instanceof Error ? error : undefined, { context: 'auth' }, 'App.tsx');
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Escutar mudanças na autenticação apenas se Supabase estiver configurado
    let subscription: { unsubscribe: () => void } | null = null;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          setIsAuthenticated(!!session);
          setIsLoading(false);
        });

        if (data && data.subscription) {
          subscription = data.subscription;
        }
      } catch (error) {
        logger.error('Erro ao configurar listener de autenticação', error instanceof Error ? error : undefined, { context: 'auth' }, 'App.tsx');
      }
    }

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Salvar a rota que estava tentando acessar para redirecionar após login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Layout>{children}</Layout>;
};



// Chave para cache de verificação do banco
const DB_VERIFIED_KEY = 'db_setup_verified';

// Componente para verificar banco e redirecionar se necessário
const DatabaseCheckRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState<boolean | null>(null);
  const [dbCheckHint, setDbCheckHint] = useState<'exposed_schemas' | 'function_not_found' | undefined>(undefined);
  const [isCheckingDatabase, setIsCheckingDatabase] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkDatabase = async () => {
      setIsCheckingDatabase(true);
      setDbCheckHint(undefined);

      if (shouldSkipDbCheck()) {
        setIsDatabaseConfigured(true);
        setIsCheckingDatabase(false);
        return;
      }

      if (!isSupabaseConfigured()) {
        setIsDatabaseConfigured(false);
        setIsCheckingDatabase(false);
        return;
      }

      const cachedResult = localStorage.getItem(DB_VERIFIED_KEY);
      if (cachedResult === 'true') {
        setIsDatabaseConfigured(true);
        setIsCheckingDatabase(false);
        return;
      }

      try {
        const supabaseUrl = localStorage.getItem('supabase_url');
        const supabaseAnonKey = localStorage.getItem('supabase_anon_key');

        if (!supabaseUrl || !supabaseAnonKey) {
          setIsDatabaseConfigured(false);
          setIsCheckingDatabase(false);
          return;
        }

        const { configured, hint } = await checkDatabaseConfigured(supabaseUrl, supabaseAnonKey);
        setIsDatabaseConfigured(configured);
        setDbCheckHint(hint);

        if (configured) {
          localStorage.setItem(DB_VERIFIED_KEY, 'true');
        }
      } catch (error) {
        logger.error('Erro ao verificar banco configurado', error instanceof Error ? error : undefined, { context: 'database' }, 'App.tsx');
        setIsDatabaseConfigured(false);
      } finally {
        setIsCheckingDatabase(false);
      }
    };

    checkDatabase();
  }, []);

  if (isCheckingDatabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando configuração...</p>
        </div>
      </div>
    );
  }

  const currentPath = location.pathname || window.location.hash.replace('#', '');
  const isSetupPath = currentPath === '/setup' || currentPath.includes('/setup');
  if (isDatabaseConfigured === false && !isSetupPath) {
    return <Navigate to="/setup" replace state={{ dbCheckHint }} />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // Handle Legacy/Standard OAuth Redirects (without hash)
  // Se a URL for /auth/conta-azul/callback mas estamos usando HashRouter, 
  // o router ignoraria. Renderizamos manualmente aqui.
  // Também verificar se há parâmetros OAuth na raiz (/?code=...&state=...)
  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthParams = urlParams.get('code') && urlParams.get('state');
  
  // Verificar se o hash já mudou (não renderizar callback se já estiver em outra rota)
  const hashPath = window.location.hash.split('?')[0];
  const isInCallbackRoute = window.location.pathname === '/auth/conta-azul/callback' || 
                           (window.location.pathname === '/' && hasOAuthParams);
  const isHashChanged = hashPath && hashPath !== '#/auth/conta-azul/callback' && hashPath !== '';
  
  // Só renderizar callback se estiver na rota E o hash não tiver mudado
  if (isInCallbackRoute && !isHashChanged) {
    return <ContaAzulCallback />;
  }

  return (
    <TenantProvider>
      <Router>
        <DatabaseCheckRoute>
          <Routes>
            {/* Setup route - sem autenticação necessária */}
            <Route
              path="/setup"
              element={
                shouldSkipDbCheck() ? (
                  <Navigate to="/login" replace />
                ) : (
                  <SetupInitial />
                )
              }
            />
            
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/conta-azul/callback" element={<ContaAzulCallback />} />

            {/* Protected Routes */}
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/admin/tenants" element={<PrivateRoute><AdminTenants /></PrivateRoute>} />
            <Route path="/admin/tenants/new" element={<PrivateRoute><OnboardingWizard /></PrivateRoute>} />
            <Route path="/onboarding" element={<PrivateRoute><OnboardingWizard /></PrivateRoute>} />
            <Route path="/credentials" element={<PrivateRoute><Credentials /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><Logs /></PrivateRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </DatabaseCheckRoute>
      </Router>
    </TenantProvider>
  );
};

export default App;