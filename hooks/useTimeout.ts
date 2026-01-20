/**
 * Hook customizado para gerenciar timeouts com cleanup automático
 * Previne memory leaks ao limpar timeouts quando o componente é desmontado
 */

import { useEffect, useRef } from 'react';

export function useTimeout() {
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  /**
   * Cria um timeout com cleanup automático
   * @param callback Função a ser executada após o delay
   * @param delay Delay em milissegundos
   * @returns ID do timeout criado
   */
  const createTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeoutId = setTimeout(() => {
      callback();
      // Remover da lista após execução
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    }, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  };

  /**
   * Limpa um timeout específico
   * @param timeoutId ID do timeout a ser limpo
   */
  const clearTimeout = (timeoutId: NodeJS.Timeout): void => {
    window.clearTimeout(timeoutId);
    timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
  };

  /**
   * Limpa todos os timeouts ativos
   */
  const clearAllTimeouts = (): void => {
    timeoutRefs.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    timeoutRefs.current = [];
  };

  // Cleanup automático ao desmontar o componente
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, []);

  return {
    createTimeout,
    clearTimeout,
    clearAllTimeouts,
  };
}
