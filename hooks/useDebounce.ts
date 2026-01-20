import { useState, useEffect } from 'react';

/**
 * Hook para debounce de valores
 * Útil para evitar múltiplas requisições em busca
 * ⚠️ SEGURANÇA: Também protege contra race conditions
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
