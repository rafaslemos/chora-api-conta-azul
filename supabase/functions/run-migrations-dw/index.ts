// Edge Function para executar migrations do Data Warehouse (fase 3)
// Contém: 013_rls_policies, 014_dim_calendario, estruturas básicas do DW
// NOTA: As funções ETL complexas (015-025) devem ser executadas manualmente
// via SQL Editor do Supabase devido ao tamanho e complexidade
// É chamada internamente pela setup-config após run-migrations-integrations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// MIGRATION 013: RLS Policies for Integrations
// ============================================================================
const MIGRATION_013_RLS_POLICIES = `
-- Habilitar RLS em tabelas do schema integrations
ALTER TABLE integrations.controle_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.config_periodicidade ENABLE ROW LEVEL SECURITY;

-- Políticas para controle_carga
DROP POLICY IF EXISTS "Service role full access controle_carga" ON integrations.controle_carga;
CREATE POLICY "Service role full access controle_carga"
    ON integrations.controle_carga FOR ALL
    USING (true)
    WITH CHECK (true);

-- Políticas para config_periodicidade  
DROP POLICY IF EXISTS "Service role full access config_periodicidade" ON integrations.config_periodicidade;
CREATE POLICY "Service role full access config_periodicidade"
    ON integrations.config_periodicidade FOR ALL
    USING (true)
    WITH CHECK (true);

-- Habilitar RLS em tabelas do schema integrations_conta_azul
ALTER TABLE integrations_conta_azul.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.categorias_dre ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.centro_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.saldos_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas_itens ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar acesso ao tenant via partner_id
CREATE OR REPLACE FUNCTION integrations_conta_azul.user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_core.tenants 
        WHERE id = p_tenant_id 
        AND partner_id = auth.uid()
    ) OR app_core.is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas genéricas para tabelas de entidades (service role tem acesso total)
DO $$
DECLARE
    tabela TEXT;
    tabelas TEXT[] := ARRAY['pessoas', 'categorias', 'categorias_dre', 'centro_custos', 
                            'produtos', 'servicos', 'vendedores', 'contas_financeiras',
                            'contas_pagar', 'contas_receber', 'contratos', 'saldos_contas',
                            'vendas', 'vendas_itens'];
BEGIN
    FOREACH tabela IN ARRAY tabelas LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Service role full access %I" ON integrations_conta_azul.%I', tabela, tabela);
        EXECUTE format('CREATE POLICY "Service role full access %I" ON integrations_conta_azul.%I FOR ALL USING (true) WITH CHECK (true)', tabela, tabela);
    END LOOP;
END $$;
`;

