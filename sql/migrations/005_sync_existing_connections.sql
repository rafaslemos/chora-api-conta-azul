-- ============================================================================
-- Migração: Sincronizar status de conexões existentes
-- ============================================================================
-- Esta migração atualiza os campos connections_olist e connections_conta_azul
-- na tabela tenants com base nas credenciais ativas em tenant_credentials
-- ============================================================================

-- Sincronizar connections_olist
UPDATE public.tenants t
SET connections_olist = COALESCE(
    (SELECT is_active FROM public.tenant_credentials tc 
     WHERE tc.tenant_id = t.id 
       AND tc.platform = 'OLIST' 
       AND tc.is_active = TRUE
     LIMIT 1),
    FALSE
)
WHERE EXISTS (
    SELECT 1 FROM public.tenant_credentials tc
    WHERE tc.tenant_id = t.id AND tc.platform = 'OLIST'
);

-- Sincronizar connections_conta_azul
UPDATE public.tenants t
SET connections_conta_azul = COALESCE(
    (SELECT is_active FROM public.tenant_credentials tc 
     WHERE tc.tenant_id = t.id 
       AND tc.platform = 'CONTA_AZUL' 
       AND tc.is_active = TRUE
     LIMIT 1),
    FALSE
)
WHERE EXISTS (
    SELECT 1 FROM public.tenant_credentials tc
    WHERE tc.tenant_id = t.id AND tc.platform = 'CONTA_AZUL'
);

-- Verificar resultado
SELECT 
    t.id,
    t.name,
    t.connections_olist,
    t.connections_conta_azul,
    (SELECT COUNT(*) FROM public.tenant_credentials tc WHERE tc.tenant_id = t.id AND tc.platform = 'OLIST' AND tc.is_active = TRUE) as olist_active_count,
    (SELECT COUNT(*) FROM public.tenant_credentials tc WHERE tc.tenant_id = t.id AND tc.platform = 'CONTA_AZUL' AND tc.is_active = TRUE) as conta_azul_active_count
FROM public.tenants t
WHERE EXISTS (
    SELECT 1 FROM public.tenant_credentials tc
    WHERE tc.tenant_id = t.id
)
ORDER BY t.name;

