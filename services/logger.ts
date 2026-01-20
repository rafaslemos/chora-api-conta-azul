/**
 * Serviço de Logging Centralizado
 * 
 * Substitui console.log/error/warn por um sistema estruturado que:
 * - Suporta diferentes níveis de log (debug, info, warn, error)
 * - Permite configuração por ambiente (dev vs produção)
 * - Pode integrar com serviços externos (Sentry, LogRocket, etc.)
 * - Formata logs de forma consistente
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
  timestamp: string;
  location?: string;
}

class Logger {
  private isDevelopment: boolean;
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 100;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  }

  /**
   * Log de debug (apenas em desenvolvimento)
   */
  debug(message: string, data?: any, location?: string): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, data, undefined, location);
    }
  }

  /**
   * Log de informação
   */
  info(message: string, data?: any, location?: string): void {
    this.log(LogLevel.INFO, message, data, undefined, location);
  }

  /**
   * Log de aviso
   */
  warn(message: string, data?: any, location?: string): void {
    this.log(LogLevel.WARN, message, data, undefined, location);
  }

  /**
   * Log de erro
   */
  error(message: string, error?: Error | any, data?: any, location?: string): void {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error && !(error instanceof Error) ? error : data;
    
    this.log(LogLevel.ERROR, message, errorData, errorObj, location);
    
    // Em produção, enviar para serviço de monitoramento (ex: Sentry)
    if (!this.isDevelopment) {
      this.sendToMonitoring(message, errorObj, errorData, location);
    }
  }

  /**
   * Método interno de logging
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    error?: Error,
    location?: string
  ): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      error,
      timestamp: new Date().toISOString(),
      location: location || this.getCallerLocation(),
    };

    // Adicionar ao histórico
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Log no console (formatado)
    this.logToConsole(entry);

    // Em desenvolvimento, também logar no localStorage para debug
    if (this.isDevelopment) {
      this.logToLocalStorage(entry);
    }
  }

  /**
   * Loga no console com formatação
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level}] ${entry.timestamp}`;
    const locationStr = entry.location ? ` (${entry.location})` : '';
    const message = `${prefix}${locationStr}: ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data || '');
        break;
      case LogLevel.ERROR:
        if (entry.error) {
          console.error(message, entry.error, entry.data || '');
        } else {
          console.error(message, entry.data || '');
        }
        break;
    }
  }

  /**
   * Salva log no localStorage (apenas desenvolvimento)
   */
  private logToLocalStorage(entry: LogEntry): void {
    try {
      const key = 'app_logs';
      const logs = JSON.parse(localStorage.getItem(key) || '[]');
      logs.push(entry);
      
      // Manter apenas últimos 50 logs no localStorage
      if (logs.length > 50) {
        logs.shift();
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (error) {
      // Ignorar erros de localStorage (pode estar cheio ou desabilitado)
    }
  }

  /**
   * Envia erro para serviço de monitoramento (ex: Sentry)
   */
  private sendToMonitoring(
    message: string,
    error?: Error,
    data?: any,
    location?: string
  ): void {
    // TODO: Integrar com Sentry ou outro serviço de monitoramento
    // Exemplo:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error || new Error(message), {
    //     extra: { data, location },
    //   });
    // }
  }

  /**
   * Obtém localização do chamador (arquivo e linha)
   */
  private getCallerLocation(): string {
    try {
      const stack = new Error().stack;
      if (!stack) return 'unknown';
      
      const lines = stack.split('\n');
      // Linha 3 é o chamador (0: Error, 1: getCallerLocation, 2: log, 3: chamador real)
      if (lines.length > 3) {
        const caller = lines[3].trim();
        // Extrair nome do arquivo e linha
        const match = caller.match(/\((.+):(\d+):(\d+)\)/);
        if (match) {
          const file = match[1].split('/').pop() || match[1];
          return `${file}:${match[2]}`;
        }
      }
    } catch (error) {
      // Ignorar erros ao obter localização
    }
    return 'unknown';
  }

  /**
   * Obtém histórico de logs
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Limpa histórico de logs
   */
  clearHistory(): void {
    this.logHistory = [];
    if (this.isDevelopment) {
      localStorage.removeItem('app_logs');
    }
  }

  /**
   * Exporta logs para download (útil para debug)
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

// Instância singleton
export const logger = new Logger();

// Exportar funções de conveniência
export const logDebug = (message: string, data?: any, location?: string) => 
  logger.debug(message, data, location);
export const logInfo = (message: string, data?: any, location?: string) => 
  logger.info(message, data, location);
export const logWarn = (message: string, data?: any, location?: string) => 
  logger.warn(message, data, location);
export const logError = (message: string, error?: Error | any, data?: any, location?: string) => 
  logger.error(message, error, data, location);