// ============================================================================
// MIGRATION 014: Dim Calendario
// ============================================================================
const MIGRATION_014_DIM_CALENDARIO = `
-- Função auxiliar para calcular nível máximo
CREATE OR REPLACE FUNCTION dw.calcular_nivel_maximo(
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT GREATEST(
        CASE WHEN nivel_1_desc IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN nivel_2_desc IS NOT NULL THEN 2 ELSE 0 END,
        CASE WHEN nivel_3_desc IS NOT NULL THEN 3 ELSE 0 END,
        CASE WHEN nivel_4_desc IS NOT NULL THEN 4 ELSE 0 END,
        CASE WHEN nivel_5_desc IS NOT NULL THEN 5 ELSE 0 END
    );
$$;

-- Dimensão Calendário
CREATE TABLE IF NOT EXISTS dw.dim_calendario (
    data_id SERIAL PRIMARY KEY,
    data DATE NOT NULL UNIQUE,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    dia INTEGER NOT NULL,
    trimestre INTEGER NOT NULL,
    semestre INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL,
    mes_nome TEXT NOT NULL,
    trimestre_nome TEXT NOT NULL,
    semestre_nome TEXT NOT NULL,
    dia_semana_nome TEXT NOT NULL,
    ano_mes TEXT NOT NULL,
    ano_trimestre TEXT NOT NULL,
    ano_semestre TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_calendario_data ON dw.dim_calendario(data);
CREATE INDEX IF NOT EXISTS idx_dim_calendario_ano ON dw.dim_calendario(ano);
CREATE INDEX IF NOT EXISTS idx_dim_calendario_ano_mes ON dw.dim_calendario(ano_mes);

-- Função para carregar calendário
CREATE OR REPLACE FUNCTION dw.carregar_dim_calendario()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    data_atual DATE;
    data_fim DATE;
    registros_inseridos INTEGER := 0;
BEGIN
    data_atual := '2020-01-01'::DATE;
    data_fim := '2030-12-31'::DATE;
    
    WHILE data_atual <= data_fim LOOP
        INSERT INTO dw.dim_calendario (
            data, ano, mes, dia, trimestre, semestre, dia_semana,
            mes_nome, trimestre_nome, semestre_nome, dia_semana_nome,
            ano_mes, ano_trimestre, ano_semestre
        )
        VALUES (
            data_atual,
            EXTRACT(YEAR FROM data_atual)::INTEGER,
            EXTRACT(MONTH FROM data_atual)::INTEGER,
            EXTRACT(DAY FROM data_atual)::INTEGER,
            EXTRACT(QUARTER FROM data_atual)::INTEGER,
            CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN 1 ELSE 2 END,
            EXTRACT(DOW FROM data_atual) + 1,
            TO_CHAR(data_atual, 'TMMonth'),
            'T' || EXTRACT(QUARTER FROM data_atual)::TEXT || 'º Trimestre',
            CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN '1º Semestre' ELSE '2º Semestre' END,
            CASE EXTRACT(DOW FROM data_atual)
                WHEN 0 THEN 'Domingo'
                WHEN 1 THEN 'Segunda-feira'
                WHEN 2 THEN 'Terça-feira'
                WHEN 3 THEN 'Quarta-feira'
                WHEN 4 THEN 'Quinta-feira'
                WHEN 5 THEN 'Sexta-feira'
                WHEN 6 THEN 'Sábado'
            END,
            TO_CHAR(data_atual, 'YYYY-MM'),
            TO_CHAR(data_atual, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM data_atual)::TEXT,
            TO_CHAR(data_atual, 'YYYY') || '-S' || CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN '1' ELSE '2' END
        )
        ON CONFLICT (data) DO NOTHING;
        
        registros_inseridos := registros_inseridos + 1;
        data_atual := data_atual + INTERVAL '1 day';
    END LOOP;
    
    RETURN registros_inseridos;
END;
$$;
`;

// ============================================================================
// MIGRATION: DW Dimension Tables (estruturas básicas)
// ============================================================================
const MIGRATION_DW_DIM_TABLES = `
-- Dimensão Categoria
CREATE TABLE IF NOT EXISTS dw.dim_categoria (
    categoria_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    categoria_api_id TEXT NOT NULL,
    nome TEXT,
    tipo TEXT,
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT,
    nivel_maximo INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, categoria_api_id)
);

-- Dimensão Categoria DRE
CREATE TABLE IF NOT EXISTS dw.dim_categoria_dre (
    categoria_dre_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    categoria_dre_api_id TEXT NOT NULL,
    descricao TEXT,
    codigo TEXT,
    posicao INTEGER,
    categoria_financeira_id TEXT,
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT,
    nivel_maximo INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, categoria_dre_api_id, categoria_financeira_id)
);

-- Máscara Totalizadores DRE
CREATE TABLE IF NOT EXISTS dw.mascara_totalizadores_dre (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    posicao INTEGER NOT NULL,
    categoria_dre_api_id TEXT,
    categoria_dre_id INTEGER REFERENCES dw.dim_categoria_dre(categoria_dre_id),
    descricao TEXT,
    codigo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, posicao)
);

-- Dimensão Centro de Custo
CREATE TABLE IF NOT EXISTS dw.dim_centro_custo (
    centro_custo_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    centro_custo_api_id TEXT NOT NULL,
    nome TEXT,
    codigo TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, centro_custo_api_id)
);

-- Dimensão Pessoa
CREATE TABLE IF NOT EXISTS dw.dim_pessoa (
    pessoa_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    pessoa_api_id TEXT NOT NULL,
    nome TEXT,
    documento TEXT,
    tipo_pessoa TEXT,
    tipo_perfil TEXT,
    cidade TEXT,
    uf TEXT,
    pais TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, pessoa_api_id)
);

-- Dimensão Conta Financeira
CREATE TABLE IF NOT EXISTS dw.dim_conta_financeira (
    conta_financeira_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    conta_financeira_api_id TEXT NOT NULL,
    nome TEXT,
    tipo TEXT,
    ativa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, conta_financeira_api_id)
);

-- Dimensão Vendedor
CREATE TABLE IF NOT EXISTS dw.dim_vendedor (
    vendedor_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    vendedor_api_id TEXT NOT NULL,
    nome TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, vendedor_api_id)
);

-- Índices para dimensões
CREATE INDEX IF NOT EXISTS idx_dim_categoria_tenant ON dw.dim_categoria(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_tenant ON dw.dim_categoria_dre(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_centro_custo_tenant ON dw.dim_centro_custo(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_pessoa_tenant ON dw.dim_pessoa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_conta_financeira_tenant ON dw.dim_conta_financeira(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_tenant ON dw.dim_vendedor(tenant_id);
`;

