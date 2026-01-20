/**
 * Serviço para gerenciar usuários (profiles)
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'contador' | 'operador';
  status: 'active' | 'pending' | 'inactive';
  invitedAt?: string;
  lastAccess?: string;
}

export const userService = {
  /**
   * Lista todos os usuários (profiles)
   * Respeita RLS: apenas ADMIN pode ver todos, outros veem apenas o próprio perfil
   */
  async list(): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Se não estiver autenticado, retorna array vazio
        return [];
      }

      // Verificar se é ADMIN usando a função RPC
      const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin', { user_id: user.id });
      
      // Se houver erro ao verificar admin, assume que não é admin
      const userIsAdmin = isAdmin === true;

      let query = supabase
        .from('profiles')
        .select('*');

      // Se não for ADMIN, só pode ver o próprio perfil
      if (!userIsAdmin) {
        query = query.eq('id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar usuários:', error);
        // Se for erro de permissão, retorna array vazio em vez de lançar erro
        if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
          console.warn('Usuário não tem permissão para listar todos os perfis');
          return [];
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Buscar emails dos usuários (precisa fazer join com auth.users via RPC ou função)
      // Por enquanto, vamos tentar buscar o email do usuário atual
      const userEmails: Record<string, string> = {};
      
      // Para cada perfil, tentar buscar o email
      for (const profile of data) {
        if (profile.id === user.id) {
          userEmails[profile.id] = user.email || '';
        }
      }

      // Mapear dados do banco para interface User
      return data.map((profile: any) => ({
        id: profile.id,
        name: profile.full_name || '',
        email: userEmails[profile.id] || '', // Email do usuário atual ou vazio
        role: profile.role === 'ADMIN' ? 'admin' : profile.role === 'PARTNER' ? 'operador' : 'operador',
        status: 'active' as const, // Por enquanto, todos são active
        lastAccess: profile.updated_at,
      }));
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      // Se for erro de permissão, retorna array vazio
      if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
        console.warn('Usuário não tem permissão para listar perfis');
        return [];
      }
      throw error;
    }
  },

  /**
   * Busca usuário por ID
   */
  async getById(id: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar usuário:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        name: data.full_name || '',
        email: '',
        role: data.role === 'ADMIN' ? 'admin' : 'operador',
        status: 'active' as const,
        lastAccess: data.updated_at,
      };
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      throw error;
    }
  },

  /**
   * Atualiza um usuário
   */
  async update(id: string, updates: Partial<User>): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    try {
      const updateData: any = {};
      
      if (updates.name) {
        updateData.full_name = updates.name;
      }
      
      // Role precisa ser mapeado de volta para o formato do banco
      if (updates.role) {
        updateData.role = updates.role === 'admin' ? 'ADMIN' : 'PARTNER';
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar usuário:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.full_name || '',
        email: '',
        role: data.role === 'ADMIN' ? 'admin' : 'operador',
        status: updates.status || 'active',
        lastAccess: data.updated_at,
      };
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  },
};

