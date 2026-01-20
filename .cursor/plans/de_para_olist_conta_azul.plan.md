# De-Para (Mapeamento) Olist → Conta Azul

## Visão Geral

Implementar sistema completo de de-para (mapeamento) para configurar como os dados da Olist serão transformados e enviados para a Conta Azul. O usuário deve poder configurar:

- Mapeamento de produtos/itens → contas de receita
- Mapeamento de marketplaces → contas específicas
- Mapeamento de taxas → contas de despesa
- Contas padrão para diferentes tipos de lançamentos
- Validação e teste de mapeamentos

## Objetivos

1. **Melhorar página de Mapeamentos** (`pages/Mappings.tsx`)

   - Adicionar modal/formulário para criar/editar regras
   - Integrar busca de contas do Conta Azul via API
   - Suporte a diferentes tipos de mapeamento (vendas, taxas, frete)
   - Visualização e ordenação por prioridade

2. **Criar serviço de API Conta Azul** (`services/contaAzulApiService.ts`)

   - Buscar contas financeiras disponíveis
   - Buscar categorias disponíveis
   - Validar contas antes de salvar mapeamentos
   - Cache de contas para melhor performance

3. **Expandir estrutura de mapeamento**

   - Adicionar suporte a tipos de lançamento (RECEITA, DESPESA, TAXA)
   - Adicionar contas padrão por tenant
   - Melhorar validação de regras

4. **Adicionar funcionalidades de teste**

   - Simular mapeamento com pedido de exemplo
   - Visualizar payload que será enviado ao Conta Azul
   - Validar regras antes de salvar

## Estrutura de Dados

### Tabela `mapping_rules` (expandir)

```sql
-- Campos existentes:
- id, tenant_id, name, condition_field, condition_value, target_account, priority, is_active

-- Campos a adicionar:
- lancamento_type TEXT CHECK (lancamento_type IN ('RECEITA', 'DESPESA', 'TAXA', 'FRETE'))
- conta_padrao BOOLEAN DEFAULT FALSE -- Se true, usa como fallback quando nenhuma regra específica aplicar
- config JSONB DEFAULT '{}' -- Configurações adicionais (ex: percentual de taxa, condições especiais)
  -- ⚠️ SEGURANÇA: Validar que config não contém tokens ou credenciais
  -- Aplicar constraint ou trigger para validar conteúdo do JSONB
```

### Nova tabela `tenant_conta_azul_config` (opcional)

```sql
CREATE TABLE IF NOT EXISTS public.tenant_conta_azul_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conta_receita_padrao TEXT, -- ID da conta padrão para receitas
    conta_despesa_padrao TEXT, -- ID da conta padrão para despesas
    conta_taxa_padrao TEXT, -- ID da conta padrão para taxas
    conta_frete_padrao TEXT, -- ID da conta padrão para frete
    criar_clientes_automaticamente BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}', -- ⚠️ SEGURANÇA: Validar que não contém tokens ou credenciais
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id)
);
```

## Componentes a Implementar

### 1. Serviço de API Conta Azul (`services/contaAzulApiService.ts`)

```typescript
export interface ContaAzulAccount {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  banco?: string;
}

export interface ContaAzulCategory {
  id: string;
  nome: string;
  tipo: string;
}

export const contaAzulApiService = {
  // ⚠️ SEGURANÇA: getToken() NUNCA deve retornar o token diretamente ao front-end
  // Deve fazer chamada para Edge Function que descriptografa server-side
  // O token só deve ser usado internamente nas requisições HTTP
  
  // ⚠️ SEGURANÇA CRÍTICA: Validação de tenantId
  // - Validar que tenantId pertence ao usuário autenticado ANTES de fazer requisição
  // - Edge Function deve validar RLS (Row Level Security) do Supabase
  // - Retornar erro 403 se usuário não tem acesso ao tenant
  async getAccounts(tenantId: string): Promise<ContaAzulAccount[]>,
  
  // Listar categorias
  // ⚠️ SEGURANÇA: Mesmas validações de tenantId acima
  async getCategories(tenantId: string): Promise<ContaAzulCategory[]>,
  
  // Validar conta existe
  // ⚠️ SEGURANÇA CRÍTICA: 
  // - Deve fazer chamada via Edge Function/RPC, nunca diretamente do front-end
  // - Validar que accountId pertence ao tenantId antes de validar
  // - Sanitizar accountId (remover caracteres especiais, validar formato UUID)
  // - Edge Function deve verificar isolamento de tenant (RLS)
  async validateAccount(tenantId: string, accountId: string): Promise<boolean>,
  
  // Simular criação de lançamento (teste)
  // ⚠️ SEGURANÇA CRÍTICA: 
  // - Payload retornado NÃO deve incluir tokens ou credenciais
  // - Headers de autenticação devem ser removidos antes de retornar
  // - Resposta deve ser sanitizada (remover Authorization, X-API-Key, etc.)
  // - Validar tenantId antes de processar
  // - Sanitizar payload de entrada (remover campos não esperados, validar tipos)
  async simulateLancamento(tenantId: string, payload: any): Promise<any>
}
```

