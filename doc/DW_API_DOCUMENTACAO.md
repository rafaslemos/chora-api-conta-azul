# Documentação da API do Data Warehouse

## Visão Geral

A API do Data Warehouse fornece acesso read-only aos dados consolidados via autenticação por API Key única por cliente. Cada cliente recebe uma chave de API que permite acessar apenas seus próprios dados.

## Autenticação

Todas as requisições devem incluir a API Key em um dos seguintes headers:

- `x-api-key: <sua-api-key>`
- `Authorization: Bearer <sua-api-key>`

## Endpoint Base

```
https://<seu-projeto>.supabase.co/functions/v1/dw-api
```

## Endpoints Disponíveis

### Listar Credenciais Conta Azul

Retorna a lista de credenciais Conta Azul ativas do tenant.

**Request:**
```http
GET /dw-api?table=vw_conta_azul_credentials&limit=100&offset=0
x-api-key: sua-api-key-aqui
```

**Parâmetros de Query:**
- `table` (obrigatório): Nome da tabela/view a ser consultada. Atualmente apenas `vw_conta_azul_credentials` é suportada.
- `limit` (opcional): Número máximo de registros a retornar. Padrão: 100. Máximo: 1000.
- `offset` (opcional): Número de registros a pular (para paginação). Padrão: 0.

**Response de Sucesso (200):**
```json
{
  "success": true,
  "tenant_id": "uuid-do-tenant",
  "table": "vw_conta_azul_credentials",
  "data": [
    {
      "tenant_id": "uuid",
      "tenant_name": "Nome do Cliente",
      "tenant_cnpj": "12.345.678/0001-90",
      "credential_id": "uuid",
      "credential_name": "Matriz SP",
      "is_active": true,
      "last_authenticated_at": "2024-01-15T10:30:00Z",
      "last_sync_at": "2024-01-15T11:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T11:00:00Z"
    }
  ],
  "count": 1,
  "limit": 100,
  "offset": 0
}
```

**Response de Erro (401):**
```json
{
  "success": false,
  "error": "API Key inválida ou não encontrada"
}
```

**Response de Erro (400):**
```json
{
  "success": false,
  "error": "Tabela/view \"tabela_invalida\" não permitida. Tabelas permitidas: vw_conta_azul_credentials"
}
```

## Gerar API Key

As API Keys devem ser geradas através do painel administrativo do app. Cada tenant pode ter múltiplas API Keys, cada uma com um nome descritivo.

### Características das API Keys

- São geradas com 32 caracteres aleatórios
- São armazenadas como hash SHA-256 no banco de dados
- Podem ter data de expiração (opcional)
- Podem ser desativadas a qualquer momento
- O último uso é registrado automaticamente

## Exemplos de Uso

### cURL

```bash
curl -X GET \
  "https://seu-projeto.supabase.co/functions/v1/dw-api?table=vw_conta_azul_credentials&limit=50" \
  -H "x-api-key: sua-api-key-aqui"
```

### JavaScript/TypeScript

```javascript
const response = await fetch(
  'https://seu-projeto.supabase.co/functions/v1/dw-api?table=vw_conta_azul_credentials&limit=50',
  {
    method: 'GET',
    headers: {
      'x-api-key': 'sua-api-key-aqui',
    },
  }
);

const data = await response.json();
console.log(data);
```

### Python

```python
import requests

response = requests.get(
    'https://seu-projeto.supabase.co/functions/v1/dw-api',
    params={
        'table': 'vw_conta_azul_credentials',
        'limit': 50,
    },
    headers={
        'x-api-key': 'sua-api-key-aqui',
    }
)

data = response.json()
print(data)
```

## Limitações

- Apenas operações de leitura (GET) são permitidas
- Cada requisição retorna no máximo 1000 registros
- Apenas dados do próprio tenant são acessíveis
- Rate limiting pode ser aplicado no futuro

## Segurança

- API Keys nunca devem ser expostas em código frontend ou versionadas no Git
- Use variáveis de ambiente para armazenar API Keys
- Revogue imediatamente qualquer API Key que tenha sido comprometida
- Monitore o uso das API Keys através do painel administrativo

## Suporte

Para suporte ou dúvidas sobre a API, entre em contato com a equipe de desenvolvimento.
