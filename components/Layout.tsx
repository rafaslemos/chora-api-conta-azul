import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, LogOut, ChevronDown, Menu, X, Users, ChevronLeft, ChevronRight, Search, Check, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, getUserProfile, UserProfile } from '../services/authService';
import { useTenant } from '../contexts/TenantContext';
import { formatCnpj } from '../utils/cnpjValidator';
import { logger } from '../services/logger';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Mobile state
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop state
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [tenantSearchTerm, setTenantSearchTerm] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  
  // Usar contexto de tenant
  const { selectedTenantId, selectedTenant, tenants, setSelectedTenantId, isLoading: isLoadingTenants } = useTenant();

  const navItems = [
    { icon: LayoutDashboard, label: 'Painel', path: '/' },
    { icon: Users, label: 'Meus Clientes', path: '/admin/tenants' },
    { icon: FileText, label: 'Logs e Auditoria', path: '/logs' },
  ];

  // Carregar dados do usuário
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoadingUser(true);
    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      logger.error('Erro ao carregar dados do usuário', error instanceof Error ? error : undefined, { context: 'user' }, 'Layout.tsx');
    } finally {
      setIsLoadingUser(false);
    }
  };

  // Filtragem de Tenants para o Dropdown
  const filteredTenants = tenants.filter(tenant => {
    const term = tenantSearchTerm.toLowerCase();
    const cleanTerm = tenantSearchTerm.replace(/\D/g, ''); 

    const matchesName = tenant.name.toLowerCase().includes(term);
    const matchesCnpj = cleanTerm.length > 0 && tenant.cnpj.replace(/\D/g, '').includes(cleanTerm);

    return matchesName || matchesCnpj;
  });

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await signOut();
      // Limpar qualquer estado local se necessário
      // Redirecionar para login
      navigate('/login', { replace: true });
      // Forçar reload para limpar qualquer cache de estado
      window.location.href = '/#/login';
    } catch (error: any) {
      logger.error('Erro ao fazer logout', error instanceof Error ? error : undefined, { context: 'auth' }, 'Layout.tsx');
      // Mesmo com erro, redirecionar para login
      navigate('/login', { replace: true });
      window.location.href = '/#/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -10 }
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.3
  } as const;

  const sidebarVariants = {
    expanded: { width: "16rem" }, // w-64
    collapsed: { width: "5rem" }   // w-20
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        variants={sidebarVariants}
        animate={isCollapsed ? "collapsed" : "expanded"}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 flex flex-col
          lg:static lg:translate-x-0 transition-all
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center h-16 border-b border-gray-100 transition-all ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          
          {/* Logo Area */}
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <div className="w-8 h-8 bg-primary rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold">C</div>
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-lg font-bold text-gray-800"
              >
                Conector
              </motion.span>
            )}
          </div>

          {/* Mobile Close Button */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X size={20} />
          </button>

          {/* Desktop Collapse Toggle - Aparece quando menu está expandido */}
          {!isCollapsed && (
            <button 
              onClick={() => setIsCollapsed(true)} 
              className="hidden lg:flex text-gray-400 hover:text-primary transition-colors"
              title="Recolher menu"
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-primary'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${isCollapsed ? 'justify-center' : ''}`
              }
              title={isCollapsed ? item.label : ''} // Tooltip simples nativo quando colapsado
            >
              <item.icon size={20} className={`flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {item.label}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="p-3 border-t border-gray-100">
          {/* Botão para expandir - Aparece apenas quando menu está recolhido */}
          {isCollapsed && (
            <button 
              onClick={() => setIsCollapsed(false)} 
              className="hidden lg:flex w-full items-center justify-center p-2 mb-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              title="Expandir menu"
            >
              <ChevronRight size={20} />
            </button>
          )}

          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`flex items-center w-full px-3 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap ${isCollapsed ? 'justify-center' : ''} ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isCollapsed ? "Sair" : ''}
          >
            <LogOut size={20} className={`flex-shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isLoggingOut ? 'animate-spin' : ''}`} />
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {isLoggingOut ? 'Saindo...' : 'Sair'}
              </motion.span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-8 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 focus:outline-none"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center ml-auto gap-4">
             {/* Tenant Selector - Dropdown Funcional */}
            <div className="hidden md:block relative">
              {/* Backdrop transparente para fechar ao clicar fora */}
              {isTenantDropdownOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setIsTenantDropdownOpen(false)} />
              )}

              {/* Trigger Button */}
              <button
                onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                className="flex items-center bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors relative z-20"
              >
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  selectedTenantId === null 
                    ? 'bg-blue-500' 
                    : selectedTenant?.status === 'ACTIVE' 
                      ? 'bg-green-500' 
                      : 'bg-gray-400'
                }`}></span>
                <div className="flex flex-col mr-2 text-left">
                  {userProfile?.company_name && (
                    <span className="text-[10px] text-gray-500 uppercase font-semibold leading-tight">
                      {userProfile.company_name}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-700 leading-tight">
                    {isLoadingTenants ? 'Carregando...' : selectedTenantId === null ? 'Todos os Clientes' : selectedTenant?.name || 'Selecione...'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {/* Dropdown Content */}
              <AnimatePresence>
                {isTenantDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden min-w-[300px]"
                  >
                    {/* Search Input */}
                    {tenants.length > 3 && (
                      <div className="p-2 border-b border-gray-100 bg-gray-50">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            autoFocus
                            type="text" 
                            placeholder="Buscar empresa ou CNPJ..." 
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            value={tenantSearchTerm}
                            onChange={(e) => setTenantSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* List Options */}
                    <div className="max-h-60 overflow-y-auto">
                      {/* Opção "Todos os Clientes" */}
                      <button
                        onClick={() => {
                          setSelectedTenantId(null);
                          setIsTenantDropdownOpen(false);
                          setTenantSearchTerm('');
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group ${
                          selectedTenantId === null ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${selectedTenantId === null ? 'font-bold text-primary' : 'font-medium text-gray-700'}`}>
                              Todos os Clientes
                            </p>
                            <p className="text-xs text-gray-500">Dados consolidados</p>
                          </div>
                        </div>
                        {selectedTenantId === null && (
                          <Check size={16} className="text-primary flex-shrink-0 ml-2" />
                        )}
                      </button>

                      {/* Separador */}
                      {tenants.length > 0 && (
                        <div className="border-t border-gray-100 my-1"></div>
                      )}

                      {/* Lista de Tenants */}
                      {(tenantSearchTerm ? filteredTenants : tenants).length > 0 ? (
                        (tenantSearchTerm ? filteredTenants : tenants).map(tenant => (
                          <button
                            key={tenant.id}
                            onClick={() => {
                              setSelectedTenantId(tenant.id);
                              setIsTenantDropdownOpen(false);
                              setTenantSearchTerm('');
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group ${
                              selectedTenantId === tenant.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                tenant.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                              }`}></span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${selectedTenantId === tenant.id ? 'font-bold text-primary' : 'font-medium text-gray-700'}`}>
                                  {tenant.name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{formatCnpj(tenant.cnpj)}</p>
                              </div>
                            </div>
                            {selectedTenantId === tenant.id && (
                              <Check size={16} className="text-primary flex-shrink-0 ml-2" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          {tenantSearchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {userProfile && (
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {isLoadingUser ? 'Carregando...' : userProfile.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isLoadingUser ? '' : userProfile.role === 'ADMIN' ? 'Administrador' : 'Parceiro'}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border-2 border-white shadow-sm">
                  {isLoadingUser ? '...' : (userProfile.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            <AnimatePresence mode="wait">
                <motion.div
                    key={location.pathname}
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;