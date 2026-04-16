/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Product, SavedList } from '../types';

export const useCart = (isAuthReady: boolean, isLoggedIn: boolean, loggedName: string) => {
  const [cart, setCart] = useState<(Product & { supplierName: string; quantity: number })[]>([]);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);

  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;

    const q = query(collection(db, 'shopping_lists'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedList[];
      setSavedLists(lists);
    });

    return () => unsub();
  }, [isAuthReady, isLoggedIn]);

  const addToCart = (product: Product, supplierName: string, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.name === product.name && item.supplierName === supplierName);
      if (existing) {
        return prev.map(item => 
          item.name === product.name && item.supplierName === supplierName 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, supplierName, quantity }];
    });
  };

  const updateCartQuantity = (name: string, supplierName: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.name === name && item.supplierName === supplierName) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (name: string, supplierName: string) => {
    setCart(prev => prev.filter(item => !(item.name === name && item.supplierName === supplierName)));
  };

  const clearCart = () => setCart([]);

  const finalizeList = async (listName: string, editingListId: string | null = null) => {
    if (cart.length === 0) return null;

    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const listData = {
      name: listName,
      date: new Date().toISOString(),
      items: cart.map(item => ({ ...item, bought: !!(item as any).bought })),
      total,
      createdBy: loggedName
    };

    if (editingListId) {
      await updateDoc(doc(db, 'shopping_lists', editingListId), listData);
      clearCart();
      return { id: editingListId, ...listData };
    } else {
      const docRef = await addDoc(collection(db, 'shopping_lists'), listData);
      clearCart();
      return { id: docRef.id, ...listData };
    }
  };

  const toggleSavedListItemBought = async (listId: string, productName: string, supplierName: string) => {
    const list = savedLists.find(l => l.id === listId);
    if (!list) return;

    const updatedItems = list.items.map(item => {
      if (item.name === productName && item.supplierName === supplierName) {
        return { ...item, bought: !item.bought };
      }
      return item;
    });

    await updateDoc(doc(db, 'shopping_lists', listId), { items: updatedItems });
  };

  const deleteSavedList = async (id: string) => {
    await deleteDoc(doc(db, 'shopping_lists', id));
  };

  return {
    cart,
    setCart,
    savedLists,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    finalizeList,
    toggleSavedListItemBought,
    deleteSavedList
  };
};
