## Visão Geral do Produto

- Descrição concisa  
  - Plataforma SaaS multi-tenant que integra vendas e pedidos provenientes da Olist com o sistema financeiro ContaAzul, automatizando a criação e reconciliação de lançamentos financeiros, conciliando itens por produto, marketplace e taxas, e mantendo auditoria completa.  
- Público-alvo  
  - BPOs financeiros que gerenciam múltiplos clientes vendedores via Olist.  
  - Pequenas e médias empresas (PMEs) que vendem em marketplaces via Olist e usam ContaAzul para gestão financeira.  
  - Times de contabilidade que precisam reduzir lançamentos manuais e erros.  
- Proposta de valor única  
  - Redução significativa do trabalho manual e de erros na transição de pedidos (Olist) para lançamentos contábeis (ContaAzul), com mapeamento por produto, taxas e marketplace, visibilidade centralizada por cliente e trilha de auditoria por lançamento.

## Requisitos Funcionais

- Liste todos os requisitos principais (priorizados MoSCoW)

Must have

- Integração via API com Olist (leitura de pedidos, itens, status, fees) e ContaAzul (criação/atualização de lançamentos, contas a receber/pagar).  
- Sincronização automática de pedidos e itens (mapeamento 1:N de pedido → lançamentos; desacoplamento por marketplace/fees).  
- Cadastro multi-tenant com isolamento de dados (cada cliente/empresa é um tenant).  
- Rotação e renovação segura de tokens (refresh tokens e rotação programada).  
- Logs de auditoria imutáveis para cada evento de integração (criação/atualização/erro).  
- Painel de monitoramento de status de sincronização (sucesso/erros/pendências).  
- Idempotência em operações de criação no ContaAzul (evitar duplicação).  
- Mecanismo de retry automático com backoff exponencial e DLQ para falhas persistentes.  
- Criptografia em repouso e em trânsito de credenciais/API tokens.  
- Autenticação e autorização admin básica (Supabase Auth) com políticas RLS por tenant.  
- Mapeamento de categorias/contas do ContaAzul para produtos e tipos de receita (configurável).  
- Testes automatizados básicos (unitários e integração) para fluxos críticos (sync, token rotation, retry).  
- Documentação de APIs internas e fluxos n8n para manutenção.

Should have

- Dashboard analítico (receita por marketplace, por produto, ciclo de recebíveis).  
- Configuração de categorias de lançamentos automatizados (regras por SKU, tag, marketplace).  
- Painel único para administradores que agregue integrações de todos os clientes.  
- Notificações por e-mail/painel para erros críticos e sincronizações falhas.  
- Suporte a múltiplos usuários por empresa com roles (admin, contador, operador).  
- Filtragem e busca avançada em logs e pedidos.  
- Mecanismo de rollback/undo para lançamentos criados nos últimos X minutos.

Could have

- Suporte a múltiplos usuários por empresa para configurar (detalhar permissões avançadas).  
- Microinterações ricas no front-end (animações detalhadas, feedbacks contextuais).  
- Importação manual (CSV) de pedidos históricos.  
- Integração opcional com ferramentas de BI (export CSV, webhooks para eventos).  
- Modo sandbox/teste para validação de mapeamentos sem criar lançamentos reais.  
- Integração com gateway de alertas (Slack, Teams) para notificações.

Won’t have (MVP)

- Autenticação 2FA no MVP.  
- Integrações nativas com ERPs além do ContaAzul no MVP.  
- Reconciliador bancário automático no MVP.

## Histórias de Usuário

- Como BPO financeiro, eu quero que as vendas integrem automaticamente no ContaAzul para evitar lançamentos manuais e reduzir erros.  
- Como usuário final, eu quero ver as vendas detalhadas por produto e marketplace para conciliar receitas e taxas.  
- Como administrador, eu quero acessar as integrações de todos os clientes em um só painel para monitorar operações e incidentes.  
- Como pequena empresa, eu quero gerir o financeiro de forma simples a partir das vendas da Olist sem precisar lançar manualmente.  
- Como desenvolvedor/integradora, eu quero uma plataforma com APIs e workflows documentados para tornar a integração intuitiva e fácil de manter.  
- Como operador, eu quero receber notificações quando um lançamento falha para agir rapidamente.  
- Como contador, eu quero configurar regras de mapeamento (produto → categoria ContaAzul) para que os lançamentos fiquem compatíveis com o plano de contas do cliente.  
- Como auditor, eu quero visualizar a trilha completa de quem e quando criou/alterou um lançamento para compliance.

