/**
 * Função para gerar API keys aleatórias seguras
 */

/**
 * Gera uma API key aleatória segura de 32 caracteres
 */
export function generateApiKey(): string {
  // Gerar chave aleatória de 32 caracteres usando crypto.randomUUID
  // Se não disponível, usar Math.random como fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    // Usar UUID v4 e remover hífens para ter 32 caracteres
    return crypto.randomUUID().replace(/-/g, '');
  } else {
    // Fallback: gerar string aleatória de 32 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
