# Análise Detalhada de Workflows n8n - BPO-Automatizado

> **Gerado em:** 08/12/2025, 18:56:37  
> **Total de workflows analisados:** 13  
> **URL do n8n:** https://automacoes.choraapi.com.br/  

---

## 1. get-tokens-conta-azul-external

**ID:** `9cSrzA17xcJkRnz4`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/9cSrzA17xcJkRnz4)  
**Criado em:** 22/10/2025, 22:06:47  
**Atualizado em:** 05/12/2025, 20:50:28  
**Total de nodes:** 12  

### Nodes do Workflow

#### 1. Webhook

- **ID do Node:** `ffdd457d-1d60-4132-a937-dd9b6689fa32`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `e5a3fe21-ffb8-4f70-bd7c-0a09b330126f`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: v1/conta-azul/refresh-token
- **authentication**: headerAuth
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 2. organiza_campos

- **ID do Node:** `024129a9-ff29-4de1-9c4f-a6317b17b530`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"b2fba3e3-faba-4b4e-8e81-edfb252f3815","name":"credential_id","value":"={{ $js...  

---

#### 3. Get Credential

- **ID do Node:** `2e2459b3-e26d-43d3-8167-0c46fe02316b`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 4. Get Platform

- **ID do Node:** `368c81bd-7c5a-422f-8b67-ae0b113d3086`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 5. Create Basic Auth

- **ID do Node:** `0b1ceb12-6369-46c3-9883-a5d92a27cff5`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const clientId = $('Get Platform').item.json.auth_config.oauth_client_id;
const   

---

#### 6. Get Tokens from Vault

- **ID do Node:** `d8bb455e-120f-4ef5-81c7-58ddefd0125d`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/get_decrypted_credentials
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 7. Validar Refresh Token

- **ID do Node:** `06574bed-6119-43b4-96ef-a39fe4716440`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose","version":2},"conditions":[...  

---

#### 8. HTTP Request

- **ID do Node:** `486c19ca-4393-49cf-9f83-35c03780f6b2`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://auth.contaazul.com/oauth2/token
- **method**: POST
- **options**: {}...  

---

#### 9. Prepare New Tokens

- **ID do Node:** `1032d9cd-0353-4c60-a828-90fe51109f37`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const newAccessToken = $json.access_token;
const newRefreshToken = $json.refresh  

---

#### 10. Update Vault

- **ID do Node:** `5a09f08c-46d2-4553-bab9-7e877692efc7`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/update_credentials_vault
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 11. Response Success

- **ID do Node:** `a9a603bc-908f-41ee-b192-cd2c6475dd53`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 12. Respond Success

- **ID do Node:** `52361a94-bfc6-4b07-a3d0-7c0c1d8039d4`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---


## 2. Hotmart Import Batch - CORRIGIDO

**ID:** `CqS8tRhBeoTo4BzX`  
**Status:** ⏸️ Inativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/CqS8tRhBeoTo4BzX)  
**Criado em:** 23/11/2025, 09:18:26  
**Atualizado em:** 05/12/2025, 20:51:13  
**Total de nodes:** 17  

### Nodes do Workflow

#### 1. Prepare Row Data

- **ID do Node:** `2215f8e9-ce6c-48ba-bb4d-8f0267d52d02`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Preparar dados para processamento individual de cada row
const items = $input  

---

#### 2. Check Customer Exists

- **ID do Node:** `a1f46b52-aa3e-4002-bf21-b0495f0e942c`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: ={{ $env.N8N_BASE_URL }}/webhook/v1/conta-azul/data
- **authentication**: genericCredentialType
- **options**: {}...  

---

#### 3. Check Product Exists

- **ID do Node:** `533b5d00-1543-4a2a-a737-a9defd2ebd99`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: ={{ $env.N8N_BASE_URL }}/webhook/v1/conta-azul/data
- **authentication**: genericCredentialType
- **options**: {}...  

---

#### 4. Create Sale

- **ID do Node:** `d0c3c7ff-2b5f-4d1a-bc43-dac738c32ec4`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: ={{ $env.N8N_BASE_URL }}/webhook/v1/conta-azul/create-sale
- **authentication**: genericCredentialType
- **options**: {}...  

---

#### 5. Prepare Payables

- **ID do Node:** `c69d117d-5349-414a-a5b9-54b8707a89ec`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Criar array de payables condicionalmente
const item = $input.item(0);
const n  

---

#### 6. Loop Over Payables

- **ID do Node:** `ec5a0a0c-7f74-44f3-91ee-97ebfa99cbfe`  
- **Tipo:** `n8n-nodes-base.splitInBatches` (splitInBatches)  
- **Versão do Tipo:** 3  
- **Descrição:** Divide dados em lotes para processamento  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 7. Create Payable

- **ID do Node:** `95933cc3-c0c5-4e71-a8bf-f0654f03c0fe`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: ={{ $env.N8N_BASE_URL }}/webhook/v1/conta-azul/create-payable
- **authentication**: genericCredentialType
- **options**: {}...  

---

#### 8. Update Row - Success

- **ID do Node:** `13fa6e9b-1027-4f59-8061-2e5852e329a6`  
- **Tipo:** `n8n-nodes-base.postgres` (postgres)  
- **Versão do Tipo:** 2.5  
- **Descrição:** Operações com banco de dados PostgreSQL  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update
- **options**: {}...  

---

#### 9. Check More Chunks

- **ID do Node:** `30ae8e59-882f-4477-bf6d-1fa90bc915da`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"id":"has-...  

---

#### 10. Webhook Import

- **ID do Node:** `dfbe53aa-af0e-459a-bffc-a52a5375ab8e`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2.1  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `hotmart-import-batch`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: v1/hotmart/import-batch
- **authentication**: headerAuth
- **options**: {}...  

---

#### 11. Fetch Batch

- **ID do Node:** `ce123514-3e66-47cc-b9e0-88c6a73e40f0`  
- **Tipo:** `n8n-nodes-base.postgres` (postgres)  
- **Versão do Tipo:** 2.5  
- **Descrição:** Operações com banco de dados PostgreSQL  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: executeQuery
- **options**: {}...  

---

#### 12. Update Batch - Processing

- **ID do Node:** `de11e951-32a5-48d6-a9ce-506e734d3b68`  
- **Tipo:** `n8n-nodes-base.postgres` (postgres)  
- **Versão do Tipo:** 2.5  
- **Descrição:** Operações com banco de dados PostgreSQL  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update
- **options**: {}...  

---

#### 13. Respond 202

- **ID do Node:** `866c37b1-e9e5-447d-a98a-bf731dbc0770`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {"responseCode":202}...  

---

#### 14. Fetch Hotmart Config

- **ID do Node:** `b4614d95-85c9-46d8-b4e8-f1e39ae70420`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: ={{ $env.SUPABASE_URL }}/functions/v1/get-integration-config
- **authentication**: genericCredentialType
- **options**: {}...  

