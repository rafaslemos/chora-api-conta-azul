# Google Sheets - Acesso e Segurança das Planilhas

## Problema Central

Como o n8n (ou Supabase) teria acesso às planilhas privadas dos clientes? Existem várias abordagens, cada uma com implicações diferentes de segurança e complexidade.

## Opções de Acesso

### Opção 1: n8n Acessa Diretamente via OAuth (Recomendado)

**Como funciona:**
- n8n tem uma credencial Google OAuth configurada
- Cliente autoriza essa credencial a acessar suas planilhas
- n8n lê planilhas diretamente usando Google Sheets API

**Fluxo de Autorização:**
```
1. Cliente configura integração no wizard
2. Sistema gera link de autorização Google
3. Cliente autoriza acesso às planilhas
4. Google retorna tokens
5. Tokens são salvos no n8n (ou no Supabase)
6. n8n usa tokens para ler planilhas
```

**Vantagens:**
- ✅ **Seguro** - Cada cliente autoriza apenas suas próprias planilhas
- ✅ **Isolamento** - Tokens por cliente/tenant
- ✅ **Padrão OAuth** - Seguindo melhores práticas
- ✅ **n8n gerencia tokens** - Renovação automática

**Desvantagens:**
- ⚠️ **Complexidade** - Precisa gerenciar OAuth por tenant
- ⚠️ **Múltiplas credenciais** - Uma credencial Google por tenant (ou compartilhada)

---

### Opção 2: Supabase Acessa e Envia Dados para n8n

**Como funciona:**
- Supabase Edge Function lê planilha via Google Sheets API
- Edge Function envia dados processados para n8n
- n8n apenas processa dados, não acessa planilha diretamente

**Fluxo:**
```
1. Cliente autoriza Supabase (não n8n) a acessar planilhas
2. Tokens salvos no Supabase (tenant_credentials)
3. Edge Function lê planilha usando tokens
4. Edge Function envia dados para n8n via webhook
5. n8n processa dados e cria vendas
```

**Vantagens:**
- ✅ **Controle total** - Tokens no nosso banco
- ✅ **Segurança** - n8n não precisa de acesso direto
- ✅ **Auditoria** - Podemos logar todos os acessos

**Desvantagens:**
- ⚠️ **Mais código** - Edge Function precisa ler planilha
- ⚠️ **Mais latência** - Camada extra de processamento
- ⚠️ **Custo** - Edge Functions têm limites

---

### Opção 3: Planilha Pública (NÃO RECOMENDADO)

**Como funciona:**
- Cliente torna planilha pública (qualquer um pode ver)
- n8n acessa sem autenticação
- Lê dados diretamente

**Vantagens:**
- ✅ **Simples** - Sem OAuth
- ✅ **Rápido** - Sem autenticação

**Desvantagens:**
- ❌ **INSEGURO** - Dados expostos publicamente
- ❌ **Não recomendado** - Violação de privacidade
- ❌ **Não escalável** - Não funciona para dados sensíveis

**Quando usar:** ❌ **NUNCA** para dados reais. Apenas para testes/protótipos.

---

### Opção 4: Compartilhamento de Planilha com Conta Google

**Como funciona:**
- Criar uma conta Google específica para o sistema (ex: `bpo-integracao@empresa.com`)
- Cliente compartilha planilha com essa conta
- n8n usa credencial dessa conta para acessar todas as planilhas

**Fluxo:**
```
1. Criar conta Google: bpo-integracao@empresa.com
2. Configurar OAuth dessa conta no n8n
3. Cliente compartilha planilha com bpo-integracao@empresa.com
4. n8n acessa todas as planilhas compartilhadas
```

**Vantagens:**
- ✅ **Simples** - Uma única credencial
- ✅ **Fácil de gerenciar** - Cliente apenas compartilha planilha
- ✅ **n8n gerencia OAuth** - Automático

**Desvantagens:**
- ⚠️ **Conta compartilhada** - Todos os clientes compartilham com mesma conta
- ⚠️ **Dependência** - Se conta for comprometida, todas planilhas afetadas
- ⚠️ **Menos isolamento** - Todos acessam via mesma credencial

**Quando usar:** ✅ **RECOMENDADO para MVP** - Mais simples e prático

---

## Comparação Detalhada

| Aspecto | Opção 1 (n8n OAuth) | Opção 2 (Supabase) | Opção 3 (Pública) | Opção 4 (Compartilhada) |
|---------|---------------------|-------------------|------------------|------------------------|
| **Segurança** | ✅✅ Alta | ✅✅ Alta | ❌ Nenhuma | ⚠️ Média |
| **Complexidade** | ⚠️ Alta | ⚠️ Alta | ✅ Baixa | ✅ Baixa |
| **Isolamento** | ✅✅ Total | ✅✅ Total | ❌ Nenhum | ⚠️ Parcial |
| **Facilidade Setup** | ⚠️ Média | ⚠️ Média | ✅ Muito fácil | ✅✅ Muito fácil |
| **Escalabilidade** | ✅✅ Alta | ✅✅ Alta | ✅ Alta | ✅ Alta |
| **Recomendação MVP** | ⚠️ Não | ⚠️ Não | ❌ Não | ✅✅ **SIM** |
| **Recomendação Prod** | ✅✅ **SIM** | ✅ Sim | ❌ Não | ⚠️ Se aceitável |

