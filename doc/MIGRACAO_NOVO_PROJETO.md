# Guia de Migração para o Novo Projeto Supabase

## Visão Geral

Este guia descreve como migrar do projeto Supabase atual para o novo projeto dedicado ao app exclusivo Conta Azul.

## Principais Mudanças

1. **Novo projeto Supabase**: Projeto completamente novo e separado
2. **Schemas dedicados**: Dados organizados em `app_core`, `integrations` (futuro) e `dw`
3. **Múltiplas credenciais**: Cada tenant pode ter N credenciais Conta Azul, cada uma com nome amigável
4. **API DW**: Nova API read-only para acesso ao Data Warehouse via API Key única por cliente
5. **OAuth seguro**: CLIENT_SECRET movido para Edge Function (não mais exposto no frontend)

## Checklist de Migração

### 1. Provisionar Novo Projeto

Siga o guia em `doc/PROVISIONAMENTO_NOVO_SUPABASE.md` para:
- [ ] Criar novo projeto Supabase
- [ ] Configurar variáveis de ambiente
- [ ] Configurar exposed schemas
- [ ] Aplicar todas as migrations SQL

### 2. Atualizar Variáveis de Ambiente do App

Atualize `.env.local`:

```env
# ⚠️ IMPORTANTE: Use as credenciais do NOVO projeto
VITE_SUPABASE_URL=https://novo-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=nova-anon-key-aqui
VITE_CONTA_AZUL_REDIRECT_URI=http://localhost:5173/auth/conta-azul/callback
```

### 3. Deploy das Edge Functions

Execute:

```bash
supabase functions deploy exchange-conta-azul-token
supabase functions deploy get-conta-azul-accounts
supabase functions deploy get-conta-azul-categories
supabase functions deploy get-valid-token
supabase functions deploy dw-api
```

### 4. Migrar Dados (Se Necessário)

Se você precisa migrar dados do projeto antigo:

1. **Exportar dados do projeto antigo**:
   ```sql
   -- Exportar tenants
   COPY (SELECT * FROM tenants) TO '/tmp/tenants.csv' CSV HEADER;
   
   -- Exportar profiles
   COPY (SELECT * FROM profiles) TO '/tmp/profiles.csv' CSV HEADER;
   ```

2. **Importar no novo projeto**:
   - Use a interface do Supabase ou scripts SQL
   - Certifique-se de manter os UUIDs se necessário (ou gerar novos)

3. **Migrar credenciais**:
   - ⚠️ ATENÇÃO: Tokens criptografados podem não ser migráveis diretamente
   - Considere pedir aos clientes para reautenticar no novo sistema
   - Ou use a mesma chave de criptografia (não recomendado em produção)

### 5. Testar Funcionalidades

- [ ] Login/Registro de usuários
- [ ] Criação de tenants
- [ ] Autenticação OAuth Conta Azul
- [ ] Listagem de credenciais múltiplas
- [ ] Teste de conexão com Conta Azul
- [ ] API do DW (se configurada)

### 6. Atualizar URLs de OAuth

No portal de desenvolvedor da Conta Azul, atualize as URLs de redirect para apontar para o novo domínio/projeto.

### 7. Atualizar n8n (Se Aplicável)

Se você usa n8n, atualize as chamadas às Edge Functions para usar:
- `get-valid-token` com `credential_id` em vez de `tenant_id + platform`
- Novos endpoints com o novo `SUPABASE_URL`

## Notas Importantes

- **Não há compatibilidade retroativa**: O novo schema é incompatível com o antigo
- **Reautenticação necessária**: Clientes precisarão reautenticar no novo sistema
- **Testes obrigatórios**: Teste todas as funcionalidades antes de migrar usuários reais
- **Backup**: Mantenha o projeto antigo ativo até confirmar que tudo funciona no novo

## Troubleshooting

### Edge Functions não encontram tabelas

Certifique-se de que:
- Os schemas estão nos "exposed schemas" do Supabase
- As tabelas foram criadas no schema correto (`app_core.tenant_credentials`, não `public.tenant_credentials`)

### Erro "Credencial não encontrada"

Verifique:
- Se o `credential_id` está correto
- Se a credencial não foi revogada (`revoked_at IS NULL`)
- Se o RLS está configurado corretamente

### OAuth não funciona

Verifique:
- URLs de redirect configuradas corretamente na Conta Azul
- Variáveis `CA_CLIENT_ID` e `CA_CLIENT_SECRET` configuradas nas Edge Functions
- URL de redirect no `.env.local` corresponde exatamente à configurada na Conta Azul
