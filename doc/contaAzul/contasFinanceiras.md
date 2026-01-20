# Retornar as contas financeiras por filtro

Procura e retorna as contas financeiras que atendam Ã s condiÃ§Ãµes do filtro aplicado

Endpoint: GET /v1/conta-financeira
Version: v1
Security: BearerAuth

## Query parameters:

  - `pagina` (integer)
    PÃ¡gina
    Example: 1

  - `tamanho_pagina` (integer)
    Tamanho da pÃ¡gina
    Example: 10

  - `tipos` (array)
    Lista de tipos de conta
    Enum: "APLICACAO", "CAIXINHA", "CONTA_CORRENTE", "CARTAO_CREDITO", "INVESTIMENTO", "OUTROS", "MEIOS_RECEBIMENTO", "POUPANCA", "COBRANCAS_CONTA_AZUL", "RECEBA_FACIL_CARTAO"

  - `nome` (string)
    Nome da conta
    Example: "Conta corrente"

  - `apenas_ativo` (boolean)
    Filtrar apenas contas ativas
    Example: true

  - `esconde_conta_digital` (boolean)
    Esconder contas digitais
    Example: true

  - `mostrar_caixinha` (boolean)
    Mostrar contas de caixinha
    Example: true

## Response 200 fields (application/json):

  - `itens_totais` (integer)
    Example: 6

  - `itens` (array)

  - `itens.id` (string)
    Identificador Ãºnico da conta financeira
    Example: "35473eec-4e74-11ee-b500-9f61de8a8b8b"

  - `itens.banco` (string)
    InstituiÃ§Ã£o bancÃ¡ria
    Enum: "BANCO_BRASIL", "BRADESCO", "CAIXA_ECONOMICA", "HSBC", "ITAU", "INTER", "ORIGINAL", "SANTANDER", "BANCOOB", "BANESTES", "BANPARA", "BANRISUL", "BCN", "BANK_BOSTON", "BANCO_BRASILIA", "BANCO_NORDESTE", "CITIBANK", "CREDISAN", "NOSSA_CAIXA", "MERCANTIL", "REAL", "SAFRA", "SICREDI", "SUDAMERIS", "UNIBANCO", "SICOOB", "AILOS", "BS2", "NUBANK", "UNICRED", "NEON", "C6", "CORA", "ACESSO", "STONE", "AGIBANK", "ASAAS", "TOPAZIO", "DAYCOVAL", "BANCO_AMAZONIA", "BANESE", "BTG_PACTUAL", "OMNI", "GENIAL", "CAPITAL", "RIBEIRAO_PRETO", "PAN", "BMG", "BNP_PARIBAS_BRASIL", "CCR_SAO_MIGUEL_OESTE", "CREDISIS", "CRESOL", "FITBANK", "GERENCIANET", "GLOBAL_SCM", "JP_MORGAN", "JUNO", "MERCADO_PAGO", "MODAL", "MONEY_PLUS", "NEXT", "OTIMO", "PAGSEGURO", "PICPAY", "PJBANK", "POLOCRED", "RENDIMENTO", "UNIPRIME", "UNIPRIME_NORTE_PARANA", "VORTX_DTVM", "BRL_TRUST", "IUGU", "OUTROS", "NAO_BANCO"

  - `itens.codigo_banco` (integer)
    CÃ³digo da instituiÃ§Ã£o bancÃ¡ria
    Example: 1

  - `itens.nome` (string)
    Nome da conta financeira
    Example: "Conta Corrente"

  - `itens.ativo` (boolean)
    Indica se a conta estÃ¡ ativa
    Example: true

  - `itens.tipo` (string)
    Tipo da conta
    Enum: "APLICACAO", "CAIXINHA", "CONTA_CORRENTE", "CARTAO_CREDITO", "INVESTIMENTO", "OUTROS", "MEIOS_RECEBIMENTO", "POUPANCA", "COBRANCAS_CONTA_AZUL", "RECEBA_FACIL_CARTAO"

  - `itens.conta_padrao` (boolean)
    Indica se Ã© a conta padrÃ£o
    Example: true

  - `itens.possui_config_boleto_bancario` (boolean)
    Indica se a conta possui configuraÃ§Ã£o de boleto bancÃ¡rio

  - `itens.agencia` (string)
    AgÃªncia da conta
    Example: "001"

  - `itens.numero` (string)
    NÃºmero da conta
    Example: "31"

  - `totais` (object)

  - `totais.ativo` (integer)
    Total de centros de custo ativos
    Example: 6

  - `totais.inativo` (integer)
    Total de centros de custo inativos

  - `totais.todos` (integer)
    Total de centros de custo
    Example: 6


## Response 400 fields

## Response 401 fields

## Response 429 fields

## Response 500 fields
