# Criar uma nova venda

Endpoint: POST /v1/venda
Version: v1
Security: BearerAuth

## Request fields (application/json):

  - `id_cliente` (string, required)
    id do cliente
    Example: "123e4567-e89b-12d3-a456-426614174000"

  - `numero` (integer, required)
    NÃºmero da venda
    Example: 1001

  - `situacao` (string, required)
    SituaÃ§Ã£o da venda
    Enum: "EM_ANDAMENTO", "APROVADO"

  - `data_venda` (string, required)
    Data da venda
    Example: "2023-12-31"

  - `id_categoria` (string)
    id da categoria
    Example: "123e4567-e89b-12d3-a456-426614174000"

  - `id_centro_custo` (string)
    id do centro de custo
    Example: "123e4567-e89b-12d3-a456-426614174000"

  - `id_vendedor` (string)
    id do vendedor
    Example: "40bbdaa5-65c2-49e9-b892-470fd1093ed3"

  - `observacoes` (string)
    ObservaÃ§Ãµes sobre a venda
    Example: "ObservaÃ§Ãµes sobre a venda"

  - `observacoes_pagamento` (string)
    ObservaÃ§Ãµes sobre o pagamento
    Example: "ObservaÃ§Ãµes sobre o pagamento"

  - `itens` (array, required)

  - `itens.descricao` (string)
    DescriÃ§Ã£o do item da venda
    Example: "Produto A"

  - `itens.quantidade` (number, required)
    Quantidade do item da venda
    Example: 2

  - `itens.valor` (number, required)
    Valor do item da venda
    Example: 50

  - `itens.id` (string, required)
    id do item da venda
    Example: "550e8400-e29b-41d4-a716-446655440000"

  - `itens.valor_custo` (number)
    Valor de custo do item da venda.
    Example: 40

  - `composicao_de_valor` (object)

  - `composicao_de_valor.frete` (number)
    Valor de frete.
    Example: 100

  - `composicao_de_valor.desconto` (object)

  - `composicao_de_valor.desconto.tipo` (string, required)
    Tipo de desconto
    Enum: "PORCENTAGEM", "VALOR"

  - `composicao_de_valor.desconto.valor` (number, required)
    Valor do desconto
    Example: 5

  - `condicao_pagamento` (object, required)

  - `condicao_pagamento.tipo_pagamento` (string)
    Forma de pagamento
    Enum: "BOLETO_BANCARIO", "CARTAO_CREDITO", "CARTAO_DEBITO", "CARTEIRA_DIGITAL", "CASHBACK", "CHEQUE", "CREDITO_LOJA", "CREDITO_VIRTUAL", "DEPOSITO_BANCARIO", "DINHEIRO", "OUTRO", "DEBITO_AUTOMATICO", "CARTAO_CREDITO_VIA_LINK", "PIX_PAGAMENTO_INSTANTANEO", "PIX_COBRANCA", "PROGRAMA_FIDELIDADE", "SEM_PAGAMENTO", "TRANSFERENCIA_BANCARIA", "VALE_ALIMENTACAO", "VALE_COMBUSTIVEL", "VALE_PRESENTE", "VALE_REFEICAO"

  - `condicao_pagamento.id_conta_financeira` (string)
    id da conta financeira
    Example: "550e8400-e29b-41d4-a716-446655440000"

  - `condicao_pagamento.opcao_condicao_pagamento` (string, required)
    Deve ser em um dos trÃªs formatos: - 1Âº: Ex: Ã€ vista. - 2Âº: Ex1: 30, 60, 90. Ex2: 15, 30, 45. - 3Âº: Ex1: 3x. Ex2: 12x
    Example: "Ã€ vista"

  - `condicao_pagamento.nsu` (string)
    NSU
    Example: "1234567890"

  - `condicao_pagamento.parcelas` (array, required)

  - `condicao_pagamento.parcelas.data_vencimento` (string, required)
    Data de vencimento
    Example: "2023-12-31"

  - `condicao_pagamento.parcelas.valor` (number, required)
    Valor da parcela
    Example: 100

  - `condicao_pagamento.parcelas.descricao` (string)
    DescriÃ§Ã£o da parcela
    Example: "Parcela 1"

