# Templates de Email - Supabase Auth

> **Nota**: Para informações sobre padrão de envio, configuração de SMTP e remetente personalizado, consulte [`doc/PADRAO_ENVIO_EMAILS.md`](PADRAO_ENVIO_EMAILS.md).

## Visão Geral

Este documento contém os templates HTML e texto simples para todos os tipos de e-mail de autenticação enviados pela Plataforma Conector. Os templates seguem um padrão visual consistente e profissional.

**Importante**: O projeto usa **HashRouter**, então todas as URLs de redirecionamento devem incluir o hash `#/` (ex: `/#/auth/confirm`).

Para informações sobre configuração de URLs de redirecionamento, consulte [`doc/GUIA_URLS_REDIRECIONAMENTO.md`](GUIA_URLS_REDIRECIONAMENTO.md).

## Templates de Email

Os templates abaixo são formais e profissionais, prontos para copiar e colar no Supabase Dashboard.

---

## 1. Confirmação de Email (Signup)

### Documentação

**Quando é enviado:**
- Quando um novo usuário se cadastra na plataforma através de `signUp()` em [`services/authService.ts`](services/authService.ts)
- Apenas se "Enable email confirmations" estiver habilitado no Supabase

**Finalidade:**
- Confirmar que o endereço de e-mail fornecido é válido e pertence ao usuário
- Ativar a conta do usuário após confirmação

**Variáveis disponíveis:**
- `{{ .ConfirmationURL }}` - URL completa de confirmação com token (ex: `https://app.com/#/auth/confirm?token=xxx&type=signup`)
- `{{ .Email }}` - E-mail do usuário que se cadastrou
- `{{ .SiteURL }}` - URL base do site configurada

**Link esperado:**
Após clicar no link, o usuário é redirecionado para:
```
https://chora-api-conta-azul.vercel.app/#/auth/confirm?token=xxx&type=signup
```

A página [`pages/AuthConfirm.tsx`](pages/AuthConfirm.tsx) processa o token e confirma o e-mail automaticamente.

**Tempo de expiração:**
- 24 horas (configurável no Supabase)

**Fluxo completo:**
1. Usuário preenche formulário de cadastro
2. `signUp()` é chamado com `emailRedirectTo: ${window.location.origin}/#/auth/confirm`
3. Supabase envia e-mail de confirmação
4. Usuário clica no link do e-mail
5. Supabase redireciona para `/#/auth/confirm?token=xxx&type=signup`
6. `AuthConfirm.tsx` processa o token e confirma o e-mail
7. Usuário é redirecionado para `/login` com mensagem de sucesso

**Assunto:**
```
Confirme seu cadastro na Plataforma Conector
```

