# Instruções para Aplicar o Schema no Supabase

## Método 1: Via SQL Editor (Recomendado)

1. **Acesse o Supabase Dashboard**
   - Vá para https://app.supabase.com
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em **SQL Editor**
   - Clique em **New Query**

3. **Cole o Schema**
   - Abra o arquivo `sql/schema.sql`
   - Copie TODO o conteúdo
   - Cole no editor SQL

4. **Execute o Script**
   - Clique no botão **Run** (ou pressione Ctrl+Enter)
   - Aguarde a execução (pode levar ~30 segundos)

5. **Verifique os Resultados**
   - Verifique se apareceu "Success. No rows returned"
   - Vá para **Table Editor** no menu lateral
   - Confirme que todas as tabelas foram criadas:
     - profiles
     - tenants
     - tenant_credentials
     - integration_flows
     - mapping_rules
     - sync_jobs
     - audit_logs
     - user_sessions

## Método 2: Via CLI do Supabase (Avançado)

Se você tem o Supabase CLI instalado:

```bash
# Conectar ao projeto
supabase link --project-ref seu-project-ref

# Aplicar o schema
supabase db push
```

## Verificações Pós-Aplicação

### 1. Verificar Tabelas
Execute no SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Deve retornar as 8 tabelas listadas acima.

### 2. Verificar RLS Habilitado
Execute:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'tenants', 'tenant_credentials', 
    'integration_flows', 'mapping_rules', 'sync_jobs', 
    'audit_logs', 'user_sessions'
);
```

Todas devem ter `rowsecurity = true`.

### 3. Verificar Políticas RLS
Execute:

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Deve retornar várias políticas para cada tabela.

### 4. Verificar Triggers
Execute:

```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

Deve retornar os triggers criados.

### 5. Verificar Funções
Execute:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

Deve retornar as funções criadas.

## Configurações Adicionais Necessárias

### 1. Habilitar Email Confirmation

1. Vá em **Authentication > Settings**
2. Em **Email Auth**, ative:
   - ✅ **Enable email confirmations**
3. Configure as URLs de redirecionamento:
   - **Site URL**: `http://localhost:3000` (ou sua URL de produção)
   - **Redirect URLs**: Adicione:
     - `http://localhost:3000/auth/confirm`
     - `http://localhost:3000/auth/reset-password`

**📖 Para entender melhor como funcionam as URLs de redirecionamento, consulte:**
- `doc/GUIA_URLS_REDIRECIONAMENTO.md` - Guia completo sobre URLs de redirecionamento

### 2. Configurar Templates de Email

1. Vá em **Authentication > Email Templates**
2. Para cada template, copie o conteúdo do arquivo `doc/EMAIL_TEMPLATES.md`:
   - **Confirmation** (Signup): Template de confirmação de email
   - **Recovery** (Reset Password): Template de redefinição de senha
   - **Email Change**: Template de mudança de email
   - **Magic Link**: Template de login sem senha
3. Cole o HTML na seção "HTML" e o texto simples na seção "Plain text"
4. Clique em **Save**

**📖 Templates prontos e formais disponíveis em:**
- `doc/EMAIL_TEMPLATES.md` - Templates profissionais em português

### 3. Criar Usuário Admin (Opcional)

Para criar o primeiro usuário admin:

1. Crie um usuário via **Authentication > Users > Add User**
2. Execute no SQL Editor:

```sql
-- Atualizar o perfil para ADMIN (substitua 'email@exemplo.com' pelo email do usuário)
UPDATE public.profiles 
SET role = 'ADMIN' 
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'email@exemplo.com'
);
```

## Troubleshooting

### Erro: "permission denied for schema public"
- Certifique-se de estar usando a conta de administrador do Supabase
- Verifique se você tem permissões no projeto

### Erro: "relation already exists"
- Algumas tabelas já existem
- Você pode:
  - Deletar as tabelas existentes manualmente
  - Ou usar `DROP TABLE IF EXISTS` antes de criar (cuidado!)

### Erro: "extension pgcrypto does not exist"
- O Supabase já tem pgcrypto habilitado por padrão
- Se o erro persistir, verifique as permissões

### Políticas RLS não funcionando
- Verifique se o RLS está habilitado: `ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;`
- Verifique se as políticas foram criadas corretamente
- Teste com um usuário autenticado

## Próximos Passos

Após aplicar o schema:

1. ✅ Testar criação de usuário (signup)
2. ✅ Verificar se o perfil é criado automaticamente
3. ✅ Testar criação de tenant
4. ✅ Verificar isolamento de dados (RLS)
5. ✅ Configurar integração com frontend

## Correção de Recursão RLS

Se você encontrar o erro "infinite recursion detected in policy for relation 'profiles'", execute o script de correção:

1. Acesse o **SQL Editor** no Supabase Dashboard
2. Abra o arquivo `sql/fix_rls_recursion.sql`
3. Execute o script completo
4. Isso corrigirá todas as políticas RLS que causam recursão

**Causa do problema:** Políticas RLS que verificam se o usuário é ADMIN consultando a própria tabela `profiles`, causando recursão infinita.

**Solução:** Função `is_admin()` com `SECURITY DEFINER` que bypassa RLS para verificar o role.

## Suporte

Se encontrar problemas:
- Consulte a documentação do Supabase: https://supabase.com/docs
- Verifique os logs no Supabase Dashboard > Logs
- Revise o arquivo `README_DATABASE.md` para mais detalhes
- Se houver erro de recursão RLS, execute `sql/fix_rls_recursion.sql`