// ============================================================================
// MIGRATION: Fato Tables (estruturas básicas)
// ============================================================================
const MIGRATION_DW_FATO_TABLES = `
-- Fato Contas Financeiras
CREATE TABLE IF NOT EXISTS dw.fato_contas_financeiras (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    conta_api_id TEXT NOT NULL,
    tipo_conta TEXT NOT NULL, -- 'PAGAR' ou 'RECEBER'
    data_id INTEGER REFERENCES dw.dim_calendario(data_id),
    categoria_id INTEGER REFERENCES dw.dim_categoria(categoria_id),
    categoria_dre_id INTEGER REFERENCES dw.dim_categoria_dre(categoria_dre_id),
    centro_custo_id INTEGER REFERENCES dw.dim_centro_custo(centro_custo_id),
    pessoa_id INTEGER REFERENCES dw.dim_pessoa(pessoa_id),
    conta_financeira_id INTEGER REFERENCES dw.dim_conta_financeira(conta_financeira_id),
    valor_total NUMERIC(15,2),
    valor_pago NUMERIC(15,2),
    valor_nao_pago NUMERIC(15,2),
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fato_contas_financeiras_tenant ON dw.fato_contas_financeiras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_financeiras_data ON dw.fato_contas_financeiras(data_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_financeiras_tipo ON dw.fato_contas_financeiras(tipo_conta);

-- Fato Vendas
CREATE TABLE IF NOT EXISTS dw.fato_vendas (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    venda_api_id TEXT NOT NULL,
    data_id INTEGER REFERENCES dw.dim_calendario(data_id),
    pessoa_id INTEGER REFERENCES dw.dim_pessoa(pessoa_id),
    vendedor_id INTEGER REFERENCES dw.dim_vendedor(vendedor_id),
    valor_total NUMERIC(15,2),
    situacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fato_vendas_tenant ON dw.fato_vendas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_data ON dw.fato_vendas(data_id);

-- Fato Vendas Itens
CREATE TABLE IF NOT EXISTS dw.fato_vendas_itens (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    venda_api_id TEXT NOT NULL,
    item_api_id TEXT,
    produto_api_id TEXT,
    servico_api_id TEXT,
    quantidade NUMERIC(15,4),
    valor_unitario NUMERIC(15,2),
    valor_total NUMERIC(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fato_vendas_itens_tenant ON dw.fato_vendas_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_itens_venda ON dw.fato_vendas_itens(venda_api_id);

-- Fato Contratos
CREATE TABLE IF NOT EXISTS dw.fato_contratos (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    contrato_api_id TEXT NOT NULL,
    data_inicio_id INTEGER REFERENCES dw.dim_calendario(data_id),
    pessoa_id INTEGER REFERENCES dw.dim_pessoa(pessoa_id),
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fato_contratos_tenant ON dw.fato_contratos(tenant_id);

-- Fato Saldos Contas
CREATE TABLE IF NOT EXISTS dw.fato_saldos_contas (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    conta_financeira_id INTEGER REFERENCES dw.dim_conta_financeira(conta_financeira_id),
    data_id INTEGER REFERENCES dw.dim_calendario(data_id),
    saldo NUMERIC(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fato_saldos_contas_tenant ON dw.fato_saldos_contas(tenant_id);
`;

