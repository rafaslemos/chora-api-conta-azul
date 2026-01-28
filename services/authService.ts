/**
 * Serviço de autenticação com Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from './logger';

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
 * Obtém a URL da aplicação para uso em emails de autenticação
 * Prioriza VITE_APP_URL (produção), fallback para window.location.origin
 */
const getAppUrl = (): string => {
  const prodUrl = import.meta.env.VITE_APP_URL;
  if (prodUrl && prodUrl.trim()) {
    return prodUrl.trim();
  }
  return window.location.origin;
};

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
        emailRedirectTo: `${getAppUrl()}/auth/confirm`,
      },
    });

    if (authError) {
      logger.warn('Erro ao criar conta no Supabase Auth', { error: authError, email: data.email });
      
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

    const hasSession = !!authData.session;

    if (!hasSession) {
      // Confirmação de email ativa: sem sessão. Não fazer polling nem RPC.
      return {
        user: authData.user,
        profile: {
          id: authData.user.id,
          full_name: data.fullName,
          cnpj: data.cnpj,
          phone: data.phone,
          company_name: data.companyName,
          role: 'PARTNER',
        },
      };
    }

    // Com sessão: aguardar perfil, eventual RPC e fetch final
    const waitForProfile = async (
      maxAttempts: number = 5,
      delayMs: number = 200
    ): Promise<{ exists: boolean; noSession?: boolean }> => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (!error && data) return { exists: true };

        const status = (error as { status?: number } | null)?.status;
        const msg = typeof (error as { message?: string } | null)?.message === 'string'
          ? (error as { message: string }).message
          : '';
        const is401 = status === 401 || /401|Unauthorized/i.test(msg);
        if (is401) return { exists: false, noSession: true };

        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      return { exists: false };
    };

    const { exists: profileExists, noSession } = await waitForProfile(5, 200);

    if (!profileExists && !noSession) {
      logger.warn('Perfil não foi criado pelo trigger após signup. Tentando criar manualmente...', { userId: authData.user.id });
    }

    const isRpcRetriable = (err: { code?: string; status?: number; message?: string } | null) => {
      if (!err) return false;
      if (err.code === '23503' || err.code === '23505') return false;
      if (err.status === 409) return false;
      const m = typeof err.message === 'string' ? err.message : '';
      if (/409|23503|23505|conflict|foreign key|duplicate/i.test(m)) return false;
      return true;
    };

    if (!profileExists && !noSession) {
      const { error: rpcError } = await supabase.rpc('create_or_update_profile', {
        p_user_id: authData.user.id,
        p_full_name: data.fullName,
        p_cnpj: data.cnpj || null,
        p_phone: data.phone || null,
        p_company_name: data.companyName || null,
        p_role: 'PARTNER',
      });

      if (rpcError) {
        const skipLog = !isRpcRetriable(rpcError);
        if (!skipLog) {
          logger.error('Erro ao criar/atualizar perfil via RPC', rpcError, { userId: authData.user.id });
        }
        let retrySuccess = false;
        if (isRpcRetriable(rpcError)) {
          for (let retry = 0; retry < 3; retry++) {
            await new Promise(resolve => setTimeout(resolve, 300));
            const { error: retryRpcError } = await supabase.rpc('create_or_update_profile', {
              p_user_id: authData.user.id,
              p_full_name: data.fullName,
              p_cnpj: data.cnpj || null,
              p_phone: data.phone || null,
              p_company_name: data.companyName || null,
              p_role: 'PARTNER',
            });
            if (!retryRpcError) {
              retrySuccess = true;
              logger.info('Perfil criado/atualizado com sucesso após retry', { userId: authData.user.id, attempt: retry + 1 });
              break;
            }
            if (!isRpcRetriable(retryRpcError)) break;
          }
        }
        if (!retrySuccess && !skipLog) {
          logger.error('Erro ao criar/atualizar perfil via RPC após múltiplas tentativas', undefined, { userId: authData.user.id });
        }
      }
    }

    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    const profileFetch401 = (profileFetchError as { status?: number } | null)?.status === 401;
    const profileFetchPermissionDenied =
      profileFetchError?.code === '42501' ||
      (typeof profileFetchError?.message === 'string' && profileFetchError.message.toLowerCase().includes('permission denied'));
    if (
      profileFetchError &&
      profileFetchError.code !== 'PGRST116' &&
      !profileFetch401 &&
      !profileFetchPermissionDenied
    ) {
      logger.error('Erro ao buscar perfil', profileFetchError, { userId: authData.user.id });
    }

    return {
      user: authData.user,
      profile: profile
        ? {
            id: profile.id,
            full_name: profile.full_name,
            cnpj: profile.cnpj,
            phone: profile.phone,
            company_name: profile.company_name,
            role: profile.role as 'PARTNER' | 'ADMIN',
          }
        : {
            id: authData.user.id,
            full_name: data.fullName,
            cnpj: data.cnpj,
            phone: data.phone,
            company_name: data.companyName,
            role: 'PARTNER',
          },
    };
  } catch (error) {
    logger.error('Erro ao criar conta', error);
    throw error;
  }
};

/**
 * Faz login do usuário.
 * Se o perfil não existir (ex.: deletado), cria via create_or_update_profile.
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

  const user = data?.user;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.rpc('create_or_update_profile', {
        p_user_id: user.id,
        p_full_name: (user.user_metadata?.full_name as string) || user.email || '',
        p_cnpj: null,
        p_phone: null,
        p_company_name: null,
        p_role: 'PARTNER',
      });
    }
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

  // O Supabase redirecionará para: https://chora-api-conta-azul.vercel.app/auth/reset-password?token=xxx&type=recovery
  // A página ResetPasswordRedirect.tsx redireciona para /#/auth/reset-password (HashRouter)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/reset-password`,
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

