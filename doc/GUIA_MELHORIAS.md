# Guia de Melhorias do Projeto

Este documento explica como implementar as melhorias pendentes identificadas na avaliação do projeto.

## 1. Como Corrigir Memory Leaks em Componentes React

### Problema

Vários componentes usam `setTimeout` sem armazenar a referência e limpar no cleanup do `useEffect`, causando memory leaks e atualizações de estado após unmount.

### Solução

Seguir o padrão já implementado em `pages/ContaAzulCallback.tsx`:

#### Padrão a Seguir:

```typescript
import React, { useEffect, useState, useRef } from 'react';

const MeuComponente: React.FC = () => {
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

    // Helper para criar timeout com cleanup automático
    const createTimeout = (callback: () => void, delay: number) => {
        const timeoutId = setTimeout(() => {
            callback();
            // Remover da lista após execução
            timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
        }, delay);
        timeoutRefs.current.push(timeoutId);
        return timeoutId;
    };

    useEffect(() => {
        // Usar createTimeout ao invés de setTimeout direto
        createTimeout(() => {
            setStatus('success');
        }, 2000);

        // Cleanup: limpar todos os timeouts ao desmontar
        return () => {
            timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
            timeoutRefs.current = [];
        };
    }, []);

    return <div>...</div>;
};
```

### Arquivos que Precisam de Correção

1. **`pages/Credentials.tsx`** - Linhas 328, 337, 416
2. **`pages/Integrations.tsx`** - Linhas 154, 211, 215, 223
3. **`pages/Settings.tsx`** - Linhas 89, 92
4. **`pages/Login.tsx`** - Linha 66
5. **`pages/Analytics.tsx`** - Linha 38
6. **`pages/ResetPassword.tsx`** - Linha 97
7. **`pages/Register.tsx`** - Linhas 174, 208
8. **`pages/OnboardingWizard.tsx`** - Linhas 75, 85, 94

### Passos para Corrigir Cada Arquivo

1. Importar `useRef` do React
2. Criar `timeoutRefs` usando `useRef<NodeJS.Timeout[]>([])`
3. Criar função helper `createTimeout` (copiar do exemplo acima)
4. Substituir todos os `setTimeout` por `createTimeout`
5. Adicionar cleanup no `useEffect` que limpa todos os timeouts

### Exemplo Prático

**Antes:**
```typescript
useEffect(() => {
    setTimeout(() => {
        setSuccessMessage(null);
    }, 3000);
}, []);
```

**Depois:**
```typescript
const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

const createTimeout = (callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
        callback();
        timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    }, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
};

useEffect(() => {
    createTimeout(() => {
        setSuccessMessage(null);
    }, 3000);

    return () => {
        timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
        timeoutRefs.current = [];
    };
}, []);
```

---

## 2. Como Implementar Testes no Projeto

### Setup Inicial

#### 1. Instalar Dependências de Teste

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
```

#### 2. Configurar Vitest

Criar arquivo `vitest.config.ts` na raiz do projeto:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

#### 3. Criar Setup de Testes

Criar arquivo `src/test/setup.ts`:

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Estender expect com matchers do jest-dom
expect.extend(matchers);

// Limpar após cada teste
afterEach(() => {
  cleanup();
});
```

#### 4. Atualizar `package.json`

Adicionar scripts de teste:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### Estrutura de Testes

Organizar testes seguindo a estrutura do projeto:

```
src/
├── services/
│   ├── authService.ts
│   └── authService.test.ts
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
├── pages/
│   ├── Login.tsx
│   └── Login.test.tsx
└── test/
    ├── setup.ts
    └── mocks/
        └── supabase.ts
```

### Exemplos de Testes

#### Teste de Service (`services/authService.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUp, signIn } from './authService';
import { supabase } from '../lib/supabase';

// Mock do Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
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
  isSupabaseConfigured: () => true,
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
    });

    it('deve tratar erro de email já cadastrado', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null },
        error: { message: 'already registered', status: 400 },
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
  });
});
```

#### Teste de Componente (`components/Button.test.tsx`)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('deve renderizar texto corretamente', () => {
    render(<Button>Clique aqui</Button>);
    expect(screen.getByText('Clique aqui')).toBeInTheDocument();
  });

  it('deve chamar onClick quando clicado', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Clique</Button>);
    
    await user.click(screen.getByText('Clique'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('deve estar desabilitado quando disabled=true', () => {
    render(<Button disabled>Desabilitado</Button>);
    expect(screen.getByText('Desabilitado')).toBeDisabled();
  });
});
```

#### Teste de Página (`pages/Login.test.tsx`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { signIn } from '../services/authService';

vi.mock('../services/authService');

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar formulário de login', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('deve fazer login com sucesso', async () => {
    const user = userEvent.setup();
    vi.mocked(signIn).mockResolvedValue({} as any);

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });
});
```

### Mock do Supabase

Criar `src/test/mocks/supabase.ts`:

```typescript
import { vi } from 'vitest';

export const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    resetPasswordForEmail: vi.fn(),
  },
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        single: vi.fn(),
      })),
      order: vi.fn(() => ({
        limit: vi.fn(),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
};

export const mockIsSupabaseConfigured = vi.fn(() => true);
```

### Executar Testes

```bash
# Executar todos os testes
npm test

# Executar em modo watch (re-executa ao salvar arquivos)
npm run test:watch

# Executar com UI interativa
npm run test:ui

# Gerar relatório de cobertura
npm run test:coverage
```

### Boas Práticas

1. **Testar comportamento, não implementação**: Teste o que o usuário vê/faz, não detalhes internos
2. **Isolar testes**: Cada teste deve ser independente
3. **Usar mocks**: Mockar dependências externas (Supabase, APIs)
4. **Testar casos de erro**: Não apenas casos de sucesso
5. **Manter testes simples**: Um teste deve verificar uma coisa
6. **Usar nomes descritivos**: `it('deve fazer login quando email e senha são válidos')`

### Cobertura Alvo

- **Services**: 80%+ de cobertura
- **Components**: 70%+ de cobertura
- **Pages**: 60%+ de cobertura

---

## 3. Sistema de Logging Centralizado

### Status

✅ **IMPLEMENTADO** - Ver `services/logger.ts`

### Como Usar

```typescript
import { logger, logError, logInfo, logWarn, logDebug } from '../services/logger';

// Em services
logger.info('Usuário criado com sucesso', { userId: user.id });
logger.error('Erro ao criar usuário', error, { email: user.email });

// Ou usar funções de conveniência
logInfo('Operação concluída', { operationId: '123' });
logError('Falha na operação', error);
```

### Migração de console.log/error

Substituir gradualmente:

**Antes:**
```typescript
console.log('Usuário criado:', user);
console.error('Erro:', error);
```

**Depois:**
```typescript
logger.info('Usuário criado', { userId: user.id, email: user.email });
logger.error('Erro ao criar usuário', error, { email: user.email });
```

### Próximos Passos

1. Migrar todos os `console.log/error` para usar o logger
2. Integrar com Sentry para produção (ver TODO no código)
3. Adicionar filtros de log por nível em produção

---

## Resumo de Prioridades

1. ✅ **Corrigir race condition no signUp** - FEITO
2. ✅ **Criar sistema de logging** - FEITO
3. ⏳ **Corrigir memory leaks** - Ver seção 1 acima
4. ⏳ **Implementar testes** - Ver seção 2 acima
