-- ============================================================================
-- Função RPC: Criar sync_job
-- ============================================================================
-- Esta função facilita a criação de sync_jobs com status RUNNING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_sync_job(
    p_tenant_id UUID,
    p_type TEXT,
    p_details TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
BEGIN
    INSERT INTO public.sync_jobs (
        tenant_id, 
        type, 
        status, 
        started_at, 
        details
    ) VALUES (
        p_tenant_id, 
        p_type, 
        'RUNNING', 
        NOW(), 
        p_details
    ) RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_sync_job IS 'Cria um sync_job com status RUNNING e retorna o ID';

