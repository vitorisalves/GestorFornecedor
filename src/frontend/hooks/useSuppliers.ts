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

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Use one-time fetch instead of onSnapshot to save continuous reads
        const supplierSnapshot = await getDocs(collection(db, 'suppliers'));
        const suppliersData = supplierSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(suppliersData);
        localStorage.setItem('cache_suppliers', JSON.stringify(suppliersData));

        const categorySnapshot = await getDocs(collection(db, 'categories'));
        if (!categorySnapshot.empty) {
          const categoriesData = categorySnapshot.docs.map(doc => doc.data().name as string);
          setCategories(categoriesData);
          localStorage.setItem('cache_categories', JSON.stringify(categoriesData));
        }
      } catch (err: any) {
        const isQuota = err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('resource-exhausted');
        if (!isQuota) console.error("Data fetch error:", err);
        setError(err.message);
        
        // Fallback to cache on error
        const cachedSuppliers = localStorage.getItem('cache_suppliers');
        if (cachedSuppliers) setSuppliers(JSON.parse(cachedSuppliers));
        
        const cachedCategories = localStorage.getItem('cache_categories');
        if (cachedCategories) setCategories(JSON.parse(cachedCategories));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthReady, isLoggedIn]);

  const refreshData = async () => {
    if (!isAuthReady || !isLoggedIn) return;
    setIsLoading(true);
    try {
      const supplierSnapshot = await getDocs(collection(db, 'suppliers'));
      const suppliersData = supplierSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(suppliersData);
      localStorage.setItem('cache_suppliers', JSON.stringify(suppliersData));
    } finally {
      setIsLoading(false);
    }
  };

  const saveSupplier = async (supplier: Supplier) => {
    await setDoc(doc(db, 'suppliers', supplier.id), supplier);
    // Optimistic update
    setSuppliers(prev => {
      const index = prev.findIndex(s => s.id === supplier.id);
      if (index !== -1) {
        const next = [...prev];
        next[index] = supplier;
        return next;
      }
      return [...prev, supplier];
    });
  };

  const deleteSupplier = async (id: string) => {
    await deleteDoc(doc(db, 'suppliers', id));
    setSuppliers(prev => prev.filter(s => s.id !== id));
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
    refreshData,
    saveSupplier,
    deleteSupplier,
    deleteAllSuppliers,
    addCategory,
    deleteCategory,
    error
  };
};