### 2. Melhorar página de Mapeamentos (`pages/Mappings.tsx`)

**Funcionalidades:**

- Lista de regras com filtros (tipo, ativo/inativo)
- Botão "Nova Regra" abre modal de criação
- Edição inline ou via modal
- Busca de contas do Conta Azul via dropdown
- Ordenação por prioridade (drag & drop ou botões)
- Teste de regra com pedido de exemplo
- Visualização de payload gerado

**Modal de Criação/Edição:**

- Nome da regra
  - ⚠️ **SEGURANÇA**: Validar tamanho máximo (ex: 100 caracteres), sanitizar HTML
- Tipo de lançamento (Receita, Despesa, Taxa, Frete)
  - ⚠️ **SEGURANÇA**: Validar enum, não permitir valores customizados
- Campo de condição (Marketplace, SKU, Categoria, Nome do Produto)
  - ⚠️ **SEGURANÇA**: Validar enum, não permitir valores customizados que possam causar SQL injection
- Valor da condição (input ou select baseado no campo)
  - ⚠️ **SEGURANÇA**: Proteção contra XSS
    - Sanitizar HTML antes de exibir (usar biblioteca como DOMPurify)
    - Validar tamanho máximo (ex: 255 caracteres)
    - Validar formato baseado no campo (ex: SKU deve ser alfanumérico)
    - Escapar caracteres especiais antes de salvar
    - Se usar regex, validar que não há injection (escapar caracteres especiais)
- Conta destino (buscar do Conta Azul)
  - ⚠️ **SEGURANÇA**: Validar que accountId é UUID válido antes de salvar
- Prioridade (número)
  - ⚠️ **SEGURANÇA**: Validar range (ex: 0-9999), não permitir valores negativos ou muito grandes
- Marcar como conta padrão (checkbox)
- Botão "Testar Regra"

### 3. Expandir serviço de mapeamento (`services/mappingRuleService.ts`)

**Novos métodos:**

- `getDefaultAccount(tenantId, type)` - Buscar conta padrão por tipo
- `applyMapping(pedido, rules)` - Aplicar regras a um pedido e retornar mapeamento
  - ⚠️ **SEGURANÇA ADICIONAL**: 
    - Validar tamanho do pedido (não permitir payloads muito grandes)
    - Proteção contra DoS: limitar número de itens processados
    - Validar encoding de caracteres (UTF-8)
    - Tratar edge cases: null, undefined, arrays vazios
- `testRule(rule, pedidoExemplo)` - Testar regra com pedido de exemplo
  - ⚠️ **SEGURANÇA ADICIONAL**:
    - Limitar tamanho do pedido de exemplo
    - Validar que pedido de exemplo não contém dados reais sensíveis
    - Rate limiting: limitar número de testes por minuto
- `validateRules(tenantId)` - Validar todas as regras do tenant
  - ⚠️ **SEGURANÇA ADICIONAL**:
    - Proteção contra regex injection se usar regex em condition_value
    - Validar que regras não causam loops infinitos ou performance issues
    - Limitar número máximo de regras por tenant

### 4. Componente de busca de contas (`components/ContaAzulAccountSelector.tsx`)

**Funcionalidades:**

