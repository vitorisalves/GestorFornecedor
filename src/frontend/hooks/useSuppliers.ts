/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { Supplier, Product } from '../types';
import { generateId } from '../utils';

export const useSuppliers = (isAuthReady: boolean, isLoggedIn: boolean) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const cached = localStorage.getItem('cache_suppliers');
    return cached ? JSON.parse(cached) : [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const cached = localStorage.getItem('cache_categories');
    return cached ? JSON.parse(cached) : ['Embalagens', 'Ingredientes', 'Limpeza', 'Escritório', 'Outros'];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;

    setIsLoading(true);
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(data);
      localStorage.setItem('cache_suppliers', JSON.stringify(data));
      
      // If the snapshot is from cache and not a live update, we might still be loading server data
      // but we can hide the loader if we have data to show.
      if (!snapshot.metadata.fromCache || data.length > 0) {
        setIsLoading(false);
      }
      setError(null);
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota');
      if (!isQuota) console.error("Suppliers listener error:", error);
      setError(error.message);
      setIsLoading(false);
      
      // Fallback to local storage if error occurs (like quota exceeded)
      const cached = localStorage.getItem('cache_suppliers');
      if (cached) {
        setSuppliers(JSON.parse(cached));
      }
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => doc.data().name as string);
        setCategories(data);
        localStorage.setItem('cache_categories', JSON.stringify(data));
      }
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota');
      if (!isQuota) console.error("Categories listener error:", error);
      // Fallback to local storage if error occurs
      const cached = localStorage.getItem('cache_categories');
      if (cached) {
        setCategories(JSON.parse(cached));
      }
    });

    return () => {
      unsubSuppliers();
      unsubCategories();
    };
  }, [isAuthReady, isLoggedIn]);

  const saveSupplier = async (supplier: Supplier) => {
    await setDoc(doc(db, 'suppliers', supplier.id), supplier);
  };

  const deleteSupplier = async (id: string) => {
    await deleteDoc(doc(db, 'suppliers', id));
  };

  const deleteAllSuppliers = async () => {
    const q = collection(db, 'suppliers');
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs
      .filter(d => {
        const name = (d.data().name as string || '').trim().toUpperCase();
        return name !== 'MERCADO' && name !== 'MATERIAIS';
      })
      .map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  };

  const addCategory = async (name: string) => {
    const id = generateId();
    await setDoc(doc(db, 'categories', id), { name });
  };

  const deleteCategory = async (name: string) => {
    const q = query(collection(db, 'categories'), where('name', '==', name));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  };

  return {
    suppliers,
    categories,
    isLoading,
    saveSupplier,
    deleteSupplier,
    deleteAllSuppliers,
    addCategory,
    deleteCategory,
    error
  };
};
