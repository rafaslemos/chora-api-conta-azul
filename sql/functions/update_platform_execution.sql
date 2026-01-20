-- ============================================================================
-- Função RPC: Atualizar platform_execution
-- ============================================================================
-- Esta função atualiza uma execução de plataforma com estatísticas e status
-- IMPORTANTE: Acumula valores (soma) em vez de substituir para permitir
-- múltiplas execuções no mesmo dia
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_platform_execution(
    p_id UUID,
    p_status TEXT,
    p_total_pages INTEGER DEFAULT NULL,
    p_total_items INTEGER DEFAULT NULL,
    p_total_requests INTEGER DEFAULT NULL,
    p_successful_requests INTEGER DEFAULT NULL,
    p_failed_requests INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_execution_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.platform_executions
    SET 
        status = p_status,
        -- ACUMULAR valores (somar ao existente) em vez de substituir
        total_pages = COALESCE(total_pages, 0) + COALESCE(p_total_pages, 0),
        total_items = COALESCE(total_items, 0) + COALESCE(p_total_items, 0),
        total_requests = COALESCE(total_requests, 0) + COALESCE(p_total_requests, 0),
        successful_requests = COALESCE(successful_requests, 0) + COALESCE(p_successful_requests, 0),
        failed_requests = COALESCE(failed_requests, 0) + COALESCE(p_failed_requests, 0),
        -- Mensagem de erro e details são substituídos (não acumulados)
        error_message = COALESCE(p_error_message, error_message),
        execution_details = COALESCE(p_execution_details, execution_details),
        finished_at = CASE 
            WHEN p_status IN ('SUCCESS', 'ERROR', 'PARTIAL') THEN NOW() 
            ELSE finished_at 
        END,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_platform_execution IS 'Atualiza uma execução de plataforma com estatísticas e status final. ACUMULA valores (soma) para permitir múltiplas execuções no mesmo dia';