- Dropdown com busca de contas
- Loading state enquanto busca
- ⚠️ **SEGURANÇA**: Cache de contas (localStorage ou state)
  - Cachear APENAS dados públicos (id, nome, tipo, banco)
  - NUNCA cachear tokens, credenciais ou dados sensíveis
  - Validar TTL do cache (expirar após 1 hora)
- Filtro por tipo de conta
- Exibição de nome e tipo da conta

### 5. Página de configuração de contas padrão (opcional)

**Nova página:** `pages/ContaAzulConfig.tsx`

- Configurar contas padrão por tipo de lançamento
- Configurações gerais (criar clientes automaticamente, etc.)
- ⚠️ **SEGURANÇA**: Teste de conexão com Conta Azul
  - Deve fazer chamada via Edge Function/RPC
  - Retornar apenas status (conectado/desconectado/erro)
  - NUNCA retornar token ou credenciais
  - Mensagens de erro não devem expor detalhes de autenticação

## Fluxo de Implementação

### Fase 1: Serviço de API Conta Azul

1. Criar `services/contaAzulApiService.ts`
2. ⚠️ **SEGURANÇA CRÍTICA**: Implementar chamadas via Edge Function que obtém token server-side

   - NUNCA retornar token descriptografado ao front-end
   - Todas as requisições devem passar pela Edge Function que adiciona o token no header
   - Ou criar endpoints RPC no Supabase que fazem as chamadas internamente
   - **Validação de entrada**: Sanitizar e validar tenantId antes de usar
     - Validar formato UUID
     - Remover caracteres especiais
     - Verificar que não está vazio ou null
   - **Autorização**: Edge Function deve validar que usuário tem acesso ao tenant
     - Usar RLS do Supabase
     - Retornar 403 se acesso negado
   - **Validação de resposta**: Validar que resposta não contém tokens
     - Sanitizar resposta antes de retornar ao front-end
     - Validar estrutura de dados esperada

3. Implementar `getAccounts()` - Via Edge Function ou RPC (não expor token)

   - ⚠️ **SEGURANÇA**: Resposta deve conter apenas dados públicos (id, nome, tipo)
   - NUNCA incluir tokens ou credenciais na resposta

4. Implementar `getCategories()` - Via Edge Function ou RPC (não expor token)

   - ⚠️ **SEGURANÇA**: Resposta deve conter apenas dados públicos (id, nome, tipo)

5. Implementar cache de contas (localStorage com TTL) - Cachear apenas dados, nunca tokens

   - ⚠️ **SEGURANÇA CRÍTICA**: 
     - Validar que cache não contém tokens antes de salvar
     - Implementar sanitização antes de cachear
     - Adicionar prefixo ao cache: `ca_accounts_` para identificar origem
     - **Invalidação de cache**: Invalidar cache quando credenciais mudarem
     - **TTL rigoroso**: Cache deve expirar após 1 hora, não usar cache indefinido
     - **Validação de integridade**: Validar que dados do cache não foram corrompidos
     - **Limpeza de cache**: Limpar cache antigo periodicamente (evitar localStorage cheio)
     - **Isolamento por tenant**: Cache deve ser isolado por tenantId (chave: `ca_accounts_${tenantId}`)

6. Testar com tenant de exemplo

   - ⚠️ **SEGURANÇA**: Usar apenas dados de teste, nunca tokens reais em logs

### Fase 2: Expandir estrutura de dados

1. Criar migração SQL para adicionar campos em `mapping_rules`

   - ⚠️ **SEGURANÇA**: Adicionar trigger para validar conteúdo de `config` JSONB
   - Trigger deve rejeitar inserções/atualizações com campos sensíveis

2. Criar tabela `tenant_conta_azul_config` (se necessário)

   - ⚠️ **SEGURANÇA**: Adicionar trigger para validar `config` JSONB
   - Garantir RLS (Row Level Security) habilitado

3. Atualizar tipos TypeScript (`types.ts`)

   - ⚠️ **SEGURANÇA**: Adicionar tipos estritos para evitar dados inválidos
   - Validar tipos em runtime quando necessário

4. Atualizar serviço de mapeamento para suportar novos campos

   - ⚠️ **SEGURANÇA CRÍTICA**: Adicionar validação de entrada antes de salvar
     - Sanitizar dados antes de inserir no banco
     - Validar tamanho máximo de campos
     - Validar tipos de dados
     - Validar encoding UTF-8
     - Criar log de auditoria para todas as operações (create_audit_log)

