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
      return error.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    }
  }

  // Tentar stringificar o objeto se nada mais funcionar, mas evitando o padrão [object Object]
  try {
    const stringified = JSON.stringify(error);
    if (stringified !== '{}') return stringified;
  } catch (e) {
    // ignorar erro de stringificação
  }

  return fallback;
};


export const generateId = () => Math.random().toString(36).substr(2, 9);