---

#### 15. Fetch Chunk

- **ID do Node:** `1e9dcb6a-d223-47d7-956c-c59801e26f1e`  
- **Tipo:** `n8n-nodes-base.postgres` (postgres)  
- **Versão do Tipo:** 2.5  
- **Descrição:** Operações com banco de dados PostgreSQL  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: executeQuery
- **options**: {}...  

---

#### 16. Check Has Rows

- **ID do Node:** `f7612e1a-62d3-458e-820e-7259cf166441`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"id":"has-...  

---

#### 17. Update Batch - Completed

- **ID do Node:** `c87b5699-63df-479f-906c-9844704e0803`  
- **Tipo:** `n8n-nodes-base.postgres` (postgres)  
- **Versão do Tipo:** 2.5  
- **Descrição:** Operações com banco de dados PostgreSQL  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update
- **options**: {}...  

---


## 3. v1/hotmart/batch/process

**ID:** `DqGJS5RHUugQnMdc`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/DqGJS5RHUugQnMdc)  
**Criado em:** 10/11/2025, 14:27:40  
**Atualizado em:** 05/12/2025, 20:49:14  
**Total de nodes:** 1  

### Nodes do Workflow

#### 1. Webhook

- **ID do Node:** `cf1e71b3-b3c6-47eb-8940-f71eeaf312f1`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2.1  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `3419a662-9002-48b6-a78d-847d34632875`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: v1/hotmart/batch/process
- **authentication**: headerAuth
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---


## 4. Pagtrust

**ID:** `J41Mgd0TecF4J8fc`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/J41Mgd0TecF4J8fc)  
**Criado em:** 19/10/2025, 21:08:28  
**Atualizado em:** 05/12/2025, 20:50:07  
**Total de nodes:** 11  

### Nodes do Workflow

#### 1. Edit Fields1

- **ID do Node:** `941eb625-96d2-43eb-a363-965e9c78dc11`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 2. Respond to Webhook

- **ID do Node:** `e0cce157-45be-46de-ab5f-229ee8c5925e`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 3. Webhook

- **ID do Node:** `c0224dd3-58ea-4301-a4e5-4c483df046aa`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `cbdaa2ea-ef3a-4dc9-81da-d8741adb4cf2`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: pagtrust-credential
- **authentication**: headerAuth
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 4. organiza_campos

- **ID do Node:** `bfb297ad-9cce-4a4a-bbbb-d23bea1e432f`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 5. Update a row

- **ID do Node:** `a0dce4de-87c5-44c5-a2e5-96b07d87351b`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 6. Get many rows

- **ID do Node:** `bb1861f2-8e89-4bb3-91a9-6f2cdd8688cc`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 7. HTTP Request

- **ID do Node:** `14f27e76-cfeb-40a9-a0d8-0e3d032e959a`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/get_decrypted_credentials
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {"redirect":{"redirect":{}}}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 8. Request Token

- **ID do Node:** `8d6dbec0-2055-48ee-bc96-78ad3860ccbd`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-sales.pagtrust.com.br/auth
- **method**: POST
- **options**: {}...  

---

#### 9. Update a row1

- **ID do Node:** `e6c45065-3602-4a2d-bc96-8f587c387a3e`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 10. Edit Fields

- **ID do Node:** `8db2c09a-8529-46bc-a477-081d3007aba5`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 11. Respond to Webhook1

- **ID do Node:** `38230eac-6d06-4254-8e49-55fbc9034fb7`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---


## 5. Batch Process Orchestrator

**ID:** `L9sTtHKstpH13TzW`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/L9sTtHKstpH13TzW)  
**Criado em:** 23/10/2025, 07:26:04  
**Atualizado em:** 05/12/2025, 20:48:58  
**Total de nodes:** 27  

### Nodes do Workflow

#### 1. Validate Hotmart Parameters

- **ID do Node:** `b60727a6-6d75-4dc7-99e4-f6d95bd776bb`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Validar parameters específicos do Hotmart
const payload = $input.first().json  

---

#### 2. Map Hotmart Columns

- **ID do Node:** `84a9da7b-582a-4c3a-b3b5-2e631d71bd84`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"f36c0b59-1440-492f-824e-fa4fc6ed787d","name":"﻿Data do lançamento","value":"=...  

---

#### 3. (Hotmart): Map CSV Hotmart Columns

- **ID do Node:** `b5c107f4-f5db-4a52-b998-369b2d9dfdc3`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **mode**: runOnceForEachItem
- **jsCode**: // ============================================
// FUNÇÕES HELPER (Obrigatórias)  

---

#### 4. (Hotmart): Filter Valid Records

- **ID do Node:** `5eea6518-d295-4939-b9d5-bad93bb887bb`  
- **Tipo:** `n8n-nodes-base.filter` (filter)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Node do tipo filter  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 5. Parse Excel File

- **ID do Node:** `efe17319-ff1d-41eb-8fde-903fd49f104a`  
- **Tipo:** `n8n-nodes-base.extractFromFile` (extractFromFile)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo extractFromFile  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: xlsx
- **options**: {}...  

---

#### 6. Merge File Data

- **ID do Node:** `34891de7-01da-44e9-a175-8c40447a8356`  
- **Tipo:** `n8n-nodes-base.merge` (merge)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Mescla múltiplos fluxos de dados  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
Nenhum parâmetro configurado  

---

#### 7. Switch by Platform process

- **ID do Node:** `f9f3e173-8cf6-47b8-abab-72e67591e2c3`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 8. Map Columns Using Rule - Detecção Automática

- **ID do Node:** `040ee6f5-1af8-4817-b925-d4bc20bb2e8c`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **mode**: runOnceForEachItem
- **jsCode**: const node5Data = $('Extrair Dados do Batch Process').first().json;

// Obter fi  

---

#### 9. Bulk Insert