## Response 200 fields (application/json):

  - `id` (string)
    id Ãºnico da venda
    Example: "123e4567-e89b-12d3-a456-426614174000"

  - `id_legado` (integer)
    id legado necessÃ¡rio para a venda
    Example: 123456

  - `id_cliente` (string)
    id do cliente associado Ã  venda
    Example: "123e4567-e89b-12d3-a456-426614174001"

  - `numero` (integer)
    NÃºmero da venda
    Example: 1001

  - `origem` (string)
    Origem da venda
    Example: "Online"

  - `id_categoria` (string)
    id da categoria da venda
    Example: "123e4567-e89b-12d3-a456-426614174002"

  - `data_venda` (string)
    Data da venda
    Example: "2023-10-01T12:00:00Z"

  - `situacao` (object)

  - `situacao.nome` (string)
    Nome da situaÃ§Ã£o
    Example: "SituaÃ§Ã£o Exemplo"

  - `situacao.descricao` (string)
    DescriÃ§Ã£o da situaÃ§Ã£o
    Example: "DescriÃ§Ã£o da situaÃ§Ã£o exemplo"

  - `pendencia` (object)

  - `pendencia.nome` (string)
    Nome da pendÃªncia
    Example: "AGUARDANDO_CONFIRMACAO"

  - `pendencia.descricao` (string)
    DescriÃ§Ã£o da pendÃªncia
    Example: "Aguardando confirmaÃ§Ã£o"

  - `valor_composicao` (object)

  - `valor_composicao.valor_bruto` (number)
    Valor bruto da venda
    Example: 100

  - `valor_composicao.desconto` (object)

  - `valor_composicao.desconto.tipo` (string, required)
    Tipo de desconto
    Enum: "PORCENTAGEM", "VALOR"

  - `valor_composicao.desconto.valor` (number, required)
    Valor do desconto
    Example: 5

  - `valor_composicao.frete` (number)
    Valor do frete
    Example: 10

  - `valor_composicao.valor_liquido` (number)
    Valor lÃ­quido da venda
    Example: 90

  - `condicao_pagamento` (object)

  - `condicao_pagamento.id_legado` (integer)
    id legado da condiÃ§Ã£o de pagamento
    Example: 123456789

  - `condicao_pagamento.tipo_pagamento` (string)
    Tipo de pagamento
    Enum: "BOLETO_BANCARIO", "CARTAO_CREDITO", "CARTAO_DEBITO", "CARTEIRA_DIGITAL", "CASHBACK", "CHEQUE", "CREDITO_LOJA", "CREDITO_VIRTUAL", "DEPOSITO_BANCARIO", "DINHEIRO", "OUTRO", "DEBITO_AUTOMATICO", "CARTAO_CREDITO_VIA_LINK", "PIX_PAGAMENTO_INSTANTANEO", "PIX_COBRANCA", "PROGRAMA_FIDELIDADE", "SEM_PAGAMENTO", "TRANSFERENCIA_BANCARIA", "VALE_ALIMENTACAO", "VALE_COMBUSTIVEL", "VALE_PRESENTE", "VALE_REFEICAO"

  - `condicao_pagamento.id_conta_financeira` (string)
    id da conta financeira
    Example: "550e8400-e29b-41d4-a716-446655440000"

  - `condicao_pagamento.opcao_condicao_pagamento` (string)
    OpÃ§Ã£o de condiÃ§Ã£o de pagamento
    Example: "Parcelado"

  - `condicao_pagamento.parcelas` (array)

  - `condicao_pagamento.parcelas.data_vencimento` (string)
    Data de vencimento
    Example: "2023-12-31"

  - `condicao_pagamento.parcelas.valor` (number)
    Valor da parcela
    Example: 100

  - `condicao_pagamento.parcelas.descricao` (string)
    DescriÃ§Ã£o da parcela
    Example: "Parcela 1"

  - `condicao_pagamento.parcelas.numero` (integer)
    NÃºmero da parcela
    Example: 1

  - `condicao_pagamento.observacoes_pagamento` (string)
    ObservaÃ§Ãµes sobre o pagamento
    Example: "Pagamento realizado em 3 parcelas"

  - `condicao_pagamento.nsu` (string)
    NSU
    Example: "1234567890"

  - `condicao_pagamento.troco_total` (number)
    Troco total
    Example: 10.5

  - `observacoes` (string)
    ObservaÃ§Ãµes sobre a venda
    Example: "Cliente solicitou entrega rÃ¡pida"

  - `id_vendedor` (string)
    id do vendedor responsÃ¡vel pela venda
    Example: "123e4567-e89b-12d3-a456-426614174003"

  - `versao` (integer)
    VersÃ£o da venda
    Example: 1


## Response 400 fields

## Response 401 fields

## Response 429 fields

## Response 500 fields
