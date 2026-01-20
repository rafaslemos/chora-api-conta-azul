# Retornar as categorias por filtro

Procura e retorna as categorias que atendam Ã s condiÃ§Ãµes do filtro aplicado

Endpoint: GET /v1/categorias
Version: v1
Security: BearerAuth

## Query parameters:

  - `pagina` (number, required)
    PÃ¡gina
    Example: 1

  - `tamanho_pagina` (number, required)
    Tamanho da pÃ¡gina
    Example: 10

  - `campo_ordenado_ascendente` (string)
    Campo para ordenaÃ§Ã£o ascendente. Se informado ele desconsidera o valor do  campo_ordenado_descendente. Ã‰ possÃ­vel ordenar por 'NOME' ou 'TIPO'
    Enum: "NOME", "TIPO"

  - `campo_ordenado_descendente` (string)
    Campo para ordenaÃ§Ã£o descendente. Se este campo for utilizado, o campo campo_ordenado_ascendente nÃ£o  deverÃ¡ ser informado. Ã‰ possÃ­vel ordenar por 'NOME' ou 'TIPO'
    Enum: "NOME", "TIPO"

  - `busca` (string)
    Busca textual por nome ou cÃ³digo
    Example: "010"

  - `tipo` (string)
    Tipo da categoria
    Enum: "RECEITA", "DESPESA"

  - `apenas_filhos` (boolean)
    Filtrar apenas categorias filhas
    Example: true

  - `nome` (string)
    Nome da categoria
    Example: "EletrÃ´nicos"

  - `permite_apenas_filhos` (boolean, required)
    Permite apenas categorias filhas
    Example: true

## Response 200 fields (application/json):

  - `itens_totais` (integer)
    Example: 6

  - `itens` (array)

  - `itens.id` (string)
    Example: "35473eec-4e74-11ee-b500-9f61de8a8b8b"

  - `itens.versao` (integer)

  - `itens.nome` (string)
    Example: "EletrÃ´nicos"

  - `itens.categoria_pai` (string,null)
    Example: "3d39b8d2-8b16-42d6-abd8-6cfd9d2e06c4"

  - `itens.tipo` (string)
    Example: "RECEITA"

  - `itens.entrada_dre` (string)
    Example: "DESPESAS_ADMINISTRATIVAS"

  - `itens.considera_custo_dre` (boolean)
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
