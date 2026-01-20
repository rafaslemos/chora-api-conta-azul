-- ============================================================================
-- Migração: Criar tabela de planos OLIST
-- ============================================================================
-- Esta migração cria a tabela olist_plans para armazenar os planos
-- disponíveis da OLIST e seus limites de requisições.
-- Isso permite que alterações nos limites sejam feitas no banco sem
-- necessidade de alterar código.
-- ============================================================================

-- Criar tabela de planos OLIST
CREATE TABLE IF NOT EXISTS public.olist_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL CHECK (code IN ('COMECAR', 'CRESCER', 'EVOLUIR', 'POTENCIALIZAR')),
    name TEXT NOT NULL,
    requests_per_minute INTEGER NOT NULL DEFAULT 0,
    batch_requests INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comentários para documentação
COMMENT ON TABLE public.olist_plans IS 'Planos disponíveis da OLIST com seus limites de requisições';
COMMENT ON COLUMN public.olist_plans.code IS 'Código único do plano: COMECAR, CRESCER, EVOLUIR, POTENCIALIZAR';
COMMENT ON COLUMN public.olist_plans.name IS 'Nome amigável do plano';
COMMENT ON COLUMN public.olist_plans.requests_per_minute IS 'Limite de requisições por minuto';
COMMENT ON COLUMN public.olist_plans.batch_requests IS 'Limite de requisições em lote';

-- Inserir planos iniciais
INSERT INTO public.olist_plans (code, name, requests_per_minute, batch_requests, is_active)
VALUES
    ('COMECAR', 'Começar', 0, 0, TRUE),
    ('CRESCER', 'Crescer', 30, 5, TRUE),
    ('EVOLUIR', 'Evoluir', 60, 5, TRUE),
    ('POTENCIALIZAR', 'Potencializar', 120, 5, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Criar índice para busca por código
CREATE INDEX IF NOT EXISTS idx_olist_plans_code ON public.olist_plans(code);
CREATE INDEX IF NOT EXISTS idx_olist_plans_active ON public.olist_plans(is_active) WHERE is_active = TRUE;

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.olist_plans ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver (para permitir re-execução da migration)
DROP POLICY IF EXISTS "Usuários autenticados podem ler planos ativos" ON public.olist_plans;
DROP POLICY IF EXISTS "Apenas administradores podem modificar planos" ON public.olist_plans;

-- Política: Todos os usuários autenticados podem ler planos ativos
CREATE POLICY "Usuários autenticados podem ler planos ativos"
    ON public.olist_plans
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND is_active = TRUE
    );

-- Política: Apenas administradores podem modificar planos
CREATE POLICY "Apenas administradores podem modificar planos"
    ON public.olist_plans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

