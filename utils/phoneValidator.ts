/**
 * Utilitários para validação e formatação de telefone
 * Reutilizável em todas as páginas de cadastro
 */

/**
 * Remove formatação do telefone, deixando apenas números
 */
export const cleanPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Formata telefone no padrão brasileiro
 * Suporta:
 * - Celular: (XX) XXXXX-XXXX (11 dígitos)
 * - Fixo: (XX) XXXX-XXXX (10 dígitos)
 */
export const formatPhone = (phone: string): string => {
  const cleaned = cleanPhone(phone);
  
  if (cleaned.length === 0) {
    return '';
  }
  
  // Telefone celular (11 dígitos)
  if (cleaned.length === 11) {
    return cleaned.replace(
      /^(\d{2})(\d{5})(\d{4})$/,
      '($1) $2-$3'
    );
  }
  
  // Telefone fixo (10 dígitos)
  if (cleaned.length === 10) {
    return cleaned.replace(
      /^(\d{2})(\d{4})(\d{4})$/,
      '($1) $2-$3'
    );
  }
  
  // Durante a digitação, formata parcialmente
  if (cleaned.length <= 2) {
    return cleaned;
  }
  
  if (cleaned.length <= 6) {
    return cleaned.replace(/^(\d{2})(\d+)$/, '($1) $2');
  }
  
  if (cleaned.length <= 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d+)$/, '($1) $2-$3');
  }
  
  // Se tiver mais de 11 dígitos, limita a 11 e formata como celular
  if (cleaned.length > 11) {
    const limited = cleaned.substring(0, 11);
    return limited.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  
  // Celular completo
  return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
};

/**
 * Valida formato de telefone brasileiro
 * Aceita telefone fixo (10 dígitos) ou celular (11 dígitos)
 */
export const validatePhone = (phone: string): boolean => {
  const cleaned = cleanPhone(phone);
  
  // Telefone fixo: 10 dígitos (DDD + 8 dígitos)
  // Telefone celular: 11 dígitos (DDD + 9 dígitos)
  return cleaned.length === 10 || cleaned.length === 11;
};

/**
 * Valida se o telefone está completo (10 ou 11 dígitos)
 */
export const isPhoneComplete = (phone: string): boolean => {
  const cleaned = cleanPhone(phone);
  return cleaned.length === 10 || cleaned.length === 11;
};

