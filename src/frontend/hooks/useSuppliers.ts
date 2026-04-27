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
    const suppliersCollection = collection(db, 'suppliers');
    const categoriesCollection = collection(db, 'categories');

    // Listener para Fornecedores
    const unsubSuppliers = onSnapshot(suppliersCollection, (snapshot) => {
      const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(suppliersData);
      localStorage.setItem('cache_suppliers', JSON.stringify(suppliersData));
      setIsLoading(false);
      setError(null);
    }, (err: any) => {
      const isQuota = err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('resource-exhausted');
      if (!isQuota) console.error("Suppliers sync error:", err);
      setError(err.message);
      setIsLoading(false);
    });

    // Listener para Categorias
    const unsubCategories = onSnapshot(categoriesCollection, (snapshot) => {
      if (!snapshot.empty) {
        const categoriesData = snapshot.docs.map(doc => doc.data().name as string);
        setCategories(categoriesData);
        localStorage.setItem('cache_categories', JSON.stringify(categoriesData));
      }
    });

    return () => {
      unsubSuppliers();
      unsubCategories();
    };
  }, [isAuthReady, isLoggedIn]);

  const refreshData = async () => {
    // onSnapshot já lida com o "refresh" automático, mas mantemos para compatibilidade
    setError(null);
  };

  const saveSupplier = async (supplier: Supplier) => {
    // Optimistic update
    setSuppliers(prev => {
      const index = prev.findIndex(s => s.id === supplier.id);
      const next = [...prev];
      if (index !== -1) {
        next[index] = supplier;
      } else {
        next.push(supplier);
      }
      localStorage.setItem('cache_suppliers', JSON.stringify(next));
      return next;
    });

    try {
      await setDoc(doc(db, 'suppliers', supplier.id), supplier);
    } catch (err: any) {
      console.warn("Cloud sync failed (could be quota):", err.message);
      // We keep the local state so the user can continue working
    }
  };

  const deleteSupplier = async (id: string) => {
    // Optimistic update
    setSuppliers(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('cache_suppliers', JSON.stringify(next));
      return next;
    });

    try {
      await deleteDoc(doc(db, 'suppliers', id));
    } catch (err: any) {
      console.warn("Cloud delete failed:", err.message);
    }
  };

  const deleteAllSuppliers = async () => {
    // Target filtered list for optimistic update matching the backend logic
    setSuppliers(prev => {
      const next = prev.filter(s => {
        const name = (s.name || '').trim().toUpperCase();
        return name === 'MERCADO' || name === 'MATERIAIS';
      });
      localStorage.setItem('cache_suppliers', JSON.stringify(next));
      return next;
    });

    try {
      const q = collection(db, 'suppliers');
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs
        .filter(d => {
          const name = (d.data().name as string || '').trim().toUpperCase();
          return name !== 'MERCADO' && name !== 'MATERIAIS';
        })
        .map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (err: any) {
      console.warn("Cloud batch delete failed:", err.message);
    }
  };

  const addCategory = async (name: string) => {
    if (categories.includes(name)) return;
    
    // Optimistic update
    setCategories(prev => {
      const next = [...prev, name];
      localStorage.setItem('cache_categories', JSON.stringify(next));
      return next;
    });

    try {
      const id = generateId();
      await setDoc(doc(db, 'categories', id), { name });
    } catch (err: any) {
      console.warn("Cloud category add failed:", err.message);
    }
  };

  const deleteCategory = async (name: string) => {
    // Optimistic update
    setCategories(prev => {
      const next = prev.filter(c => c !== name);
      localStorage.setItem('cache_categories', JSON.stringify(next));
      return next;
    });

    try {
      const q = query(collection(db, 'categories'), where('name', '==', name));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (err: any) {
       console.warn("Cloud category delete failed:", err.message);
    }
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
