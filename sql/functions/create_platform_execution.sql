-- ============================================================================
-- Função RPC: Criar platform_execution
-- ============================================================================
-- Esta função facilita a criação de platform_executions com status RUNNING
-- Se já existir uma execução para o mesmo tenant, platform, type e date,
-- atualiza para RUNNING e retorna o ID existente (idempotência)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_platform_execution(
    p_tenant_id UUID,
    p_platform TEXT,
    p_execution_type TEXT,
    p_execution_date DATE DEFAULT CURRENT_DATE,
    p_is_initial_load BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    v_execution_id UUID;
BEGIN
    INSERT INTO public.platform_executions (
        tenant_id,
        platform,
        execution_type,
        execution_date,
        status,
        is_initial_load,
        started_at
    ) VALUES (
        p_tenant_id,
        p_platform,
        p_execution_type,
        p_execution_date,
        'RUNNING',
        p_is_initial_load,
        NOW()
    )
    ON CONFLICT (tenant_id, platform, execution_type, execution_date)
    DO UPDATE SET
        status = 'RUNNING',
        is_initial_load = COALESCE(EXCLUDED.is_initial_load, platform_executions.is_initial_load),
        started_at = NOW(),
        finished_at = NULL, -- Reset finished_at quando reinicia
        updated_at = NOW()
    RETURNING id INTO v_execution_id;
    
    RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_platform_execution IS 'Cria um platform_execution com status RUNNING e retorna o ID. Se já existir para a mesma data, atualiza e retorna o ID existente (idempotência)';

