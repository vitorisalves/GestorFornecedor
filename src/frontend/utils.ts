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
  
  // Se for um Erro, não tentamos stringificar o objeto todo, apenas pegamos a mensagem
  if (obj instanceof Error) return obj.message;

  const cache = new Set();
  const handleValue = (val: any, depth: number): any => {
    if (depth > maxDepth) return '[Max Depth Reached]';
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    
    // Evitar processar objetos complexos do navegador que costumam ser circulares
    if (val instanceof Node || (typeof window !== 'undefined' && (val === window || val === document))) {
      return '[DOM Object]';
    }

    if (cache.has(val)) return '[Circular]';
    cache.add(val);

    try {
      if (Array.isArray(val)) {
        return val.map(item => handleValue(item, depth + 1));
      }

      const jsonObj: any = {};
      
      // Capturamos propriedades básicas se for um objeto tipo Erro que não herda de Error
      if (val.message && val.stack) {
        return { message: val.message, code: val.code || val.status };
      }

      for (const key of Object.keys(val)) {
        try {
          const value = (val as any)[key];
          jsonObj[key] = handleValue(value, depth + 1);
        } catch (e) {
          jsonObj[key] = '[Unreadable Property]';
        }
      }
      return jsonObj;
    } finally {
      // Opcional: manter na cache para evitar duplicidade no mesmo grafo, 
      // ou remover se quiser permitir o mesmo objeto em ramos diferentes
    }
  };

  try {
    const safeObj = handleValue(obj, 0);
    return JSON.stringify(safeObj);
  } catch (err) {
    return `[Error stringifying: ${err instanceof Error ? err.message : 'Unknown'}]`;
  }
};

export const extractErrorMessage = (error: any, fallback: string = 'Ocorreu um erro desconhecido'): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  
  // Se for um objeto de erro do JS
  if (error instanceof Error) return error.message;

  // Se for resposta de fetch ou algo com status
  if (error.statusText && error.status) {
    return `Erro ${error.status}: ${error.statusText}`;
  }

  // Se for um objeto com propriedade 'message' ou 'error'
  if (error.message && typeof error.message === 'string') return error.message;
  if (error.error) {
    if (typeof error.error === 'string') return error.error;
    if (typeof error.error === 'object') return extractErrorMessage(error.error, fallback);
  }

  // Tratamento específico para erros do Gemini/Google AI
  if (error.stack && error.message) return error.message;

  // Se for um objeto com 'detail' (comum em APIs Python/FastAPI)
  if (error.detail) {
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
      return error.detail.map((d: any) => {
        if (typeof d === 'string') return d;
        if (d && d.msg) return d.msg;
        return typeof d === 'object' ? d.message || 'Erro no item' : String(d);
      }).join(', ');
    }
  }

  // Tentar stringificar o objeto de forma segura se nada mais funcionar
  try {
    const stringified = safeStringify(error);
    if (stringified && stringified !== '{}' && stringified !== 'null' && !stringified.startsWith('[Error')) {
      return stringified;
    }
  } catch (e) {
    return fallback;
  }

  return fallback;
};


export const generateId = () => Math.random().toString(36).substr(2, 9);

export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