### Fase 3: Melhorar página de Mapeamentos

1. Adicionar modal de criação/edição de regras

   - ⚠️ **SEGURANÇA**: Validar todos os campos do formulário antes de submeter
     - Validar tamanho máximo de cada campo
     - Sanitizar HTML em campos de texto
     - Validar tipos de dados (números, strings, enums)
     - Prevenir submissão dupla (desabilitar botão após submit)

2. Integrar `ContaAzulAccountSelector` no modal

   - ⚠️ **SEGURANÇA**: Validar que accountId selecionado pertence ao tenant correto

3. Adicionar campo de tipo de lançamento

   - ⚠️ **SEGURANÇA**: Validar enum, não permitir valores customizados

4. Adicionar campo de prioridade com ordenação

   - ⚠️ **SEGURANÇA**: Validar range numérico, prevenir valores inválidos

5. ⚠️ **SEGURANÇA**: Implementar funcionalidade de teste de regra

   - Teste deve usar dados sanitizados (sem tokens)
   - Chamadas de teste devem passar por Edge Function/RPC
   - Resultado do teste não deve incluir tokens ou headers de autenticação

6. Adicionar validações (conta existe, regras não conflitantes)

   - ⚠️ **SEGURANÇA**: Validação deve ser server-side, não expor tokens

### Fase 4: Funcionalidades avançadas

1. Implementar `applyMapping()` para testar regras
2. ⚠️ **SEGURANÇA**: Adicionar visualização de payload gerado

   - Payload exibido deve ser sanitizado (remover tokens, credenciais, headers de autenticação)
   - Mostrar apenas dados do lançamento (valores, contas, datas, descrições)
   - Nunca exibir `Authorization: Bearer ...` ou qualquer token

3. Implementar drag & drop para ordenação (opcional)
4. Adicionar filtros e busca na lista de regras
5. Adicionar exportação de regras (JSON/CSV) - Sem tokens ou credenciais

## Arquivos a Criar/Modificar

### Novos Arquivos

1. `services/contaAzulApiService.ts` - Serviço de API Conta Azul
2. `components/ContaAzulAccountSelector.tsx` - Componente de seleção de conta
3. `components/MappingRuleForm.tsx` - Formulário de criação/edição de regra
4. `pages/ContaAzulConfig.tsx` - Página de configuração (opcional)
5. `sql/migrations/015_expand_mapping_rules.sql` - Migração para expandir tabela

### Arquivos a Modificar

1. `pages/Mappings.tsx` - Adicionar modal e funcionalidades
2. `services/mappingRuleService.ts` - Adicionar novos métodos
3. `types.ts` - Expandir interface `MappingRule`
4. `supabase/functions/get-conta-azul-token/index.ts` - Criar se não existir

## ⚠️ Segurança: Proteção de Tokens

**IMPORTANTE**: Este plano deve garantir que tokens **NUNCA** sejam expostos no front-end:

1. **Todas as chamadas de API Conta Azul devem passar por Edge Functions ou RPCs**

   - Edge Function obtém token descriptografado server-side
   - Edge Function adiciona token no header da requisição
   - Front-end nunca recebe o token descriptografado

2. **Visualização de payload deve ser sanitizada**

   - Remover headers de autenticação
   - Remover tokens de qualquer parte do payload
   - Mostrar apenas dados do negócio (valores, contas, datas)

3. **Cache no front-end**

   - Cachear apenas dados (contas, categorias)
   - NUNCA cachear tokens ou credenciais
   - Usar localStorage apenas para dados não sensíveis

4. **Logs e Debug**

   - NUNCA fazer `console.log(token)` ou similar
   - Usar mascaramento em logs: `console.log('Token: ***ENCRYPTED***')`
   - ⚠️ **SEGURANÇA ADICIONAL**: 
     - Não logar objetos completos que possam conter tokens (`console.log(response)`)
     - Sanitizar objetos antes de logar: `console.log(sanitizeForLog(response))`
     - Remover campos sensíveis: `access_token`, `refresh_token`, `Authorization`, `X-API-Key`
     - Em produção, desabilitar logs detalhados ou usar biblioteca de logging segura