---

## Implementação Recomendada: Opção 4 (MVP) → Opção 1 (Produção)

### Fase 1: MVP - Opção 4 (Compartilhamento)

**Configuração:**

1. **Criar conta Google para integração:**
   - Email: `bpo-integracao@suasempresa.com`
   - Senha forte
   - 2FA ativado

2. **Configurar OAuth no n8n:**
   - Ir em n8n → Settings → Credentials
   - Adicionar "Google Sheets OAuth2 API"
   - Conectar com `bpo-integracao@suasempresa.com`
   - Autorizar escopos necessários

3. **Cliente compartilha planilha:**
   - Cliente abre planilha no Google Sheets
   - Clica em "Compartilhar"
   - Adiciona email: `bpo-integracao@suasempresa.com`
   - Permissão: "Visualizador" (apenas leitura)

4. **n8n acessa planilha:**
   - Workflow usa credencial configurada
   - Lê planilha compartilhada
   - Processa dados

**Código no Wizard:**

```typescript
const SheetsIntegrationWizard: React.FC = () => {
  const INTEGRATION_EMAIL = 'bpo-integracao@suasempresa.com';

  return (
    <div>
      <h2>Passo 1: Compartilhar Planilha</h2>
      <p>
        Para que possamos acessar sua planilha, você precisa compartilhá-la com:
      </p>
      <div className="bg-gray-100 p-4 rounded">
        <code>{INTEGRATION_EMAIL}</code>
        <button onClick={copyToClipboard}>Copiar</button>
      </div>
      <ol>
        <li>Abra sua planilha no Google Sheets</li>
        <li>Clique em "Compartilhar" (canto superior direito)</li>
        <li>Cole o email acima</li>
        <li>Defina permissão como "Visualizador"</li>
        <li>Clique em "Enviar"</li>
      </ol>
      <input
        type="text"
        placeholder="Cole a URL da planilha compartilhada"
        value={sheetUrl}
        onChange={(e) => setSheetUrl(e.target.value)}
      />
    </div>
  );
};
```

**Validação:**

```typescript
// Verificar se planilha está compartilhada
const validateSheetAccess = async (sheetId: string) => {
  // Tentar ler planilha via n8n ou Supabase
  // Se conseguir ler, está compartilhada corretamente
  // Se não conseguir, mostrar erro
};
```

---

### Fase 2: Produção - Opção 1 (OAuth por Tenant)

**Configuração:**

1. **Criar OAuth App no Google Cloud:**
   - Um OAuth app para toda a plataforma
   - Redirect URI: `https://seu-dominio.com/auth/google-sheets/callback`

2. **Cliente autoriza no wizard:**
   - Cliente clica em "Conectar com Google"
   - Autoriza acesso às planilhas
   - Tokens salvos em `tenant_credentials` (platform: 'GOOGLE_SHEETS')

3. **n8n usa tokens dinamicamente:**
   - Workflow busca tokens do Supabase
   - Usa tokens específicos do tenant
   - Acessa apenas planilhas autorizadas

**Estrutura de Tokens:**

```sql
-- tenant_credentials
{
  "tenant_id": "tenant-1",
  "platform": "GOOGLE_SHEETS",
  "access_token": "encrypted...",
  "refresh_token": "encrypted...",
  "config": {
    "authorized_sheets": [
      "sheet-id-1",
      "sheet-id-2"
    ]
  }
}
```

**Workflow n8n Modificado:**

```javascript
// Nó: Buscar Token do Tenant
const integration = $input.first().json;
const tenantId = integration.tenant_id;

// Chamar Supabase para buscar token descriptografado
const tokenResponse = await fetch(
  `${SUPABASE_URL}/functions/v1/get-google-sheets-token`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-api-key': SYSTEM_API_KEY,
    },
    body: JSON.stringify({ tenant_id: tenantId }),
  }
);

const { access_token } = await tokenResponse.json();

// Usar token para acessar planilha
// (n8n pode usar token customizado no Google Sheets node)
```

---

## Opção 2 Detalhada: Supabase Acessa e Envia para n8n

### Arquitetura

```
Cliente autoriza Supabase
    ↓
Tokens salvos no Supabase (tenant_credentials)
    ↓
Edge Function: read-sheets-data
    ↓
Lê planilha via Google Sheets API
    ↓
Envia dados para n8n via webhook
    ↓
n8n processa dados
```

### Edge Function: `read-sheets-data`