**Corpo (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            width: 60px;
            height: 60px;
            background-color: #0B74E0;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        p {
            margin: 15px 0;
            color: #555;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #0B74E0;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #095ba8;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #888;
            text-align: center;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">C</div>
            <h1>Bem-vindo à Plataforma Conector</h1>
        </div>
        
        <div class="content">
            <p>Prezado(a) parceiro(a),</p>
            
            <p>Obrigado por se cadastrar na <strong>Plataforma Conector</strong>, sua solução completa para integração entre Olist e ContaAzul.</p>
            
            <p>Para ativar sua conta e começar a utilizar nossos serviços, por favor, confirme seu endereço de e-mail clicando no botão abaixo:</p>
            
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Confirmar E-mail</a>
            </div>
            
            <p>Ou copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #0B74E0; font-size: 12px;">{{ .ConfirmationURL }}</p>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong> Este link expira em 24 horas. Se você não solicitou este cadastro, pode ignorar este e-mail com segurança.
            </div>
            
            <p>Após a confirmação, você poderá:</p>
            <ul>
                <li>Gerenciar múltiplos clientes em uma única plataforma</li>
                <li>Automatizar a sincronização entre Olist e ContaAzul</li>
                <li>Acessar relatórios e análises detalhadas</li>
                <li>Monitorar todas as integrações em tempo real</li>
            </ul>
            
            <p>Se você tiver alguma dúvida ou precisar de suporte, nossa equipe está à disposição.</p>
        </div>
        
        <div class="footer">
            <p><strong>Plataforma Conector</strong></p>
            <p>Integração Olist-ContaAzul</p>
            <p>Este é um e-mail automático, por favor não responda.</p>
            <p style="margin-top: 15px;">© 2024 Plataforma Conector. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
```

**Corpo (Texto Simples - Fallback):**
```
Bem-vindo à Plataforma Conector

Prezado(a) parceiro(a),

Obrigado por se cadastrar na Plataforma Conector, sua solução completa para integração entre Olist e ContaAzul.

Para ativar sua conta e começar a utilizar nossos serviços, por favor, confirme seu endereço de e-mail acessando o link abaixo:

{{ .ConfirmationURL }}

⚠️ IMPORTANTE: Este link expira em 24 horas. Se você não solicitou este cadastro, pode ignorar este e-mail com segurança.

Após a confirmação, você poderá:
- Gerenciar múltiplos clientes em uma única plataforma
- Automatizar a sincronização entre Olist e ContaAzul
- Acessar relatórios e análises detalhadas
- Monitorar todas as integrações em tempo real

Se você tiver alguma dúvida ou precisar de suporte, nossa equipe está à disposição.

Atenciosamente,
Equipe Plataforma Conector

---
Este é um e-mail automático, por favor não responda.
© 2024 Plataforma Conector. Todos os direitos reservados.
```

---

## 2. Reset de Senha (Password Recovery)

### Documentação

**Quando é enviado:**
- Quando um usuário solicita redefinição de senha através de `resetPassword()` em [`services/authService.ts`](services/authService.ts)
- O e-mail só é enviado se o endereço existir no sistema (validação via `checkEmailExists()`)

**Finalidade:**
- Permitir que o usuário redefina sua senha quando esquecida ou comprometida
- Garantir segurança através de link temporário e único

**Variáveis disponíveis:**
- `{{ .ConfirmationURL }}` - URL completa de redefinição com token (ex: `https://app.com/#/auth/reset-password?token=xxx&type=recovery`)
- `{{ .Email }}` - E-mail do usuário que solicitou o reset
- `{{ .SiteURL }}` - URL base do site configurada

**Link esperado:**
Após clicar no link, o usuário é redirecionado para:
```
https://chora-api-conta-azul.vercel.app/#/auth/reset-password?token=xxx&type=recovery
```

A página [`pages/ResetPassword.tsx`](pages/ResetPassword.tsx) valida o token e permite que o usuário defina uma nova senha.

**Tempo de expiração:**
- 1 hora (configurável no Supabase)

**Fluxo completo:**
1. Usuário solicita reset de senha na página de login
2. `resetPassword()` é chamado com `redirectTo: ${window.location.origin}/#/auth/reset-password`
3. Sistema valida se o e-mail existe (`checkEmailExists()`)
4. Se válido, Supabase envia e-mail de reset
5. Usuário clica no link do e-mail
6. Supabase redireciona para `/#/auth/reset-password?token=xxx&type=recovery`
7. `ResetPassword.tsx` valida o token e exibe formulário de nova senha
8. Usuário define nova senha e é redirecionado para `/login`

**Assunto:**
```
Redefinição de Senha - Plataforma Conector
```

**Corpo (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            width: 60px;
            height: 60px;
            background-color: #0B74E0;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        p {
            margin: 15px 0;
            color: #555;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #0B74E0;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #095ba8;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #888;
            text-align: center;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .security {
            background-color: #d1ecf1;
            border-left: 4px solid #0B74E0;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">C</div>
            <h1>Redefinição de Senha</h1>
        </div>
        
        <div class="content">
            <p>Prezado(a) parceiro(a),</p>
            
            <p>Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Plataforma Conector</strong>.</p>
            
            <p>Se você solicitou esta alteração, clique no botão abaixo para criar uma nova senha:</p>
            
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Redefinir Senha</a>
            </div>
            
            <p>Ou copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #0B74E0; font-size: 12px;">{{ .ConfirmationURL }}</p>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong> Este link expira em 1 hora por motivos de segurança.
            </div>
            
            <div class="security">
                <strong>🔒 Segurança:</strong> Se você <strong>NÃO</strong> solicitou a redefinição de senha, ignore este e-mail. Sua conta permanecerá segura e nenhuma alteração será feita.
            </div>
            
            <p>Após redefinir sua senha, recomendamos:</p>
            <ul>
                <li>Usar uma senha forte com pelo menos 8 caracteres</li>
                <li>Incluir letras maiúsculas, minúsculas, números e símbolos</li>
                <li>Não compartilhar sua senha com terceiros</li>
            </ul>
            
            <p>Se você tiver alguma dúvida ou precisar de suporte, nossa equipe está à disposição.</p>
        </div>
        
        <div class="footer">
            <p><strong>Plataforma Conector</strong></p>
            <p>Integração Olist-ContaAzul</p>
            <p>Este é um e-mail automático, por favor não responda.</p>
            <p style="margin-top: 15px;">© 2024 Plataforma Conector. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
```

**Corpo (Texto Simples - Fallback):**
```
Redefinição de Senha - Plataforma Conector

Prezado(a) parceiro(a),

Recebemos uma solicitação para redefinir a senha da sua conta na Plataforma Conector.

Se você solicitou esta alteração, acesse o link abaixo para criar uma nova senha:

{{ .ConfirmationURL }}

⚠️ IMPORTANTE: Este link expira em 1 hora por motivos de segurança.

🔒 SEGURANÇA: Se você NÃO solicitou a redefinição de senha, ignore este e-mail. Sua conta permanecerá segura e nenhuma alteração será feita.

Após redefinir sua senha, recomendamos:
- Usar uma senha forte com pelo menos 8 caracteres
- Incluir letras maiúsculas, minúsculas, números e símbolos
- Não compartilhar sua senha com terceiros

Se você tiver alguma dúvida ou precisar de suporte, nossa equipe está à disposição.

Atenciosamente,
Equipe Plataforma Conector

---
Este é um e-mail automático, por favor não responda.
© 2024 Plataforma Conector. Todos os direitos reservados.
```

---

## 3. Mudança de Email (Email Change)

### Documentação

**Quando é enviado:**
- Quando um usuário autenticado solicita alteração do endereço de e-mail
- O e-mail é enviado para o **novo** endereço de e-mail fornecido
- Requer confirmação do novo endereço antes de efetivar a mudança

**Finalidade:**
- Confirmar que o novo endereço de e-mail é válido e pertence ao usuário
- Prevenir mudanças não autorizadas de e-mail
- Garantir que o usuário tenha acesso ao novo endereço

**Variáveis disponíveis:**
- `{{ .ConfirmationURL }}` - URL completa de confirmação com token (ex: `https://app.com/#/auth/change-email?token=xxx&type=email_change`)
- `{{ .Email }}` - **Novo** endereço de e-mail que será confirmado
- `{{ .SiteURL }}` - URL base do site configurada

**Link esperado:**
Após clicar no link, o usuário é redirecionado para:
```
https://chora-api-conta-azul.vercel.app/#/auth/change-email?token=xxx&type=email_change
```

**Nota**: Atualmente não há uma página específica `ChangeEmail.tsx` implementada. O token pode ser processado na página de confirmação ou uma página específica pode ser criada.

**Tempo de expiração:**
- 24 horas (configurável no Supabase)

**Fluxo completo:**
1. Usuário autenticado solicita mudança de e-mail nas configurações
2. Supabase envia e-mail de confirmação para o **novo** endereço
3. Usuário clica no link do e-mail
4. Supabase redireciona para `/#/auth/change-email?token=xxx&type=email_change`
5. Token é processado e o e-mail é atualizado
6. Usuário é redirecionado para dashboard ou configurações

**Assunto:**
```
Confirme a mudança de e-mail - Plataforma Conector
```

**Corpo (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            width: 60px;
            height: 60px;
            background-color: #0B74E0;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        p {
            margin: 15px 0;
            color: #555;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #0B74E0;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #095ba8;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #888;
            text-align: center;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">C</div>
            <h1>Confirmação de Mudança de E-mail</h1>
        </div>
        
        <div class="content">
            <p>Prezado(a) parceiro(a),</p>
            
            <p>Recebemos uma solicitação para alterar o endereço de e-mail da sua conta na <strong>Plataforma Conector</strong>.</p>
            
            <p>Para confirmar esta alteração, clique no botão abaixo:</p>
            
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Confirmar Mudança de E-mail</a>
            </div>
            
            <p>Ou copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #0B74E0; font-size: 12px;">{{ .ConfirmationURL }}</p>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong> Este link expira em 24 horas. Se você não solicitou esta alteração, ignore este e-mail com segurança.
            </div>
            
            <p>Após a confirmação, seu novo endereço de e-mail será ativado e você receberá todas as notificações neste novo endereço.</p>
        </div>
        
        <div class="footer">
            <p><strong>Plataforma Conector</strong></p>
            <p>Integração Olist-ContaAzul</p>
            <p>Este é um e-mail automático, por favor não responda.</p>
            <p style="margin-top: 15px;">© 2024 Plataforma Conector. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
```

**Corpo (Texto Simples - Fallback):**
```
Confirmação de Mudança de E-mail - Plataforma Conector

Prezado(a) parceiro(a),

Recebemos uma solicitação para alterar o endereço de e-mail da sua conta na Plataforma Conector.

Para confirmar esta alteração, acesse o link abaixo:

{{ .ConfirmationURL }}

⚠️ IMPORTANTE: Este link expira em 24 horas. Se você não solicitou esta alteração, ignore este e-mail com segurança.

Após a confirmação, seu novo endereço de e-mail será ativado e você receberá todas as notificações neste novo endereço.

Atenciosamente,
Equipe Plataforma Conector

---
Este é um e-mail automáticos, por favor não responda.
© 2024 Plataforma Conector. Todos os direitos reservados.
```

---

## 4. Magic Link (Login sem senha)

### Documentação

**Quando é enviado:**
- Quando um usuário solicita login sem senha através de `signInWithOtp()` do Supabase
- Alternativa ao login tradicional com senha
- Útil para usuários que preferem não usar senha

**Finalidade:**
- Permitir acesso à plataforma sem necessidade de senha
- Simplificar o processo de login para usuários
- Oferecer método de autenticação alternativo e seguro

**Variáveis disponíveis:**
- `{{ .ConfirmationURL }}` - URL completa de acesso com token (ex: `https://app.com/#/auth/confirm?token=xxx&type=magiclink`)
- `{{ .Email }}` - E-mail do usuário que solicitou o magic link
- `{{ .SiteURL }}` - URL base do site configurada

**Link esperado:**
Após clicar no link, o usuário é redirecionado para:
```
https://chora-api-conta-azul.vercel.app/#/auth/confirm?token=xxx&type=magiclink
```

A página [`pages/AuthConfirm.tsx`](pages/AuthConfirm.tsx) pode processar o token e fazer login automaticamente.

**Tempo de expiração:**
- 1 hora (configurável no Supabase)
- Link pode ser usado apenas **uma vez**

**Fluxo completo:**
1. Usuário solicita magic link na página de login
2. `signInWithOtp()` é chamado com o e-mail do usuário
3. Supabase envia e-mail com magic link
4. Usuário clica no link do e-mail
5. Supabase redireciona para `/#/auth/confirm?token=xxx&type=magiclink`
6. Token é processado e usuário é autenticado automaticamente
7. Usuário é redirecionado para dashboard

**Assunto:**
```
Link de acesso - Plataforma Conector
```

**Corpo (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            width: 60px;
            height: 60px;
            background-color: #0B74E0;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        p {
            margin: 15px 0;
            color: #555;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #0B74E0;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #095ba8;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #888;
            text-align: center;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">C</div>
            <h1>Acesso à Plataforma Conector</h1>
        </div>
        
        <div class="content">
            <p>Prezado(a) parceiro(a),</p>
            
            <p>Você solicitou um link de acesso para entrar na <strong>Plataforma Conector</strong> sem precisar de senha.</p>
            
            <p>Clique no botão abaixo para acessar sua conta:</p>
            
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Acessar Plataforma</a>
            </div>
            
            <p>Ou copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #0B74E0; font-size: 12px;">{{ .ConfirmationURL }}</p>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong> Este link expira em 1 hora e pode ser usado apenas uma vez por motivos de segurança.
            </div>
            
            <p>Se você não solicitou este link, ignore este e-mail com segurança. Sua conta permanecerá protegida.</p>
        </div>
        
        <div class="footer">
            <p><strong>Plataforma Conector</strong></p>
            <p>Integração Olist-ContaAzul</p>
            <p>Este é um e-mail automático, por favor não responda.</p>
            <p style="margin-top: 15px;">© 2024 Plataforma Conector. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
```

**Corpo (Texto Simples - Fallback):**
```
Acesso à Plataforma Conector

Prezado(a) parceiro(a),

Você solicitou um link de acesso para entrar na Plataforma Conector sem precisar de senha.

Acesse o link abaixo para entrar na sua conta:

{{ .ConfirmationURL }}

⚠️ IMPORTANTE: Este link expira em 1 hora e pode ser usado apenas uma vez por motivos de segurança.

Se você não solicitou este link, ignore este e-mail com segurança. Sua conta permanecerá protegida.

Atenciosamente,
Equipe Plataforma Conector

---
Este é um e-mail automático, por favor não responda.
© 2024 Plataforma Conector. Todos os direitos reservados.
```

---

## Como Aplicar os Templates no Supabase

### Passo a Passo

1. **Acesse o Supabase Dashboard**
   - Vá para https://app.supabase.com
   - Selecione seu projeto

2. **Configure SMTP Personalizado (Recomendado)**
   - Vá em **Authentication** → **Settings**
   - Role até **SMTP Settings**
   - Configure seu SMTP personalizado conforme [`doc/PADRAO_ENVIO_EMAILS.md`](PADRAO_ENVIO_EMAILS.md)

3. **Configure URLs de Redirecionamento**
   - Vá em **Authentication** → **URL Configuration**
   - Configure **Site URL** e **Redirect URLs**
   - **Importante**: Inclua o hash `#/` nas URLs (ex: `/#/auth/confirm`)
   - Para mais detalhes, consulte [`doc/GUIA_URLS_REDIRECIONAMENTO.md`](GUIA_URLS_REDIRECIONAMENTO.md)

4. **Aplique os Templates**
   - Vá em **Authentication** → **Email Templates**
   - Para cada template:
     - Selecione o tipo (Confirmation, Recovery, Email Change, Magic Link)
     - Cole o conteúdo HTML na seção "HTML"
     - Cole o conteúdo de texto simples na seção "Plain text"
     - Clique em "Save"

5. **Habilite Confirmação de E-mail**
   - Vá em **Authentication** → **Settings**
   - Ative **Enable email confirmations**

### Variáveis Disponíveis

Todos os templates suportam as seguintes variáveis:

- `{{ .ConfirmationURL }}` - URL completa de confirmação com token (usado na maioria dos casos)
- `{{ .Email }}` - E-mail do usuário
- `{{ .Token }}` - Token de confirmação (geralmente não necessário, já incluído na URL)
- `{{ .TokenHash }}` - Hash do token (geralmente não necessário)
- `{{ .SiteURL }}` - URL base do site configurada

---

## Personalização

Você pode personalizar os templates alterando:

- **Cores**: Substitua `#0B74E0` pela cor desejada (cor principal da marca)
- **Logo**: Substitua o `<div class="logo">C</div>` por uma tag `<img>` com seu logo
- **Textos**: Ajuste mensagens conforme necessário, mantendo o tom profissional
- **Rodapé**: Atualize informações de contato e copyright

**Importante**: Mantenha a consistência visual entre todos os templates para uma experiência profissional.

---

## Testes

### Checklist de Testes

Após configurar os templates, teste cada tipo de e-mail:

- [ ] **Confirmação de Cadastro**
  - [ ] Criar usuário de teste
  - [ ] Verificar recebimento do e-mail
  - [ ] Verificar remetente correto
  - [ ] Clicar no link e verificar redirecionamento
  - [ ] Confirmar que o e-mail foi confirmado

- [ ] **Reset de Senha**
  - [ ] Solicitar reset com e-mail válido
  - [ ] Verificar recebimento do e-mail
  - [ ] Clicar no link e verificar redirecionamento
  - [ ] Redefinir senha e verificar sucesso
  - [ ] Testar com e-mail inválido (não deve enviar)

- [ ] **Mudança de E-mail**
  - [ ] Solicitar mudança de e-mail
  - [ ] Verificar recebimento no novo endereço
  - [ ] Clicar no link e verificar confirmação

- [ ] **Magic Link**
  - [ ] Solicitar magic link
  - [ ] Verificar recebimento do e-mail
  - [ ] Clicar no link e verificar login automático

### Testes de Renderização

Teste os templates em diferentes clientes de e-mail:

- [ ] Gmail (web e mobile)
- [ ] Outlook (web e desktop)
- [ ] Apple Mail
- [ ] Clientes móveis (iOS Mail, Android Gmail)

### Validação de Links

- [ ] Todos os links funcionam corretamente
- [ ] Redirecionamentos apontam para as rotas corretas
- [ ] Tokens são processados corretamente
- [ ] Mensagens de erro são exibidas quando necessário

---

## Referências

- [Padrão de Envio de E-mails](PADRAO_ENVIO_EMAILS.md) - Configuração de SMTP e remetente
- [Guia de URLs de Redirecionamento](GUIA_URLS_REDIRECIONAMENTO.md) - Configuração de URLs
- [Documentação Supabase Auth](https://supabase.com/docs/guides/auth)
- [Email Templates do Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)

