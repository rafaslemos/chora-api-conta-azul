import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminhos dos arquivos de migration
const migrationsDir = join(__dirname, '..', 'sql', 'migrations');
const outputFile = join(__dirname, '..', 'supabase', 'functions', 'setup-database', 'index.ts');

// Lista de migrations a processar (014-020)
const migrations = [
  '014_create_dw_dim_calendario',
  '015_create_dw_etl_dimensoes',
  '016_create_dw_etl_fatos',
  '017_create_dw_views',
  '018_create_dw_ajustes',
  '019_add_additional_migrations',
  '020_create_view_contas_unificadas',
];

// Ler o arquivo atual
const currentContent = readFileSync(outputFile, 'utf-8');

// Gerar constantes para cada migration
const constants: string[] = [];
const migrationEntries: string[] = [];

migrations.forEach((migrationName, index) => {
  const migrationNumber = String(14 + index).padStart(3, '0');
  const constantName = `MIGRATION_${migrationNumber}`;
  const filePath = join(migrationsDir, `${migrationName}.sql`);
  
  try {
    // Verificar se arquivo existe antes de ler
    if (!existsSync(filePath)) {
      console.log(`⚠ Arquivo não encontrado: ${migrationName}.sql (será pulado)`);
      return; // Pular migrations que ainda não existem
    }
    
    const sqlContent = readFileSync(filePath, 'utf-8');
    
    // Escapar caracteres especiais para template literal
    const escapedSql = sqlContent
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\${/g, '\\${');
    
    // Criar constante
    constants.push(`// Migration ${migrationNumber}: ${migrationName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
    constants.push(`const ${constantName} = \`${escapedSql}\`;`);
    constants.push('');
    
    // Adicionar ao array MIGRATIONS
    migrationEntries.push(`  { name: '${migrationName}', sql: ${constantName} },`);
    
    console.log(`✓ Processada migration ${migrationNumber}: ${migrationName}`);
  } catch (error) {
    console.error(`✗ Erro ao processar ${migrationName}:`, error);
    throw error;
  }
});

// Encontrar onde inserir as constantes (após MIGRATION_016 que já existe)
// Verificar se MIGRATION_016 já existe (015_expand_mapping_rules ou 016_create_tenant_conta_azul_config)
const insertAfterPattern = /const MIGRATION_016 = `[\s\S]*?`;\s*\n\s*\n/;
const constantsBlock = constants.join('\n');

if (!insertAfterPattern.test(currentContent)) {
  // Tentar encontrar MIGRATION_015 ou MIGRATION_013 como fallback
  const fallbackPattern = /const MIGRATION_01[35] = `[\s\S]*?`;\s*\n\s*\n/;
  if (fallbackPattern.test(currentContent)) {
    const updatedContent = currentContent.replace(
      fallbackPattern,
      (match) => match + constantsBlock
    );
    // Atualizar array MIGRATIONS
    const migrationsArrayPattern = /(\s+{ name: '01[356]_[^']+', sql: MIGRATION_01[356] },\s*)\];/;
    const migrationsArrayReplacement = `$1${migrationEntries.join('\n')}\n];`;
    
    if (migrationsArrayPattern.test(updatedContent)) {
      const finalContent = updatedContent.replace(
        migrationsArrayPattern,
        migrationsArrayReplacement
      );
      writeFileSync(outputFile, finalContent, 'utf-8');
      console.log('\n✓ Constantes geradas com sucesso!');
      console.log(`✓ Arquivo atualizado: ${outputFile}`);
      console.log(`\nTotal de migrations processadas: ${migrations.length}`);
      process.exit(0);
    }
  }
  throw new Error('Não foi possível encontrar MIGRATION_013, 015 ou 016 no arquivo');
}

// Inserir constantes após MIGRATION_016
const updatedContent = currentContent.replace(
  insertAfterPattern,
  (match) => match + constantsBlock
);

// Atualizar array MIGRATIONS
// Procurar pelo último item do array (pode ser MIGRATION_013, 015 ou 016)
const migrationsArrayPattern = /(\s+{ name: '01[356]_[^']+', sql: MIGRATION_01[356] },\s*)\];/;
const migrationsArrayReplacement = `$1${migrationEntries.join('\n')}\n];`;

if (!migrationsArrayPattern.test(updatedContent)) {
  throw new Error('Não foi possível encontrar o final do array MIGRATIONS para atualizar');
}

const finalContent = updatedContent.replace(
  migrationsArrayPattern,
  migrationsArrayReplacement
);

// Escrever arquivo atualizado
writeFileSync(outputFile, finalContent, 'utf-8');

console.log('\n✓ Constantes geradas com sucesso!');
console.log(`✓ Arquivo atualizado: ${outputFile}`);
console.log(`\nTotal de migrations processadas: ${migrations.length}`);
