/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
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
import { extractErrorMessage, handleFirestoreError, OperationType } from '../utils';

export function useDeliveredProducts(isAuthReady: boolean, isApproved: boolean) {
  const [deliveredProducts, setDeliveredProducts] = useState<DeliveredProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const saveDeliveredProduct = useCallback(async (product: DeliveredProduct) => {
    try {
      const docRef = doc(db, 'delivered_products', product.id);
      await setDoc(docRef, product);
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

    const updatedProduct: DeliveredProduct = {
      ...product,
      delivered: !product.delivered,
      deliveryDate: !product.delivered ? formattedDate : undefined
    };

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

  return {
    deliveredProducts,
    isLoading,
    error,
    saveDeliveredProduct,
    deleteDeliveredProduct,
    toggleDeliveryStatus,
    updatePurchaseDate
  };
}