// Lista de migrations em ordem
const MIGRATIONS = [
  { name: '013_rls_policies', sql: MIGRATION_013_RLS_POLICIES },
  { name: '014_dim_calendario', sql: MIGRATION_014_DIM_CALENDARIO },
  { name: 'dw_dim_tables', sql: MIGRATION_DW_DIM_TABLES },
  { name: 'dw_fato_tables', sql: MIGRATION_DW_FATO_TABLES },
];

// ============================================================================
// Função para executar SQL via conexão PostgreSQL direta
// ============================================================================
async function executeSQLDirect(
  dbHost: string,
  dbPassword: string,
  sql: string
): Promise<{ success: boolean; error?: string }> {
  const client = new Client({
    hostname: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPassword,
    tls: { enabled: true },
  });

  try {
    await client.connect();
    await client.queryArray(sql);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('already exists')) {
      return { success: true };
    }
    return { success: false, error: errorMsg };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignorar erros ao fechar conexão
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' },
    });
  }

  console.log('[run-migrations-dw] Iniciando...');
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));

    if (!body.supabase_url || !body.db_password) {
      return jsonResponse({
        success: false,
        error: 'supabase_url e db_password são obrigatórios',
      }, 400);
    }

    const match = body.supabase_url.match(/https:\/\/(.+?)\.supabase\.co/);
    if (!match) {
      return jsonResponse({ success: false, error: 'URL do Supabase inválida' }, 400);
    }

    const projectRef = match[1];
    const dbHost = `db.${projectRef}.supabase.co`;

    console.log(`[run-migrations-dw] Conectando a ${dbHost}...`);

    const results: Array<{ migration: string; success: boolean; error?: string }> = [];

    for (const migration of MIGRATIONS) {
      console.log(`[run-migrations-dw] Executando ${migration.name}...`);
      const result = await executeSQLDirect(dbHost, body.db_password, migration.sql);
      results.push({
        migration: migration.name,
        success: result.success,
        error: result.error,
      });

      if (!result.success) {
        console.error(`[run-migrations-dw] Erro em ${migration.name}:`, result.error);
      } else {
        console.log(`[run-migrations-dw] ${migration.name} OK`);
      }
    }

    // Carregar calendário após criar tabelas
    console.log('[run-migrations-dw] Carregando dim_calendario...');
    const calendarResult = await executeSQLDirect(dbHost, body.db_password, 'SELECT dw.carregar_dim_calendario();');
    results.push({
      migration: 'carregar_dim_calendario',
      success: calendarResult.success,
      error: calendarResult.error,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[run-migrations-dw] Concluído em ${elapsed}ms`);

    const allSuccessful = results.every(r => r.success);

    return jsonResponse({
      success: allSuccessful,
      message: allSuccessful ? 'Migrations do DW executadas com sucesso' : 'Algumas migrations falharam',
      migrations_result: {
        executed: results.filter(r => r.success).map(r => r.migration),
        errors: results.filter(r => !r.success).map(r => `${r.migration}: ${r.error}`),
      },
      elapsed_ms: elapsed,
      nota: 'Para ETL completo (funções 015-025), execute os arquivos SQL manualmente via Supabase SQL Editor',
    }, allSuccessful ? 200 : 500);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[run-migrations-dw] Exceção:', errorMessage);
    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
