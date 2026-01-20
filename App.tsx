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
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { checkDatabaseConfigured } from './services/setupService';
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



// Componente para verificar banco e redirecionar se necessário
const DatabaseCheckRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState<boolean | null>(null);
  const [isCheckingDatabase, setIsCheckingDatabase] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkDatabase = async () => {
      setIsCheckingDatabase(true);
      
      // Se não tiver Supabase configurado, banco não está configurado
      if (!isSupabaseConfigured()) {
        setIsDatabaseConfigured(false);
        setIsCheckingDatabase(false);
        return;
      }

      try {
        // Obter configuração do localStorage ou env
        const supabaseUrl = localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = localStorage.getItem('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          setIsDatabaseConfigured(false);
          setIsCheckingDatabase(false);
          return;
        }

        // Verificar se banco está configurado
        const configured = await checkDatabaseConfigured(supabaseUrl, supabaseAnonKey);
        setIsDatabaseConfigured(configured);
      } catch (error) {
        logger.error('Erro ao verificar banco configurado', error instanceof Error ? error : undefined, { context: 'database' }, 'App.tsx');
        setIsDatabaseConfigured(false);
      } finally {
        setIsCheckingDatabase(false);
      }
    };

    checkDatabase();
  }, []);

  // Se estiver verificando banco, mostrar loading
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

  // Se banco não estiver configurado e não estiver na página de setup, redirecionar
  const currentPath = location.pathname || window.location.hash.replace('#', '');
  if (isDatabaseConfigured === false && currentPath !== '/setup' && !currentPath.includes('/setup')) {
    return <Navigate to="/setup" replace />;
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
            <Route path="/setup" element={<SetupInitial />} />
            
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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