# Corrigir falha do CI (npm ci)

O CI usa **npm install** (em vez de `npm ci`) enquanto `package.json` e `package-lock.json` estiverem fora de sincronia, para o job não falhar.

Para resolver de forma definitiva e voltar a usar `npm ci`:

1. Na raiz do projeto, rode:
   ```bash
   npm install
   ```
2. Comite e faça push do `package-lock.json` atualizado.
3. Em [.github/workflows/ci.yml](.github/workflows/ci.yml), troque de volta o passo "Install dependencies" para `npm ci`.

O workflow usa Node 22 para evitar warnings de engine do semantic-release.