5. **Tratamento de Erros**

   - ⚠️ **SEGURANÇA CRÍTICA**: Mensagens de erro não devem expor tokens
   - Erros de autenticação: "Falha na autenticação" (não "Token inválido: abc123...")
   - Erros de API: "Erro ao conectar com Conta Azul" (não incluir detalhes de requisição com headers)
   - Não retornar stack traces completos em produção que possam conter tokens

6. **Estado React e Props**

   - ⚠️ **SEGURANÇA**: NUNCA armazenar tokens em estado React (`useState`, `useReducer`)
   - NUNCA passar tokens como props entre componentes
   - Se necessário armazenar temporariamente, usar `sessionStorage` com limpeza automática
   - Validar que componentes não acessam tokens diretamente do contexto global

7. **URLs e Parâmetros**

   - ⚠️ **SEGURANÇA**: NUNCA passar tokens em URLs (query params, hash)
   - NUNCA incluir tokens em `window.location` ou histórico do navegador
   - Validar que redirects OAuth não expõem tokens na URL após callback

8. **Validação de Entrada e Autorização**

   - ⚠️ **SEGURANÇA CRÍTICA**: Validar tenantId em TODAS as operações
     - Validar formato UUID antes de usar
     - Sanitizar entrada (remover caracteres especiais, trim whitespace)
     - Edge Functions devem validar RLS (Row Level Security)
     - Verificar que usuário autenticado tem acesso ao tenant
     - Retornar 403 (Forbidden) se acesso negado, não 404 (Not Found) para evitar enumeração
   - Validar accountId antes de usar
     - Validar formato UUID
     - Verificar que accountId pertence ao tenantId correto
   - Validar tipos de dados antes de processar
     - Validar tipos TypeScript em runtime
     - Rejeitar dados com tipos incorretos

9. **Isolamento de Dados (Tenant Isolation)**

   - ⚠️ **SEGURANÇA CRÍTICA**: Garantir isolamento completo entre tenants
     - Edge Functions devem usar RLS do Supabase
     - Validar que dados retornados pertencem ao tenantId correto
     - Não permitir acesso a dados de outros tenants mesmo com tenantId válido
     - Validar que IDs de conta retornados pertencem ao tenant correto
     - Implementar validação dupla: no Edge Function E no banco (RLS)

10. **Sanitização de Dados JSONB**

    - ⚠️ **SEGURANÇA**: Validar conteúdo de campos JSONB (`config`)
      - Criar função de validação que verifica ausência de tokens/credenciais
      - Aplicar trigger no banco para validar antes de inserir/atualizar
      - Lista negra de campos proibidos: `access_token`, `refresh_token`, `api_key`, `api_secret`, `token`, `password`, `secret`
      - Validar estrutura JSON antes de salvar

11. **Rate Limiting e Proteção contra Abuso**

    - ⚠️ **SEGURANÇA**: Implementar rate limiting nas Edge Functions
      - Limitar número de requisições por tenant por minuto
      - Limitar número de requisições por usuário por minuto
      - Retornar 429 (Too Many Requests) quando limite excedido
      - Não expor detalhes de rate limiting em mensagens de erro

12. **Validação de Resposta de Edge Functions**

    - ⚠️ **SEGURANÇA**: Validar resposta antes de usar no front-end
      - Verificar estrutura de dados esperada
      - Validar que não contém campos sensíveis
      - Sanitizar resposta mesmo que venha de Edge Function (defesa em profundidade)
      - Tratar erros de Edge Function sem expor detalhes internos

13. **Limpeza de Memória**

    - ⚠️ **SEGURANÇA**: Limpar dados sensíveis da memória quando não mais necessários
      - Não manter referências a objetos com tokens após uso
      - Limpar variáveis locais após operações críticas
      - Evitar vazamento de dados em closures ou callbacks

14. **Serialização Segura**

    - ⚠️ **SEGURANÇA**: Sanitizar dados antes de serializar para JSON
      - Remover campos sensíveis antes de `JSON.stringify()`
      - Validar estrutura antes de serializar
      - Não serializar objetos completos de resposta HTTP (podem conter headers)

