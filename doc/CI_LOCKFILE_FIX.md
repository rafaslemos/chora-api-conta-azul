# Corrigir falha do CI (npm ci)

Se o CI falhar em **Install dependencies** com `package.json` e `package-lock.json` fora de sincronia:

1. Na raiz do projeto, rode:
   ```bash
   npm install
   ```
2. Comite e faça push do `package-lock.json` atualizado.

O workflow de CI já usa Node 22 para evitar warnings de engine do semantic-release.
