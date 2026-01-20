/**
 * Utilitários para validação e formatação de CNPJ
 */

/**
 * Remove formatação do CNPJ, deixando apenas números
 */
export const cleanCnpj = (cnpj: string): string => {
  return cnpj.replace(/\D/g, '');
};

/**
 * Formata CNPJ no padrão XX.XXX.XXX/XXXX-XX
 */
export const formatCnpj = (cnpj: string): string => {
  const cleaned = cleanCnpj(cnpj);
  
  if (cleaned.length !== 14) {
    return cnpj; // Retorna original se não tiver 14 dígitos
  }
  
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
};

/**
 * Valida os dígitos verificadores do CNPJ
 */
const validateCnpjDigits = (cnpj: string): boolean => {
  const cleaned = cleanCnpj(cnpj);
  
  if (cleaned.length !== 14) {
    return false;
  }
  
  // Verifica se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1+$/.test(cleaned)) {
    return false;
  }
  
  // Valida primeiro dígito verificador
  let length = 12;
  let numbers = cleaned.substring(0, length);
  let digits = cleaned.substring(length);
  let sum = 0;
  let pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return false;
  }
  
  // Valida segundo dígito verificador
  length = 13;
  numbers = cleaned.substring(0, length);
  sum = 0;
  pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return false;
  }
  
  return true;
};

/**
 * Valida formato e dígitos verificadores do CNPJ
 */
export const validateCnpj = (cnpj: string): boolean => {
  const cleaned = cleanCnpj(cnpj);
  
  // Verifica se tem 14 dígitos
  if (cleaned.length !== 14) {
    return false;
  }
  
  // Valida dígitos verificadores
  return validateCnpjDigits(cnpj);
};

