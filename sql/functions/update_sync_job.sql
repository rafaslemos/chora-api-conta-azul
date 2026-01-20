-- ============================================================================
-- Função RPC: Atualizar sync_job
-- ============================================================================
-- Esta função atualiza um sync_job com status final, estatísticas e detalhes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_sync_job(
    p_id UUID,
    p_status TEXT DEFAULT NULL,
    p_items_processed INTEGER DEFAULT NULL,
    p_finished_at TIMESTAMPTZ DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_details TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.sync_jobs
    SET 
        status = COALESCE(p_status, status),
        items_processed = COALESCE(p_items_processed, items_processed),
        finished_at = COALESCE(p_finished_at, finished_at),
        error_message = COALESCE(p_error_message, error_message),
        details = COALESCE(p_details, details)
    WHERE id = p_id;
    
    -- Não lançar exceção se não encontrar - apenas não atualizar (comportamento tolerante)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_sync_job IS 'Atualiza um sync_job com status final, estatísticas e detalhes. Se o sync_job não existir, não faz nada (não lança erro)';

