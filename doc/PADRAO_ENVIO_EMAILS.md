# Padrão de Envio de E-mails - Plataforma Conector

## Visão Geral

Este documento define o padrão de envio de e-mails de autenticação da Plataforma Conector, garantindo consistência, profissionalismo e uso de domínio personalizado para todos os e-mails enviados aos usuários.

## Remetente Padrão

### Configuração de SMTP Personalizado

Todos os e-mails devem ser enviados usando um **domínio personalizado** configurado no Supabase, não o remetente padrão do Supabase (`noreply@mail.app.supabase.io`).

**Remetente Padrão:**
- **E-mail**: `no-reply@[seu-dominio.com]` ou `noreply@[seu-dominio.com]`
- **Nome de Exibição**: `Plataforma Conector`
- **Reply-To**: `suporte@[seu-dominio.com]` (opcional, para permitir respostas)

**Exemplo:**
- Se o domínio for `chora-api-conta-azul.com.br`:
  - Remetente: `no-reply@chora-api-conta-azul.com.br`
  - Nome: `Plataforma Conector`
  - Reply-To: `suporte@chora-api-conta-azul.com.br`

### Como Configurar SMTP no Supabase

1. **Acesse o Supabase Dashboard**
   - Vá para https://app.supabase.com
   - Selecione seu projeto

2. **Configure SMTP Personalizado**
   - Vá em **Authentication** → **Settings**
   - Role até a seção **SMTP Settings**
   - Ative **Enable Custom SMTP**

3. **Preencha os dados do SMTP:**

   **Opção 1: Usando serviços como SendGrid, Mailgun, AWS SES, etc.**
   ```
   SMTP Host: smtp.sendgrid.net (ou seu provedor)
   SMTP Port: 587 (ou 465 para SSL)
   SMTP User: apikey (ou seu usuário)
   SMTP Password: [sua-chave-API]
   Sender Email: no-reply@seu-dominio.com
   Sender Name: Plataforma Conector
   ```

   **Opção 2: Usando SMTP do próprio domínio**
   ```
   SMTP Host: smtp.seu-dominio.com (ou mail.seu-dominio.com)
   SMTP Port: 587
   SMTP User: no-reply@seu-dominio.com
   SMTP Password: [senha-do-email]
   Sender Email: no-reply@seu-dominio.com
   Sender Name: Plataforma Conector
   ```

4. **Configurar DNS (SPF, DKIM, DMARC)**

   Para garantir boa entrega e evitar spam, configure os registros DNS:

   **SPF Record:**
   ```
   TXT @ "v=spf1 include:_spf.supabase.co ~all"
   ```
   (Se usar SMTP do Supabase) ou:
   ```
   TXT @ "v=spf1 include:sendgrid.net ~all"
   ```
   (Se usar SendGrid, ajuste conforme seu provedor)

   **DKIM:**
   - Configure conforme instruções do seu provedor SMTP
   - Geralmente envolve adicionar registros TXT específicos

   **DMARC:**
   ```
   TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@seu-dominio.com"
   ```

5. **Testar Configuração**
   - Clique em **Send Test Email** no Supabase
   - Verifique se o e-mail foi recebido
   - Confirme que o remetente está correto

### Fallback para SMTP Padrão

Se o SMTP personalizado não estiver configurado, o Supabase usará seu SMTP padrão (`noreply@mail.app.supabase.io`). **Recomendamos configurar SMTP personalizado antes de ir para produção.**

## Padrão de Templates

Todos os templates de e-mail seguem o mesmo padrão visual e de conteúdo:

### Elementos Visuais Padrão

- **Cor Principal**: `#0B74E0` (azul corporativo)
- **Logo**: Logo da Plataforma Conector (ou inicial "C" em círculo azul)
- **Fonte**: System fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`)
- **Layout**: Responsivo, máximo 600px de largura
- **Estilo**: Profissional, limpo e moderno

### Elementos de Conteúdo Padrão

- **Saudação**: "Prezado(a) parceiro(a),"
- **Assinatura**: "Equipe Plataforma Conector"
- **Rodapé**: 
  - "Este é um e-mail automático, por favor não responda."
  - "© 2024 Plataforma Conector. Todos os direitos reservados."
- **Tom**: Formal, profissional e amigável

### Variáveis Disponíveis nos Templates

- `{{ .ConfirmationURL }}` - URL completa de confirmação com token
- `{{ .Email }}` - E-mail do usuário
- `{{ .Token }}` - Token de confirmação (geralmente não necessário)
- `{{ .TokenHash }}` - Hash do token (geralmente não necessário)
- `{{ .SiteURL }}` - URL base do site configurada

## Tipos de E-mail

A plataforma envia os seguintes tipos de e-mail:

1. **Confirmação de Cadastro (Signup)** - Ver [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md#1-confirmação-de-email-signup)
2. **Reset de Senha (Recovery)** - Ver [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md#2-reset-de-senha-password-recovery)
3. **Mudança de E-mail (Email Change)** - Ver [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md#3-mudança-de-email-email-change)
4. **Magic Link (Login sem senha)** - Ver [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md#4-magic-link-login-sem-senha)

Cada tipo de e-mail possui documentação detalhada em [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md).

## URLs de Redirecionamento

Todos os e-mails redirecionam para rotas específicas da aplicação. O projeto usa **HashRouter**, mas o Supabase não preserva hash no `redirect_to` dos emails. Por isso, criamos páginas intermediárias que redirecionam automaticamente.

### Configuração de URL de Produção

**Variável de Ambiente**: `VITE_APP_URL`

Configure esta variável para garantir que os emails sempre apontem para produção:

**Desenvolvimento** (`.env.local`):
```env
VITE_APP_URL=https://chora-api-conta-azul.vercel.app
```

**Produção** (Vercel Environment Variables):
- Adicione `VITE_APP_URL` com a URL de produção
- Isso garante que mesmo em builds de preview/staging, os emails apontem para produção

### URLs no Supabase

Configure as Redirect URLs **sem hash** (as páginas intermediárias tratam o hash automaticamente):

**Produção:**
```
https://chora-api-conta-azul.vercel.app/auth/confirm
https://chora-api-conta-azul.vercel.app/auth/reset-password
```

**Desenvolvimento** (opcional, apenas para testes locais):
```
http://localhost:3000/auth/confirm
http://localhost:3000/auth/reset-password
```

### Como Funciona

1. Email contém link: `...&redirect_to=https://chora-api-conta-azul.vercel.app/auth/confirm`
2. Usuário clica → Supabase redireciona para `/auth/confirm?token=xxx` (sem hash)
3. `AuthConfirmRedirect.tsx` detecta e redireciona para `/#/auth/confirm?token=xxx` (com hash)
4. HashRouter processa a rota normalmente