15. **Proteção em Componentes Filhos**

    - ⚠️ **SEGURANÇA**: Validar dados antes de passar para componentes filhos
      - Não passar objetos completos de resposta HTTP como props
      - Passar apenas dados necessários e já sanitizados
      - Validar props em componentes filhos (PropTypes ou TypeScript strict)

16. **Proteção contra XSS (Cross-Site Scripting)**

    - ⚠️ **SEGURANÇA CRÍTICA**: Sanitizar todos os inputs do usuário
      - Usar biblioteca de sanitização HTML (DOMPurify) antes de exibir dados
      - Escapar caracteres especiais em inputs de texto
      - Validar e sanitizar `condition_value` antes de salvar
      - Não permitir HTML/JavaScript em campos de texto
      - Usar `dangerouslySetInnerHTML` apenas quando absolutamente necessário e com sanitização
      - Validar encoding UTF-8 em todos os inputs

17. **Proteção contra Regex Injection**

    - ⚠️ **SEGURANÇA**: Se usar regex em `condition_value`, proteger contra injection
      - Escapar caracteres especiais de regex antes de usar
      - Validar que regex não causa ReDoS (Regular Expression Denial of Service)
      - Limitar complexidade de regex (não permitir regex muito complexos)
      - Usar whitelist de padrões permitidos quando possível

18. **Validação de Tamanho e Limites**

    - ⚠️ **SEGURANÇA**: Implementar limites para prevenir DoS
      - Limitar tamanho máximo de payloads (ex: 1MB)
      - Limitar número de itens em arrays (ex: máximo 1000 itens)
      - Limitar tamanho de campos de texto (ex: nome máximo 100 caracteres)
      - Limitar número de regras por tenant (ex: máximo 100 regras)
      - Validar tamanho antes de processar, não durante

19. **Proteção contra Race Conditions**

    - ⚠️ **SEGURANÇA**: Proteger operações críticas contra condições de corrida
      - Usar debounce em operações de busca (evitar múltiplas requisições simultâneas)
      - Implementar locks ou filas para operações de escrita críticas
      - Validar estado antes de salvar (verificar se dados não mudaram)
      - Usar versionamento ou timestamps para detectar mudanças concorrentes

20. **Tratamento de Timeout e Erros de Rede**

    - ⚠️ **SEGURANÇA**: Tratar erros de rede sem expor tokens
      - Timeout configurável (ex: 30 segundos)
      - Retry com backoff exponencial (não exponha tokens em retries)
      - Mensagens de erro genéricas: "Erro de conexão" (não detalhes técnicos)
      - Não logar detalhes de requisições HTTP que falharam (podem conter headers)

21. **Validação de Encoding e Caracteres Especiais**

    - ⚠️ **SEGURANÇA**: Validar encoding de dados
      - Forçar UTF-8 em todos os inputs
      - Validar que strings não contêm caracteres de controle
      - Normalizar Unicode (NFD/NFC) para evitar problemas de comparação
      - Validar que dados não contêm caracteres que podem causar problemas em SQL/JSON

22. **Auditoria e Rastreabilidade**

    - ⚠️ **SEGURANÇA**: Registrar operações sensíveis
      - Logar criação/edição/exclusão de regras de mapeamento
      - Logar tentativas de acesso a dados de outros tenants (tentativas de violação)
      - Logar tentativas de inserir tokens em campos JSONB (tentativas de bypass)
      - Usar `create_audit_log` para todas as operações críticas
      - Não logar tokens ou credenciais, apenas ações e resultados

23. **Proteção de Dados em Trânsito**

    - ⚠️ **SEGURANÇA**: Garantir comunicação segura
      - Todas as comunicações devem usar HTTPS/TLS 1.2+
      - Validar certificados SSL em produção
      - Não permitir downgrade para HTTP
      - Validar que Edge Functions usam HTTPS

24. **Validação de Integridade de Dados**

    - ⚠️ **SEGURANÇA**: Validar que dados não foram alterados
      - Validar checksums ou hashes quando aplicável
      - Validar estrutura de dados antes de processar
      - Verificar que dados do cache não foram corrompidos
      - Validar que dados do banco não foram alterados externamente

