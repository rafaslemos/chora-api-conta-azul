-- ============================================================================
-- Migration 027: Tabela app_core.sync_jobs e RLS
-- ============================================================================
-- Jobs de sincronização por tenant. Usado pelo Dashboard e syncJobService.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_core.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ORDER_SYNC', 'PRODUCT_SYNC', 'FEES_SYNC', 'CUSTOMER_SYNC')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR', 'CANCELLED')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    details TEXT,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.sync_jobs IS 'Jobs de sincronização executados para cada tenant';
COMMENT ON COLUMN app_core.sync_jobs.retry_count IS 'Número de tentativas de retry em caso de erro';

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_id ON app_core.sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON app_core.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON app_core.sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_status_created ON app_core.sync_jobs(tenant_id, status, created_at DESC);

ALTER TABLE app_core.sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own tenant sync jobs" ON app_core.sync_jobs;
CREATE POLICY "Partners can view own tenant sync jobs"
    ON app_core.sync_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants t
            WHERE t.id = sync_jobs.tenant_id AND t.partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "System can create sync jobs" ON app_core.sync_jobs;
CREATE POLICY "System can create sync jobs"
    ON app_core.sync_jobs FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Partners can update own tenant sync jobs" ON app_core.sync_jobs;
CREATE POLICY "Partners can update own tenant sync jobs"
    ON app_core.sync_jobs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants t
            WHERE t.id = sync_jobs.tenant_id AND t.partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );
