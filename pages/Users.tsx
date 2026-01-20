import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Mail, 
  User, 
  Shield, 
  UserCheck, 
  UserX, 
  Edit2, 
  Trash2,
  XCircle,
  CheckCircle2,
  Search,
  Filter,
  MoreVertical
} from 'lucide-react';
import Button from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { userService, User as UserType } from '../services/userService';

type UserRole = 'admin' | 'operador' | 'contador';
type UserStatus = 'active' | 'pending' | 'inactive';

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');

  // Invite user form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'operador' as UserRole,
    name: ''
  });

  // Edit user form
  const [editForm, setEditForm] = useState({
    role: 'operador' as UserRole,
    status: 'active' as UserStatus
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.list();
      setUsers(data);
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
      setError(err.message || 'Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar convite real via Supabase Auth
    alert('Funcionalidade de convite será implementada em breve');
    setInviteForm({ email: '', role: 'operador', name: '' });
    setIsModalOpen(false);
  };

  const handleEditUser = (user: UserType) => {
    setSelectedUser(user);
    setEditForm({ role: user.role, status: user.status });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    try {
      await userService.update(selectedUser.id, {
        role: editForm.role,
        status: editForm.status,
      });
      await loadUsers();
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Erro ao atualizar usuário:', err);
      alert('Erro ao atualizar usuário: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja revogar o acesso deste usuário?')) {
      return;
    }

    try {
      await userService.update(userId, { status: 'inactive' });
      await loadUsers();
    } catch (err: any) {
      console.error('Erro ao revogar acesso:', err);
      alert('Erro ao revogar acesso: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700 border-purple-200',
      contador: 'bg-blue-100 text-blue-700 border-blue-200',
      operador: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    const labels = {
      admin: 'Admin',
      contador: 'Contador',
      operador: 'Operador'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  const getStatusBadge = (status: UserStatus) => {
    const styles = {
      active: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      inactive: 'bg-red-100 text-red-700 border-red-200'
    };
    const labels = {
      active: 'Ativo',
      pending: 'Pendente',
      inactive: 'Inativo'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários & Permissões</h1>
            <p className="text-gray-500">Gerencie usuários e suas permissões de acesso</p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários & Permissões</h1>
            <p className="text-gray-500">Gerencie usuários e suas permissões de acesso</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários & Permissões</h1>
          <p className="text-gray-500">Gerencie usuários e suas permissões de acesso</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={18} className="mr-2" />
          Convidar Usuário
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          >
            <option value="all">Todos os Roles</option>
            <option value="admin">Admin</option>
            <option value="contador">Contador</option>
            <option value="operador">Operador</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo</option>
            <option value="pending">Pendente</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Acesso
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 mr-3">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.status === 'pending' && user.invitedAt
                        ? `Convite em ${new Date(user.invitedAt).toLocaleDateString('pt-BR')}`
                        : user.lastAccess
                        ? new Date(user.lastAccess).toLocaleString('pt-BR')
                        : 'Nunca'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleRevokeAccess(user.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Revogar Acesso"
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <User size={48} className="text-gray-300 mb-4" />
                      <p className="text-lg font-medium text-gray-600">Nenhum usuário encontrado</p>
                      <p className="text-sm text-gray-400">Tente ajustar os filtros ou convide um novo usuário.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Convidar Usuário */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-2">
                  <Mail size={20} className="text-primary" />
                  <h3 className="text-lg font-bold text-gray-900">Convidar Usuário</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleInviteUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="João Silva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="usuario@empresa.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({...inviteForm, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="operador">Operador - Acesso básico para operações</option>
                    <option value="contador">Contador - Acesso para gestão financeira</option>
                    <option value="admin">Admin - Acesso completo ao sistema</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    O usuário receberá um e-mail com o link de ativação da conta.
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    <Mail size={16} className="mr-2" />
                    Enviar Convite
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Editar Usuário */}
      <AnimatePresence>
        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
              onClick={() => setIsEditModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-2">
                  <Edit2 size={20} className="text-primary" />
                  <h3 className="text-lg font-bold text-gray-900">Editar Usuário</h3>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Usuário</p>
                  <p className="text-sm text-gray-900">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="operador">Operador</option>
                    <option value="contador">Contador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value as UserStatus})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="active">Ativo</option>
                    <option value="pending">Pendente</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} className="flex-1">
                    <CheckCircle2 size={16} className="mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;