Para mais detalhes sobre configuração de URLs, consulte [`doc/GUIA_URLS_REDIRECIONAMENTO.md`](GUIA_URLS_REDIRECIONAMENTO.md).

## Checklist de Configuração

### Configuração Inicial

- [ ] Variável `VITE_APP_URL` configurada no `.env.local` e Vercel
- [ ] Domínio personalizado configurado e verificado
- [ ] SMTP personalizado configurado no Supabase
- [ ] Registros DNS (SPF, DKIM, DMARC) configurados
- [ ] Teste de envio realizado e verificado
- [ ] Remetente padrão configurado (`no-reply@seu-dominio.com`)

### Configuração no Supabase Dashboard

- [ ] **Authentication > Settings**
  - [ ] Email confirmations habilitado
  - [ ] SMTP personalizado configurado
  - [ ] Sender email e name configurados

- [ ] **Authentication > URL Configuration**
  - [ ] Site URL configurada (URL de produção)
  - [ ] Redirect URLs adicionadas (sem hash, páginas intermediárias tratam o hash):
    - [ ] `https://chora-api-conta-azul.vercel.app/auth/confirm`
    - [ ] `https://chora-api-conta-azul.vercel.app/auth/reset-password`

- [ ] **Authentication > Email Templates**
  - [ ] Template de Confirmação (Signup) aplicado
  - [ ] Template de Reset de Senha (Recovery) aplicado
  - [ ] Template de Mudança de E-mail (Email Change) aplicado
  - [ ] Template de Magic Link aplicado
  - [ ] Versões HTML e Plain Text configuradas para cada template

### Validação

- [ ] E-mail de teste enviado e recebido
- [ ] Remetente aparece corretamente no cliente de e-mail
- [ ] Links de confirmação funcionam corretamente
- [ ] Redirecionamentos funcionam para as rotas corretas
- [ ] Templates renderizam corretamente em diferentes clientes de e-mail
- [ ] Versão Plain Text está legível

### Documentação

- [ ] Templates documentados em [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md)
- [ ] URLs de redirecionamento documentadas em [`doc/GUIA_URLS_REDIRECIONAMENTO.md`](GUIA_URLS_REDIRECIONAMENTO.md)
- [ ] Padrão de envio documentado neste arquivo

## Troubleshooting

### E-mails não estão sendo enviados

1. Verifique se o SMTP está configurado corretamente
2. Teste o envio usando "Send Test Email" no Supabase
3. Verifique os logs do Supabase em **Logs > Auth Logs**
4. Confirme que os registros DNS estão corretos

### E-mails vão para spam

1. Verifique configuração de SPF, DKIM e DMARC
2. Use um provedor SMTP confiável (SendGrid, Mailgun, AWS SES)
3. Evite palavras que podem ser consideradas spam
4. Mantenha uma boa reputação do domínio

### Remetente incorreto

1. Verifique configuração de SMTP no Supabase
2. Confirme que "Sender Email" está configurado corretamente
3. Verifique se o domínio está verificado no provedor SMTP

### Links não funcionam

1. Verifique se as Redirect URLs estão configuradas corretamente
2. Confirme que as URLs incluem o hash `#/` se usar HashRouter
3. Teste os links manualmente copiando e colando no navegador
4. Verifique se as rotas existem no frontend

## Manutenção

### Atualização de Templates

Quando atualizar templates:

1. Atualize o arquivo [`doc/EMAIL_TEMPLATES.md`](EMAIL_TEMPLATES.md)
2. Aplique as mudanças no Supabase Dashboard
3. Teste cada tipo de e-mail
4. Documente mudanças significativas

### Monitoramento

- Monitore taxa de entrega de e-mails
- Acompanhe reclamações de spam
- Verifique logs de autenticação regularmente
- Mantenha registros DNS atualizados

## Referências

- [Documentação Supabase Auth](https://supabase.com/docs/guides/auth)
- [Configuração de SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
- [Email Templates do Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Configuração de URLs de Redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls)
