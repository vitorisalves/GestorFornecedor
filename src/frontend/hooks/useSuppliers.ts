/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { Supplier, Product } from '../types';
import { generateId, extractErrorMessage, safeStringify, handleFirestoreError, OperationType, cleanObject } from '../utils';

export const useSuppliers = (isAuthReady: boolean, isApproved: boolean) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const cached = localStorage.getItem('cache_suppliers');
    return cached ? JSON.parse(cached) : [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const cached = localStorage.getItem('cache_categories');
    return cached ? JSON.parse(cached) : ['Embalagens', 'Ingredientes', 'Limpeza', 'Escritório', 'Fornecedor'];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (force: boolean = false) => {
    if (!isAuthReady || !isApproved) {
      setIsLoading(false);
      return;
    }

    const cacheDuration = 30 * 1000 * 60; // 30 minutes cache for extreme database load optimization
    const lastFetch = localStorage.getItem('suppliers_last_fetch');
    const cachedSuppliers = localStorage.getItem('cache_suppliers');
    const cachedCategories = localStorage.getItem('cache_categories');
    const now = Date.now();

    if (!force && lastFetch && cachedSuppliers && (now - Number(lastFetch)) < cacheDuration) {
      setSuppliers(JSON.parse(cachedSuppliers));
      if (cachedCategories) {
        setCategories(JSON.parse(cachedCategories));
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let suppliersData: Supplier[] = [];
      let categoriesData: string[] = [];

      try {
        const [suppRes, catRes] = await Promise.all([
          fetch('/api/xml/suppliers'),
          fetch('/api/xml/categories')
        ]);

        if (suppRes.ok && catRes.ok) {
          const sData = await suppRes.json();
          suppliersData = sData as Supplier[];
          
          const cData = await catRes.json();
          categoriesData = cData.map((d: any) => d.name as string);
        } else {
          throw new Error("Backend caching routes failed, resorting to client SDK fallback");
        }
      } catch (backendErr) {
        console.warn("Backend suppliers/categories cache failed, falling back to client-side Firestore SDK:", backendErr);
        
        const suppliersCollection = collection(db, 'suppliers');
        const categoriesCollection = collection(db, 'categories');

        const [suppSnap, catSnap] = await Promise.all([
          getDocs(suppliersCollection),
          getDocs(categoriesCollection)
        ]);

        suppliersData = suppSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));

        if (!catSnap.empty) {
          categoriesData = catSnap.docs.map(doc => doc.data().name as string);
        } else {
          categoriesData = ['Embalagens', 'Ingredientes', 'Limpeza', 'Escritório', 'Fornecedor'];
        }
      }

      setSuppliers(suppliersData);
      localStorage.setItem('cache_suppliers', safeStringify(suppliersData));

      if (categoriesData.length > 0) {
        setCategories(categoriesData);
        localStorage.setItem('cache_categories', safeStringify(categoriesData));
      }

      localStorage.setItem('suppliers_last_fetch', String(now));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, 'suppliers/categories');
      if (cachedSuppliers) setSuppliers(JSON.parse(cachedSuppliers));
      if (cachedCategories) setCategories(JSON.parse(cachedCategories));
      
      const isQuota = err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('resource-exhausted');
      if (!isQuota) setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [isAuthReady, isApproved]);

  const refreshData = async () => {
    await loadData(true);
  };

  const invalidateBackendCache = async (collectionName: string) => {
    try {
      await fetch('/api/xml/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionName })
      });
    } catch (err) {
      console.warn("Backend cache invalidation failed:", err);
    }
  };

  const saveSupplier = async (supplier: Supplier) => {
    // Garantir que temos um ID
    const sanitizedSupplier = {
      ...supplier,
      id: supplier.id || generateId()
    };

    // Optimistic update
    setSuppliers(prev => {
      const index = prev.findIndex(s => s.id === sanitizedSupplier.id);
      const next = [...prev];
      if (index !== -1) {
        next[index] = sanitizedSupplier;
      } else {
        next.push(sanitizedSupplier);
      }
      localStorage.setItem('cache_suppliers', safeStringify(next));
      return next;
    });

    try {
      const cleaned = cleanObject(sanitizedSupplier);
      await setDoc(doc(db, 'suppliers', sanitizedSupplier.id), cleaned);
      await invalidateBackendCache('suppliers');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `suppliers/${sanitizedSupplier.id}`);
      console.warn("Cloud sync failed (could be quota):", err.message);
      // We keep the local state so the user can continue working
    }
  };

  const deleteSupplier = async (id: string) => {
    // Optimistic update
    setSuppliers(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('cache_suppliers', safeStringify(next));
      return next;
    });

    try {
      await deleteDoc(doc(db, 'suppliers', id));
      await invalidateBackendCache('suppliers');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
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
      localStorage.setItem('cache_suppliers', safeStringify(next));
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
      await invalidateBackendCache('suppliers');
    } catch (err: any) {
      console.warn("Cloud batch delete failed:", err.message);
    }
  };

  const addCategory = async (name: string) => {
    if (categories.includes(name)) return;
    
    // Optimistic update
    setCategories(prev => {
      const next = [...prev, name];
      localStorage.setItem('cache_categories', safeStringify(next));
      return next;
    });

    try {
      const id = generateId();
      await setDoc(doc(db, 'categories', id), { name });
      await invalidateBackendCache('categories');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `categories/${name}`);
      console.warn("Cloud category add failed:", err.message);
    }
  };

  const deleteCategory = async (name: string) => {
    // Optimistic update
    setCategories(prev => {
      const next = prev.filter(c => c !== name);
      localStorage.setItem('cache_categories', safeStringify(next));
      return next;
    });

    try {
      const q = query(collection(db, 'categories'), where('name', '==', name));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      await invalidateBackendCache('categories');
    } catch (err: any) {
       handleFirestoreError(err, OperationType.DELETE, `categories/${name}`);
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
