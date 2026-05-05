/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ExternalProduct } from '../types';
import { extractErrorMessage } from '../utils';

export const useOmie = (currentPage: string) => {
  const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>([]);
  const [isSyncingExternal, setIsSyncingExternal] = useState(false);
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [apiHealth, setApiHealth] = useState<{ status: string; env_set: boolean; external_api?: string } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [wakeUpMessage, setWakeUpMessage] = useState('');

  const checkApiHealth = async () => {
    setIsCheckingHealth(true);
    try {
      // Usamos um AbortController com timeout de 15s para dar tempo ao servidor de responder
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setApiHealth(data);
        return data;
      } else {
        setApiHealth({ status: 'error', env_set: false });
      }
    } catch (error) {
      setApiHealth({ status: 'offline', env_set: false });
    } finally {
      setIsCheckingHealth(false);
    }
    return null;
  };

  const wakeUpApi = async (): Promise<boolean> => {
    if (isWakingUp) return false;
    
    setIsWakingUp(true);
    setWakeUpMessage('Iniciando conexão com o servidor...');
    
    const startTime = Date.now();
    const MAX_ATTEMPTS = 20; // ~40-60 segundos total
    let attempt = 0;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const elapsed = (Date.now() - startTime) / 1000;
      
      if (elapsed > 30) {
        setWakeUpMessage('Quase lá... Servidores gratuitos podem ser lentos para acordar.');
      } else if (elapsed > 15) {
        setWakeUpMessage('O servidor está sendo ativado (Render.com)...');
      } else if (elapsed > 5) {
        setWakeUpMessage('Enviando sinal de ativação...');
      }

      try {
        const health = await checkApiHealth();
        if (health && health.external_api === 'online') {
          setWakeUpMessage('Conexão Estabelecida!');
          setTimeout(() => setIsWakingUp(false), 1000);
          return true;
        }
      } catch (e) {
        // Silently retry
      }

      // Espera 3 segundos entre tentativas
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    setIsWakingUp(false);
    setWakeUpMessage('Tempo limite atingido. Tente novamente.');
    return false;
  };

  const triggerOmieSync = async (addNotification: any) => {
    if (isWakingUp) return;
    
    const isOnline = apiHealth?.external_api === 'online';
    if (!isOnline) {
      const wokeUp = await wakeUpApi();
      if (!wokeUp) {
        addNotification('Não foi possível acordar o servidor. Tente novamente.', 0);
        return;
      }
    }

    setIsTriggeringSync(true);
    try {
      const response = await fetch('/api/v1/omie/sync/products', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      let responseData: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`Erro do servidor (${response.status}): ${text.substring(0, 100)}`);
        }
        throw new Error('O servidor não retornou um JSON válido');
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(responseData, 'Erro ao disparar sincronização'));
      }
      
      addNotification('Sincronização disparada! Aguarde o processamento...', 0);
      setTimeout(fetchExternalProducts, 5000);
    } catch (error) {
      console.error('Erro ao disparar sync:', extractErrorMessage(error));
      addNotification(extractErrorMessage(error, 'Erro ao disparar sync'), 0);
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const fetchExternalProducts = async (addNotification?: any) => {
    if (isWakingUp) return;
    
    const isOnline = apiHealth?.external_api === 'online';
    if (!isOnline) {
      const wokeUp = await wakeUpApi();
      if (!wokeUp) {
        if (addNotification) addNotification('O servidor externo está inacessível no momento.', 0);
        return;
      }
    }

    setIsSyncingExternal(true);
    try {
      const url = `/api/omie-direct/products`;
      const response = await fetch(url);
      
      let responseData: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`Erro do servidor (${response.status}): ${text.substring(0, 100)}`);
        }
        throw new Error('O servidor não retornou um JSON válido');
      }
      
      if (!response.ok) {
        throw new Error(extractErrorMessage(responseData, 'Erro ao buscar produtos'));
      }
      
      const result = responseData;
      let products = result.data || result || [];
      
      setExternalProducts(Array.isArray(products) ? products : []);
      
      if (addNotification) {
        if (products.length > 0) {
          addNotification('Produtos carregados!', products.length);
        } else {
          addNotification('Nenhum produto encontrado na API.', 0);
        }
      }
    } catch (error) {
      console.error('Erro CRÍTICO no fetchExternalProducts:', extractErrorMessage(error));
      if (addNotification) {
        addNotification(extractErrorMessage(error, 'Erro fatal ao buscar produtos'), 0);
      }
    } finally {
      setIsSyncingExternal(false);
    }
  };

  useEffect(() => {
    if (currentPage === 'omie') {
      checkApiHealth();
      if (externalProducts.length === 0) {
        fetchExternalProducts();
      }
    }
    
    // Auto-refresh every 15 minutes if on Omie page
    let interval: any;
    if (currentPage === 'omie') {
      interval = setInterval(() => {
        console.log('🔄 Auto-refreshing Omie products (15min)...');
        fetchExternalProducts();
        checkApiHealth();
      }, 15 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentPage]);

  return {
    externalProducts,
    isSyncingExternal,
    isTriggeringSync,
    apiHealth,
    isCheckingHealth,
    isWakingUp,
    wakeUpMessage,
    triggerOmieSync,
    fetchExternalProducts,
    checkApiHealth
  };
};
