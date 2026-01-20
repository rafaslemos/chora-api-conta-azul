# Documentação do Banco de Dados

## Visão Geral

Este documento descreve a estrutura completa do banco de dados Supabase para a plataforma BPO Olist-ContaAzul.

## Estrutura de Tabelas

### 1. `profiles`
Perfis de usuários parceiros e administradores.

**Campos principais:**
- `id`: UUID (FK para auth.users)
- `full_name`: Nome completo
- `cnpj`: CNPJ único
- `phone`: Telefone
- `company_name`: Nome da empresa
- `role`: 'PARTNER' ou 'ADMIN'

**RLS:** Usuários veem apenas seu próprio perfil, ADMIN vê todos.

### 2. `tenants`
Clientes/empresas gerenciadas pelos parceiros.

**Campos principais:**
- `id`: UUID
- `name`: Nome da empresa
- `cnpj`: CNPJ único
- `email`: Email de contato
- `status`: 'ACTIVE', 'INACTIVE', 'SUSPENDED'
- `plan`: 'BASIC', 'PRO', 'ENTERPRISE'
- `partner_id`: FK para profiles.id

**RLS:** Parceiros veem apenas seus próprios tenants.

### 3. `tenant_credentials`
Credenciais de API por tenant e plataforma.

**Campos principais:**
- `id`: UUID
- `tenant_id`: FK para tenants
- `platform`: 'OLIST', 'CONTA_AZUL', 'HOTMART', etc.
- `access_token`: Token de acesso (criptografado)
- `refresh_token`: Token de refresh (criptografado)
- `api_key`, `api_secret`: Chaves de API (criptografadas)

**RLS:** Parceiros veem apenas credenciais de seus tenants.

### 4. `integration_flows`
Fluxos de integração configurados por tenant.

**Campos principais:**
- `id`: UUID
- `tenant_id`: FK para tenants
- `name`: Nome do fluxo
- `source`: Plataforma origem
- `destination`: Plataforma destino
- `active`: Se está ativo
- `config`: Configurações em JSON
- `n8n_workflow_id`: ID do workflow no n8n

**RLS:** Isolamento por tenant.

### 5. `mapping_rules`
Regras de mapeamento de produtos/categorias para contas do ContaAzul.

**Campos principais:**
- `id`: UUID
- `tenant_id`: FK para tenants
- `name`: Nome da regra
- `condition_field`: Campo de condição ('CATEGORY', 'MARKETPLACE', 'SKU')
- `condition_value`: Valor da condição
- `target_account`: Conta do ContaAzul
- `priority`: Prioridade da regra

**RLS:** Isolamento por tenant.

### 6. `sync_jobs`
Jobs de sincronização executados para cada tenant.

**Campos principais:**
- `id`: UUID
- `tenant_id`: FK para tenants
- `type`: Tipo de sync ('ORDER_SYNC', 'PRODUCT_SYNC', etc.)
- `status`: 'PENDING', 'RUNNING', 'SUCCESS', 'ERROR'
- `items_processed`: Quantidade de itens processados
- `error_message`: Mensagem de erro (se houver)
- `retry_count`: Número de tentativas

**RLS:** Isolamento por tenant.

### 7. `audit_logs`
Logs imutáveis de auditoria para compliance.

**Campos principais:**
- `id`: UUID
- `tenant_id`: FK para tenants (nullable)
- `user_id`: FK para auth.users (nullable)
- `action`: Ação realizada
- `entity_type`: Tipo de entidade afetada
- `entity_id`: ID da entidade
- `status`: 'SUCCESS', 'ERROR', 'WARNING'
- `details`: Detalhes adicionais
- `ip_address`, `user_agent`: Informações de sessão

**RLS:** Parceiros veem apenas logs de seus tenants.

### 8. `user_sessions`
Registro de sessões de usuário para auditoria de segurança.

**Campos principais:**
- `id`: UUID
- `user_id`: FK para auth.users
- `ip_address`: IP da sessão
- `user_agent`: User agent do navegador
- `expires_at`: Data de expiração

**RLS:** Usuários veem apenas suas próprias sessões.

## Funções Principais

### `handle_new_user()`
Cria perfil automaticamente quando um novo usuário se cadastra no Supabase Auth.

### `update_updated_at_column()`
Atualiza o campo `updated_at` automaticamente em todas as tabelas.

### `encrypt_token()` / `decrypt_token()`
Criptografa e descriptografa tokens usando pgcrypto.

**⚠️ IMPORTANTE:** Em produção, use uma chave segura armazenada no Supabase Vault, não a chave padrão.

### `create_audit_log()`
Cria logs de auditoria de forma padronizada.

## Triggers

- **on_auth_user_created**: Cria perfil automaticamente após signup
- **update_*_updated_at**: Atualiza `updated_at` em todas as tabelas relevantes

## Row Level Security (RLS)

Todas as tabelas têm RLS habilitado com políticas que garantem:

1. **Isolamento por tenant**: Parceiros só veem dados de seus próprios tenants
2. **Privacidade de perfil**: Usuários só veem seu próprio perfil
3. **Privilégios de ADMIN**: Administradores podem ver tudo
4. **Logs imutáveis**: Apenas sistema pode criar logs, apenas ADMIN pode deletar

## Índices

Índices criados para otimizar consultas frequentes:

- Busca de tenants por parceiro
- Busca de credenciais por tenant e plataforma
- Busca de jobs por status e data
- Busca de logs por tenant e data
- E outros índices estratégicos

## Como Aplicar o Schema

1. Acesse o **SQL Editor** no Supabase Dashboard
2. Abra o arquivo `sql/schema.sql`
3. Cole todo o conteúdo no editor
4. Execute o script
5. Verifique se todas as tabelas foram criadas na aba **Table Editor**

## Configurações Adicionais no Supabase

### 1. Habilitar Email Confirmation
- Vá em **Authentication > Settings**
- Ative **Enable email confirmations**
- Configure as URLs de redirecionamento:
  - Confirmação: `http://localhost:3000/auth/confirm`
  - Reset de senha: `http://localhost:3000/auth/reset-password`

### 2. Configurar Templates de Email (Opcional)
- Vá em **Authentication > Email Templates**
- Personalize os templates de:
  - Confirmação de email
  - Reset de senha
  - Mudança de email

### 3. Configurar Rate Limiting (Opcional)
- Vá em **Settings > API**
- Configure limites de taxa para proteger contra abuso

## Segurança

### Criptografia de Tokens
Os tokens são armazenados criptografados usando pgcrypto. Em produção:

1. Use o Supabase Vault para armazenar a chave de criptografia
2. Atualize as funções `encrypt_token` e `decrypt_token` para usar a chave do Vault
3. Nunca exponha a chave no código ou logs

### RLS e Políticas
Todas as políticas RLS foram testadas para garantir isolamento de dados. Sempre teste novas políticas antes de aplicar em produção.

## Manutenção

### Backup
O Supabase faz backups automáticos, mas recomenda-se:
- Backups manuais antes de mudanças importantes
- Export periódico de dados críticos

### Monitoramento
Monitore:
- Tamanho das tabelas (especialmente `audit_logs` e `sync_jobs`)
- Performance de queries
- Uso de índices

### Limpeza
Considere criar jobs periódicos para:
- Arquivar logs antigos
- Limpar sessões expiradas
- Limpar jobs antigos

## Suporte

Para dúvidas sobre o schema, consulte:
- Documentação do Supabase: https://supabase.com/docs
- Documentação do PostgreSQL: https://www.postgresql.org/docs/

