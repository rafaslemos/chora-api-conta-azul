# Guia Completo: URLs de Redirecionamento no Supabase

## 📍 Como Funcionam as URLs de Redirecionamento

### 1. Site URL (URL Base)

A **Site URL** é a URL principal da sua aplicação. O Supabase usa isso como padrão quando nenhuma URL específica é fornecida.

**Configuração:**
- **Desenvolvimento**: `http://localhost:3000` (ou `http://localhost:5173` se usar Vite)
- **Produção**: `https://chora-api-conta-azul.vercel.app` (ou seu domínio no Vercel)

O app usa `emailRedirectTo` no cadastro com a URL de produção configurada em `VITE_APP_URL`. Isso garante que os emails sempre apontem para produção, independente do ambiente onde o cadastro foi feito.

**Importante**: Configure a variável `VITE_APP_URL` no `.env.local` (desenvolvimento) e nas variáveis de ambiente do Vercel (produção) com a URL de produção: `https://chora-api-conta-azul.vercel.app`

**Onde configurar:**
1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Campo: **Site URL**

### 2. Redirect URLs (URLs Permitidas)

As **Redirect URLs** são URLs específicas que o Supabase pode usar para redirecionar após ações de autenticação. Por segurança, você deve adicionar explicitamente todas as URLs que serão usadas.

**Onde configurar:**
1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Seção: **Redirect URLs**
3. Adicione cada URL uma por uma

**URLs Necessárias:**

O projeto usa **HashRouter**, mas o Supabase não preserva hash no `redirect_to` dos emails. Por isso, criamos páginas intermediárias que redirecionam automaticamente.

**Configure no Supabase (sem hash):**

```
https://chora-api-conta-azul.vercel.app/auth/confirm
https://chora-api-conta-azul.vercel.app/auth/reset-password
```

**Para desenvolvimento local (opcional, apenas para testes):**

```
http://localhost:3000/auth/confirm
http://localhost:3000/auth/reset-password
```

**Como funciona:**

1. Supabase redireciona para `/auth/confirm?token=xxx` (sem hash)
2. A página `AuthConfirmRedirect.tsx` detecta e redireciona para `/#/auth/confirm?token=xxx` (com hash)
3. O HashRouter processa a rota normalmente

(Substitua `chora-api-conta-azul.vercel.app` pelo seu domínio se for diferente.)

## 🔄 Fluxo Completo de Redirecionamento

### Cenário 1: Confirmação de Email (Signup)

```
1. Usuário se cadastra
   ↓
2. Supabase envia email de confirmação
   ↓
3. Usuário clica no link do email
   ↓
4. Supabase redireciona para:
   http://localhost:3000/auth/confirm?token=xxx&type=signup
   ↓
5. Sua página /auth/confirm processa o token
   ↓
6. Email é confirmado
   ↓
7. Redireciona para /login com mensagem de sucesso
```

### Cenário 2: Reset de Senha

```
1. Usuário solicita reset de senha
   ↓
2. Supabase envia email com link
   ↓
3. Usuário clica no link
   ↓
4. Supabase redireciona para:
   http://localhost:3000/auth/reset-password?token=xxx&type=recovery
   ↓
5. Sua página /auth/reset-password processa o token
   ↓
6. Usuário define nova senha
   ↓
7. Redireciona para /login
```

### Cenário 3: Mudança de Email

```
1. Usuário solicita mudança de email
   ↓
2. Supabase envia email para novo endereço
   ↓
3. Usuário clica no link
   ↓
4. Supabase redireciona para:
   http://localhost:3000/auth/change-email?token=xxx&type=email_change
   ↓
5. Sua página /auth/change-email processa o token
   ↓
6. Email é atualizado
   ↓
7. Redireciona para dashboard
```

## 🛠️ Implementação no Frontend

### Estrutura de Rotas Necessária

Você precisa criar as seguintes rotas no seu `App.tsx`:

```typescript
<Route path="/auth/confirm" element={<ConfirmEmail />} />
<Route path="/auth/reset-password" element={<ResetPassword />} />
<Route path="/auth/change-email" element={<ChangeEmail />} />
```

### Como Processar os Tokens

O Supabase adiciona automaticamente os seguintes parâmetros na URL:

- `token`: Token de confirmação
- `type`: Tipo de ação (`signup`, `recovery`, `email_change`)

**Exemplo de processamento:**

```typescript
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ConfirmEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    
    if (token && type === 'signup') {
      // Confirmar email
      supabase.auth.verifyOtp({
        token_hash: token,
        type: 'signup'
      }).then(({ error }) => {
        if (error) {
          // Mostrar erro
        } else {
          // Sucesso - redirecionar para login
          navigate('/login?confirmed=true');
        }
      });
    }
  }, [searchParams, navigate]);
  
  return <div>Processando confirmação...</div>;
};
```

## ⚙️ Configuração Passo a Passo

### Passo 1: Configurar Site URL

1. Acesse: **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Em **Site URL**, use a URL do app:
   - Desenvolvimento: `http://localhost:3000` ou `http://localhost:5173`
   - Produção: `https://chora-api-conta-azul.vercel.app` (ou seu domínio)
3. Clique em **Save**

### Passo 2: Adicionar Redirect URLs

1. Na mesma página, role até **Redirect URLs**
2. Clique em **Add URL**
3. Adicione cada URL (o app usa **HashRouter**; em produção use as URLs com `#/...`):
   ```
   http://localhost:3000/#/auth/confirm
   http://localhost:3000/#/auth/reset-password
   https://chora-api-conta-azul.vercel.app
   https://chora-api-conta-azul.vercel.app/#/auth/confirm
   https://chora-api-conta-azul.vercel.app/#/auth/reset-password
   ```
4. Para cada URL, clique em **Add**
5. Clique em **Save**

### Passo 3: Habilitar Email Confirmation

1. Vá em **Authentication** → **Settings**
2. Em **Email Auth**, ative:
   - ✅ **Enable email confirmations**
3. Clique em **Save**

### Passo 4: Testar

1. Crie um usuário de teste
2. Verifique se o email foi recebido
3. Clique no link do email
4. Verifique se foi redirecionado para a URL correta
5. Confirme se o token foi processado

## 🔒 Segurança

### Por que precisamos adicionar Redirect URLs?

Por segurança, o Supabase só redireciona para URLs que você explicitamente permitiu. Isso previne:
- Ataques de redirecionamento malicioso
- Phishing
- Vazamento de tokens

### Boas Práticas

1. **Nunca exponha tokens na URL em produção** (use hash quando possível)
2. **Use HTTPS em produção**
3. **Valide sempre os tokens no backend**
4. **Expire tokens rapidamente** (já configurado no Supabase)
5. **Monitore tentativas de acesso com tokens inválidos**

## 🐛 Troubleshooting

### Problema: "Invalid redirect URL"

**Causa:** A URL não está na lista de Redirect URLs permitidas.

**Solução:**
1. Verifique se a URL está exatamente como configurada (incluindo http/https, porta, etc.)
2. Adicione a URL em **Authentication** → **URL Configuration** → **Redirect URLs**

### Problema: Redirecionamento não funciona

**Causa:** Pode ser problema com HashRouter vs BrowserRouter.

**Solução:**
- Se usar `HashRouter`, a URL será: `http://localhost:3000/#/auth/confirm`
- Se usar `BrowserRouter`, a URL será: `http://localhost:3000/auth/confirm`
- Configure as Redirect URLs de acordo com o tipo de router usado

### Problema: Token expirado

**Causa:** Tokens têm tempo de expiração (24h para signup, 1h para recovery).

**Solução:**
- Informe o usuário que o link expirou
- Ofereça opção de reenviar o email

## 📝 Checklist de Configuração

- [ ] Site URL configurada (desenvolvimento e produção)
- [ ] Redirect URLs adicionadas:
  - [ ] `/auth/confirm`
  - [ ] `/auth/reset-password`
  - [ ] `/auth/change-email`
- [ ] Email confirmation habilitado
- [ ] Templates de email configurados
- [ ] Rotas criadas no frontend
- [ ] Páginas de processamento criadas
- [ ] Testado em desenvolvimento
- [ ] Configurado para produção

## 📚 Recursos Adicionais

- [Documentação Supabase Auth](https://supabase.com/docs/guides/auth)
- [Configuração de URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