- **ID do Node:** `68a04ccb-79f2-4cc5-ae91-127b7b7a06c2`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Agrupar todos os itens em um array para bulk insert
const batchId = $('Extrai  

---

#### 10. HTTP Request Bulk Insert

- **ID do Node:** `0970bb56-6939-4e92-bd2f-90980a28a940`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: =https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/batch_process_items?on_conflict=batch_process_id,l
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {"response":{"response":{"fullResponse":true}},"timeout":120000}...  
- **Credenciais Utilizadas:** httpHeaderAuth, supabaseApi  

---

#### 11. get_token_ca

- **ID do Node:** `c973fab5-af6d-451d-a9b0-0ff130269e67`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 12. Switch by Platform process1

- **ID do Node:** `ae9af90c-9df9-4fe2-8b49-a29c391979dd`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 13. Webhook Trigger

- **ID do Node:** `04a85071-47ee-45c7-8944-8c0c45b8c9f0`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `b0e83a92-5e99-4700-8cdb-91683bd22b5a`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: v1/batch-process
- **authentication**: headerAuth
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 14. Validate Payload

- **ID do Node:** `04a1ddd7-2dbb-49e8-bcb5-6896c9d3e1f2`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Extrair payload (pode estar em body ou diretamente no json)
const payload = $  

---

#### 15. Set Initial Variables

- **ID do Node:** `b4c458a0-70aa-45e1-8808-950989f11d0d`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0733f45f-dfaf-487c-90b4-7a76fdce4c1e","name":"batch_process_id","value":"={{ ...  

---

#### 16. Buscar Batch Process no Supabase

- **ID do Node:** `e64ca4cb-aa67-4965-9d1a-c575efe4b374`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: =https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/batch_processes?id=eq.{{$json.batch_process_id}}&s
- **authentication**: genericCredentialType
- **options**: {"response":{"response":{}}}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 17. Extrair Dados do Batch Process

- **ID do Node:** `6ccc14b2-7de1-493e-b3bb-c4774652975b`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"35f6738d-cca6-4f5a-9ff1-1dc66cf26067","name":"batch_id","value":"={{ $json.id...  

---

#### 18. Switch by Platform

- **ID do Node:** `3f9c3e60-6dcd-4ac7-a7ce-f7a36004d16e`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 19. Download File from Supabase Storage

- **ID do Node:** `fb309335-88fb-468e-8a6d-34f94444aa22`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: ={{ $json.file_url }}
- **authentication**: genericCredentialType
- **options**: {"redirect":{"redirect":{}},"response":{"response":{"responseFormat":"file"}}}...  
- **Credenciais Utilizadas:** httpHeaderAuth, supabaseApi  

---

#### 20. Switch - Detect File Type

- **ID do Node:** `36311e10-e3cf-46a6-87b4-81c8b45f23d9`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 21. Expand Items Data

- **ID do Node:** `f697b0d5-8295-469c-8069-d654e242bbb3`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Recuperar os dados originais do Node 14a (antes do insert)
// Como o Node 14b  

---

#### 22. Edit Fields

- **ID do Node:** `e35341d1-f72d-43c4-abd4-635f258f5d99`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"6a76481c-6358-4832-b5f1-a49f814a4314","name":"rule","value":"={{ $('Buscar Ba...  

---

#### 23. Detectar Delimitador CSV

- **ID do Node:** `3cc19e75-ab7b-49b2-828d-f9e33fc34905`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Obter dados binários do arquivo
const item = $input.first();
const binaryData  

---

#### 24. Parse CSV File

- **ID do Node:** `5f62e23e-2ee0-43ec-9614-a2bab29d63b6`  
- **Tipo:** `n8n-nodes-base.extractFromFile` (extractFromFile)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo extractFromFile  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {"delimiter":"={{ $json.delimiter }}"}...  

---

#### 25. Loop

- **ID do Node:** `bb61aa00-9055-4df6-8dc4-b1877b4c55f1`  
- **Tipo:** `n8n-nodes-base.splitInBatches` (splitInBatches)  
- **Versão do Tipo:** 3  
- **Descrição:** Divide dados em lotes para processamento  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 26. Wait

- **ID do Node:** `833b9b53-64ae-4869-8e34-abb30d6b41f8`  
- **Tipo:** `n8n-nodes-base.wait` (wait)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Aguarda um período de tempo ou evento  
- **Webhook ID:** `a9610eff-0627-449b-a0a8-a8c804b0dbdc`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **amount**: 1  

---

#### 27. Execute Workflow1

- **ID do Node:** `18de43ae-d99d-46c8-a4e9-a51df0c2ef92`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---


## 6. get-tokens-conta-azul

**ID:** `NN7kAXqqRhIWzfwE`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/NN7kAXqqRhIWzfwE)  
**Criado em:** 19/10/2025, 22:42:43  
**Atualizado em:** 05/12/2025, 20:50:32  
**Total de nodes:** 17  

### Nodes do Workflow

#### 1. HTML

- **ID do Node:** `2dd867e7-d99b-4bd2-8409-a4e64b387b21`  
- **Tipo:** `n8n-nodes-base.html` (html)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Node do tipo html  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **html**: <!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta   

---

#### 2. Respond to Webhook1

- **ID do Node:** `a1fa66f1-8b48-4b5e-910e-d502d5cf080a`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 3. Create a row

- **ID do Node:** `e5f083cc-e340-4756-98e1-40a48ac9613d`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **tableId**: client_platform_credentials
- **fieldsUi**: {"fieldValues":[{"fieldId":"client_id","fieldValue":"={{ $('new_apiKey').item.js  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 4. Switch

- **ID do Node:** `1c8c5653-c552-4475-948d-dc497a86ee61`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 5. Webhook

- **ID do Node:** `207b1bbe-488e-41c2-ab0d-a92ae2e33f62`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `43d5d198-a4be-417b-ae67-2d648418f7b3`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: ca-auth
- **options**: {}...  

---

#### 6. organiza_campos

- **ID do Node:** `6df9de80-f1e3-4cd1-a75e-48f2f81c1878`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"096cfdec-96b2-46f6-bd12-f3ed1d3d2eee","name":"code","value":"={{ $json.query....  

---

#### 7. Code

- **ID do Node:** `14d02ce9-8114-4d0f-b585-dd6de6ef638c`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Node "Code" - Decodificar State

// Decodificar o state para obter contexto
c  

---

#### 8. Get many rows

- **ID do Node:** `6f4ba2e8-17d2-4269-bdd1-057bd594f862`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 9. Code1

- **ID do Node:** `7c1796c1-3f94-4d88-8f8e-8ff678d7ab2d`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Node Code - Criar Basic Auth Header, API Key e Webhook Key
const clientId = $  

---

#### 10. new_token

- **ID do Node:** `78d36186-ef57-485f-bc23-6331124f2963`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://auth.contaazul.com/oauth2/token
- **method**: POST
- **options**: {}...  

---

#### 11. novos_campos

- **ID do Node:** `f6657abf-0191-49d8-83f6-ff537db1baac`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"5589a6f7-3ca3-46ca-962d-3b39f0124b3e","name":"access_token","value":"={{ $jso...  

---

#### 12. new_apiKey

- **ID do Node:** `0a772962-f744-490f-938d-9e23f8dd8c7b`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Node Code - Preparar dados e body para encrypt_credentials
const credentialsD  

---

#### 13. new_vault

- **ID do Node:** `64e91382-ebb8-4dc9-93ea-818f97556cbe`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/encrypt_credentials
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {"redirect":{"redirect":{}},"response":{"response":{"responseFormat":"text"}}}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 14. Get a row1

- **ID do Node:** `598a850a-6e2e-46ec-96d0-cfd988f229d2`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: get  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 15. Edit Fields2

- **ID do Node:** `941d504b-537e-4fc6-93a6-b0ef462afb2c`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 16. Respond to Webhook

- **ID do Node:** `67625e6e-291e-40fa-a43c-dc13a89626e0`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 17. Update a row1

- **ID do Node:** `acd15462-fbda-4c42-940c-78fea2afbfd2`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---


## 7. get_data_conta_azul

**ID:** `Rmha1HWwvGVGbBF4`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/Rmha1HWwvGVGbBF4)  
**Criado em:** 22/10/2025, 18:41:03  
**Atualizado em:** 05/12/2025, 20:49:54  
**Total de nodes:** 29  

### Nodes do Workflow

#### 1. HTTP Request6

- **ID do Node:** `adf978c8-5ede-4f83-9ec1-7ad92baaa10f`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/produto/busca
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 2. Edit Fields7

- **ID do Node:** `11cd0855-1317-4e59-8702-fc0d2d881326`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{ $json.itens....  

---

#### 3. Respond to Webhook6

- **ID do Node:** `7b9e31d7-2008-45f3-b28c-814afbfbe699`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 4. HTTP Request5

- **ID do Node:** `5b68e47d-8219-425b-9701-dd914f7e1321`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/servicos
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 5. Edit Fields6

- **ID do Node:** `2819d389-c957-4d57-a189-376aa330cf5a`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{ $json.itens....  

---

#### 6. Respond to Webhook5

- **ID do Node:** `ce93a2b9-bd85-4fc7-b343-fd94e0fcc4f7`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 7. HTTP Request1

- **ID do Node:** `72b1a41b-876e-4df2-ad06-faac7f706a57`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/categorias
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 8. Edit Fields1

- **ID do Node:** `9122f68f-09eb-4293-8cf6-83e2a0f351f3`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{\n  {\n    \"...  

---

#### 9. Respond to Webhook1

- **ID do Node:** `07faeb77-ce45-4fb2-b43c-78f5b6ab86ec`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 10. Switch

- **ID do Node:** `82fb2f9e-b75f-424f-8444-744d7af25070`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 11. Webhook: Receber Requisição

- **ID do Node:** `82dce896-44a0-42ae-8d7b-c67dfa52d49a`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `83b0364c-b578-4904-8ee3-a2fec0fe44a7`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: v1/conta-azul/data
- **authentication**: headerAuth
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 12. organiza_campos

- **ID do Node:** `2792ced9-a8f6-4f98-a9eb-efe60d19588e`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"b2fba3e3-faba-4b4e-8e81-edfb252f3815","name":"credential_id","value":"={{ $js...  

---

#### 13. Get Credential

- **ID do Node:** `2fb6280e-36ef-4abf-abae-445c57e22aa9`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 14. Get Platform

- **ID do Node:** `5c849a6a-9ecb-4a7d-8516-13f9a3e4e7c9`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 15. Create Basic Auth

- **ID do Node:** `6a05b419-e67b-4339-9880-93b2204c5332`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const clientId = $('Get Platform').item.json.auth_config.oauth_client_id;
const   

---

#### 16. Get Tokens from Vault

- **ID do Node:** `6a02ef33-edb5-446d-9ce5-245367e27b68`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/get_decrypted_credentials
- **method**: POST
- **options**: {}...  

---

#### 17. Edit Fields5

- **ID do Node:** `10481ca1-dbd0-4c8e-a035-a52d620b2205`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"1b1ea6e9-50fd-434e-a1ba-2adece99ecf2","name":"credentials.access_token","valu...  

---

#### 18. HTTP Request2

- **ID do Node:** `cac4e213-4932-48fd-8892-671655220060`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/categorias
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 19. Edit Fields2

- **ID do Node:** `884125b5-56d3-4296-aa89-ddb9fea41059`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{\n  {\n    \"...  

---

#### 20. Respond to Webhook2

- **ID do Node:** `27edec2a-ee40-4fbf-b217-601051788415`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 21. HTTP Request

- **ID do Node:** `362d18da-44ba-44a8-84c7-ff83a344d233`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/conta-financeira
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 22. Edit Fields

- **ID do Node:** `63e4e28d-3096-4bbb-90d0-0d97546c0518`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{\n  {\n    \"...  

---

#### 23. Respond to Webhook

- **ID do Node:** `f52302e8-01e7-4bd3-ac30-fcf288bd28a5`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 24. HTTP Request3

- **ID do Node:** `d467cd05-8dc0-4569-bb49-056b1fa00fa2`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/centro-de-custo
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 25. Edit Fields3

- **ID do Node:** `cac1ff43-49fb-4d1a-9a57-acca4d0d6df4`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{ $json.itens....  

---

#### 26. Respond to Webhook3

- **ID do Node:** `e397ef63-a7b7-4369-82a9-b5c643f06f90`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 27. HTTP Request4

- **ID do Node:** `4d5e3f6e-9f5b-412f-8c9f-df96e8893126`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-v2.contaazul.com/v1/pessoas
- **options**: {"redirect":{"redirect":{}}}...  

---

#### 28. Edit Fields4

- **ID do Node:** `82aa50d1-0308-4df0-8a3f-86c4f144b165`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0fb59e46-2bb6-4c92-91fb-6d8a350a4dd9","name":"data","value":"={{ $json.items....  

---

#### 29. Respond to Webhook4

- **ID do Node:** `704c6ab4-c5a1-4391-87f1-eca19cf1b41c`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---


## 8. get-tokens-hotmart-internal

**ID:** `T0JW5do6JMohlzTW`  
**Status:** ⏸️ Inativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/T0JW5do6JMohlzTW)  
**Criado em:** 25/10/2025, 20:47:54  
**Atualizado em:** 05/12/2025, 20:50:19  
**Total de nodes:** 7  

### Nodes do Workflow

#### 1. Return Token

- **ID do Node:** `dcc183f0-bd93-4832-8913-c57d8afe4043`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"223510e9-9652-4f45-b646-7516db5a51f6","name":"credential_id","value":"={{ $('...  

---

#### 2. Manual Trigger

- **ID do Node:** `bd7be3b9-86f8-4d10-b085-71d298d26c4a`  
- **Tipo:** `n8n-nodes-base.executeWorkflowTrigger` (executeWorkflowTrigger)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Node do tipo executeWorkflowTrigger  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **workflowInputs**: {"values":[{"name":"client_id"}]}  

---

#### 3. Buscar Credential ID

- **ID do Node:** `fb831a01-3735-4bf2-94ed-cd684ed02819`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 4. Get Credential

- **ID do Node:** `a8ae35c4-d6a1-4bc1-aa15-f3af0d8821ec`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 5. Get Platform

- **ID do Node:** `5c01a912-72ff-4636-9602-df08dccb964a`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 6. Get Tokens from Vault

- **ID do Node:** `2e121d12-b97e-47bc-acd0-d61f77a52683`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/get_decrypted_credentials
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 7. HTTP Request1

- **ID do Node:** `54eab2d5-33eb-43e6-a244-e6c299b446b8`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://api-sec-vlc.hotmart.com/security/oauth/token
- **method**: POST
- **options**: {"redirect":{"redirect":{}}}...  

---


## 9. cadastro-titulos-lote

**ID:** `UmP98d8FOyyMF9YK`  
**Status:** ⏸️ Inativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/UmP98d8FOyyMF9YK)  
**Criado em:** 06/11/2025, 10:44:59  
**Atualizado em:** 05/12/2025, 20:49:11  
**Total de nodes:** 17  

### Nodes do Workflow

#### 1. Execute Workflow

- **ID do Node:** `ae4a7a9f-752a-4adf-9b21-ad932f994675`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 2. Conta Azul - Buscar evento financeiro

- **ID do Node:** `bcf152fa-0b7a-4e1d-9fe8-537844134129`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 3. Loop Over Items1

- **ID do Node:** `f6235ff4-39d3-4e57-93fe-7b7054337cd2`  
- **Tipo:** `n8n-nodes-base.splitInBatches` (splitInBatches)  
- **Versão do Tipo:** 3  
- **Descrição:** Divide dados em lotes para processamento  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 4. Merge

- **ID do Node:** `a0fb618c-fce1-4612-b17d-a55d14877a39`  
- **Tipo:** `n8n-nodes-base.merge` (merge)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Mescla múltiplos fluxos de dados  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 5. Edit Fields

- **ID do Node:** `758d5946-e176-41a9-8d89-b0f1fa31e177`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[]}...  

---

#### 6. Switch - Evento Encontrado?

- **ID do Node:** `de82a104-fb2d-4fde-9bf3-3da6e974950c`  
- **Tipo:** `n8n-nodes-base.switch` (switch)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Roteia dados baseado em condições múltiplas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {"fallbackOutput":"extra"}...  

---

#### 7. Trigger

- **ID do Node:** `edaf0922-e810-42a3-a4b6-4d99cc3b64c3`  
- **Tipo:** `n8n-nodes-base.executeWorkflowTrigger` (executeWorkflowTrigger)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Node do tipo executeWorkflowTrigger  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **inputSource**: passthrough  

---

#### 8. Code

- **ID do Node:** `e2bad34d-1cc3-49a5-be5b-06161ef37502`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Processar todos os itens do input, não apenas o primeiro
const items = $('Tri  

---

#### 9. Get or Create Contact

- **ID do Node:** `255af064-a2b4-41b4-a98e-389145b9b9ba`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 10. Code2

- **ID do Node:** `dbbd8d25-ed4e-4ddc-a3c4-c6bab1c942dd`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const contatos = $('Get or Create Contact').all();
const triggers = $('Trigger')  

---

#### 11. organiza_campos

- **ID do Node:** `82803909-22af-4161-bd5b-68ae23d652bb`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 12. Code1

- **ID do Node:** `30265c23-11f8-4d9f-b5a6-dbd51154d22f`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: function calcularDataCompetencia(dataVencimento) {
  const data = new Date(dataV  

---

#### 13. If

- **ID do Node:** `e9b0a97b-0ff2-4ef5-8b5f-ee5ac8b49bdd`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 14. Wait

- **ID do Node:** `69337229-9373-4048-8b6a-488ae0be4c08`  
- **Tipo:** `n8n-nodes-base.wait` (wait)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Aguarda um período de tempo ou evento  
- **Webhook ID:** `80d18115-2c82-4c3a-beee-72635ab0cae2`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **amount**: 2  

---

#### 15. Execute Workflow2

- **ID do Node:** `06d2c785-4710-47a9-ae62-2f7830609a70`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 16. If1

- **ID do Node:** `08eab248-c526-43b6-b763-d9b685948161`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 17. Fallback

- **ID do Node:** `24b9670e-4d62-498f-a07e-4252482d6743`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---


## 10. hotmart_vendas_lote

**ID:** `Y6fnFhiohAm9eUYO`  
**Status:** ✅ Ativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/Y6fnFhiohAm9eUYO)  
**Criado em:** 16/11/2025, 18:44:51  
**Atualizado em:** 05/12/2025, 20:51:20  
**Total de nodes:** 28  

### Nodes do Workflow

#### 1. Code in JavaScript4

- **ID do Node:** `7a4fff4d-115e-4212-aae1-849f6098dec2`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== EXTRAIR ID E BATCH_ID DO NODE organiza_campos_vendas_pagamentos =====

  

---

#### 2. Update a row1

- **ID do Node:** `a8c135c9-4998-4694-8459-b358e8e6516a`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 3. Respond to Webhook

- **ID do Node:** `0220ef89-56a8-4cc3-9a33-4aa030c98f55`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 4. Webhook

- **ID do Node:** `0beedd7d-0242-492e-be8a-1aa557874a30`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2.1  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `55a76f92-216a-45f1-8367-52d19d8a2996`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: v1/hotmart/import-batch
- **authentication**: headerAuth
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 5. Update Batch - Processing

- **ID do Node:** `efbe1ed7-3ad1-47a5-b50f-7179f9041a15`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 6. Respond 202

- **ID do Node:** `5cfe9085-4cb1-4a8f-88e0-5348f490bde9`  
- **Tipo:** `n8n-nodes-base.respondToWebhook` (respondToWebhook)  
- **Versão do Tipo:** 1.4  
- **Descrição:** Node do tipo respondToWebhook  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 7. Fetch Hotmart Config

- **ID do Node:** `6aa9d079-ebb6-4ce4-98e4-dd5518650a2c`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/functions/v1/get-integration-config
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 8. Execute Workflow - Get Tokens Conta Azul

- **ID do Node:** `20b2f9b8-3f0f-42ef-b86b-6e75a0e990fe`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 9. Node 11A: Buscar/Criar Fornecedor Hotmart na Conta Azul

- **ID do Node:** `730f5542-ab0f-474b-816d-26d0e91ea9cc`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 10. Node 11B: Buscar/Criar Fornecedor Hotmart na Conta Azul

- **ID do Node:** `fd8c81da-9788-4e74-8235-2a2a50662c28`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 11. Fetch Batch

- **ID do Node:** `b8e11ad0-5df4-4380-ac95-f5d54957314e`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 12. Edit Fields

- **ID do Node:** `37357889-a690-4fe6-819b-27c3786267d4`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"d0b5e7ae-f152-4263-bae2-87099af53285","name":"config","value":"={{ $('Fetch H...  

---

#### 13. Loop Over Items

- **ID do Node:** `702fef48-7f01-4256-9f55-17dfce00d5f4`  
- **Tipo:** `n8n-nodes-base.splitInBatches` (splitInBatches)  
- **Versão do Tipo:** 3  
- **Descrição:** Divide dados em lotes para processamento  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 14. Code in JavaScript

- **ID do Node:** `b3b081df-ca9e-4861-8234-690bba1d5dc6`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== CÓDIGO ATUALIZADO PARA CÁLCULO DE DESPESAS HOTMART =====
// Este código  

---

#### 15. Node 13D: Execute Workflow - Criar Evento Financeiro

- **ID do Node:** `ba86505f-e844-49a7-b903-1859e7b30471`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 16. Code in JavaScript3

- **ID do Node:** `fe3f2fe3-6863-435a-a955-33014dc9a046`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== EXTRAIR ID E BATCH_ID DO NODE organiza_campos_vendas_pagamentos =====

  

---

#### 17. Update a row

- **ID do Node:** `8bb3750a-59df-4d48-8cc6-71cbfbdb0153`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 18. organiza_campos

- **ID do Node:** `a87f08c4-296c-45e7-a6e7-ef09b4d72a84`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 19. Update id processing

- **ID do Node:** `36c12739-5ce1-4fac-bd77-59e06b7ae794`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 20. Node 9A: Buscar/Criar Cliente na Conta Azul

- **ID do Node:** `06957005-9e68-44df-88d0-34aaaa262376`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const items = $input.all();

return items.map(item => {
    const data = item.js  

---

#### 21. Node 9B: Buscar/Criar Cliente na Conta Azul

- **ID do Node:** `1573f0a2-c176-41a1-8e36-2528ceb6b9e4`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 22. Node 6B: Execute Workflow - Buscar/Criar Item CA

- **ID do Node:** `fba00562-b4ab-434f-8baa-bf1b1d215fd4`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 23. Code in JavaScript1

- **ID do Node:** `7bec38f5-87e5-4716-9d09-deedb654580a`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Pega os dados de todos os nós de entrada
const clientes = $('Node 9B: Buscar/  

---

#### 24. prepara_dados_vendas

- **ID do Node:** `e72cc7e3-e685-4028-984c-29da3c2955ad`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Mapeamento de Métodos de Pagamento: Hotmart -> Conta Azul
const paymentMap =   

---

#### 25. Buscar Regra de Prazo Específica

- **ID do Node:** `d90df8a2-22b3-48bc-aa3d-9101dd5cd7bb`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 26. organiza_campos_vendas_pagamentos

- **ID do Node:** `f3486e27-77d6-49fd-99e4-2293ef4dfbb6`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"974f1e2f-40b2-4877-b9b0-24bb13424482","name":"item_id","value":"={{ $('prepar...  

---

#### 27. Code in JavaScript2

- **ID do Node:** `d5d8347a-ac79-4bbc-b524-d4f4758ee1a6`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Função para calcular data de vencimento
function calculateDueDate(saleDateStr  

---

#### 28. Node 10B: Criar Venda na Conta Azul1

- **ID do Node:** `b62aab31-86ab-4757-ad83-232dcc4d9702`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---


## 11. get-tokens-conta-azul-internal

**ID:** `a6dTFCwOXuoLgJhw`  
**Status:** ⏸️ Inativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/a6dTFCwOXuoLgJhw)  
**Criado em:** 25/10/2025, 20:26:17  
**Atualizado em:** 05/12/2025, 20:50:24  
**Total de nodes:** 11  

### Nodes do Workflow

#### 1. Manual Trigger

- **ID do Node:** `88cdf3ab-34aa-4571-a426-9dc3fbb50cfc`  
- **Tipo:** `n8n-nodes-base.executeWorkflowTrigger` (executeWorkflowTrigger)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Node do tipo executeWorkflowTrigger  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **workflowInputs**: {"values":[{"name":"client_id"}]}  

---

#### 2. Buscar Credential ID

- **ID do Node:** `9e747141-9d8b-4551-9015-5cf2b8811400`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 3. Get Credential

- **ID do Node:** `729ecb74-0cb2-40ca-89e5-cfb2bf03ddc9`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 4. Get Platform

- **ID do Node:** `86bdec50-0fc7-4b70-991a-a8c2325b9c5c`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 5. Create Basic Auth

- **ID do Node:** `fdd1239d-19d2-4be0-a069-875c2cb7b476`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const clientId = $('Get Platform').item.json.auth_config.oauth_client_id;
const   

---

#### 6. Get Tokens from Vault

- **ID do Node:** `e9aea46f-e7a9-49fd-8c44-0e3fed0b111e`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/get_decrypted_credentials
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 7. Check Token Expiration

- **ID do Node:** `b813f600-e181-480c-b988-11c8a799ba7f`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const credentials = $json;
const now = new Date();

// O vault retorna updated_a  

---

#### 8. HTTP Request

- **ID do Node:** `616b5bdf-4643-4db4-ab5d-ad60a3784439`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://auth.contaazul.com/oauth2/token
- **method**: POST
- **options**: {}...  

---

#### 9. Prepare New Tokens

- **ID do Node:** `1488f88d-0d10-49e4-ab44-84f0fdfd09a1`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const newAccessToken = $json.access_token;
const newRefreshToken = $json.refresh  

---

#### 10. Update Vault

- **ID do Node:** `ddad3109-95eb-4791-bd3f-ff8a31d57d13`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/rest/v1/rpc/update_credentials_vault
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 11. Return Token

- **ID do Node:** `055c13db-1f35-4f22-861d-1e87fe1a6843`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"223510e9-9652-4f45-b646-7516db5a51f6","name":"credential_id","value":"={{ $('...  

---


## 12. Saipos

**ID:** `aZQJOrZdGOf9bhIY`  
**Status:** ⏸️ Inativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/aZQJOrZdGOf9bhIY)  
**Criado em:** 28/10/2025, 09:16:59  
**Atualizado em:** 05/12/2025, 20:51:52  
**Total de nodes:** 1  

### Nodes do Workflow

#### 1. Webhook

- **ID do Node:** `ac1e7f8c-3a19-4a30-b270-622ed585a67c`  
- **Tipo:** `n8n-nodes-base.webhook` (webhook)  
- **Versão do Tipo:** 2  
- **Descrição:** Recebe dados via webhook HTTP  
- **Webhook ID:** `db6ada2d-d41c-4b86-a2e2-9614eda11af3`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **path**: saipos
- **options**: {}...  

---


## 13. My workflow 19

**ID:** `csckZ23xQHyfF1C2`  
**Status:** ⏸️ Inativo  
**Tags:** BPO-Automatizado  
**URL:** [Abrir no n8n](https://automacoes.choraapi.com.br//workflow/csckZ23xQHyfF1C2)  
**Criado em:** 09/11/2025, 20:09:52  
**Atualizado em:** 05/12/2025, 20:51:04  
**Total de nodes:** 58  

### Nodes do Workflow

#### 1. Node 14C: Execute Workflow - Criar Evento Financeiro

- **ID do Node:** `77aca8b4-ca1e-43b2-b65d-275dfa2c74f0`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 2. Edit Fields1

- **ID do Node:** `0133265e-4a4c-42d7-bfa7-897c378204df`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 3. Node 12B: Set - Preparar Dados Afiliado

- **ID do Node:** `033729ec-6d53-4c9d-9f71-f72a2e4b7560`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 4. Node 12C: Execute Workflow - Criar Fornecedor Afiliado

- **ID do Node:** `c4493912-bae1-40a6-8117-6821d0d8d359`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 5. Node 12D: Set - Salvar Affiliate Supplier ID

- **ID do Node:** `d5d7c8c7-8bf3-4b77-a161-fa54ca047d7d`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"e2f5b9bf-c7f5-4bdb-8d8a-270ec87ba2e2","name":"affiliate_supplier_id","value":...  

---

#### 6. Node 12H: Set - Preparar Dados Coprodutor

- **ID do Node:** `f14d3dc3-9aff-4c7c-8230-3760af8fc30b`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 7. Node 12I: Execute Workflow - Criar Fornecedor Coprodutor

- **ID do Node:** `0a5ee7fe-3089-442c-9621-02e699b859ce`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 8. Node 12J: Set - Salvar Coproducer Supplier ID

- **ID do Node:** `ecbaad23-53ce-494d-9d63-f378c96089f1`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"e2f5b9bf-c7f5-4bdb-8d8a-270ec87ba2e2","name":"coproducer_supplier_id","value"...  

---

#### 9. Node 13B: Code - Preparar Dados Taxa Hotmart

- **ID do Node:** `d4e52b5d-760e-43b7-8c7c-2a8bad1942ba`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== FUNÇÃO HELPER PARA ACESSAR NODES COM FALLBACK =====
function getNodeDat  

---

#### 10. Node 13D: Execute Workflow - Criar Evento Financeiro

- **ID do Node:** `679b416d-de4d-4f34-aca8-cf60639303a9`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 11. Node 14A: Code - Preparar Lista de Comissões

- **ID do Node:** `27ded1a4-dede-4a76-81d6-d473f8d2b1a6`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== FUNÇÃO HELPER PARA ACESSAR NODES COM FALLBACK =====
function getNodeDat  

---

#### 12. If

- **ID do Node:** `028bfd5a-fc6a-4491-abd0-2adebbfd1875`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 13. Node 12F: Merge - Consolidar Afiliado

- **ID do Node:** `0f9ca18b-85bb-4c10-81aa-898f293bf9bc`  
- **Tipo:** `n8n-nodes-base.merge` (merge)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Mescla múltiplos fluxos de dados  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
Nenhum parâmetro configurado  

---

#### 14. Node 12G: IF - Coprodutor Existe?

- **ID do Node:** `542f8b68-924d-4cad-94e8-ab8e136b3bef`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 15. Node 12L: Merge - Consolidar Coprodutor

- **ID do Node:** `3252329f-9385-4175-b06e-664b8dd1ac34`  
- **Tipo:** `n8n-nodes-base.merge` (merge)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Mescla múltiplos fluxos de dados  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
Nenhum parâmetro configurado  

---

#### 16. Node 12M: Set - Consolidar Todos Fornecedores

- **ID do Node:** `8d597928-f420-4df4-9ea3-bfd1ec76dcfd`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"c138667d-26a8-427f-995c-d6dd08fd5ea0","name":"coproducer_supplier_id","value"...  

---

#### 17. Node 13A: IF - Tem Taxa Hotmart?

- **ID do Node:** `5ca3f498-76b2-4581-9dd3-9b243ddc03b6`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 18. Node 15: Code - Consolidar Todas Despesas

- **ID do Node:** `31eb0607-96f6-4b4d-a503-ae0ad7b4f016`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== FUNÇÃO HELPER PARA ACESSAR NODES COM FALLBACK =====
function getNodeDat  

---

#### 19. Node 16: Code - Estruturar Resumo Final

- **ID do Node:** `95cc4679-7433-4f8a-a024-59ab59ea878e`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // ===== FUNÇÃO HELPER PARA ACESSAR NODES COM FALLBACK =====
function getNodeDat  

---

#### 20. Update a row

- **ID do Node:** `46633b2d-d957-4d68-a344-6e242c3952da`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 21. Node 11A: Buscar/Criar Fornecedor Hotmart na Conta Azul

- **ID do Node:** `a875faf4-a6a4-48b2-b1e8-8e1400790b10`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 22. Node 11B: Buscar/Criar Fornecedor Hotmart na Conta Azul

- **ID do Node:** `cd08b2c7-e6b9-49ee-94aa-fdbfd1a5c640`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 23. Node 12A: IF - Afiliado Existe?

- **ID do Node:** `26da84f4-dd8d-4223-919e-1c993329b2bf`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 24. Node 10B: IF - Venda Foi Criada ou Já Existia?

- **ID do Node:** `f2ac780a-20d8-4499-bd13-0b1079933abb`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 25. Execute Workflow - Get Tokens Conta Azul

- **ID do Node:** `f309ddf8-f324-4011-a9a8-2ad94bf70759`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 26. Node 6B: Execute Workflow - Buscar/Criar Item CA

- **ID do Node:** `4c324c4c-1cc4-4534-bc78-0c15e26c7df0`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 27. Edit Fields

- **ID do Node:** `6659365f-9f3c-4122-8ca9-9163efc46a35`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 28. Seleciona todos campos

- **ID do Node:** `de62a009-f1b8-4794-b649-a6abcafc7e8f`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"dc51699d-1872-466e-bf65-713adb0352fd","name":"webhook_payload","value":"={{ $...  

---

#### 29. Node 7D.5: Code - Converter approved_date (NOVO - CORREÇÃO TIMEZONE)

- **ID do Node:** `fa6e4d63-6b7d-4f9b-8b86-1e3ad328248a`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: function convertHotmartTimestamp(timestamp) {
  // Timestamp pode vir como númer  

---

#### 30. Node 7E: Calcular Due Date

- **ID do Node:** `d6529aa7-0a22-49f5-bd07-b66db45d93ea`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: // Função helper para converter timestamp considerando timezone Brasil (UTC-3)
f  

---

#### 31. Execute Workflow - Get Tokens Hotmart

- **ID do Node:** `bcabeb7a-caff-4341-8101-984c9e61eeb9`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 32. Node 8: Buscar Participantes da Venda (Hotmart Sales Users)

- **ID do Node:** `3ca3e953-4a7d-41f5-a65c-54395bf372ab`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 33. Node 9A: Buscar/Criar Cliente na Conta Azul

- **ID do Node:** `7632da00-aea7-4355-a906-47075b95bf23`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const trigger = $('Node 1: Webhook Trigger').first().json ?? {};
const buyer = t  

---

#### 34. Node 9B: Buscar/Criar Cliente na Conta Azul

- **ID do Node:** `b99a1190-bce1-462f-86af-7637bf65cbc9`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 35. Node 10A: Set - Preparar Dados para Criar Venda

- **ID do Node:** `203dcb3d-ab4e-402f-bd82-84908e813206`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"4df05d81-3782-4071-a7c2-5c2faffb8525","name":"id_cliente","value":"={{ $('Nod...  

---

#### 36. Wait

- **ID do Node:** `f28e747b-8fc4-4437-a7b3-a4243423eadd`  
- **Tipo:** `n8n-nodes-base.wait` (wait)  
- **Versão do Tipo:** 1.1  
- **Descrição:** Aguarda um período de tempo ou evento  
- **Webhook ID:** `e20f09e3-5ba1-4b73-8fc7-cce338538bdf`  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **amount**: 3  

---

#### 37. Node 10B: Criar Venda na Conta Azul

- **ID do Node:** `bda754e1-a470-456e-801f-78adec4ff281`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 38. Node 6D: Merge - Consolidar Item ID

- **ID do Node:** `5010cea5-fc40-4699-8b4b-537c6e20ad0a`  
- **Tipo:** `n8n-nodes-base.merge` (merge)  
- **Versão do Tipo:** 3.2  
- **Descrição:** Mescla múltiplos fluxos de dados  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
Nenhum parâmetro configurado  

---

#### 39. Node 6E: Set - Finalizar Mapeamento

- **ID do Node:** `adbcc85c-be3e-48f3-83ad-283d2f6cfcc4`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"0f8d0b73-2420-4175-bf84-5005a44b35ed","name":"mapped_category_id","value":"={...  

---

#### 40. Node 7A: Mapear Forma de Pagamento

- **ID do Node:** `33e7b742-3822-4a08-9f7d-69f15745534b`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 41. Node 7B: Buscar Regra de Prazo Específica

- **ID do Node:** `c272f2b9-8a8b-4e36-bb12-c40f2c47da3c`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 42. Node 7C: IF - Regra Foi Encontrada?

- **ID do Node:** `5a5d6500-e6fe-4311-ac0c-51551ffc2349`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 43. 5A: Set - Juntar Dados

- **ID do Node:** `03d5cd77-c5ec-4c67-9911-d704956e265f`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"8613f2bf-e8f9-4758-86b9-eb307b6e20fc","name":"config","value":"={{ $json.conf...  

---

#### 44. Aplicar Mapeamento de Produtos

- **ID do Node:** `da59cb38-b3d4-49ce-896a-bb4ba602b5dd`  
- **Tipo:** `n8n-nodes-base.code` (code)  
- **Versão do Tipo:** 2  
- **Descrição:** Executa código JavaScript/Python personalizado  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **jsCode**: const config = $json.config;
const webhookData = $json.webhook_payload.data;
con  

---

#### 45. Node 6A: IF - Precisa Criar Item Automaticamente?

- **ID do Node:** `0e122c48-0f46-40cb-b7c4-a62708f5a86f`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 46. Execute Workflow - Get Tokens Conta Azul1

- **ID do Node:** `a4f0c8ff-2ec9-4c06-9f3b-e52e3b5dc3b2`  
- **Tipo:** `n8n-nodes-base.executeWorkflow` (executeWorkflow)  
- **Versão do Tipo:** 1.2  
- **Descrição:** Executa outro workflow  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 47. Node 7D: Buscar Regra Padrão Sistema

- **ID do Node:** `d40e4706-2bca-4857-964e-4acd8c3f68f6`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 48. Node 12K: Set - Coproducer Supplier ID Null

- **ID do Node:** `42adb602-d0b9-4a9a-b0cf-27b95ce2b793`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 49. Node 6C: Set - Usar Item Padrão

- **ID do Node:** `f847af55-b1e7-4758-a1d0-42f77b75a392`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **assignments**: {"assignments":[{"id":"65a41a30-6b59-4c87-b798-6a7b3380f6d2","name":"item_id","value":"={{ $('Aplica...  

---

#### 50. Node 12E: Set - Affiliate Supplier ID Null

- **ID do Node:** `5573e9e6-9daf-4782-8420-54e19fce07e6`  
- **Tipo:** `n8n-nodes-base.set` (set)  
- **Versão do Tipo:** 3.4  
- **Descrição:** Define/atualiza valores de campos  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 51. Node 4: Consultar Configuração de Integração

- **ID do Node:** `0156da31-394c-4bfa-8ade-4175da1ae454`  
- **Tipo:** `n8n-nodes-base.httpRequest` (httpRequest)  
- **Versão do Tipo:** 4.2  
- **Descrição:** Faz requisições HTTP para APIs externas  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **url**: https://qkjmxrbalqahrzyiuuwd.supabase.co/functions/v1/get-integration-config
- **method**: POST
- **authentication**: genericCredentialType
- **options**: {}...  
- **Credenciais Utilizadas:** httpHeaderAuth  

---

#### 52. Node 5: Branch - Integração Ativa?

- **ID do Node:** `3740b515-f6f8-4093-bbb1-1c640d8fbf9d`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 53. Loop

- **ID do Node:** `f75ea6a2-665f-4e11-a9a9-844127aa0eaf`  
- **Tipo:** `n8n-nodes-base.splitInBatches` (splitInBatches)  
- **Versão do Tipo:** 3  
- **Descrição:** Divide dados em lotes para processamento  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...  

---

#### 54. Node 2: Validar Webhook Key e Identificar Cliente

- **ID do Node:** `3206198c-3a10-4fb1-ae0a-7baceca3aab9`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 55. When clicking ‘Execute workflow’

- **ID do Node:** `d8715053-b09c-4beb-8126-4b9fdc781ddc`  
- **Tipo:** `n8n-nodes-base.manualTrigger` (manualTrigger)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo manualTrigger  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
Nenhum parâmetro configurado  

---

#### 56. Node 2A: Buscar Webhooks

- **ID do Node:** `e0235e67-913b-41e2-92c4-7c16c4ee2257`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: getAll  
- **Credenciais Utilizadas:** supabaseApi  

---

#### 57. 3A: IF - Validar Status da Transação

- **ID do Node:** `0d9211ae-c4f5-4787-a113-ae7026e2040a`  
- **Tipo:** `n8n-nodes-base.if` (if)  
- **Versão do Tipo:** 2.2  
- **Descrição:** Executa lógica condicional (IF/ELSE)  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **options**: {}...
- **conditions**: {"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict","version":2},"conditions":...  

---

#### 58. Workflow encerra

- **ID do Node:** `ae600c56-142d-4fd4-a8c0-af7fd75171c7`  
- **Tipo:** `n8n-nodes-base.supabase` (supabase)  
- **Versão do Tipo:** 1  
- **Descrição:** Node do tipo supabase  
- **Conexões de Entrada:** Nenhuma (node inicial ou isolado)  
- **Conexões de Saída:** Nenhuma (node final ou isolado)  
- **Parâmetros Principais:**  
- **operation**: update  
- **Credenciais Utilizadas:** supabaseApi  

---


