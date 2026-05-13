/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { DeliveredProduct } from '../types';
import { extractErrorMessage, handleFirestoreError, OperationType, cleanObject } from '../utils';

export function useDeliveredProducts(
  isAuthReady: boolean, 
  isApproved: boolean, 
  addAppNotification?: (title: string, message: string) => void
) {
  const [deliveredProducts, setDeliveredProducts] = useState<DeliveredProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notifiedRefs = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthReady || !isApproved) return;

    setIsLoading(true);
    const q = query(collection(db, 'delivered_products'), orderBy('purchaseDate', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DeliveredProduct));
      setDeliveredProducts(docs);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'delivered_products');
      console.error("Firestore Error (delivered_products):", err);
      setError(extractErrorMessage(err));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, isApproved]);

  useEffect(() => {
    if (!addAppNotification || deliveredProducts.length === 0) return;

    deliveredProducts.forEach(p => {
      if (!p.delivered && p.forecastDate && !notifiedRefs.current.has(p.id)) {
        try {
          const parts = p.forecastDate.split('/');
          if (parts.length === 3) {
            const [day, month, year] = parts.map(Number);
            const forecast = new Date(year, month - 1, day, 23, 59, 59);
            if (forecast < new Date()) {
              addAppNotification(
                'Entrega Atrasada!',
                `O produto "${p.name}" do fornecedor ${p.supplierName} está com a entrega atrasada (Previsão: ${p.forecastDate}).`
              );
              notifiedRefs.current.add(p.id);
            }
          }
        } catch (e) {
          console.error("Error checking notification for delay:", e);
        }
      }
    });
  }, [deliveredProducts, addAppNotification]);

  const saveDeliveredProduct = useCallback(async (product: DeliveredProduct) => {
    try {
      const docRef = doc(db, 'delivered_products', product.id);
      const cleanedData = cleanObject(product);
      await setDoc(docRef, cleanedData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `delivered_products/${product.id}`);
      console.error("Error saving delivered product:", err);
      throw err;
    }
  }, []);

  const deleteDeliveredProduct = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'delivered_products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `delivered_products/${id}`);
      console.error("Error deleting delivered product:", err);
      throw err;
    }
  }, []);

  const toggleDeliveryStatus = useCallback(async (id: string) => {
    const product = deliveredProducts.find(p => p.id === id);
    if (!product) return;

    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const formattedDate = `${day}/${month}/${now.getFullYear()}`;

    let deliveryTimeDays: number | undefined = undefined;

    if (!product.delivered) {
      try {
        const [d, m, y] = product.purchaseDate.split('/').map(Number);
        const purchaseDate = new Date(y, m - 1, d);
        
        // Reset both to midnight for clean day calculation
        const date1 = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate());
        const date2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        deliveryTimeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } catch (e) {
        console.error("Error calculating delivery time:", e);
      }
    }

    const updatedProduct: DeliveredProduct = {
      ...product,
      delivered: !product.delivered,
    };

    if (updatedProduct.delivered) {
      updatedProduct.deliveryDate = formattedDate;
      if (deliveryTimeDays !== undefined) {
        updatedProduct.deliveryTimeDays = deliveryTimeDays;
      }
    } else {
      updatedProduct.deliveryDate = undefined;
      updatedProduct.deliveryTimeDays = undefined;
    }

    await saveDeliveredProduct(updatedProduct);
  }, [deliveredProducts, saveDeliveredProduct]);

  const updatePurchaseDate = useCallback(async (id: string, newDate: string) => {
    const product = deliveredProducts.find(p => p.id === id);
    if (!product) return;

    const updatedProduct: DeliveredProduct = {
      ...product,
      purchaseDate: newDate
    };

    await saveDeliveredProduct(updatedProduct);
  }, [deliveredProducts, saveDeliveredProduct]);

  const updateForecastDate = useCallback(async (id: string, newDate: string) => {
    const product = deliveredProducts.find(p => p.id === id);
    if (!product) return;

    const updatedProduct: DeliveredProduct = {
      ...product,
      forecastDate: newDate
    };

    await saveDeliveredProduct(updatedProduct);
  }, [deliveredProducts, saveDeliveredProduct]);

  const updateDeliveredQuantity = useCallback(async (name: string, supplierName: string, newQuantity: number) => {
    const productsToUpdate = deliveredProducts.filter(p => p.name === name && p.supplierName === supplierName && !p.delivered);
    
    for (const p of productsToUpdate) {
      await saveDeliveredProduct({ ...p, quantity: newQuantity });
    }
  }, [deliveredProducts, saveDeliveredProduct]);

  return {
    deliveredProducts,
    isLoading,
    error,
    saveDeliveredProduct,
    deleteDeliveredProduct,
    toggleDeliveryStatus,
    updatePurchaseDate,
    updateForecastDate,
    updateDeliveredQuantity
  };
}
