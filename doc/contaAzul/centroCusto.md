# Retornar os centros de custo por filtro

Retorna os centros de custo cadastrados que atendam Ã s condiÃ§Ãµes do filtro aplicado -  utilizados para classificar lanÃ§amentos financeiros e facilitar o controle e anÃ¡lise  de pagamentos e recebimentos

Endpoint: GET /v1/centro-de-custo
Version: v1
Security: BearerAuth

## Query parameters:

  - `pagina` (number, required)
    PÃ¡gina
    Example: 1

  - `tamanho_pagina` (number, required)
    Tamanho da pÃ¡gina
    Example: 10

  - `busca` (string)
    Busca textual por nome ou cÃ³digo
    Example: "010"

  - `filtro_rapido` (string)
    Filtro rÃ¡pido para itens ativos, inativos ou todos
    Enum: "ATIVO", "INATIVO", "TODOS"

  - `campo_ordenado_ascendente` (string)
    Campo para ordenaÃ§Ã£o ascendente. Se informado ele desconsidera o valor do campo_ordenado_descendente. Ã‰ possÃ­vel ordenar por nome ou por cÃ³digo
    Example: "nome"

  - `campo_ordenado_descendente` (string)
    Campo para ordenaÃ§Ã£o descendente. Se este campo for utilizado, o campo campo_ordenado_ascendente  nÃ£o deverÃ¡ ser informado. Ã‰ possÃ­vel ordenar por nome ou por cÃ³digo
    Example: "nome"

## Response 200 fields (application/json):

  - `itens_totais` (integer)
    Example: 6

  - `items` (array)

  - `items.id` (string)
    Identificador Ãºnico do centro de custo
    Example: "35473eec-4e74-11ee-b500-9f61de8a8b8b"

  - `items.codigo` (string,null)
    CÃ³digo do centro de custo
    Example: "1040"

  - `items.nome` (string)
    Nome do centro de custo
    Example: "Contabilidade"

  - `items.ativo` (boolean)
    Indica se o centro de custo estÃ¡ ativo
    Example: true

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
