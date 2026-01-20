-- ============================================================================
-- Função RPC: Inserir detalhes completos de um pedido (JSONB)
-- ============================================================================
-- Esta função recebe um objeto JSON completo do pedido detalhado,
-- extrai campos individuais e armazena arrays em JSONB
-- Atualiza o status do pedido em pedidos_tiny para DETALHADO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.insert_pedido_detalhado_jsonb(
    p_pedido_tiny_id UUID,
    p_detalhes_jsonb JSONB
)
RETURNS UUID AS $$
DECLARE
    v_detalhes_id UUID;
    v_pedido JSONB;
    v_cliente JSONB;
    v_ecommerce JSONB;
    v_itens JSONB;
    v_parcelas JSONB;
    v_pagamentos_integrados JSONB;
    v_marcadores JSONB;
    v_data_faturamento DATE;
    v_data_envio DATE;
    v_data_entrega DATE;
    v_data_prevista DATE;
    v_existing_detalhes_id UUID := NULL;
BEGIN
    -- Extrair objeto pedido (pode vir direto ou dentro de retorno.pedido)
    v_pedido := COALESCE(p_detalhes_jsonb->'pedido', p_detalhes_jsonb);
    
    -- Validar que o pedido_tiny_id existe
    IF NOT EXISTS (SELECT 1 FROM public.pedidos_tiny WHERE id = p_pedido_tiny_id) THEN
        RAISE EXCEPTION 'Pedido Tiny com id % não encontrado', p_pedido_tiny_id;
    END IF;
    
    -- Verificar se pedido já foi detalhado (Bug #16)
    SELECT id INTO v_existing_detalhes_id
    FROM public.pedidos_tiny_detalhes
    WHERE pedido_tiny_id = p_pedido_tiny_id;
    
    IF v_existing_detalhes_id IS NOT NULL THEN
        -- Pedido já foi detalhado, usar UPSERT (INSERT ... ON CONFLICT DO UPDATE)
        -- Retornar ID existente para manter compatibilidade
        RETURN v_existing_detalhes_id;
    END IF;
    
    -- Extrair objetos aninhados
    -- Bug #15: Validar se objetos existem (mas não bloquear se forem NULL)
    v_cliente := v_pedido->'cliente';
    v_ecommerce := v_pedido->'ecommerce';
    
    -- Validar que cliente existe (obrigatório para pedido válido)
    IF v_cliente IS NULL OR jsonb_typeof(v_cliente) != 'object' THEN
        -- Cliente não encontrado - logar aviso mas não bloquear inserção
        -- Campos de cliente serão NULL, mas pedido será inserido
        RAISE WARNING 'Objeto cliente não encontrado no pedido %', p_pedido_tiny_id;
    END IF;
    
    -- Ecommerce é opcional, não precisa validar
    
    -- Extrair arrays (API retorna formato: [{item: {...}}, {parcela: {...}}])
    -- Extrair objetos internos para simplificar estrutura em JSONB
    
    -- Para itens: extrair objetos 'item' do array [{item: {...}}] → [{...}]
    IF v_pedido->'itens' IS NOT NULL AND jsonb_typeof(v_pedido->'itens') = 'array' AND jsonb_array_length(v_pedido->'itens') > 0 THEN
        SELECT jsonb_agg(elem->'item')
        INTO v_itens
        FROM jsonb_array_elements(v_pedido->'itens') elem
        WHERE elem->'item' IS NOT NULL;
        -- Se não extraiu nada, manter vazio
        v_itens := COALESCE(v_itens, '[]'::jsonb);
    ELSE
        v_itens := '[]'::jsonb;
    END IF;
    
    -- Para parcelas: extrair objetos 'parcela' do array [{parcela: {...}}] → [{...}]
    IF v_pedido->'parcelas' IS NOT NULL AND jsonb_typeof(v_pedido->'parcelas') = 'array' AND jsonb_array_length(v_pedido->'parcelas') > 0 THEN
        SELECT jsonb_agg(elem->'parcela')
        INTO v_parcelas
        FROM jsonb_array_elements(v_pedido->'parcelas') elem
        WHERE elem->'parcela' IS NOT NULL;
        v_parcelas := COALESCE(v_parcelas, '[]'::jsonb);
    ELSE
        v_parcelas := '[]'::jsonb;
    END IF;
    
    -- Para pagamentos_integrados: extrair objetos 'pagamento_integrado' do array
    IF v_pedido->'pagamentos_integrados' IS NOT NULL AND jsonb_typeof(v_pedido->'pagamentos_integrados') = 'array' AND jsonb_array_length(v_pedido->'pagamentos_integrados') > 0 THEN
        SELECT jsonb_agg(elem->'pagamento_integrado')
        INTO v_pagamentos_integrados
        FROM jsonb_array_elements(v_pedido->'pagamentos_integrados') elem
        WHERE elem->'pagamento_integrado' IS NOT NULL;
        v_pagamentos_integrados := COALESCE(v_pagamentos_integrados, '[]'::jsonb);
    ELSE
        v_pagamentos_integrados := '[]'::jsonb;
    END IF;
    
    -- Para marcadores: extrair objetos 'marcador' do array
    IF v_pedido->'marcadores' IS NOT NULL AND jsonb_typeof(v_pedido->'marcadores') = 'array' AND jsonb_array_length(v_pedido->'marcadores') > 0 THEN
        SELECT jsonb_agg(elem->'marcador')
        INTO v_marcadores
        FROM jsonb_array_elements(v_pedido->'marcadores') elem
        WHERE elem->'marcador' IS NOT NULL;
        v_marcadores := COALESCE(v_marcadores, '[]'::jsonb);
    ELSE
        v_marcadores := '[]'::jsonb;
    END IF;
    
    -- Converter datas usando função auxiliar segura (Bug #13)
    v_data_faturamento := public.safe_jsonb_to_date(v_pedido->'data_faturamento', 'DD/MM/YYYY');
    v_data_envio := public.safe_jsonb_to_date(v_pedido->'data_envio', 'DD/MM/YYYY');
    v_data_entrega := public.safe_jsonb_to_date(v_pedido->'data_entrega', 'DD/MM/YYYY');
    v_data_prevista := public.safe_jsonb_to_date(v_pedido->'data_prevista', 'DD/MM/YYYY');
    
    -- Inserir detalhes do pedido
    INSERT INTO public.pedidos_tiny_detalhes (
        pedido_tiny_id,
        tenant_id,
        partner_id,
        
        -- Cliente
        cliente_nome,
        cliente_codigo,
        cliente_nome_fantasia,
        cliente_tipo_pessoa,
        cliente_cpf_cnpj,
        cliente_ie,
        cliente_rg,
        cliente_endereco,
        cliente_numero,
        cliente_complemento,
        cliente_bairro,
        cliente_cidade,
        cliente_uf,
        cliente_cep,
        cliente_fone,
        cliente_email,
        
        -- Pedido
        data_faturamento,
        data_envio,
        data_entrega,
        data_prevista,
        id_lista_preco,
        descricao_lista_preco,
        valor_frete,
        valor_desconto,
        outras_despesas,
        total_produtos,
        total_pedido,
        deposito,
        forma_envio,
        forma_frete,
        frete_por_conta,
        condicao_pagamento,
        forma_pagamento,
        meio_pagamento,
        nome_transportador,
        numero_ordem_compra,
        obs,
        obs_interna,
        id_nota_fiscal,
        id_natureza_operacao,
        
        -- Marketplace
        ecommerce_id,
        ecommerce_nome,
        ecommerce_numero_pedido,
        ecommerce_numero_pedido_canal_venda,
        
        -- Vendedor
        id_vendedor,
        nome_vendedor,
        
        -- Arrays JSONB (preservar formato original dos arrays)
        itens,
        parcelas,
        pagamentos_integrados,
        marcadores
    )
    SELECT 
        p_pedido_tiny_id,
        pt.tenant_id,
        pt.partner_id,
        
        -- Cliente (Bug #15: Tratar caso v_cliente seja NULL)
        NULLIF(TRIM(COALESCE(v_cliente->>'nome', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'codigo', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'nome_fantasia', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'tipo_pessoa', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'cpf_cnpj', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'ie', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'rg', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'endereco', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'numero', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'complemento', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'bairro', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'cidade', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'uf', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'cep', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'fone', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'email', '')::TEXT), ''),
        
        -- Pedido
        v_data_faturamento,
        v_data_envio,
        v_data_entrega,
        v_data_prevista,
        -- Bug #14: Converter explicitamente para texto antes do TRIM
        NULLIF(TRIM(COALESCE(v_pedido->>'id_lista_preco', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'descricao_lista_preco', '')::TEXT), ''),
        -- Bugs #11 e #12: Usar função auxiliar segura para conversão de DECIMAL
        public.safe_jsonb_to_decimal(v_pedido->'valor_frete'),
        public.safe_jsonb_to_decimal(v_pedido->'valor_desconto'),
        public.safe_jsonb_to_decimal(v_pedido->'outras_despesas'),
        public.safe_jsonb_to_decimal(v_pedido->'total_produtos'),
        public.safe_jsonb_to_decimal(v_pedido->'total_pedido'),
        -- Bug #14: Converter explicitamente para texto antes do TRIM
        NULLIF(TRIM(COALESCE(v_pedido->>'deposito', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'forma_envio', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'forma_frete', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'frete_por_conta', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'condicao_pagamento', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'forma_pagamento', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'meio_pagamento', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'nome_transportador', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'numero_ordem_compra', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'obs', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'obs_interna', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'id_nota_fiscal', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'id_natureza_operacao', '')::TEXT), ''),
        
        -- Marketplace (Bug #15: Tratar caso v_ecommerce seja NULL)
        NULLIF(TRIM(COALESCE(v_ecommerce->>'id', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_ecommerce->>'nomeEcommerce', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_ecommerce->>'numeroPedidoEcommerce', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_ecommerce->>'numeroPedidoCanalVenda', '')::TEXT), ''),
        
        -- Vendedor
        NULLIF(TRIM(COALESCE(v_pedido->>'id_vendedor', '')::TEXT), ''),
        NULLIF(TRIM(COALESCE(v_pedido->>'nome_vendedor', '')::TEXT), ''),
        
        -- Arrays JSONB (manter formato original - preservar strings, datas DD/MM/YYYY)
        COALESCE(v_itens, '[]'::jsonb),
        COALESCE(v_parcelas, '[]'::jsonb),
        COALESCE(v_pagamentos_integrados, '[]'::jsonb),
        COALESCE(v_marcadores, '[]'::jsonb)
    FROM public.pedidos_tiny pt
    WHERE pt.id = p_pedido_tiny_id
    RETURNING id INTO v_detalhes_id;
    
    -- Atualizar status do pedido em pedidos_tiny para DETALHADO
    -- Apenas atualizar se inserção foi bem-sucedida
    IF v_detalhes_id IS NOT NULL THEN
        UPDATE public.pedidos_tiny
        SET 
            status = 'DETALHADO',
            data_detalhamento = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_tiny_id;
    END IF;
    
    RETURN v_detalhes_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Bug #16: Se houver conflito de UNIQUE (pedido já detalhado), retornar ID existente
        SELECT id INTO v_existing_detalhes_id
        FROM public.pedidos_tiny_detalhes
        WHERE pedido_tiny_id = p_pedido_tiny_id;
        
        IF v_existing_detalhes_id IS NOT NULL THEN
            RETURN v_existing_detalhes_id;
        ELSE
            RAISE;
        END IF;
    WHEN OTHERS THEN
        -- Relançar outros erros
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.insert_pedido_detalhado_jsonb IS 'Insere detalhes completos de um pedido em pedidos_tiny_detalhes e atualiza status do pedido para DETALHADO. Recebe objeto JSON completo e extrai campos individuais, preservando arrays em JSONB com formato original.';
