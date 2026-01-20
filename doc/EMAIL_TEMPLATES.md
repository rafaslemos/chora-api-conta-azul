# Templates de Email - Supabase Auth

## Como Funcionam as URLs de Redirecionamento

### Site URL
A **Site URL** é a URL base da sua aplicação. O Supabase usa isso como padrão para redirecionamentos quando nenhuma URL específica é fornecida.

**Exemplo:**
- Desenvolvimento: `http://localhost:3000`
- Produção: `https://seu-dominio.com`

### Redirect URLs
As **Redirect URLs** são URLs específicas que o Supabase pode redirecionar após ações de autenticação. Você deve adicionar todas as URLs que serão usadas.

**URLs necessárias:**
1. **Confirmação de Email**: `http://localhost:3000/auth/confirm`
   - Usada quando o usuário clica no link de confirmação no email
   - O Supabase adiciona automaticamente tokens na URL: `?token=xxx&type=signup`

2. **Reset de Senha**: `http://localhost:3000/auth/reset-password`
   - Usada quando o usuário solicita redefinição de senha
   - O Supabase adiciona: `?token=xxx&type=recovery`

3. **Mudança de Email**: `http://localhost:3000/auth/change-email`
   - Usada quando o usuário confirma mudança de email
   - O Supabase adiciona: `?token=xxx&type=email_change`

### Como Funciona o Fluxo

1. **Usuário se cadastra** → Supabase envia email de confirmação
2. **Usuário clica no link** → Supabase redireciona para: `Site URL/auth/confirm?token=xxx&type=signup`
3. **Sua aplicação recebe** → Página `/auth/confirm` processa o token e confirma o email
4. **Redireciona para login** → Após confirmação, redireciona para `/login`

## Templates de Email

Os templates abaixo são formais e profissionais, prontos para copiar e colar no Supabase Dashboard.

---

## 1. Confirmação de Email (Signup)

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

1. **Acesse o Supabase Dashboard**
   - Vá para https://app.supabase.com
   - Selecione seu projeto

2. **Vá em Authentication > Email Templates**

3. **Para cada template:**
   - Selecione o tipo (Confirmation, Recovery, etc.)
   - Cole o conteúdo HTML na seção "HTML"
   - Cole o conteúdo de texto simples na seção "Plain text"
   - Clique em "Save"

4. **Variáveis disponíveis:**
   - `{{ .ConfirmationURL }}` - URL de confirmação com token
   - `{{ .Email }}` - Email do usuário
   - `{{ .Token }}` - Token de confirmação (geralmente não necessário)
   - `{{ .TokenHash }}` - Hash do token (geralmente não necessário)
   - `{{ .SiteURL }}` - URL do site configurada

---

## Personalização

Você pode personalizar os templates alterando:
- Cores (substitua `#0B74E0` pela cor desejada)
- Textos e mensagens
- Logo (substitua o `<div class="logo">C</div>` por uma imagem)
- Informações de contato no rodapé

---

## Testes

Após configurar os templates:
1. Crie um usuário de teste
2. Verifique se o email foi recebido
3. Teste se os links funcionam corretamente
4. Verifique se o redirecionamento está funcionando