**`supabase/functions/read-sheets-data/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

serve(async (req) => {
  try {
    const { integration_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar integração
    const { data: integration } = await supabase
      .from('sheets_integrations')
      .select('*, tenant_id')
      .eq('id', integration_id)
      .single();

    // 2. Buscar token do Google Sheets
    const { data: cred } = await supabase.rpc(
      'get_tenant_credential_decrypted',
      {
        p_tenant_id: integration.tenant_id,
        p_platform: 'GOOGLE_SHEETS',
      }
    );

    if (!cred || cred.length === 0) {
      throw new Error('Credenciais não encontradas');
    }

    // 3. Ler planilha via Google Sheets API
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${integration.sheet_id}/values/${integration.range}`;
    
    const sheetResponse = await fetch(sheetUrl, {
      headers: {
        'Authorization': `Bearer ${cred[0].access_token}`,
      },
    });

    if (!sheetResponse.ok) {
      // Tentar renovar token se expirado
      if (sheetResponse.status === 401) {
        // Renovar token e tentar novamente
        // ...
      }
      throw new Error(`Erro ao ler planilha: ${sheetResponse.status}`);
    }

    const sheetData = await sheetResponse.json();

    // 4. Filtrar linhas novas
    const lastProcessed = integration.last_processed_row || 0;
    const newRows = sheetData.values
      .map((row, index) => ({
        row_number: index + 2,
        data: row,
      }))
      .filter(row => row.row_number > lastProcessed);

    // 5. Enviar para n8n via webhook
    const n8nWebhookUrl = `${process.env.N8N_WEBHOOK_URL}/sheets-process`;
    
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        integration_id: integration_id,
        rows: newRows,
        tenant_id: integration.tenant_id,
      }),
    });

    if (!n8nResponse.ok) {
      throw new Error('Erro ao enviar para n8n');
    }

    const n8nResult = await n8nResponse.json();

    // 6. Atualizar last_processed_row
    if (newRows.length > 0) {
      const lastRow = newRows[newRows.length - 1].row_number;
      await supabase
        .from('sheets_integrations')
        .update({ last_processed_row: lastRow })
        .eq('id', integration_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        rows_sent: newRows.length,
        n8n_result: n8nResult,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

**Vantagens desta abordagem:**
- ✅ Tokens ficam no Supabase (nosso controle)
- ✅ n8n não precisa de acesso direto
- ✅ Podemos logar todos os acessos
- ✅ Mais seguro (tokens criptografados)

**Desvantagens:**
- ⚠️ Mais código para manter
- ⚠️ Mais latência (camada extra)
- ⚠️ Custo de Edge Functions

---

## Recomendação Final

### Para MVP: **Opção 4 (Compartilhamento)**

**Por quê:**
- ✅ Mais simples de implementar
- ✅ Cliente apenas compartilha planilha
- ✅ n8n gerencia OAuth automaticamente
- ✅ Funciona imediatamente

**Implementação:**
1. Criar conta Google: `bpo-integracao@empresa.com`
2. Configurar OAuth dessa conta no n8n
3. Cliente compartilha planilha com essa conta
4. n8n acessa planilhas compartilhadas

### Para Produção: **Opção 1 (OAuth por Tenant)**

**Por quê:**
- ✅✅ Máxima segurança
- ✅✅ Isolamento total por tenant
- ✅✅ Seguindo melhores práticas
- ✅✅ Escalável

**Implementação:**
1. OAuth próprio (Opção B detalhada anteriormente)
2. Cada cliente autoriza suas próprias planilhas
3. Tokens salvos por tenant
4. n8n usa tokens dinamicamente

---

## Checklist de Segurança

### ✅ Boas Práticas

- [ ] Tokens sempre criptografados no banco
- [ ] Renovação automática de tokens
- [ ] Logs de acesso às planilhas
- [ ] Permissões mínimas necessárias (apenas leitura)
- [ ] Validação de permissões antes de acessar
- [ ] Timeout em requisições
- [ ] Rate limiting

### ❌ Evitar

- [ ] Planilhas públicas
- [ ] Tokens em texto plano
- [ ] Compartilhar planilhas com permissão de edição
- [ ] Uma única credencial para todos (se possível)
- [ ] Tokens expostos em logs

---

## Resumo das Opções

| Opção | Segurança | Complexidade | Recomendação |
|-------|-----------|--------------|--------------|
| **1. n8n OAuth por tenant** | ✅✅ Alta | ⚠️ Alta | ✅✅ Produção |
| **2. Supabase lê e envia** | ✅✅ Alta | ⚠️ Alta | ✅ Se não usar n8n |
| **3. Planilha pública** | ❌ Nenhuma | ✅ Baixa | ❌ Nunca |
| **4. Compartilhamento** | ⚠️ Média | ✅ Baixa | ✅✅ MVP |

**Estratégia Recomendada:**
1. **Começar com Opção 4** (MVP rápido)
2. **Migrar para Opção 1** (quando escalar)

