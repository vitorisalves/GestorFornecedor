/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  };

  // Se a string não contiver hora específica ou for a hora padrão que adicionamos (09:00 ou 00:00)
  // mostramos apenas a data.
  const hasTime = dateString.includes('T') && !dateString.endsWith('T00:00:00') && !dateString.endsWith('T09:00:00');
  
  if (hasTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('pt-BR', options).format(date);
};

export const safeStringify = (obj: any): string => {
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  
  try {
    return JSON.stringify(obj);
  } catch (err) {
    const cache = new Set();
    try {
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) {
            return '[Circular]';
          }
          cache.add(value);
          
          // Se for uma instância de classe complexa (como as do Firebase), 
          // ela pode ter um toJSON que falha ou causa problemas.
          // Mas o JSON.stringify chama toJSON antes do replacer...
        }
        return value;
      });
    } catch (innerErr) {
      return `[Error stringifying object: ${innerErr instanceof Error ? innerErr.message : 'Unknown'}]`;
    }
  }
};

export const extractErrorMessage = (error: any, fallback: string = 'Ocorreu um erro desconhecido'): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  
  // Se for um objeto de erro do JS
  if (error instanceof Error) return error.message;

  // Se for um objeto com propriedade 'message' ou 'error'
  if (error.message && typeof error.message === 'string') return error.message;
  if (error.error) {
    if (typeof error.error === 'string') return error.error;
    if (typeof error.error === 'object') return extractErrorMessage(error.error, fallback);
  }

  // Se for um objeto com 'detail' (comum em APIs Python/FastAPI)
  if (error.detail) {
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
      return error.detail.map((d: any) => {
        if (typeof d === 'string') return d;
        if (d && d.msg) return d.msg;
        return safeStringify(d);
      }).join(', ');
    }
  }

  // Tentar stringificar o objeto se nada mais funcionar
  const stringified = safeStringify(error);
  if (stringified && stringified !== '{}' && stringified !== 'null' && !stringified.startsWith('[Error')) {
    return stringified;
  }

  return fallback;
};


export const generateId = () => Math.random().toString(36).substr(2, 9);

