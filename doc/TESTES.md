# Guia de Testes

Este documento explica como usar e escrever testes no projeto.

## Setup

O projeto usa **Vitest** como framework de testes, configurado em `vitest.config.ts`.

### Instalação

As dependências já estão configuradas no `package.json`. Para instalar:

```bash
npm install
```

### Estrutura de Testes

```
src/
├── test/
│   ├── setup.ts              # Configuração global de testes
│   └── mocks/
│       └── supabase.ts       # Mocks do Supabase
├── services/
│   ├── authService.ts
│   └── authService.test.ts   # Testes do serviço
└── components/
    ├── ui/
    │   ├── Button.tsx
    │   └── Button.test.tsx   # Testes do componente
```

## Executando Testes

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

## Escrevendo Testes

### Teste de Service

Exemplo: `services/authService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUp } from './authService';
import { supabase } from '../lib/supabase';

// Mock do Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
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

  it('deve criar usuário e perfil com sucesso', async () => {
    // Configurar mocks
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Executar função
    const result = await signUp({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
      cnpj: '12345678901234',
      companyName: 'Test Company',
    });

    // Verificar resultado
    expect(result.user.id).toBe('user-123');
    expect(supabase.auth.signUp).toHaveBeenCalled();
  });
});
```

### Teste de Componente

Exemplo: `components/ui/Button.test.tsx`

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
});
```

## Mocks Disponíveis

### Mock do Supabase

O mock do Supabase está em `src/test/mocks/supabase.ts` e pode ser usado assim:

```typescript
import { mockSupabaseClient, mockIsSupabaseConfigured } from '../test/mocks/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabaseClient,
  isSupabaseConfigured: mockIsSupabaseConfigured,
}));
```

## Boas Práticas

1. **Testar comportamento, não implementação**: Teste o que o usuário vê/faz
2. **Isolar testes**: Cada teste deve ser independente
3. **Usar mocks**: Mockar dependências externas (Supabase, APIs)
4. **Testar casos de erro**: Não apenas casos de sucesso
5. **Manter testes simples**: Um teste deve verificar uma coisa
6. **Usar nomes descritivos**: `it('deve fazer login quando email e senha são válidos')`

## Cobertura Alvo

- **Services**: 80%+ de cobertura
- **Components**: 70%+ de cobertura
- **Pages**: 60%+ de cobertura

## Próximos Passos

1. Adicionar mais testes para outros services
2. Adicionar testes para páginas críticas (Login, Register, Credentials)
3. Adicionar testes de integração para fluxos completos
4. Configurar CI/CD para executar testes automaticamente
