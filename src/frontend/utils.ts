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

export const safeStringify = (obj: any, maxDepth: number = 3): string => {
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return String(obj);
  
  try {
    return JSON.stringify(obj);
  } catch (err) {
    const cache = new Set();
    const handleValue = (val: any, depth: number): any => {
      if (depth > maxDepth) return '[Max Depth Reached]';
      if (typeof val !== 'object' || val === null) return val;
      
      if (cache.has(val)) return '[Circular]';
      cache.add(val);

      if (Array.isArray(val)) {
        return val.map(item => handleValue(item, depth + 1));
      }

      const jsonObj: any = {};
      // Se tiver toJSON, tentamos usar, mas com cuidado
      if (typeof val.toJSON === 'function') {
        try {
          const jsonValue = val.toJSON();
          if (typeof jsonValue !== 'object' || jsonValue === null) return jsonValue;
          // Se toJSON retornou um objeto, processamos ele de forma recursiva e segura
          // Mas remover da cache primeiro para permitir que toJSON retorne uma nova estrutura
          cache.delete(val); 
          return handleValue(jsonValue, depth + 1);
        } catch (e) {
          return `[Error in toJSON: ${e instanceof Error ? e.message : 'Unknown'}]`;
        }
      }

      for (const [key, value] of Object.entries(val)) {
        jsonObj[key] = handleValue(value, depth + 1);
      }
      return jsonObj;
    };

    try {
      const safeObj = handleValue(obj, 0);
      return JSON.stringify(safeObj);
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

