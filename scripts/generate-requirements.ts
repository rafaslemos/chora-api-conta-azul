/**
 * Script para gerar requirements.txt a partir do package.json
 * Equivalente ao pip freeze do Python
 * 
 * Uso: npm run generate:requirements
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminhos dos arquivos
const packageJsonPath = join(__dirname, '..', 'package.json');
const requirementsPath = join(__dirname, '..', 'requirements.txt');
const nvmrcPath = join(__dirname, '..', '.nvmrc');

// Ler package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// Ler versão do Node.js do .nvmrc ou engines
let nodeVersion = '18.0.0';
if (packageJson.engines?.node) {
  const enginesNode = packageJson.engines.node;
  // Extrair versão mínima (>=18.0.0 -> 18.0.0)
  const match = enginesNode.match(/(\d+\.\d+\.\d+)/);
  if (match) {
    nodeVersion = match[1];
  }
}

try {
  const nvmrcContent = readFileSync(nvmrcPath, 'utf-8').trim();
  if (nvmrcContent) {
    nodeVersion = nvmrcContent;
  }
} catch (error) {
  // .nvmrc não existe, usar versão do engines
}

// Função para normalizar versão (remover ^, ~, etc)
function normalizeVersion(version: string): string {
  // Remover prefixos ^, ~, >=, etc
  return version.replace(/^[\^~>=<]+/, '');
}

// Gerar conteúdo do requirements.txt
let content = `# Requirements - Dependências do Projeto
# Gerado automaticamente a partir do package.json
# Para instalar, use: npm install
# Para regenerar este arquivo: npm run generate:requirements

# Versão do Node.js requerida
node>=${nodeVersion}

# ============================================================================
# Dependencies (Production)
# ============================================================================

`;

// Adicionar dependências de produção
if (packageJson.dependencies) {
  const deps = Object.entries(packageJson.dependencies)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => {
      const normalizedVersion = normalizeVersion(version as string);
      return `${name}==${normalizedVersion}`;
    });
  content += deps.join('\n') + '\n';
}

content += `
# ============================================================================
# DevDependencies (Development)
# ============================================================================

`;

// Adicionar dependências de desenvolvimento
if (packageJson.devDependencies) {
  const devDeps = Object.entries(packageJson.devDependencies)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => {
      const normalizedVersion = normalizeVersion(version as string);
      return `${name}==${normalizedVersion}`;
    });
  content += devDeps.join('\n') + '\n';
}

// Escrever arquivo
writeFileSync(requirementsPath, content, 'utf-8');

console.log('✓ requirements.txt gerado com sucesso!');
console.log(`  - Node.js: >= ${nodeVersion}`);
console.log(`  - Dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
console.log(`  - DevDependencies: ${Object.keys(packageJson.devDependencies || {}).length}`);
