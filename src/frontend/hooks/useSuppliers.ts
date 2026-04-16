/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Supplier, Product } from '../types';
import { generateId } from '../utils';

export const useSuppliers = (isAuthReady: boolean, isLoggedIn: boolean) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<string[]>(['Embalagens', 'Ingredientes', 'Limpeza', 'Escritório', 'Outros']);

  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Supplier);
      setSuppliers(data);
    }, (error) => {
      console.error("Suppliers listener error:", error);
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => doc.data().name as string);
        setCategories(data);
      }
    }, (error) => {
      console.error("Categories listener error:", error);
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

  const addCategory = async (name: string) => {
    const id = generateId();
    await setDoc(doc(db, 'categories', id), { name });
  };

  return {
    suppliers,
    categories,
    saveSupplier,
    deleteSupplier,
    addCategory
  };
};
