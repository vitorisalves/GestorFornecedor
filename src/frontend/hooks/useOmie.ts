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
  const [managedProducts, setManagedProducts] = useState<any[]>([]);
  const [isFetchingManaged, setIsFetchingManaged] = useState(false);

  const triggerOmieSync = async (addNotification: any) => {
    setIsTriggeringSync(true);
    try {
      const response = await fetch('/api/v1/omie/sync/products', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(extractErrorMessage(errorData, 'Erro ao disparar sincronização'));
      }
      
      addNotification('Sincronização disparada! Aguarde o processamento...', 0);
      setTimeout(fetchExternalProducts, 5000);
    } catch (error) {
      console.error('Erro ao disparar sync:', error);
      addNotification(extractErrorMessage(error, 'Erro ao disparar sync'), 0);
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const fetchExternalProducts = async (addNotification?: any) => {
    setIsSyncingExternal(true);
    try {
      const url = `/api/omie-direct/products`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(extractErrorMessage(errorData, 'Erro ao buscar produtos'));
      }
      
      const result = await response.json();
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
      console.error('Erro CRÍTICO no fetchExternalProducts:', error);
      if (addNotification) {
        addNotification(extractErrorMessage(error, 'Erro fatal ao buscar produtos'), 0);
      }
    } finally {
      setIsSyncingExternal(false);
    }
  };

  const fetchManagedProducts = async () => {
    setIsFetchingManaged(true);
    try {
      const response = await fetch('/api/v1/products');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(extractErrorMessage(errorData, 'Erro ao buscar produtos gerenciados'));
      }
      const result = await response.json();
      const data = result.data || result;
      setManagedProducts(Array.isArray(data) ? data : (data.products || []));
    } catch (error) {
      console.error('Erro ao buscar gerenciados:', error);
    } finally {
      setIsFetchingManaged(false);
    }
  };

  const addToManager = async (codigo: any, addNotification: any) => {
    try {
      const body: any = {};
      if (codigo && !isNaN(Number(codigo))) {
        body.productId = Number(codigo);
        body.codigo_produto = Number(codigo);
      } else {
        body.productId = codigo;
        body.codigo_produto = codigo;
      }

      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(extractErrorMessage(errorData, 'Erro ao adicionar'));
      }
      
      addNotification('Produto adicionado ao gerenciador!', 1);
      fetchManagedProducts();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
      addNotification(extractErrorMessage(error, 'Erro ao adicionar'), 0);
    }
  };

  useEffect(() => {
    if (currentPage === 'omie' && externalProducts.length === 0) {
      fetchExternalProducts();
    }
  }, [currentPage]);

  return {
    externalProducts,
    isSyncingExternal,
    isTriggeringSync,
    managedProducts,
    isFetchingManaged,
    triggerOmieSync,
    fetchExternalProducts,
    fetchManagedProducts,
    addToManager
  };
};
