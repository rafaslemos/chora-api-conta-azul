-- ============================================================================
-- Migração: Adicionar campos de detalhes completos do tenant
-- ============================================================================
-- Esta migração adiciona campos para armazenar todos os dados da empresa
-- retornados pela API de consulta de CNPJ
-- ============================================================================

-- Adicionar novos campos à tabela tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address_logradouro TEXT,
ADD COLUMN IF NOT EXISTS address_numero TEXT,
ADD COLUMN IF NOT EXISTS address_bairro TEXT,
ADD COLUMN IF NOT EXISTS address_cidade TEXT,
ADD COLUMN IF NOT EXISTS address_estado TEXT,
ADD COLUMN IF NOT EXISTS address_cep TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.tenants.razao_social IS 'Razão social da empresa (nome oficial)';
COMMENT ON COLUMN public.tenants.nome_fantasia IS 'Nome fantasia da empresa (nome comercial)';
COMMENT ON COLUMN public.tenants.phone IS 'Telefone da empresa';
COMMENT ON COLUMN public.tenants.address_logradouro IS 'Logradouro do endereço da empresa';
COMMENT ON COLUMN public.tenants.address_numero IS 'Número do endereço da empresa';
COMMENT ON COLUMN public.tenants.address_bairro IS 'Bairro do endereço da empresa';
COMMENT ON COLUMN public.tenants.address_cidade IS 'Cidade do endereço da empresa';
COMMENT ON COLUMN public.tenants.address_estado IS 'Estado (UF) do endereço da empresa';
COMMENT ON COLUMN public.tenants.address_cep IS 'CEP do endereço da empresa';