## Estrutura de Páginas/Seções

- Hierarquia de navegação (top-level)  
    
  - Home / Dashboard (Tenant)  
  - Clientes (lista de tenants) — Admin multi-tenant  
  - Cadastro do Cliente (wizard de onboarding)  
  - Configurações de Integração  
    - Configuração API Olist  
    - Configuração API ContaAzul  
    - Mapeamento Lançamentos (categorias / produtos)  
  - Monitor de Sincronização (fila, histórico, retries)  
  - Logs & Auditoria  
  - Analytics (Relatórios)  
  - Usuários & Permissões  
  - Settings (Chaves, Rotina de token rotation, Limites)  
  - Ajuda / Documentação / Sandbox


- Wireframes em texto para cada página principal  
    
1) Login / Seleção de Tenant  
- Topbar: logo (esquerda), tenant selector (se multi-tenant com SSO), user avatar (direita).  
- Corpo central: formulário de login (email \+ senha), link "Esqueci senha".  
- Rodapé: versão do sistema, link docs.  
2) Dashboard (Tenant)  
- Top: resumo (cards) — Total vendas (30d), Recebíveis a vencer, Pendências de sync.  
- Centro: timeline de sincronizações recentes (últimos 24h), mapa de erros por cliente/produto.  
- Lateral: ações rápidas (Run sync manual, Criar mapeamento rápido, Ver logs).  
- CTA para abrir Monitor de Sincronização e Analytics.  
3) Clientes (Admin)  
- Tabela com colunas: Empresa, CNPJ, Status integração (Olist/ContaAzul), Última sincronização, Ações (ver, editar, logs).  
- Filtro por status / busca por nome.  
- Botão "+ Novo cliente" → abre Wizard de Cadastro.  
4) Wizard de Cadastro do Cliente  
- Passo 1: Dados da empresa (nome, CNPJ, responsável).  
- Passo 2: Configurar Olist — instruções, campo token/API key, testar conexão (fetch sample orders).  
- Passo 3: Configurar ContaAzul — OAuth ou API key, selecionar plano de contas/pasta contábil, testar conexão.  
- Passo 4: Mapeamento inicial — regras básicas (todos itens → Conta X; marketplace Y → conta Z).  
- Confirmação e primeiro sync agendado.  
5) Configuração API da Olist  
- Campos: tipo de autenticação (API key/OAuth), token (criptografado), webhook URL (para receber eventos), polling interval (se webhook não disponível).  
- Botão "Testar Conexão" com modal de results (sample orders).  
- Histórico de tokens/rotations.  
6) Configuração API do ContaAzul  
- Fluxo OAuth recomendado (autorizar ContaAzul), fallback para API key.  
- Seleção de contas/pastas no ContaAzul para mapear receitas, frete, taxas, estornos.  
- Teste de criação de lançamento (modo sandbox).  
7) Página de Configuração de Lançamentos (Mapeamentos)  
- Grid: regras com prioridade (ex.: SKU contém "X" → Conta 3).  
- Regra: filtros (SKU, tag, marketplace, faixa de preço), ação (criar conta a receber, provisão, conta de receita), percentuais (taxa marketplace).  
- Teste de regra: simular pedido e visualizar payload que será enviado ao ContaAzul.  
8) Monitor de Sincronização  
- Lista de jobs/pendências com status (pending/running/success/error).  
- Detalhe do job: payload, resposta do ContaAzul, tentativa atual, logs.  
- Ações: reenfileirar, enviar para DLQ, notificar responsável.  
9) Logs & Auditoria  
- Timeline com entradas imutáveis: quem, o que, quando, payload hash.  
- Filtro por período, tipo de evento, usuário, cliente.  
- Export CSV e possibilidade de armazenamento longo (S3).  
10) Analytics  
- Gráficos: receita por marketplace, top SKUs, tempo médio até pagamento, inadimplência.  
- Exportar relatórios (PDF/CSV).  
11) Usuários & Permissões  
- Lista de usuários por tenant, roles (admin, operador, contador).  
- Ações: convidar usuário (email), revoke, editar permissões.

## Design e Interações