25. **Tratamento de Edge Cases**

    - ⚠️ **SEGURANÇA**: Tratar casos especiais que podem causar vulnerabilidades
      - Validar null/undefined antes de usar (evitar null pointer exceptions)
      - Validar arrays vazios antes de iterar
      - Validar objetos vazios antes de acessar propriedades
      - Tratar casos onde tenantId é null/undefined (retornar erro, não processar)
      - Validar que accountId não é string vazia ou apenas espaços

26. **Proteção CSRF (Cross-Site Request Forgery)**

    - ⚠️ **SEGURANÇA**: Proteger contra requisições CSRF
      - Edge Functions devem validar origem das requisições
      - Validar headers `Origin` e `Referer` quando disponíveis
      - Usar tokens CSRF em formulários críticos (opcional, mas recomendado)
      - Validar que requisições vêm do domínio esperado

27. **Validação de Sessão e Autenticação**

    - ⚠️ **SEGURANÇA CRÍTICA**: Validar sessão em todas as operações
      - Edge Functions devem validar token JWT do Supabase
      - Verificar que sessão não expirou antes de processar
      - Invalidar cache quando sessão expirar
      - Não processar requisições sem autenticação válida

28. **Content Security Policy (CSP)**

    - ⚠️ **SEGURANÇA**: Implementar CSP para prevenir XSS
      - Configurar headers CSP no servidor/Edge Functions
      - Restringir fontes de scripts, styles, imagens
      - Prevenir inline scripts/styles não autorizados
      - Validar que aplicação funciona com CSP restritivo

29. **Validação de CORS**

    - ⚠️ **SEGURANÇA**: Configurar CORS corretamente
      - Edge Functions devem validar origem das requisições
      - Permitir apenas origens conhecidas e confiáveis
      - Não usar `Access-Control-Allow-Origin: *` em produção
      - Validar métodos HTTP permitidos (GET, POST, etc.)

30. **Proteção contra Clickjacking**

    - ⚠️ **SEGURANÇA**: Prevenir embedding em iframes maliciosos
      - Usar header `X-Frame-Options: DENY` ou `SAMEORIGIN`
      - Validar que páginas críticas não podem ser embedadas
      - Considerar usar CSP `frame-ancestors` directive

31. **Validação de Integridade de Requisições**

    - ⚠️ **SEGURANÇA**: Validar que requisições não foram alteradas
      - Validar estrutura de payload antes de processar
      - Verificar que campos obrigatórios estão presentes
      - Validar tipos de dados em runtime
      - Rejeitar payloads com campos inesperados (fail-safe)

32. **Proteção contra Enumeração de Recursos**

    - ⚠️ **SEGURANÇA**: Prevenir descoberta de recursos por tentativa e erro
      - Retornar 403 em vez de 404 para recursos não autorizados
      - Não expor diferenças entre "não existe" e "sem permissão"
      - Rate limiting em tentativas de acesso não autorizado
      - Logar tentativas de acesso não autorizado para análise

33. **Validação de Dependências e Bibliotecas**

    - ⚠️ **SEGURANÇA**: Garantir que dependências são seguras
      - Auditar dependências regularmente (npm audit, Snyk)
      - Manter bibliotecas atualizadas (especialmente sanitização, validação)
      - Usar versões específicas, não ranges amplos (`^`, `~`)
      - Validar integridade de pacotes (package-lock.json)

34. **Validação de Versão de API**

    - ⚠️ **SEGURANÇA**: Validar compatibilidade de versões
      - Edge Functions devem validar versão da API Conta Azul esperada
      - Tratar mudanças de API que podem expor dados
      - Validar formato de resposta antes de processar
      - Implementar fallback seguro se API mudar

35. **Proteção contra Cache Poisoning**

    - ⚠️ **SEGURANÇA**: Prevenir envenenamento de cache
      - Validar dados antes de cachear (não cachear dados inválidos)
      - Invalidar cache quando dados mudarem no servidor
      - Usar chaves de cache específicas por tenant (evitar vazamento)
      - Validar integridade de dados do cache antes de usar

36. **Validação de Serialização/Deserialização**

    - ⚠️ **SEGURANÇA**: Validar dados ao serializar/deserializar
      - Validar JSON antes de `JSON.parse()` (evitar JSON injection)
      - Sanitizar dados antes de `JSON.stringify()`
      - Validar profundidade máxima de objetos JSON (prevenir stack overflow)
      - Validar tamanho máximo de JSON antes de processar

