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
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const extractErrorMessage = (error: any, fallback: string = 'Ocorreu um erro desconhecido'): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return fallback;
};


export const generateId = () => Math.random().toString(36).substr(2, 9);

