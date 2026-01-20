/**
 * Serviço de autenticação com Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  cnpj: string;
  phone?: string;
  companyName: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  cnpj: string;
  phone?: string;
  company_name: string;
  role: 'PARTNER' | 'ADMIN';
}

/**
 * Cria uma nova conta de usuário
 */
export const signUp = async (data: SignUpData): Promise<{ user: any; profile: UserProfile }> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
  }

  try {
    // Criar conta no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
      },
    });

    if (authError) {
      // Tratar erros específicos do Supabase
      if (authError.status === 429) {
        throw new Error('Muitas tentativas. Por favor, aguarde alguns segundos antes de tentar novamente.');
      }
      
      if (authError.message.includes('rate limit') || authError.message.includes('after')) {
        const match = authError.message.match(/after (\d+) seconds?/i);
        const seconds = match ? match[1] : 'alguns';
        throw new Error(`Por segurança, aguarde ${seconds} segundos antes de tentar novamente.`);
      }
      
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        throw new Error('Este email já está cadastrado. Tente fazer login ou recuperar sua senha.');
      }
      
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Erro ao criar usuário. Tente novamente.');
    }

    // O perfil será criado automaticamente pelo trigger handle_new_user()
    // Mas precisamos atualizar com os dados adicionais (CNPJ, telefone, etc.)
    // Aguardar um pouco para garantir que o trigger executou
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Usar função RPC que bypassa RLS para criar/atualizar perfil
    // Isso é necessário porque após signup, a sessão pode não estar totalmente estabelecida
    const { data: profileId, error: rpcError } = await supabase.rpc('create_or_update_profile', {
      p_user_id: authData.user.id,
      p_full_name: data.fullName,
      p_cnpj: data.cnpj || null,
      p_phone: data.phone || null,
      p_company_name: data.companyName || null,
      p_role: 'PARTNER',
    });

    if (rpcError) {
      console.error('Erro ao criar/atualizar perfil via RPC:', rpcError);
      // Se falhar, tentar novamente após mais tempo (pode ser problema de timing)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: retryProfileId, error: retryRpcError } = await supabase.rpc('create_or_update_profile', {
        p_user_id: authData.user.id,
        p_full_name: data.fullName,
        p_cnpj: data.cnpj || null,
        p_phone: data.phone || null,
        p_company_name: data.companyName || null,
        p_role: 'PARTNER',
      });
      
      if (retryRpcError) {
        console.error('Erro ao criar/atualizar perfil via RPC (tentativa 2):', retryRpcError);
        // Não lançar erro aqui - o perfil pode ter sido criado pelo trigger
        // O usuário ainda pode usar a aplicação, apenas sem os dados adicionais
      }
    }

    // Buscar perfil (usar maybeSingle para não falhar se não existir)
    // Aguardar um pouco mais para garantir que o perfil foi criado/atualizado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileFetchError && profileFetchError.code !== 'PGRST116') {
      console.error('Erro ao buscar perfil:', profileFetchError);
    }

    // Retornar dados do usuário e perfil
    // Se o perfil não foi encontrado, retornar dados do formulário
    // O perfil será criado/atualizado posteriormente ou pelo trigger
    return {
      user: authData.user,
      profile: profile ? {
        id: profile.id,
        full_name: profile.full_name,
        cnpj: profile.cnpj,
        phone: profile.phone,
        company_name: profile.company_name,
        role: profile.role as 'PARTNER' | 'ADMIN',
      } : {
        // Se o perfil não foi encontrado, retornar dados do formulário
        // Isso não é um erro fatal - o usuário foi criado com sucesso
        id: authData.user.id,
        full_name: data.fullName,
        cnpj: data.cnpj,
        phone: data.phone,
        company_name: data.companyName,
        role: 'PARTNER',
      },
    };
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    throw error;
  }
};

/**
 * Faz login do usuário
 */
export const signIn = async (email: string, password: string) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Faz logout do usuário
 */
export const signOut = async () => {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
};

/**
 * Verifica se um email existe no sistema usando função RPC
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('check_email_exists', {
      p_email: email.toLowerCase().trim(),
    });

    if (error) {
      console.error('Erro ao verificar email:', error);
      // Se a função não existir ainda, retornar true para não bloquear o fluxo
      // O usuário receberá o email mesmo se não existir (comportamento padrão do Supabase)
      if (error.code === '42883' || error.message.includes('does not exist')) {
        console.warn('Função check_email_exists não encontrada. Execute o script sql/check_email_exists.sql no Supabase.');
        return true; // Permite continuar o fluxo
      }
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Erro ao verificar email:', error);
    // Em caso de erro, permitir continuar (comportamento padrão do Supabase)
    return true;
  }
};

/**
 * Solicita reset de senha
 * Valida se o email existe antes de enviar
 */
export const resetPassword = async (email: string) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
  }

  // Validar se o email existe antes de enviar
  const emailExists = await checkEmailExists(email);
  
  if (!emailExists) {
    throw new Error('Email não encontrado. Verifique o endereço digitado ou cadastre-se.');
  }

  // Usar HashRouter - a URL deve incluir o hash (#)
  // O Supabase redirecionará para: http://localhost:3000/#/auth/reset-password?token=xxx&type=recovery
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#/auth/reset-password`,
  });

  if (error) {
    throw error;
  }
};

/**
 * Obtém o usuário atual
 */
export const getCurrentUser = async () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Obtém o perfil do usuário atual
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    full_name: data.full_name,
    cnpj: data.cnpj,
    phone: data.phone,
    company_name: data.company_name,
    role: data.role as 'PARTNER' | 'ADMIN',
  };
};

