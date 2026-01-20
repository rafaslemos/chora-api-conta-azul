# Correção Rápida: Recursão Infinita RLS

## Problema
Erro: `infinite recursion detected in policy for relation "profiles"`

## Solução Rápida

Execute este código no **SQL Editor** do Supabase:

```sql
-- 1. Criar função para verificar ADMIN (bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Corrigir política de profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin(auth.uid()));

-- 3. Corrigir política de tenant_credentials
DROP POLICY IF EXISTS "Partners can view own tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Partners can view own tenant credentials"
    ON public.tenant_credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );
```

Isso deve resolver o problema imediatamente. Para uma correção completa, execute o arquivo `sql/fix_rls_recursion.sql`.

