-- ============================================================================
-- Função RPC: Inserir/Atualizar pedidos Tiny em lote
-- ============================================================================
-- Esta função permite inserir ou atualizar múltiplos pedidos de uma vez
-- com validação e tratamento de erros
-- ============================================================================

CREATE OR REPLACE FUNCTION public.insert_pedidos_tiny_batch(
    p_pedidos JSONB[]
)
RETURNS JSONB AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_errors INTEGER := 0;
    v_pedido JSONB;
    v_error_detail TEXT;
    v_existing_id UUID;
    v_error_details JSONB[] := ARRAY[]::JSONB[];
BEGIN
    FOREACH v_pedido IN ARRAY p_pedidos
    LOOP
        BEGIN
            -- Validar campos obrigatórios
            IF v_pedido->>'tenant_id' IS NULL OR v_pedido->>'id_pedido_tiny' IS NULL THEN
                v_errors := v_errors + 1;
                v_error_details := v_error_details || jsonb_build_object(
                    'pedido', v_pedido,
                    'erro', 'Campos obrigatórios ausentes: tenant_id ou id_pedido_tiny',
                    'codigo', 'VALIDATION_ERROR'
                );
                CONTINUE;
            END IF;
            
            -- Verificar se já existe
            SELECT id INTO v_existing_id
            FROM public.pedidos_tiny
            WHERE tenant_id = (v_pedido->>'tenant_id')::UUID
              AND id_pedido_tiny = v_pedido->>'id_pedido_tiny';
            
            IF v_existing_id IS NOT NULL THEN
                -- Atualizar registro existente
                UPDATE public.pedidos_tiny
                SET 
                    numero = COALESCE(v_pedido->>'numero', numero),
                    data_pedido = CASE 
                        WHEN v_pedido->>'data_pedido' IS NOT NULL 
                        THEN (v_pedido->>'data_pedido')::DATE 
                        ELSE data_pedido 
                    END,
                    status_pedido_tiny = COALESCE(v_pedido->>'status_pedido_tiny', status_pedido_tiny),
                    valor_total = CASE 
                        WHEN v_pedido->>'valor_total' IS NOT NULL 
                        THEN (v_pedido->>'valor_total')::DECIMAL 
                        ELSE valor_total 
                    END,
                    updated_at = NOW()
                WHERE id = v_existing_id;
                
                v_updated := v_updated + 1;
            ELSE
                -- Inserir novo registro
                INSERT INTO public.pedidos_tiny (
                    tenant_id, 
                    partner_id, 
                    id_pedido_tiny, 
                    numero,
                    data_pedido, 
                    status_pedido_tiny, 
                    valor_total, 
                    status
                ) VALUES (
                    (v_pedido->>'tenant_id')::UUID,
                    (v_pedido->>'partner_id')::UUID,
                    v_pedido->>'id_pedido_tiny',
                    v_pedido->>'numero',
                    CASE 
                        WHEN v_pedido->>'data_pedido' IS NOT NULL 
                        THEN (v_pedido->>'data_pedido')::DATE 
                        ELSE NULL 
                    END,
                    v_pedido->>'status_pedido_tiny',
                    CASE 
                        WHEN v_pedido->>'valor_total' IS NOT NULL 
                        THEN (v_pedido->>'valor_total')::DECIMAL 
                        ELSE NULL 
                    END,
                    'PENDENTE_DETALHAMENTO'
                );
                
                v_inserted := v_inserted + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            v_error_detail := SQLERRM;
            v_error_details := v_error_details || jsonb_build_object(
                'pedido', v_pedido,
                'erro', SQLERRM,
                'codigo', SQLSTATE
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'inserted', v_inserted,
        'updated', v_updated,
        'errors', v_errors,
        'total', array_length(p_pedidos, 1),
        'error_details', v_error_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.insert_pedidos_tiny_batch IS 'Insere ou atualiza múltiplos pedidos Tiny em lote com validação e tratamento de erros';