37. **Proteção contra Timing Attacks**

    - ⚠️ **SEGURANÇA**: Prevenir ataques de timing
      - Usar comparação de strings constante-time quando comparar tokens/hashes
      - Não expor diferenças de tempo entre "não existe" e "sem permissão"
      - Implementar delays aleatórios em respostas de erro (opcional, mas ajuda)

38. **Validação de Contexto de Execução**

    - ⚠️ **SEGURANÇA**: Validar contexto antes de executar operações
      - Verificar que código está rodando no ambiente esperado (não em iframe malicioso)
      - Validar que requisições vêm do front-end legítimo
      - Verificar headers de segurança (Origin, Referer) quando disponíveis
      - Validar que não há modificação de código em runtime

39. **Proteção de Dados Sensíveis em Logs de Debug**

    - ⚠️ **SEGURANÇA**: Garantir que logs de debug não expõem dados
      - Desabilitar logs detalhados em produção
      - Usar níveis de log (DEBUG, INFO, WARN, ERROR)
      - Sanitizar dados antes de logar em qualquer nível
      - Não logar payloads completos, apenas resumos

40. **Validação de Estado da Aplicação**

    - ⚠️ **SEGURANÇA**: Validar estado antes de operações críticas
      - Verificar que aplicação está em estado válido antes de processar
      - Validar que configurações de segurança estão ativas
      - Verificar que RLS está habilitado antes de fazer queries
      - Validar que Edge Functions estão configuradas corretamente

## Considerações Técnicas

### Autenticação

- ⚠️ **SEGURANÇA CRÍTICA**: 
  - Usar Edge Function `get-conta-azul-token` para obter token **server-side apenas**
  - Token **NUNCA** deve ser retornado ao front-end ou armazenado em estado React
  - Todas as chamadas de API devem passar por Edge Functions ou RPCs que adicionam o token internamente
  - Token deve ser renovado automaticamente quando expirar (server-side)
  - Cachear token por alguns minutos **apenas no servidor** (Edge Function), nunca no cliente

### Performance

- Cachear lista de contas do Conta Azul (localStorage com TTL de 1 hora)
- Buscar contas apenas quando necessário (lazy loading)
- Debounce em busca de contas no dropdown

### Validação

- ⚠️ **SEGURANÇA CRÍTICA**: Validar que conta existe no Conta Azul antes de salvar regra
  - Validação deve ser feita via Edge Function/RPC server-side
  - NUNCA fazer chamada direta à API Conta Azul do front-end
  - Retornar apenas boolean (existe/não existe), sem detalhes de autenticação
  - **Validação de entrada**: Sanitizar e validar accountId (formato UUID)
  - **Isolamento**: Verificar que accountId pertence ao tenantId correto
  - **Autorização**: Validar que usuário tem acesso ao tenant antes de validar conta
- Verificar conflitos de regras (mesma condição, diferentes contas)
  - ⚠️ **SEGURANÇA**: Validação deve considerar apenas regras do tenant atual
- Validar prioridade única (opcional)
  - ⚠️ **SEGURANÇA**: Validação deve ser isolada por tenant

### UX

- Loading states em todas as operações assíncronas
- Mensagens de erro claras
  - ⚠️ **SEGURANÇA**: Mensagens devem ser genéricas, não expor detalhes técnicos ou tokens
- Confirmação antes de deletar regra
  - ⚠️ **SEGURANÇA**: Validar permissões antes de permitir exclusão
- Feedback visual ao salvar/atualizar regra
  - ⚠️ **SEGURANÇA**: Não exibir dados sensíveis em mensagens de sucesso

## Próximos Passos

1. ✅ Criar serviço de API Conta Azul
2. ✅ Criar migração SQL para expandir `mapping_rules`
3. ✅ Atualizar tipos TypeScript
4. ✅ Criar componente de seleção de conta
5. ✅ Melhorar página de Mapeamentos com modal
6. ✅ Implementar funcionalidade de teste de regra
7. ✅ Testar com tenant de exemplo
8. ✅ Documentar uso do de-para