/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc, limit } from 'firebase/firestore';
import { Product, SavedList } from '../types';

export const useCart = (
  isAuthReady: boolean, 
  isLoggedIn: boolean, 
  loggedName: string,
  addAppNotification: (title: string, message: string) => void
) => {
  const [cart, setCart] = useState<(Product & { supplierName: string; quantity: number })[]>(() => {
    const cached = localStorage.getItem('cache_cart');
    return cached ? JSON.parse(cached) : [];
  });
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => {
    const cached = localStorage.getItem('cache_savedLists');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    localStorage.setItem('cache_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return;

    // Restoring real-time synchronization with onSnapshot
    // limited to 20 items to balance performance and user experience.
    const q = query(
      collection(db, 'shopping_lists'), 
      orderBy('date', 'desc'), 
      limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedList[];
      setSavedLists(lists);
      localStorage.setItem('cache_savedLists', JSON.stringify(lists));
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('resource-exhausted');
      if (!isQuota) console.error("Shopping lists listener error:", error);
      const cached = localStorage.getItem('cache_savedLists');
      if (cached) setSavedLists(JSON.parse(cached));
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

  const addItemToList = async (listId: string, product: Product, supplierName: string, quantity: number) => {
    const list = savedLists.find(l => l.id === listId);
    if (!list) return;

    const existingItemIndex = list.items.findIndex(item => item.name === product.name && item.supplierName === supplierName);
    let updatedItems = [...list.items];

    if (existingItemIndex !== -1) {
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity
      };
    } else {
      updatedItems.push({
        ...product,
        supplierName,
        quantity,
        bought: false
      });
    }

    const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const newDate = new Date().toISOString();
    
    await updateDoc(doc(db, 'shopping_lists', listId), { 
      items: updatedItems,
      total: newTotal,
      date: newDate
    });

    addAppNotification('Lista Atualizada', `O produto "${product.name}" foi adicionado à lista "${list.name}".`);
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
    deleteSavedList,
    addItemToList
  };
};
