
# 🧠 Fluxo 1 – Pesquisar Pedidos (Tiny API) – Versão Atualizada

Fluxo responsável por consultar pedidos da **API Tiny** (`pedidos.pesquisa.php`) para cada tenant ativo,
controlando paginação, respeitando o limite de requisições e salvando resultados no Supabase.

Agora com suporte à **carga inicial (30 dias)** e **atualização diária** automática.

---

## 🎯 Objetivo
- Realizar a **primeira carga** dos últimos **30 dias** (a partir de ontem) quando um novo token é cadastrado.  
- Nas execuções seguintes, buscar apenas **o dia anterior**.  
- Salvar todos os pedidos no **Supabase**, vinculando cada tenant e partner.  
- Manter controle de limites de requisições e estado de sincronização.

---

## 🧩 Estrutura do Fluxo

| Ordem | Node | Função |
|--------|-------|--------|
| 1️⃣ | **Start** | Início do fluxo |
| 2️⃣ | **Supabase → Buscar Tenants Ativos** | Lista tenants com tokens Tiny válidos |
| 3️⃣ | **Split In Batches** | Itera um tenant por vez |
| 4️⃣ | **Function → Calcular Período** | Define se é carga inicial (30 dias) ou atualização diária |
| 5️⃣ | **HTTP Request → Buscar Página 1 (Tiny)** | Faz a primeira requisição de pesquisa |
| 6️⃣ | **Function → Paginar Resultados** | Busca páginas adicionais conforme `numero_paginas` |
| 7️⃣ | **Supabase → Inserir Pedidos** | Insere pedidos no banco |
| 8️⃣ | **Supabase → Atualizar Tenant** | Marca carga inicial concluída e registra data da execução |
| 9️⃣ | **Supabase → Atualizar Limite** | Atualiza o contador de uso do tenant |

---

## ⚙️ Etapas Detalhadas

### 1️⃣ Supabase → Buscar Tenants Ativos
- **Operação:** Select  
- **Tabela:** `tenants`
- **Colunas esperadas:**  
  `id_tenant`, `id_partner`, `token_tiny`, `limite_por_minuto`, `ativo`, `primeira_execucao`, `data_ultima_execucao`
- **Filtro:** `ativo = true`

Retorna todos os tenants ativos com status de execução.

---

### 2️⃣ Split In Batches
- **Tamanho do lote:** 1 (processa um tenant por vez)

---

### 3️⃣ Function → Calcular Período

Determina se deve buscar 30 dias (carga inicial) ou 1 dia (atualização diária).

```javascript
const hoje = new Date();
const ontem = new Date(hoje);
ontem.setDate(hoje.getDate() - 1);

// Se for a primeira execução, pega últimos 30 dias a partir de ontem
let dataInicial;
if ($json.primeira_execucao) {
  dataInicial = new Date(ontem);
  dataInicial.setDate(ontem.getDate() - 29); // últimos 30 dias contando o dia anterior
} else {
  // Atualização diária: apenas o dia anterior
  dataInicial = new Date(ontem);
}

function fmt(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
}

return [{
  json: {
    id_tenant: $json.id_tenant,
    id_partner: $json.id_partner,
    token_tiny: $json.token_tiny,
    limite: $json.limite_por_minuto,
    primeira_execucao: $json.primeira_execucao,
    dataInicial: fmt(dataInicial),
    dataFinal: fmt(ontem)
  }
}];
```

---

### 4️⃣ HTTP Request → Buscar Página 1 (Tiny)
- **Método:** POST  
- **URL:** `https://api.tiny.com.br/api2/pedidos.pesquisa.php`  
- **Body Parameters:**  
  | Campo | Valor |
  |--------|--------|
  | token | `{{ $json.token_tiny }}` |
  | formato | `JSON` |
  | dataInicial | `{{ $json.dataInicial }}` |
  | dataFinal | `{{ $json.dataFinal }}` |
  | pagina | `1` |
- **Response Format:** JSON

---

### 5️⃣ Function → Paginar Resultados

```javascript
const response = $json.retorno;
const pedidosTotais = [...(response.pedidos || [])];
const totalPaginas = parseInt(response.numero_paginas) || 1;
const token = $node["Function - Calcular Período"].item.json.token_tiny;
const dataInicial = $node["Function - Calcular Período"].item.json.dataInicial;
const dataFinal = $node["Function - Calcular Período"].item.json.dataFinal;

async function getPagina(pagina) {
  const req = await $node["HTTP Request - Buscar Página 1 (Tiny)"].httpRequest({
    method: "POST",
    url: "https://api.tiny.com.br/api2/pedidos.pesquisa.php",
    body: { token, formato: "JSON", dataInicial, dataFinal, pagina },
    json: true,
  });
  return req.retorno.pedidos || [];
}

// Loop de paginação
for (let p = 2; p <= totalPaginas; p++) {
  const pedidos = await getPagina(p);
  pedidosTotais.push(...pedidos);
}

// Retorna pedidos normalizados
return pedidosTotais.map(p => ({
  json: {
    id_tenant: $node["Function - Calcular Período"].item.json.id_tenant,
    id_partner: $node["Function - Calcular Período"].item.json.id_partner,
    numero: p.pedido.numero,
    id_pedido_tiny: p.pedido.id,
    data_pedido: p.pedido.data_pedido,
    situacao: p.pedido.situacao,
    valor_total: p.pedido.valor,
    consultado: false,
    data_consulta: null
  }
}));
```

---

### 6️⃣ Supabase → Inserir Pedidos
- **Operação:** Insert  
- **Tabela:** `pedidos_tiny`  
- **Campos:**  
  `id_tenant`, `id_partner`, `id_pedido_tiny`, `numero`, `situacao`, `data_pedido`, `valor_total`, `consultado`, `data_consulta`

---

### 7️⃣ Supabase → Atualizar Tenant
Após a inserção dos pedidos, marca que o tenant já executou a carga inicial e registra a data da execução.

- **Operação:** Update  
- **Tabela:** `tenants`  
- **Filtro:** `id_tenant = {{ $json.id_tenant }}`  
- **Campos:**  
  ```json
  {
    "primeira_execucao": false,
    "data_ultima_execucao": "{{ new Date().toISOString().split('T')[0] }}"
  }
  ```

---

### 8️⃣ Supabase → Atualizar Contador de Requisições
- **Operação:** Update  
- **Tabela:** `limites_uso`  
- **Filtro:** `id_tenant = {{ $json.id_tenant }}`  
- **Campos:** `requisicoes_feitas = requisicoes_feitas + totalPaginas`

---

## ✅ Resultado Final

- Primeira execução → busca dos **últimos 30 dias a partir de ontem**.  
- Execuções seguintes → busca apenas **o dia anterior**.  
- Pedidos salvos com `consultado = false`.  
- Tenant atualizado como `primeira_execucao = false`.  
- Pronto para seguir para o **Fluxo 2 – Detalhar Pedidos (Tiny)**.

---

## 📚 Próximo Fluxo
O **Fluxo 2 (Detalhar Pedidos Tiny)** irá:
- Buscar pedidos não detalhados (`consultado = false`)
- Consultar `pedido.obter.php`
- Salvar detalhes
- Atualizar status e data de consulta