- Paleta de cores sugerida  
    
  - Primárias: ContaAzul Blue (ex.: \#0B74E0), Deep Blue (\#065FA8)  
  - Neutros: Gray-100 (\#F7F9FB), Gray-300 (\#D1D7DD), Gray-700 (\#4B5563)  
  - Ações: Success Green (\#22C55E), Warning Amber (\#F59E0B), Error Red (\#EF4444)  
  - Uso: Botões primários em Azul ContaAzul, estados hover com leve escurecimento, success badges em verde.


- Tipografia  
    
  - Sans-serif moderna (ex.: Inter ou Poppins).  
  - Hierarquia: H1 24-28px semibold, H2 20px semibold, body 14-16px regular.  
  - Espaçamento generoso e line-height 1.4 para legibilidade.


- Animações e microinterações (detalhadas com implementação técnica)  
    
  - Princípios gerais  
    - Suportar prefers-reduced-motion: desabilitar transições não essenciais.  
    - Usar animações para foco/feedback, não decoração.  
    - Durations curtas: 120–350ms dependendo da ação; easing cúbicos (cubic-bezier(0.2, 0.8, 0.2, 1\) para entradas).  
    - Utilizar transform/opacity para melhor performance (GPU-accelerated).  
  - Microinterações principais  
    1. Botões e estados (hover, active, disabled)  
       - Implementação: Framer Motion variants (initial: { scale: 1 }, hover: { scale: 1.03 }, tap: { scale: 0.98 }), transition: { duration: 0.12, type: 'spring', stiffness: 500 }.  
       - Acessibilidade: foco via outline visível customizável, alt text for icons.  
    2. Toasts e banners  
       - Entrada/saída: slide-up \+ fade: variants { hidden: { y: 8, opacity: 0 }, visible: { y: 0, opacity: 1 } }, transition 200ms.  
       - Suportar ação "Desfazer" com countdown visual (progress bar).  
    3. Salvar / Indicador de progresso  
       - Animation: small inline spinner (SVG) \+ morphing success check animation (Lottie opcional).  
       - Framer Motion: animate layout changes with layoutId for smooth transitions.  
    4. Cards expansíveis (detalhe de pedido)  
       - Expand/collapse com layout animation (layout: true in Framer Motion) e height auto smoothing (use measure \+ animate height).  
       - Transition: { type: 'spring', stiffness: 260, damping: 20 } para sensação tátil.  
    5. Tabela — highlight on row update  
       - Temporarily pulse background (yellow → transparent) using CSS custom property animation ou Framer Motion keyframes.  
       - Smooth column width transitions with transition on width.  
    6. Progress bar de sincronização  
       - Use determinate bar with incremental smooth animation, easing in JS; ícone animado à esquerda (rotating sync) em 600ms loop.  
    7. Indicação de status de integração (badge)  
       - Micro-animations: pulse discreto para “conectando”, static para “conectado”, shake para “erro” (shake via x translate keyframes 3 cycles).  
       - For shake: small amplitude (6–8px) with 200–300ms total duration.  
    8. Onboarding wizard transitions  
       - Use GSAP timeline ou Framer Motion AnimatePresence para transições entre passos (slide \+ fade).  
       - Stagger child inputs with 60ms offset for perceived speed.  
    9. On error modals  
       - Modal entrance: scale from 0.98 \+ fade (150–200ms) to emphasise seriousness; use focus trap.  
  - Técnicas e parâmetros recomendados  
    - Prefer Framer Motion para microinterações e transições de layout (React).  
    - Usar GSAP para timelines complexos e sequências de onboarding com sincronia de múltiplos elementos.  
    - Lottie para ilustrativos animados (success, empty states) com autoplay loop off e control via JS.  
    - Para animações de SVG (checks, paths) usar stroke-dashoffset com Framer Motion.  
    - Use will-change sparingly e remove quando animação terminar.  
    - Debounce animações de hover em elementos densos (listas) para evitar jank.  
    - Gerenciamento de redução de movimento: ler window.matchMedia('(prefers-reduced-motion: reduce)') e aplicar variantes sem animação.


- Bibliotecas recomendadas  
    
  - Framer Motion — animações de UI, layout transitions, variants.  
  - GSAP — sequências complexas (onboarding tour).  
  - Lottie (lottie-web / react-lottie) — ilustrações animadas em empty states e success.  
  - React Aria / Reach UI — para componentes acessíveis (dialogs, combobox).  
  - tailwindcss (se for compatível com Lovable.dev) — utilitários estilos rápidos.  
  - lodash.debounce — debounces de UI.  
  - react-query / SWR — cache e sincronização de dados no front-end.  
  - date-fns — manipulação de datas.

## Considerações Técnicas

- Stack tecnológica sugerida  
  - Frontend: React (Next.js opcional) com Lovable.dev UI kit; TypeScript.  
  - Integrações/workflows: n8n para orquestração de integrações e automatizações.  
  - Backend: Node.js (NestJS ou Fastify) ou serverless functions (Vercel/Azure Functions) para endpoints críticos (webhooks, token management).  
  - Banco: Supabase (Postgres) para dados, Auth e RLS.  
  - Cache / filas: Redis (cache \+ BullMQ para filas de processamento).  
  - Storage: S3 (logs long-term, payloads).  
  - Observability: Datadog/ELK para logs estruturados, Sentry para erros.  
  - CI/CD: GitHub Actions (testes, lint, deploy).  
  - Secrets/KMS: AWS KMS/GCP KMS para criptografia de tokens.  
- Integrações necessárias  
  - Olist API: leitura de pedidos, itens, fees; webhooks se disponível; fallback polling.  
  - ContaAzul API: criação e atualização de lançamentos, consulta de plano de contas, webhooks (se aplicável).  
  - E-mail (SendGrid) e notificações (optional Slack/Teams).  
  - n8n flows versionados para mapear payloads e transformações.  
- Segurança e compliance  
  - Tokens criptografados em DB (AES-256) e rotacionados automaticamente via rota agendada.  
  - RLS (Row Level Security) no Postgres/Supabase para isolar dados por tenant.  
  - Audit logs imutáveis (append-only) com hash do payload e possibilidade de export para S3.  
  - Rate limits por tenant para chamadas externas (proteger ContaAzul/Olist).  
  - Idempotency keys para requests que criam lançamentos no ContaAzul.  
  - TLS 1.2+ em todas as comunicações.  
- Requisitos de performance  
  - Cache de metadados (plano de contas ContaAzul, catálogo Olist) em Redis com TTL 15–60 minutos.  
  - Jobs de sincronização via filas (BullMQ) com workers escaláveis.  
  - Retry com backoff exponencial (ex.: 1m, 5m, 20m, 1h) e DLQ após N tentativas configurável.  
  - Monitoramento de SLAs de sincronização (ex.: 99% das operações processadas em \< 5 minutos).  
  - Paginação e lazy-loading nas tabelas de pedidos para evitar cargas pesadas.  
  - Metalimit de chamadas concorrentes por tenant para evitar bloqueio de APIs externas.  
- Observabilidade e manutenção  
  - Métricas: taxa de sucesso/falha, latência média de jobs, uso de tokens expirados, filas acumuladas.  
  - Dashboards prontos em Grafana/Datadog.  
  - Playbook operacional para erros comuns (token expirado, schema mismatch, rate limit).

## Roadmap Sugerido

- MVP (Fase 1\) — 4–6 semanas (Implementar primeiro)  
  - Objetivo: entregar o fluxo crítico de valor — conectar Olist → ContaAzul e criar lançamentos automatizados para um tenant.  
  - Entregáveis mínimos:  
    - Onboarding de cliente (wizard básico).  
    - Conexão Olist (token) \+ conexão ContaAzul (OAuth/API key).  
    - Mapeamento mínimo: regras por marketplace e produto padrão.  
    - Worker de sincronização (fila) com idempotência e retry básico.  
    - Logs de auditoria e painel de Monitor de Sincronização.  
    - Criptografia de tokens e RLS básico via Supabase.  
    - Testes de integração end-to-end e documentação de uso.  
    - Deploy básico, alertas operacionais e monitoramento.  
- Melhorias futuras (Fase 2\) — 8–12 semanas  
  - Entregáveis:  
    - Dashboard analítico completo (receita por marketplace/SKU, gráficos).  
    - Painel multi-tenant para administradores (visão agregada).  
    - Regras avançadas de mapeamento (conditions, priorities, test mode).  
    - Notificações (email/Slack) e retry manual via UI.  
    - Modo sandbox/teste e import CSV para históricos.  
    - Suporte a múltiplos usuários por tenant com roles detalhadas.  
    - Refinamento de UX e animações (Framer Motion/GSAP), accessibility WCAG 2.1 completo.  
    - Hardened security (token rotation automático, alertas de segurança).  
- Visão de longo prazo (Fase 3\)

