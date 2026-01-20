import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUp, signIn, resetPassword } from './authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Mock do Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
  isSupabaseConfigured: vi.fn(() => true),
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('deve criar usuário e perfil com sucesso', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = {
        id: 'user-123',
        full_name: 'Test User',
        role: 'PARTNER',
        cnpj: '12345678901234',
        phone: null,
        company_name: 'Test Company',
      };

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'user-123',
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          })),
        })),
      } as any);

      const result = await signUp({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        cnpj: '12345678901234',
        companyName: 'Test Company',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.profile.full_name).toBe('Test User');
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'Test User',
          },
        },
      });
    });

    it('deve tratar erro de email já cadastrado', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null },
        error: { message: 'already registered', status: 400 } as any,
      });

      await expect(
        signUp({
          email: 'existing@example.com',
          password: 'password123',
          fullName: 'Test User',
          cnpj: '12345678901234',
          companyName: 'Test Company',
        })
      ).rejects.toThrow('Este email já está cadastrado');
    });

    it('deve tratar erro de rate limit', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null },
        error: { message: 'rate limit after 60 seconds', status: 429 } as any,
      });

      await expect(
        signUp({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
          cnpj: '12345678901234',
          companyName: 'Test Company',
        })
      ).rejects.toThrow('Por segurança, aguarde 60 segundos');
    });
  });

  describe('signIn', () => {
    it('deve fazer login com sucesso', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123',
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: mockSession,
        error: null,
      });

      const result = await signIn('test@example.com', 'password123');

      expect(result).toEqual(mockSession);
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('deve lançar erro quando credenciais são inválidas', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 } as any,
      });

      await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('deve solicitar reset de senha com sucesso', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      });

      await resetPassword('test@example.com');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password'),
        })
      );
    });

    it('deve lançar erro quando email não existe', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: { message: 'Email not found', status: 404 } as any,
      });

      await expect(resetPassword('nonexistent@example.com')).rejects.toThrow();
    });
  });
});
